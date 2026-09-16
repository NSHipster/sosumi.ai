import { env, runInDurableObject } from "cloudflare:test"
import { describe, expect, it, vi } from "vitest"
import { MonitorState } from "../src/index"

const monitorEnv = env as unknown as ConstructorParameters<typeof MonitorState>[1]

function withMonitor(test: (state: DurableObjectState) => Promise<void>) {
  const stub = monitorEnv.MONITOR_STATE.get(monitorEnv.MONITOR_STATE.newUniqueId())
  return runInDurableObject(stub, async (_instance, state) => test(state))
}

function createMonitor(state: DurableObjectState) {
  const send = vi.fn<SendEmail["send"]>().mockResolvedValue({ messageId: "test-message" })
  const monitor = new MonitorState(state, {
    ...monitorEnv,
    EMAIL: { send: send as SendEmail["send"] },
  })
  return { monitor, send }
}

describe("monitor alert delivery", () => {
  it("sends only on health changes after successful delivery", () =>
    withMonitor(async (state) => {
      const { monitor, send } = createMonitor(state)
      await monitor.reportResult(true)
      expect(send).not.toHaveBeenCalled()

      await monitor.reportResult(false, "timeout")
      await monitor.reportResult(false, "timeout")
      await monitor.reportResult(true)
      await monitor.reportResult(true)

      expect(send.mock.calls.map(([message]) => message.subject)).toEqual([
        "Sosumi MCP Alert: Health check failed",
        "Sosumi MCP Recovered: Health check passing",
      ])
    }))

  it("retries a failed outage email with the original details after reconstruction", () =>
    withMonitor(async (state) => {
      const first = createMonitor(state)
      first.send.mockRejectedValueOnce(new Error("email unavailable"))
      await expect(first.monitor.reportResult(false, "original timeout")).rejects.toThrow(
        "email unavailable",
      )
      expect(await state.storage.get("healthy")).toBe(false)

      const restarted = createMonitor(state)
      await restarted.monitor.reportResult(false, "different error")
      expect(restarted.send).toHaveBeenCalledExactlyOnceWith(first.send.mock.calls[0][0])
      await restarted.monitor.reportResult(false, "still down")
      expect(restarted.send).toHaveBeenCalledTimes(1)
    }))

  it("retries a failed recovery email on a later healthy check", () =>
    withMonitor(async (state) => {
      const { monitor, send } = createMonitor(state)
      await monitor.reportResult(false, "timeout")
      send.mockRejectedValueOnce(new Error("email unavailable"))
      await expect(monitor.reportResult(true)).rejects.toThrow("email unavailable")

      await monitor.reportResult(true)
      expect(send).toHaveBeenCalledTimes(3)
      expect(send.mock.calls[2][0]).toEqual(send.mock.calls[1][0])
      await monitor.reportResult(true)
      expect(send).toHaveBeenCalledTimes(3)
    }))

  it("keeps outage and recovery alerts in order across repeated send failures", () =>
    withMonitor(async (state) => {
      const { monitor, send } = createMonitor(state)
      send.mockRejectedValue(new Error("email unavailable"))
      await expect(monitor.reportResult(false, "timeout")).rejects.toThrow("email unavailable")
      await expect(monitor.reportResult(true)).rejects.toThrow("email unavailable")
      expect(send.mock.calls[1][0]).toEqual(send.mock.calls[0][0])

      send.mockResolvedValue({ messageId: "test-message" })
      await monitor.reportResult(true)
      expect(send.mock.calls.slice(2).map(([message]) => message.subject)).toEqual([
        "Sosumi MCP Alert: Health check failed",
        "Sosumi MCP Recovered: Health check passing",
      ])
      expect(state.storage.sql.exec("SELECT * FROM pending_alerts").toArray()).toEqual([])
    }))

  it("does not start duplicate sends when reports overlap", () =>
    withMonitor(async (state) => {
      const { monitor, send } = createMonitor(state)
      const delivery = Promise.withResolvers<EmailSendResult>()
      send.mockReturnValueOnce(delivery.promise)

      const outage = monitor.reportResult(false, "timeout")
      const repeatedOutage = monitor.reportResult(false, "timeout")
      const recovery = monitor.reportResult(true)
      expect(send).toHaveBeenCalledTimes(1)

      delivery.resolve({ messageId: "test-message" })
      await Promise.all([outage, repeatedOutage, recovery])
      expect(send.mock.calls.map(([message]) => message.subject)).toEqual([
        "Sosumi MCP Alert: Health check failed",
        "Sosumi MCP Recovered: Health check passing",
      ])
    }))

  it("keeps the health state saved by the previous implementation", () =>
    withMonitor(async (state) => {
      await state.storage.put("healthy", false)
      const { monitor, send } = createMonitor(state)
      await monitor.reportResult(false, "still down")
      expect(send).not.toHaveBeenCalled()
      await monitor.reportResult(true)
      expect(send).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ subject: "Sosumi MCP Recovered: Health check passing" }),
      )
    }))

  it("rolls back the health change if the pending alert cannot be saved", () =>
    withMonitor(async (state) => {
      const { monitor, send } = createMonitor(state)
      state.storage.sql.exec(`
        CREATE TRIGGER reject_alert BEFORE INSERT ON pending_alerts
        BEGIN SELECT RAISE(ABORT, 'storage failure'); END
      `)
      await expect(monitor.reportResult(false, "timeout")).rejects.toThrow("storage failure")
      expect(await state.storage.get("healthy")).toBeUndefined()
      expect(send).not.toHaveBeenCalled()

      state.storage.sql.exec("DROP TRIGGER reject_alert")
      await monitor.reportResult(false, "timeout")
      expect(send).toHaveBeenCalledTimes(1)
    }))
})
