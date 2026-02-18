export type RobotsPolicyResult =
  | { kind: "allow-all" }
  | { kind: "deny-all" }
  | { kind: "rules"; robotsText: string }

export interface ExternalPolicyEnv {
  EXTERNAL_DOC_HOST_ALLOWLIST?: string
  EXTERNAL_DOC_HOST_BLOCKLIST?: string
}
