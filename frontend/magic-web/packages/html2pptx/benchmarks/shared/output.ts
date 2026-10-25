import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"

export function emitJson(report: unknown, outputPath?: string): void {
	const json = `${JSON.stringify(report, null, 2)}\n`
	if (outputPath) {
		const absolutePath = resolve(process.cwd(), outputPath)
		mkdirSync(dirname(absolutePath), { recursive: true })
		writeFileSync(absolutePath, json, "utf8")
	}
	process.stdout.write(json)
}
