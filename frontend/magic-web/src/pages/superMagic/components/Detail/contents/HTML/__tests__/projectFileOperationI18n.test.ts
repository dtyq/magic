import { describe, expect, it } from "vitest"
import enUS from "@/assets/locales/en_US/super.json"
import zhCN from "@/assets/locales/zh_CN/super.json"

const requiredKeys = [
	"title",
	"content",
	"cancel",
	"operations.write",
	"operations.move",
	"operations.rename",
	"operations.delete",
	"targetTypes.file",
	"targetTypes.directory",
	"projectRoot",
]

function getPathValue(source: unknown, path: string): unknown {
	return path.split(".").reduce<unknown>((current, segment) => {
		if (!current || typeof current !== "object") return undefined
		return (current as Record<string, unknown>)[segment]
	}, source)
}

describe("project file operation confirmation i18n", () => {
	it.each([
		["zh_CN", zhCN],
		["en_US", enUS],
	])("defines all modal copy keys for %s", (_locale, messages) => {
		for (const key of requiredKeys) {
			expect(getPathValue(messages, `htmlEditor.projectFileOperationConfirm.${key}`)).toEqual(
				expect.any(String),
			)
		}
	})
})
