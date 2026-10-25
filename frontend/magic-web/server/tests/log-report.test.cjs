const { test } = require("node:test")
const assert = require("node:assert/strict")
const { Readable } = require("node:stream")
const { gzipSync } = require("node:zlib")
const { decodeLogReport } = require("../middleware/logReportBody.cjs")
const Logs = require("../routes/logs.route.js")

function request(body, headers = {}) {
	const req = Readable.from([body])
	req.headers = headers
	return req
}
function response() {
	return {
		statusCode: 200,
		status(code) {
			this.statusCode = code
			return this
		},
		json(body) {
			this.body = body
			return this
		},
		setHeader() {},
	}
}

test("JSON/gzip preserve legacy object and new array formats", async () => {
	const body = [{ namespace: "test", data: [1], eventId: "event", level: "warn" }]
	assert.deepEqual(await decodeLogReport(request(JSON.stringify(body))), body)
	assert.deepEqual(
		await decodeLogReport(
			request(gzipSync(JSON.stringify(body)), { "content-encoding": "gzip" }),
		),
		body,
	)
	assert.deepEqual(await decodeLogReport(request('{"namespace":"legacy"}')), {
		namespace: "legacy",
	})
})

test("valid legacy LZ stays compatible while malformed v2 records fail validation", async () => {
	const text = require("lz-string").compress('{"namespace":"legacy","data":[1]}')
	assert.deepEqual(
		await decodeLogReport(request(Buffer.from(text, "utf8"), { "x-compression": "lz-string" })),
		{ namespace: "legacy", data: [1] },
	)
	const res = response()
	await new Logs({
		info() {
			throw Error("must not write")
		},
	}).report({ headers: {}, body: { schemaVersion: 2, namespace: "missing identity" } }, res)
	assert.equal(res.statusCode, 400)
})
test("encoded, decoded, malformed and unsupported bodies fail explicitly", async () => {
	await assert.rejects(decodeLogReport(request(Buffer.alloc(2 * 1024 * 1024 + 1))), {
		status: 413,
	})
	await assert.rejects(
		decodeLogReport(
			request(gzipSync('"' + "a".repeat(2 * 1024 * 1024) + '"'), {
				"content-encoding": "gzip",
			}),
		),
		{ status: 413 },
	)
	await assert.rejects(decodeLogReport(request("{broken")), { status: 400 })
	await assert.rejects(decodeLogReport(request("[]", { "x-compression": "lzstring" })), {
		status: 400,
	})
})

test("accepts exactly 2 MiB of UTF-8 JSON and rejects one extra byte for JSON and gzip", async () => {
	const limit = 2 * 1024 * 1024
	const prefix = JSON.stringify({ data: "" })
	const contentBytes = limit - Buffer.byteLength(prefix)
	const value = "汉".repeat(Math.floor(contentBytes / 3)) + "x".repeat(contentBytes % 3)
	const json = JSON.stringify({ data: value })
	assert.equal(Buffer.byteLength(json), limit)
	for (const compressed of [false, true]) {
		const headers = compressed ? { "content-encoding": "gzip" } : {}
		const body = compressed ? gzipSync(json) : Buffer.from(json)
		assert.deepEqual(await decodeLogReport(request(body, headers)), { data: value })
		const oversized = compressed ? gzipSync(json + " ") : Buffer.from(json + " ")
		await assert.rejects(decodeLogReport(request(oversized, headers)), { status: 413 })
	}
})

test("accepts 100 records and acknowledges the whole batch", async () => {
	const calls = []
	const res = response()
	await new Logs({ info: (record) => calls.push(record) }).report(
		{ headers: {}, body: Array.from({ length: 100 }, (_, i) => ({ data: i })) },
		res,
	)
	assert.equal(res.body.accepted, 100)
	assert.equal(calls.length, 100)
})
test("only ordinary requests are supported", async () => {
	await assert.rejects(decodeLogReport(request("[]", { "x-log-report-mode": "diagnostic" })), {
		status: 400,
	})
	assert.deepEqual(await decodeLogReport(request("[]", { "x-log-report-mode": "ordinary" })), [])
})
test("validates entire batch before writing, reports accepted count and isolates client fields", async () => {
	const calls = []
	const writer = Object.fromEntries(
		["info", "warn", "error"].map((level) => [
			level,
			(record) => calls.push({ level, record }),
		]),
	)
	const logs = new Logs(writer)
	let res = response()
	await logs.report({ headers: {}, body: [{ data: "valid" }, null] }, res)
	assert.equal(res.statusCode, 400)
	assert.equal(calls.length, 0)
	res = response()
	await logs.report(
		{
			headers: {},
			body: [
				{ logType: "report", time: "fake", pid: "fake" },
				{ level: "warn" },
				{ logType: "error" },
			],
		},
		res,
	)
	assert.equal(res.body.accepted, 3)
	assert.deepEqual(
		calls.map((call) => call.level),
		["info", "warn", "error"],
	)
	assert.equal(calls[0].record.pid, undefined)
	assert.equal(calls[0].record.clientLog.pid, "fake")
})
test("batch capacity is checked before writes", async () => {
	const logs = new Logs({
		info() {
			throw Error("must not write")
		},
	})
	const res = response()
	await logs.report({ body: Array(101).fill({}), headers: {} }, res)
	assert.equal(res.statusCode, 413)
})
test("writer failures return 5xx, never a false successful receipt", async () => {
	const logs = new Logs({
		info() {
			throw Error("writer unavailable")
		},
	})
	const res = response()
	await logs.report({ body: {}, headers: {} }, res)
	assert.equal(res.statusCode, 500)
	assert.equal(res.body.accepted, undefined)
})
test("the process-wide limit returns 429 and Retry-After", () => {
	const throttle = require("../middleware/throttleMiddleware.js")
	let allowed = 0
	const res = response()
	const headers = {}
	res.setHeader = (name, value) => {
		headers[name] = value
	}
	for (let i = 0; i < 1001; i++)
		throttle({}, res, () => {
			allowed++
		})
	assert.equal(allowed, 1000)
	assert.equal(res.statusCode, 429)
	assert.ok(Number(headers["Retry-After"]) > 0)
})
