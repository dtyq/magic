const assert = require("node:assert/strict")
const test = require("node:test")
const Module = require("node:module")

// Mock server-only dependencies if running outside container environment
const originalRequire = Module.prototype.require
Module.prototype.require = function (id) {
	if (id === "node-bunyan" || id === "bunyan") {
		return {
			createLogger: () => ({
				info: () => {},
				error: () => {},
				warn: () => {},
				debug: () => {},
			}),
		}
	}
	if (id === "morgan") {
		return () => (req, res, next) => next && next()
	}
	return originalRequire.apply(this, arguments)
}

const {
	shouldShimImportMap,
	transformHtmlForShimMode,
} = require("../middleware/seoMiddleware/getHtmlTemplate")

test("shouldShimImportMap correctly detects legacy vs modern browsers", () => {
	// Chrome < 105 should trigger shim mode
	assert.equal(
		shouldShimImportMap(
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.53 Safari/537.36",
		),
		true,
	)
	assert.equal(
		shouldShimImportMap(
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.5112.102 Safari/537.36",
		),
		true,
	)

	// Chrome >= 105 should use native import maps
	assert.equal(
		shouldShimImportMap(
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36",
		),
		false,
	)
	assert.equal(
		shouldShimImportMap(
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		),
		false,
	)

	// Safari < 16.4 should trigger shim mode
	assert.equal(
		shouldShimImportMap(
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Safari/605.1.15",
		),
		true,
	)
	assert.equal(
		shouldShimImportMap(
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3.1 Safari/605.1.15",
		),
		true,
	)

	// Safari >= 16.4 should use native import maps
	assert.equal(
		shouldShimImportMap(
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15",
		),
		false,
	)
	assert.equal(
		shouldShimImportMap(
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
		),
		false,
	)

	// Firefox < 108 should trigger shim mode
	assert.equal(
		shouldShimImportMap(
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:102.0) Gecko/20100101 Firefox/102.0",
		),
		true,
	)

	// Firefox >= 108 should use native import maps
	assert.equal(
		shouldShimImportMap(
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
		),
		false,
	)

	// Empty / undefined User-Agent should default to false
	assert.equal(shouldShimImportMap(""), false)
	assert.equal(shouldShimImportMap(undefined), false)
})

test("transformHtmlForShimMode rewrites script and modulepreload tags for shim mode", () => {
	const originalHtml = `<!doctype html>
<html>
<head>
<meta charset="UTF-8" />
<script type="importmap">{"imports":{"/assets/a.js":"/assets/b.js"}}</script>
<script type="module" crossorigin src="/assets/index-CBBCjw1I.js"></script>
<link rel="modulepreload" crossorigin href="/assets/tabler-icons-used-TGqT5ivq.js">
</head>
<body><div id="root"></div></body>
</html>`

	const transformed = transformHtmlForShimMode(originalHtml)

	// es-module-shims script tag is injected AFTER importmap-shim
	const importMapEndIndex = transformed.indexOf("</script>")
	const shimScriptIndex = transformed.indexOf("es-module-shims")
	assert.ok(shimScriptIndex > importMapEndIndex)

	// <script type="importmap"> is converted to <script type="importmap-shim">
	assert.match(transformed, /<script type="importmap-shim">/)
	assert.equal(transformed.includes('<script type="importmap">'), false)

	// <script type="module"> is converted to <script type="module-shim">
	assert.match(transformed, /type="module-shim"/)
	assert.equal(transformed.includes('type="module"'), false)

	// <link rel="modulepreload"> is converted to <link rel="modulepreload-shim">
	assert.match(transformed, /rel="modulepreload-shim"/)
	assert.equal(transformed.includes('rel="modulepreload"'), false)
})
