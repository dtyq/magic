import { describe, expect, it } from "vitest"
import { getHtmlSandboxRuntimeUrl } from "../html-sandbox-runtime-url"

describe("getHtmlSandboxRuntimeUrl", () => {
	it("resolves the default runtime from the host origin", () => {
		expect(getHtmlSandboxRuntimeUrl()).toBe("http://localhost:3000/husky-runtime.js")
	})
})
