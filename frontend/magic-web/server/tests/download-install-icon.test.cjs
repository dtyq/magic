const assert = require("node:assert/strict")
const { afterEach, test } = require("node:test")
const downloadInstallIcon = require("../utils/downloadInstallIcon")

const originalFetch = global.fetch
const validSvg = Buffer.from(
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#111" d="M4 4h16v16H4z"/></svg>',
)

afterEach(() => {
	global.fetch = originalFetch
})

test("downloads a bounded SVG from a backend-resolved URL", async () => {
	global.fetch = async () =>
		new Response(validSvg, {
			status: 200,
			headers: { "content-type": "image/svg+xml" },
		})

	assert.deepEqual(await downloadInstallIcon("https://files.example.com/icon.svg"), {
		body: validSvg,
		contentType: "image/svg+xml",
	})
})

test("infers SVG content type when the response omits it", async () => {
	global.fetch = async () => new Response(validSvg, { status: 200 })

	const result = await downloadInstallIcon("https://files.example.com/icon.svg")
	assert.equal(result.contentType, "image/svg+xml")
})

test("infers SVG content type when the upstream uses a generic binary type", async () => {
	global.fetch = async () =>
		new Response(validSvg, {
			status: 200,
			headers: { "content-type": "application/octet-stream" },
		})

	const result = await downloadInstallIcon("https://files.example.com/icon.svg")
	assert.equal(result.contentType, "image/svg+xml")
})

test("rejects unsupported responses and protocols", async () => {
	global.fetch = async () =>
		new Response("not-an-image", {
			status: 200,
			headers: { "content-type": "text/plain" },
		})

	await assert.rejects(
		downloadInstallIcon("https://files.example.com/icon.svg"),
		/Install icon must be an image/,
	)
	await assert.rejects(
		downloadInstallIcon("file:///tmp/icon.svg"),
		/Unsupported install icon protocol/,
	)
})

test("rejects unsafe SVG active content", async () => {
	global.fetch = async () =>
		new Response("<svg><script>alert(1)</script></svg>", {
			status: 200,
			headers: { "content-type": "image/svg+xml" },
		})

	await assert.rejects(
		downloadInstallIcon("https://files.example.com/icon.svg"),
		/active content/,
	)
})

test("rejects icon responses above the size limit", async () => {
	global.fetch = async () =>
		new Response("too-large", {
			status: 200,
			headers: {
				"content-type": "image/svg+xml",
				"content-length": String(downloadInstallIcon.MAX_ICON_BYTES + 1),
			},
		})

	await assert.rejects(
		downloadInstallIcon("https://files.example.com/icon.svg"),
		/Install icon is too large/,
	)
})

test("rejects forbidden install icon hosts", async () => {
	await assert.rejects(
		downloadInstallIcon("http://127.0.0.1/icon.svg"),
		/Install icon URL host is not allowed/,
	)
	await assert.rejects(
		downloadInstallIcon("https://localhost/icon.svg"),
		/Install icon URL host is not allowed/,
	)
})

test("rejects redirects to forbidden hosts", async () => {
	global.fetch = async () =>
		new Response(null, {
			status: 302,
			headers: { location: "http://127.0.0.1/icon.svg" },
		})

	await assert.rejects(
		downloadInstallIcon("https://files.example.com/icon.svg"),
		/Install icon URL host is not allowed/,
	)
})

test("follows safe redirects before downloading the icon", async () => {
	let requestCount = 0
	global.fetch = async (url) => {
		requestCount += 1
		if (requestCount === 1) {
			assert.equal(url, "https://files.example.com/icon.svg")
			return new Response(null, {
				status: 302,
				headers: { location: "/cdn/icon.svg" },
			})
		}

		assert.equal(url, "https://files.example.com/cdn/icon.svg")
		return new Response(validSvg, {
			status: 200,
			headers: { "content-type": "image/svg+xml" },
		})
	}

	const result = await downloadInstallIcon("https://files.example.com/icon.svg")
	assert.equal(result.contentType, "image/svg+xml")
	assert.equal(requestCount, 2)
})
