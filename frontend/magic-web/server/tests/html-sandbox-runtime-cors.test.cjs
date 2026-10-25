const assert = require("node:assert/strict")
const test = require("node:test")
const {
	getHtmlSandboxAllowedOrigins,
	isHtmlSandboxRuntimeRequest,
	setHtmlSandboxRuntimeCorsHeaders,
} = require("../utils/htmlSandboxRuntimeCors.cjs")

function createHeaderRecorder(initialHeaders = {}) {
	const headers = new Map(
		Object.entries(initialHeaders).map(([name, value]) => [name.toLowerCase(), String(value)]),
	)

	return {
		getHeader(name) {
			return headers.get(name.toLowerCase())
		},
		removeHeader(name) {
			headers.delete(name.toLowerCase())
		},
		setHeader(name, value) {
			headers.set(name.toLowerCase(), String(value))
		},
	}
}

test("derives runtime CORS origins from the web and sandbox URLs", () => {
	assert.deepEqual(
		getHtmlSandboxAllowedOrigins({
			MAGIC_WEB_URL: "https://magic.example.com/app",
			MAGIC_HTML_SANDBOX_URL: "https://husky.pages.letsmagic.space/index.html",
		}),
		["https://magic.example.com", "https://husky.pages.letsmagic.space"],
	)
})

test("uses only the web origin when no sandbox URL is configured", () => {
	assert.deepEqual(
		getHtmlSandboxAllowedOrigins({
			MAGIC_WEB_URL: "https://magic.example.com/app",
		}),
		["https://magic.example.com"],
	)
})

test("deduplicates origins and ignores invalid or unsupported URLs", () => {
	assert.deepEqual(
		getHtmlSandboxAllowedOrigins({
			MAGIC_WEB_URL: "https://magic.example.com/app",
			MAGIC_HTML_SANDBOX_URL: "https://magic.example.com/sandbox",
		}),
		["https://magic.example.com"],
	)
	assert.deepEqual(
		getHtmlSandboxAllowedOrigins({
			MAGIC_WEB_URL: "not-a-url",
			MAGIC_HTML_SANDBOX_URL: "javascript:alert(1)",
		}),
		[],
	)
})

test("echoes an allowed request origin and preserves existing Vary values", () => {
	const response = createHeaderRecorder({ Vary: "Accept-Encoding" })

	setHtmlSandboxRuntimeCorsHeaders(response, "https://husky.example.com", [
		"https://magic.example.com",
		"https://husky.example.com",
	])

	assert.equal(response.getHeader("Access-Control-Allow-Origin"), "https://husky.example.com")
	assert.equal(response.getHeader("Vary"), "Accept-Encoding, Origin")
})

test("removes a wildcard header for origins outside the allowlist", () => {
	const response = createHeaderRecorder({ "Access-Control-Allow-Origin": "*" })

	setHtmlSandboxRuntimeCorsHeaders(response, "https://untrusted.example.com", [
		"https://magic.example.com",
	])

	assert.equal(response.getHeader("Access-Control-Allow-Origin"), undefined)
	assert.equal(response.getHeader("Vary"), "Origin")
})

test("runtime CORS rejects missing, null, unconfigured and lookalike origins", () => {
	for (const requestOrigin of [undefined, "null", "https://husky.example.com.attacker.test"]) {
		const response = createHeaderRecorder({
			"Access-Control-Allow-Origin": "*",
			Vary: "Origin",
		})
		setHtmlSandboxRuntimeCorsHeaders(response, requestOrigin, ["https://husky.example.com"])
		assert.equal(response.getHeader("Access-Control-Allow-Origin"), undefined)
		assert.equal(response.getHeader("Vary"), "Origin")
	}
	const response = createHeaderRecorder()
	setHtmlSandboxRuntimeCorsHeaders(response, "https://husky.example.com", [])
	assert.equal(response.getHeader("Access-Control-Allow-Origin"), undefined)
})

test("runtime CORS does not enable credentialed requests", () => {
	const response = createHeaderRecorder()
	setHtmlSandboxRuntimeCorsHeaders(response, "https://husky.example.com", [
		"https://husky.example.com",
	])
	assert.equal(response.getHeader("Access-Control-Allow-Credentials"), undefined)
})

test("runtime CORS policy is scoped to the runtime asset, never API or config routes", () => {
	assert.equal(isHtmlSandboxRuntimeRequest("/husky-runtime.js"), true)
	for (const path of ["/api/v1/user", "/config.js", "/other.js", "/husky-runtime.js/extra"]) {
		assert.equal(isHtmlSandboxRuntimeRequest(path), false)
	}
})
