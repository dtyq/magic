const assert = require("node:assert/strict")
const test = require("node:test")
const noIndexMiddleware = require("../middleware/noIndexMiddleware")

function createResponse() {
	const headers = new Map()

	return {
		setHeader(name, value) {
			headers.set(name.toLowerCase(), value)
		},
		getHeader(name) {
			return headers.get(name.toLowerCase())
		},
	}
}

test("adds a global no-index robots header and continues the request", () => {
	const response = createResponse()
	let nextCalled = false

	noIndexMiddleware({}, response, () => {
		nextCalled = true
	})

	assert.equal(
		response.getHeader("X-Robots-Tag"),
		"noindex, nofollow, noarchive, nosnippet",
	)
	assert.equal(nextCalled, true)
})
