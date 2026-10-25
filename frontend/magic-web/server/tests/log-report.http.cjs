const { test } = require("node:test")
const assert = require("node:assert/strict")
const http = require("node:http")
const { gzipSync } = require("node:zlib")
const { logReportBody } = require("../middleware/logReportBody.cjs")
const Logs = require("../routes/logs.route.js")

// Run explicitly with node --test server/tests/log-report.http.cjs; no deployment env is needed.
test("loopback HTTP accepts gzip and returns a readable 413 for a decompression bomb", async () => {
	const written = []
	const route = new Logs({ info: (record) => written.push(record) })
	const server = http.createServer((req, res) => {
		res.status = (code) => {
			res.statusCode = code
			return res
		}
		res.json = (body) => {
			res.setHeader("Content-Type", "application/json")
			res.end(JSON.stringify(body))
		}
		void logReportBody(req, res, () => route.report(req, res))
	})
	await new Promise((resolve, reject) => {
		server.once("error", reject)
		server.listen(0, "127.0.0.1", resolve)
	})
	try {
		const url = `http://127.0.0.1:${server.address().port}/log-report`
		const headers = { "Content-Type": "application/json", "Content-Encoding": "gzip" }
		const payload = [
			{
				schemaVersion: 2,
				eventId: "local-smoke",
				timestamp: Date.now(),
				namespace: "smoke",
				logType: "report",
				data: [""],
			},
		]
		// Include the array/envelope overhead so the real HTTP request lands on the exact boundary.
		const available = 2 * 1024 * 1024 - Buffer.byteLength(JSON.stringify(payload))
		payload[0].data[0] = "汉".repeat(Math.floor(available / 3)) + "x".repeat(available % 3)
		assert.equal(Buffer.byteLength(JSON.stringify(payload)), 2 * 1024 * 1024)
		const accepted = await fetch(url, {
			method: "POST",
			headers,
			body: gzipSync(JSON.stringify(payload)),
		})
		assert.equal(accepted.status, 200)
		assert.equal((await accepted.json()).accepted, 1)
		assert.equal(written[0].clientLog.eventId, "local-smoke")
		const rejected = await fetch(url, {
			method: "POST",
			headers,
			body: gzipSync(JSON.stringify({ data: "a".repeat(2 * 1024 * 1024) })),
		})
		assert.equal(rejected.status, 413)
		assert.equal((await rejected.json()).code, 413)
		assert.equal(written.length, 1)
	} finally {
		server.closeAllConnections()
		await new Promise((resolve) => server.close(resolve))
	}
})
