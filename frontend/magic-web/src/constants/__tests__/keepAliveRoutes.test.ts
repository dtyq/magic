import { describe, expect, it } from "vitest"
import { isKeepAliveRoute, shouldKeepAlive } from "../keepAliveRoutes"

describe("keep-alive route boundaries", () => {
	it.each(["/chat", "/global/chat", "/another-cluster/chat", "/global/super/assistant"])(
		"keeps the intended page alive: %s",
		(pathname) => expect(shouldKeepAlive(pathname)).toBe(true),
	)

	it.each([
		"/global/super/new-chat",
		"/global/super/new-chat/",
		"/global/super/chat/project/topic",
		"/global/super/workspace/workspace-1",
		"/global/nested/super/assistant",
	])("does not cache a different page sharing a suffix: %s", (pathname) => {
		expect(shouldKeepAlive(pathname)).toBe(false)
	})

	it("retains explicit regex and exact object matching", () => {
		expect(isKeepAliveRoute("/global/custom/detail", /^\/global\/custom\//)).toBe(true)
		expect(isKeepAliveRoute("/custom", { path: "/custom" })).toBe(true)
		expect(isKeepAliveRoute("/global/custom", { path: "/custom" })).toBe(false)
	})
})
