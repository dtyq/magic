const { createGunzip } = require("node:zlib")
const { Transform } = require("node:stream")
const { pipeline } = require("node:stream/promises")
const { decodeLegacy } = require("./legacyLogDecode.cjs")
const failure = (status, message) => Object.assign(new Error(message), { status })
function limiter(maximum) {
	let size = 0
	return new Transform({
		transform(chunk, encoding, callback) {
			size += chunk.length
			callback(size > maximum ? failure(413, "Log report exceeds capacity") : null, chunk)
		},
	})
}
/** Compressed and decoded byte budgets are enforced while streaming. */
async function decodeLogReport(req) {
	const mode = req.headers["x-log-report-mode"]
	if (mode && mode !== "ordinary") throw failure(400, "Unknown log report mode")
	// Match the web delivery limit for both the wire body and the decoded JSON content.
	const encodedLimit = 2 * 1024 * 1024
	const decodedLimit = 2 * 1024 * 1024
	if (Number(req.headers["content-length"]) > encodedLimit)
		throw failure(413, "Log report exceeds capacity")
	const encoding = String(req.headers["content-encoding"] || "identity").toLowerCase()
	const legacy = String(req.headers["x-compression"] || "").toLowerCase() === "lz-string"
	if (
		!["identity", "gzip"].includes(encoding) ||
		(req.headers["x-compression"] && !legacy) ||
		(legacy && encoding !== "identity")
	)
		throw failure(400, "Unsupported compression")
	const chunks = []
	const sink = new Transform({
		transform(chunk, encoding, callback) {
			chunks.push(chunk)
			callback()
		},
	})
	// Keep the HTTP socket outside pipeline destruction so clients can receive the 413 receipt.
	const input = limiter(encodedLimit)
	const stages =
		encoding === "gzip"
			? [input, createGunzip(), limiter(decodedLimit), sink]
			: [input, limiter(decodedLimit), sink]
	const timer = setTimeout(() => input.destroy(failure(408, "Log report body timeout")), 30000)
	const abort = () => input.destroy(failure(400, "Log report aborted"))
	req.on("aborted", abort)
	req.on("error", abort)
	req.pipe(input)
	try {
		await pipeline(...stages)
		const text = Buffer.concat(chunks).toString("utf8")
		return JSON.parse(legacy ? await decodeLegacy(text, decodedLimit) : text)
	} catch (error) {
		throw error.status ? error : failure(400, "Invalid log report body")
	} finally {
		clearTimeout(timer)
		req.unpipe(input)
		req.removeListener("aborted", abort)
		req.removeListener("error", abort)
		req.resume()
	}
}
async function logReportBody(req, res, next) {
	try {
		req.body = await decodeLogReport(req)
		next()
	} catch (error) {
		res.status(error.status || 500).json({ code: error.status || 500, message: error.message })
	}
}
module.exports = { logReportBody, decodeLogReport }
