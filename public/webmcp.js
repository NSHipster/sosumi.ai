(function () {
  const ctx =
    (typeof navigator !== "undefined" && navigator.modelContext) || document.modelContext
  if (!ctx) return
  if (typeof ctx.registerTool !== "function" && typeof ctx.provideContext !== "function") return

  // A tool with an output schema resolves with the parsed JSON response, which conforms to it.
  // Other tools resolve with a `CallToolResult` that holds the response text.
  // Either way, a failure resolves with an MCP `CallToolResult` error,
  // because WebMCP does not pass the reason for a rejected promise to the agent.
  async function runHttpTool(http, input, structured) {
    let pathname = http.path
    if (http.pathFrom) {
      const value = String(input[http.pathFrom] ?? "")
      if (http.pathPrefix) {
        pathname = http.pathPrefix + value.replace(/^\//, "")
      } else {
        pathname = value.startsWith("/") ? value : "/" + value
      }
    }
    const url = new URL(pathname, location.origin)
    if (http.query) {
      for (const [param, key] of Object.entries(http.query)) {
        url.searchParams.set(param, String(input[key] ?? ""))
      }
    }
    let response
    let body
    try {
      response = await fetch(url, { headers: { Accept: "application/json" } })
      body = await response.text()
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      return errorResult(`Request to Sosumi failed: ${reason}`)
    }
    let data
    try {
      data = JSON.parse(body)
    } catch {
      data = body
    }
    const text =
      data && typeof data === "object" && data !== null && "content" in data
        ? String(data.content)
        : typeof data === "string"
          ? data
          : JSON.stringify(data, null, 2)
    // Follow the MCP `CallToolResult` shape, so that an agent can tell a failure from a result.
    if (!response.ok) return errorResult(text)
    if (structured) {
      if (data && typeof data === "object") return data
      return errorResult(`Sosumi returned a response that is not JSON: ${text}`)
    }
    return { content: [{ type: "text", text }] }
  }

  function errorResult(text) {
    return { isError: true, content: [{ type: "text", text }] }
  }

  function registerTool(tool) {
    const registration = {
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: { readOnlyHint: tool.readOnly },
      execute: (input) => runHttpTool(tool.http, input, Boolean(tool.outputSchema)),
    }
    if (tool.outputSchema) registration.outputSchema = tool.outputSchema
    try {
      if (typeof ctx.registerTool === "function") {
        ctx.registerTool(registration)
      } else if (typeof ctx.provideContext === "function") {
        ctx.provideContext({ tools: [registration] })
      }
    } catch {
      // Ignore duplicate or unsupported registrations.
    }
  }

  fetch("/webmcp/manifest.json")
    .then((response) => {
      if (!response.ok) throw new Error("Failed to load WebMCP manifest")
      return response.json()
    })
    .then((tools) => {
      for (const tool of tools) {
        registerTool(tool)
      }
    })
    .catch(() => {})
})()
