/** biome-ignore-all lint/suspicious/noExplicitAny: test fixtures */
import { describe, expect, it } from "vitest"
import { renderFromJSON } from "../src/lib/reference"
import { applyVariantOverrides } from "../src/lib/reference/variants"

describe("applyVariantOverrides", () => {
  it("returns input unchanged when no language is given", () => {
    const data = {
      metadata: { title: "X" },
      variantOverrides: [
        { traits: [{ interfaceLanguage: "occ" }], patch: [{ op: "replace", path: "/metadata/title", value: "Y" }] },
      ],
    } as any
    expect(applyVariantOverrides(data).metadata.title).toBe("X")
  })

  it("returns input unchanged when no matching override exists", () => {
    const data = {
      metadata: { title: "X" },
      variantOverrides: [
        { traits: [{ interfaceLanguage: "swift" }], patch: [{ op: "replace", path: "/metadata/title", value: "Y" }] },
      ],
    } as any
    expect(applyVariantOverrides(data, "objc").metadata.title).toBe("X")
  })

  it("maps objc → occ trait and applies replace ops", () => {
    const data = {
      metadata: { title: "Swift Title" },
      variantOverrides: [
        {
          traits: [{ interfaceLanguage: "occ" }],
          patch: [{ op: "replace", path: "/metadata/title", value: "Objc Title" }],
        },
      ],
    } as any
    expect(applyVariantOverrides(data, "objc").metadata.title).toBe("Objc Title")
  })

  it("does not mutate the input", () => {
    const data = {
      metadata: { title: "Swift Title" },
      variantOverrides: [
        {
          traits: [{ interfaceLanguage: "occ" }],
          patch: [{ op: "replace", path: "/metadata/title", value: "Objc Title" }],
        },
      ],
    } as any
    applyVariantOverrides(data, "objc")
    expect(data.metadata.title).toBe("Swift Title")
  })

  it("applies add op to objects and arrays", () => {
    const data = {
      tags: ["a"],
      variantOverrides: [
        {
          traits: [{ interfaceLanguage: "occ" }],
          patch: [
            { op: "add", path: "/extra", value: "new-field" },
            { op: "add", path: "/tags/-", value: "b" },
            { op: "add", path: "/tags/0", value: "z" },
          ],
        },
      ],
    } as any
    const result = applyVariantOverrides(data, "objc")
    expect(result.extra).toBe("new-field")
    expect(result.tags).toEqual(["z", "a", "b"])
  })

  it("applies remove op", () => {
    const data = {
      keep: 1,
      drop: 2,
      list: ["a", "b", "c"],
      variantOverrides: [
        {
          traits: [{ interfaceLanguage: "occ" }],
          patch: [
            { op: "remove", path: "/drop" },
            { op: "remove", path: "/list/1" },
          ],
        },
      ],
    } as any
    const result = applyVariantOverrides(data, "objc")
    expect(result.drop).toBeUndefined()
    expect(result.list).toEqual(["a", "c"])
    expect(result.keep).toBe(1)
  })

  it("decodes ~0 and ~1 escapes in JSON Pointer paths", () => {
    const data = {
      references: { "doc://x/y": { title: "swift" } },
      variantOverrides: [
        {
          traits: [{ interfaceLanguage: "occ" }],
          patch: [
            { op: "replace", path: "/references/doc:~1~1x~1y/title", value: "objc" },
          ],
        },
      ],
    } as any
    const result = applyVariantOverrides(data, "objc")
    expect(result.references["doc://x/y"].title).toBe("objc")
  })

  it("skips ops whose path doesn't resolve", () => {
    const data = {
      metadata: { title: "X" },
      variantOverrides: [
        {
          traits: [{ interfaceLanguage: "occ" }],
          patch: [
            { op: "replace", path: "/does/not/exist", value: "Y" },
            { op: "replace", path: "/metadata/title", value: "Z" },
          ],
        },
      ],
    } as any
    const result = applyVariantOverrides(data, "objc")
    expect(result.metadata.title).toBe("Z")
  })
})

describe("renderFromJSON with variant overrides", () => {
  const baseDataWithObjcOverride = {
    metadata: { title: "NSExample", roleHeading: "Class" },
    primaryContentSections: [
      {
        kind: "declarations",
        declarations: [
          {
            tokens: [
              { kind: "keyword", text: "class" },
              { kind: "text", text: " " },
              { kind: "identifier", text: "NSExample" },
            ],
            languages: ["swift"],
          },
        ],
      },
    ],
    variantOverrides: [
      {
        traits: [{ interfaceLanguage: "occ" }],
        patch: [
          {
            op: "replace",
            path: "/primaryContentSections/0",
            value: {
              kind: "declarations",
              declarations: [
                {
                  tokens: [
                    { kind: "keyword", text: "@interface" },
                    { kind: "text", text: " " },
                    { kind: "identifier", text: "NSExample" },
                    { kind: "text", text: " : " },
                    { kind: "typeIdentifier", text: "NSObject" },
                  ],
                  languages: ["occ"],
                },
              ],
            },
          },
        ],
      },
    ],
  }

  it("renders Swift declaration by default", async () => {
    const result = await renderFromJSON(baseDataWithObjcOverride as any, "https://test.com")
    expect(result).toContain("```swift")
    expect(result).toContain("class NSExample")
    expect(result).not.toContain("@interface")
  })

  it("applies the objc variant override and uses an objc fence", async () => {
    const result = await renderFromJSON(baseDataWithObjcOverride as any, "https://test.com", {
      language: "objc",
    })
    expect(result).toContain("```objc")
    expect(result).toContain("@interface NSExample : NSObject")
    expect(result).not.toContain("```swift\nclass NSExample")
  })
})
