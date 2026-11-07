declare module "cloudflare:test" {
  // ProvidedEnv controls the type of `import("cloudflare:test").env`
  interface ProvidedEnv extends Env {}

  export const SELF: Fetcher
  export const env: ProvidedEnv
  export function createExecutionContext(): ExecutionContext
  export function waitOnExecutionContext(ctx: ExecutionContext): Promise<void>
}

declare module "*?raw" {
  const content: string
  export default content
}
