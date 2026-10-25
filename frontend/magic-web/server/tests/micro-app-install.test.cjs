const assert = require("node:assert/strict")
const { afterEach, test } = require("node:test")
const MicroAppInstallRoutes = require("../routes/micro-app-install.route")
const getGlobalPlatformInfo = require("../apis/getGlobalPlatformInfo")
const { processHtmlContent } = require("../middleware/seoMiddleware/html-utils")
const buildInstallLinks = require("../middleware/seoMiddleware/micro-app-install-links")
const defaultInstallIcon = require("../utils/defaultInstallIcon")
const {
	BUILTIN_DEFAULT_ICON_KEY,
	buildInstallIconUrl,
	buildManifestIcons,
	buildManifestUrl,
} = require("../utils/microAppInstallConstants")
const {
	buildInstallIconCacheKey,
	toStableIconSourceKey,
} = require("../utils/installIconCache")

const originalFetch = global.fetch
const TEST_APP_ID = "900000000000000001"
const generatedIconSvg = Buffer.from(
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#111" d="M4 4h16v16H4z"/></svg>',
)
const expectedManifestIcons = buildManifestIcons(TEST_APP_ID)

afterEach(() => {
	global.fetch = originalFetch
	getGlobalPlatformInfo.resetCache()
	MicroAppInstallRoutes.resetInstallIconCache()
})

function createResponse() {
	return {
		body: null,
		headers: {},
		statusCode: 200,
		setHeader(name, value) {
			this.headers[name.toLowerCase()] = value
		},
		status(value) {
			this.statusCode = value
			return this
		},
		json(value) {
			this.body = value
			return this
		},
		send(value) {
			this.body = value
			return this
		},
		sendFile(value) {
			this.body = value
			return this
		},
	}
}

function mockPublishedMicroApp({ appId = TEST_APP_ID, iconUrl = "" } = {}) {
	global.fetch = async (url) => {
		if (url.includes("/api/v1/settings/global")) {
			return new Response(JSON.stringify({ data: { favicon: "" } }), {
				status: 200,
				headers: { "content-type": "application/json" },
			})
		}
		if (url.includes("/api/v1/share/micro-apps/")) {
			return new Response(
				JSON.stringify({
					data: { app_id: appId, resource_id: "resource-1", icon_url: iconUrl },
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			)
		}
		if (url.includes("/title")) {
			return new Response(JSON.stringify({ data: { project_name: "测试微应用" } }), {
				status: 200,
				headers: { "content-type": "application/json" },
			})
		}
		throw new Error(`Unexpected request: ${url}`)
	}
}

test("builds a distinct password-free manifest for each published micro app", async () => {
	mockPublishedMicroApp({ iconUrl: "https://files.example.com/icon.svg" })
	const response = createResponse()
	await new MicroAppInstallRoutes().manifest(
		{ params: { appId: TEST_APP_ID } },
		response,
		(error) => {
			throw error
		},
	)

	assert.equal(response.body.id, `/micro-app/${TEST_APP_ID}`)
	assert.equal(response.body.start_url, `/micro-app/${TEST_APP_ID}?source=pwa`)
	assert.equal(response.body.scope, `/micro-app/${TEST_APP_ID}`)
	assert.equal(response.body.name, "测试微应用")
	assert.equal(response.headers["content-type"], "application/manifest+json; charset=utf-8")
	assert.match(response.headers["cache-control"], /no-store/)
	assert.doesNotMatch(JSON.stringify(response.body), /password|temporary_token|token=/i)
	assert.deepEqual(response.body.icons, expectedManifestIcons)

	mockPublishedMicroApp({ appId: "900000000000000002" })
	const secondResponse = createResponse()
	await new MicroAppInstallRoutes().manifest(
		{ params: { appId: "900000000000000002" } },
		secondResponse,
		(error) => {
			throw error
		},
	)
	assert.equal(secondResponse.body.id, "/micro-app/900000000000000002")
	assert.equal(secondResponse.body.scope, "/micro-app/900000000000000002")
	assert.notEqual(secondResponse.body.scope, response.body.scope)
	assert.notEqual(secondResponse.body.start_url, response.body.start_url)
})

test("rejects an unpublished micro app instead of returning a manifest", async () => {
	global.fetch = async () => new Response(JSON.stringify({ data: null }), { status: 200 })
	const response = createResponse()
	await new MicroAppInstallRoutes().manifest(
		{ params: { appId: TEST_APP_ID } },
		response,
		(error) => {
			throw error
		},
	)

	assert.equal(response.statusCode, 404)
	assert.equal(response.body, "")
})

test("still advertises install icons when the app has no icon.svg", async () => {
	mockPublishedMicroApp()
	const response = createResponse()
	await new MicroAppInstallRoutes().manifest(
		{ params: { appId: TEST_APP_ID } },
		response,
		(error) => {
			throw error
		},
	)

	assert.deepEqual(response.body.icons, expectedManifestIcons)
})

test("manifest uses the SVG type for a backend-resolved root icon", async () => {
	const iconUrl = "https://files.example.com/icon.svg?token=secret"
	global.fetch = async (url) => {
		if (url.includes("/api/v1/share/micro-apps/")) {
			return new Response(
				JSON.stringify({
					data: {
						app_id: TEST_APP_ID,
						resource_id: "resource-1",
						icon_url: iconUrl,
					},
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			)
		}
		if (url.includes("/title")) {
			return new Response(JSON.stringify({ data: { project_name: "测试微应用" } }), {
				status: 200,
				headers: { "content-type": "application/json" },
			})
		}
		throw new Error(`Unexpected request: ${url}`)
	}

	const response = createResponse()
	await new MicroAppInstallRoutes().manifest(
		{ params: { appId: TEST_APP_ID } },
		response,
		(error) => {
			throw error
		},
	)

	assert.deepEqual(response.body.icons, expectedManifestIcons)
})

test("serves the generated SVG app icon through the same-origin icon route", async () => {
	const iconUrl = "https://files.example.com/icon.svg?token=secret"
	global.fetch = async (url) => {
		if (url.includes("/api/v1/share/micro-apps/")) {
			return new Response(
				JSON.stringify({
					data: {
						app_id: TEST_APP_ID,
						resource_id: "resource-1",
						cover_url: "https://files.example.com/cover.png",
						icon_url: iconUrl,
					},
				}),
				{ status: 200 },
			)
		}
		assert.equal(url, iconUrl)
		return new Response(generatedIconSvg, {
			status: 200,
			headers: { "content-type": "image/svg+xml" },
		})
	}

	const response = createResponse()
	await new MicroAppInstallRoutes().icon(
		{ params: { appId: TEST_APP_ID }, query: { size: "192" } },
		response,
		(error) => {
			throw error
		},
	)

	assert.equal(response.headers["content-type"], "image/svg+xml")
	assert.deepEqual(response.body, generatedIconSvg)
})

test("proxies an upstream SVG icon without changing its MIME type", async () => {
	const iconUrl = "https://files.example.com/icon.svg"
	global.fetch = async (url) => {
		if (url.includes("/api/v1/share/micro-apps/")) {
			return new Response(
				JSON.stringify({
					data: { resource_id: "resource-1", icon_url: iconUrl },
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			)
		}
		assert.equal(url, iconUrl)
		return new Response(generatedIconSvg, {
			status: 200,
			headers: { "content-type": "image/svg+xml" },
		})
	}

	const response = createResponse()
	await new MicroAppInstallRoutes().icon(
		{ params: { appId: TEST_APP_ID }, query: { size: "512" } },
		response,
		(error) => {
			throw error
		},
	)

	assert.equal(response.headers["content-type"], "image/svg+xml")
	assert.deepEqual(response.body, generatedIconSvg)
})

test("uses the management favicon as the fallback icon and a built-in default without one", async () => {
	mockPublishedMicroApp()
	global.fetch = async (url) => {
		if (url.includes("/api/v1/settings/global")) {
			return new Response(
				JSON.stringify({ data: { favicon: "https://files.example.com/favicon.svg" } }),
				{ status: 200 },
			)
		}
		if (url.includes("/api/v1/share/micro-apps/")) {
			return new Response(
				JSON.stringify({ data: { resource_id: "resource-1", icon_url: "" } }),
				{ status: 200 },
			)
		}
		return new Response(generatedIconSvg, {
			status: 200,
			headers: { "content-type": "image/svg+xml" },
		})
	}
	const route = new MicroAppInstallRoutes()
	const response = createResponse()
	await route.icon(
		{ params: { appId: TEST_APP_ID }, query: { size: "192" } },
		response,
		(error) => {
			throw error
		},
	)
	assert.equal(response.headers["content-type"], "image/svg+xml")
	assert.deepEqual(response.body, generatedIconSvg)

	global.fetch = async (url) => {
		if (url.includes("/api/v1/settings/global"))
			return new Response(JSON.stringify({ data: { favicon: "" } }), { status: 200 })
		return new Response(JSON.stringify({ data: { resource_id: "resource-1", icon_url: "" } }), {
			status: 200,
		})
	}
	MicroAppInstallRoutes.resetInstallIconCache()
	getGlobalPlatformInfo.resetCache()
	const missingResponse = createResponse()
	await route.icon(
		{ params: { appId: TEST_APP_ID }, query: { size: "192" } },
		missingResponse,
		(error) => {
			throw error
		},
	)
	assert.equal(missingResponse.statusCode, 200)
	assert.equal(missingResponse.headers["content-type"], "image/svg+xml")
	assert.deepEqual(missingResponse.body, defaultInstallIcon.body)
})

test("rate-limits abusive icon requests from the same client", async () => {
	const iconUrl = "https://files.example.com/icon.svg"
	global.fetch = async (url) => {
		if (url.includes("/api/v1/share/micro-apps/")) {
			return new Response(JSON.stringify({ data: { resource_id: "resource-1", icon_url: iconUrl } }), {
				status: 200,
			})
		}
		return new Response(generatedIconSvg, {
			status: 200,
			headers: { "content-type": "image/svg+xml" },
		})
	}

	const route = new MicroAppInstallRoutes()
	const req = {
		params: { appId: TEST_APP_ID },
		query: { size: "192" },
		ip: "203.0.113.10",
		headers: {},
	}

	for (let i = 0; i < 120; i++) {
		const response = createResponse()
		await route.icon(req, response, (error) => {
			throw error
		})
		assert.equal(response.statusCode, 200)
	}

	const limited = createResponse()
	await route.icon(req, limited, (error) => {
		throw error
	})
	assert.equal(limited.statusCode, 429)
	assert.match(limited.headers["cache-control"] || "", /max-age=10|no-store/)
})

test("caches icon downloads and merges concurrent requests across icon sizes", async () => {
	const iconUrl = "https://files.example.com/icon.svg"
	let metadataRequests = 0
	let iconRequests = 0
	global.fetch = async (url) => {
		if (url.includes("/api/v1/share/micro-apps/")) {
			metadataRequests += 1
			await new Promise((resolve) => setTimeout(resolve, 5))
			return new Response(JSON.stringify({ data: { resource_id: "resource-1", icon_url: iconUrl } }), {
				status: 200,
			})
		}
		iconRequests += 1
		return new Response(generatedIconSvg, {
			status: 200,
			headers: { "content-type": "image/svg+xml" },
		})
	}

	const route = new MicroAppInstallRoutes()
	const responses = [createResponse(), createResponse()]
	await Promise.all(
		responses.map((response, index) =>
			route.icon(
				{ params: { appId: TEST_APP_ID }, query: { size: index ? "512" : "192" } },
				response,
				(error) => {
					throw error
				},
			),
		),
	)

	assert.equal(metadataRequests, 1)
	assert.equal(iconRequests, 1)
	assert.match(responses[0].headers.etag, /^"[a-f0-9]{64}"$/)
	assert.match(responses[0].headers["cache-control"], /max-age=300/)

	const cachedResponse = createResponse()
	await route.icon(
		{
			params: { appId: TEST_APP_ID },
			query: { size: "180" },
			headers: { "if-none-match": responses[0].headers.etag },
		},
		cachedResponse,
		(error) => {
			throw error
		},
	)
	assert.equal(cachedResponse.statusCode, 304)
	assert.equal(metadataRequests, 1)
	assert.equal(iconRequests, 1)
})

test("builds a stable icon cache key without signed query params", async () => {
	assert.equal(
		toStableIconSourceKey("https://files.example.com/a/icon.svg?token=abc#x"),
		"https://files.example.com/a/icon.svg",
	)
	assert.equal(
		await buildInstallIconCacheKey("app-1", {
			resource_id: "resource-9",
			icon_url: "https://files.example.com/a/icon.svg?token=abc",
		}),
		"app-1:resource-9:https://files.example.com/a/icon.svg",
	)

	global.fetch = async (url) => {
		if (url.includes("/api/v1/settings/global")) {
			return new Response(JSON.stringify({ data: { favicon: "" } }), { status: 200 })
		}
		throw new Error(`Unexpected request: ${url}`)
	}
	getGlobalPlatformInfo.resetCache()
	assert.equal(
		await buildInstallIconCacheKey("app-1", { resource_id: "resource-9", icon_url: "" }),
		`app-1:resource-9:${BUILTIN_DEFAULT_ICON_KEY}`,
	)

	global.fetch = async (url) => {
		if (url.includes("/api/v1/settings/global")) {
			return new Response(
				JSON.stringify({ data: { favicon: "https://files.example.com/favicon.svg?v=2" } }),
				{ status: 200 },
			)
		}
		throw new Error(`Unexpected request: ${url}`)
	}
	getGlobalPlatformInfo.resetCache()
	assert.equal(
		await buildInstallIconCacheKey("app-1", { resource_id: "resource-9", icon_url: "" }),
		"app-1:resource-9:https://files.example.com/favicon.svg",
	)
})

test("reuses cached icons when signed URL query params rotate", async () => {
	let iconRequests = 0
	let signedToken = "v1"
	global.fetch = async (url) => {
		if (url.includes("/api/v1/share/micro-apps/")) {
			return new Response(
				JSON.stringify({
					data: {
						resource_id: "resource-1",
						icon_url: `https://files.example.com/workspace/app/icon.svg?token=${signedToken}`,
					},
				}),
				{ status: 200 },
			)
		}
		iconRequests += 1
		return new Response(generatedIconSvg, {
			status: 200,
			headers: { "content-type": "image/svg+xml" },
		})
	}

	const route = new MicroAppInstallRoutes()
	await route.icon(
		{ params: { appId: TEST_APP_ID }, query: { size: "192" }, headers: {} },
		createResponse(),
		(error) => {
			throw error
		},
	)
	assert.equal(iconRequests, 1)

	// Refresh metadata only; body cache must survive signed-query rotation.
	MicroAppInstallRoutes.resetInstallIconCache({ keepIconBodies: true })
	signedToken = "v2"
	await route.icon(
		{ params: { appId: TEST_APP_ID }, query: { size: "512" }, headers: {} },
		createResponse(),
		(error) => {
			throw error
		},
	)
	assert.equal(iconRequests, 1)
})

test("downloads again when the stable icon path or resource id changes", async () => {
	let iconRequests = 0
	let iconPath = "icon-a.svg"
	let resourceId = "resource-1"
	global.fetch = async (url) => {
		if (url.includes("/api/v1/share/micro-apps/")) {
			return new Response(
				JSON.stringify({
					data: {
						resource_id: resourceId,
						icon_url: `https://files.example.com/workspace/app/${iconPath}?token=abc`,
					},
				}),
				{ status: 200 },
			)
		}
		iconRequests += 1
		return new Response(generatedIconSvg, {
			status: 200,
			headers: { "content-type": "image/svg+xml" },
		})
	}

	const route = new MicroAppInstallRoutes()
	await route.icon(
		{ params: { appId: TEST_APP_ID }, query: { size: "192" }, headers: {} },
		createResponse(),
		(error) => {
			throw error
		},
	)
	assert.equal(iconRequests, 1)

	MicroAppInstallRoutes.resetInstallIconCache({ keepIconBodies: true })
	iconPath = "icon-b.svg"
	resourceId = "resource-2"
	await route.icon(
		{ params: { appId: TEST_APP_ID }, query: { size: "192" }, headers: {} },
		createResponse(),
		(error) => {
			throw error
		},
	)
	assert.equal(iconRequests, 2)
})

test("does not use a published cover when the app icon is unavailable", async () => {
	global.fetch = async (url) => {
		if (url.includes("/api/v1/settings/global")) {
			return new Response(JSON.stringify({ data: { favicon: "" } }), { status: 200 })
		}
		assert.match(url, /\/api\/v1\/share\/micro-apps\//)
		return new Response(
			JSON.stringify({
				data: {
					app_id: TEST_APP_ID,
					resource_id: "resource-1",
					cover_url: "https://files.example.com/cover.png",
					icon_url: "",
				},
			}),
			{ status: 200 },
		)
	}

	const response = createResponse()
	await new MicroAppInstallRoutes().icon(
		{ params: { appId: TEST_APP_ID }, query: { size: "192" } },
		response,
		(error) => {
			throw error
		},
	)

	assert.equal(response.statusCode, 200)
	assert.deepEqual(response.body, defaultInstallIcon.body)
	assert.doesNotMatch(String(response.body), /cover\.png/)
})

test("falls back to the built-in default when the app icon is unsafe SVG", async () => {
	const iconUrl = "https://files.example.com/icon.svg"
	global.fetch = async (url) => {
		if (url.includes("/api/v1/settings/global")) {
			return new Response(JSON.stringify({ data: { favicon: "" } }), { status: 200 })
		}
		if (url.includes("/api/v1/share/micro-apps/")) {
			return new Response(
				JSON.stringify({ data: { resource_id: "resource-1", icon_url: iconUrl } }),
				{ status: 200 },
			)
		}
		return new Response("<svg><script>alert(1)</script></svg>", {
			status: 200,
			headers: { "content-type": "image/svg+xml" },
		})
	}
	const response = createResponse()
	await new MicroAppInstallRoutes().icon(
		{ params: { appId: TEST_APP_ID }, query: {} },
		response,
		(error) => {
			throw error
		},
	)
	assert.equal(response.statusCode, 200)
	assert.deepEqual(response.body, defaultInstallIcon.body)
})

test("injects install links only when the public micro app route opts in", () => {
	assert.deepEqual(buildInstallLinks({}, TEST_APP_ID), {})
	assert.deepEqual(buildInstallLinks({ installable: true }, TEST_APP_ID), {
		manifestUrl: buildManifestUrl(TEST_APP_ID),
		appleTouchIconUrl: buildInstallIconUrl(TEST_APP_ID, 180),
		faviconUrl: buildInstallIconUrl(TEST_APP_ID, 192),
	})

	const html = processHtmlContent(
		'<html><head><meta name="viewport" content="width=device-width" /><link rel="icon" href="/favicon.ico" /></head></html>',
		{
			favicon: buildInstallIconUrl("1", 192),
			title: "Micro App",
			keywords: "",
			description: "",
			ogUrl: "https://example.com/micro-app/1",
			manifestUrl: buildManifestUrl("1"),
			appleTouchIconUrl: buildInstallIconUrl("1", 180),
		},
	)
	assert.match(
		html,
		/rel="manifest" href="&#x2F;micro-app&#x2F;1&#x2F;manifest\.webmanifest" data-micro-app-install="manifest"/,
	)
	assert.match(
		html,
		/rel="apple-touch-icon" href="&#x2F;micro-app&#x2F;1&#x2F;icon\?size=180" data-micro-app-install="apple-touch-icon"/,
	)
	assert.match(
		html,
		/rel="icon"[^>]*href="&#x2F;micro-app&#x2F;1&#x2F;icon\?size=192" data-micro-app-install="favicon"/,
	)
})
