const { Worker, isMainThread, parentPort, workerData } = require("node:worker_threads")

if (!isMainThread) {
	try {
		const decoded = require("lz-string").decompress(workerData.text)
		if (typeof decoded !== "string") throw new Error("Invalid legacy encoding")
		if (Buffer.byteLength(decoded) > workerData.limit) parentPort.postMessage({ status: 413 })
		else parentPort.postMessage({ decoded })
	} catch {
		parentPort.postMessage({ status: 400 })
	}
}

/** Legacy LZ has no streaming API: isolate its CPU and heap until old clients are retired. */
function decodeLegacy(text, limit) {
	return new Promise((resolve, reject) => {
		const worker = new Worker(__filename, {
			workerData: { text, limit },
			resourceLimits: { maxOldGenerationSizeMb: 16, maxYoungGenerationSizeMb: 4 },
		})
		const finish = (error, decoded) => {
			clearTimeout(timer)
			void worker.terminate()
			error ? reject(error) : resolve(decoded)
		}
		const timer = setTimeout(
			() =>
				finish(Object.assign(new Error("Legacy decode budget exceeded"), { status: 413 })),
			2000,
		)
		worker.once("message", ({ decoded, status }) =>
			finish(
				status
					? Object.assign(new Error("Invalid or oversized legacy log"), { status })
					: null,
				decoded,
			),
		)
		worker.once("error", (error) =>
			finish(
				Object.assign(new Error("Legacy decode failed"), {
					status: error.code === "ERR_WORKER_OUT_OF_MEMORY" ? 413 : 400,
				}),
			),
		)
	})
}
module.exports = { decodeLegacy }
