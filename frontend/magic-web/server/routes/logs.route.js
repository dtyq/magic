class Logs {
	constructor(writer) {
		this.writer = writer
	}
	async report(req, res) {
		const records = Array.isArray(req.body) ? req.body : [req.body]
		if (records.length > 100)
			return res.status(413).json({ code: 413, message: "Log batch exceeds capacity" })
		// Validate the entire batch before submitting any entry to the writer.
		if (
			!records.length ||
			records.some(
				(record) =>
					!record ||
					typeof record !== "object" ||
					Array.isArray(record) ||
					(record.schemaVersion !== undefined &&
						(record.schemaVersion !== 2 ||
							typeof record.eventId !== "string" ||
							!record.eventId ||
							typeof record.namespace !== "string" ||
							!Number.isFinite(record.timestamp) ||
							!["info", "warn", "error", "report"].includes(record.logType))),
			)
		) {
			return res.status(400).json({ code: 400, message: "Invalid log batch" })
		}
		try {
			const writer = this.writer || require("../logger.cjs").logger
			const forwarded = String(req.headers["x-forwarded-for"] || "").slice(0, 2048)
			const ipMeta = {
				ips: forwarded
					.split(",")
					.filter(Boolean)
					.map((ip) => ip.trim())
					.reverse(),
				remoteAddress: req.socket?.remoteAddress?.replace("::ffff:", ""),
			}
			for (const record of records) {
				const level = record.level || record.logType
				const method = level === "error" ? "error" : level === "warn" ? "warn" : "info"
				// Client fields cannot overwrite server time, pid, hostname or severity.
				await writer[method]({ clientLog: record, ipMeta }, "web log report")
			}
			return res.status(200).json({
				code: 1000,
				accepted: records.length,
				message: "Validated and submitted to receiver writer",
			})
		} catch {
			return res.status(500).json({ code: 500, message: "Log writer failed" })
		}
	}
}
module.exports = Logs
