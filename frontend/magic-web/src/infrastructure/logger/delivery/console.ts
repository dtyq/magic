import type { LogRecord } from "../types"

export function writeConsole(record: LogRecord): void {
	const method = record.level === "report" ? "info" : record.level
	globalThis.console?.[method]?.(`[${record.namespace}]`, record)
}
