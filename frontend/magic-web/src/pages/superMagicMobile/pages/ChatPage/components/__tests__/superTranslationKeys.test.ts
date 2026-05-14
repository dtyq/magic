import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const CHAT_PAGE_COMPONENTS_DIR = path.resolve(
	process.cwd(),
	"src/pages/superMagicMobile/pages/ChatPage/components",
)

const SUPER_ZH_LOCALE_PATH = path.resolve(process.cwd(), "src/assets/locales/zh_CN/super.json")
const SUPER_EN_LOCALE_PATH = path.resolve(process.cwd(), "src/assets/locales/en_US/super.json")

/**
 * 递归收集目录下的所有 TSX 文件，确保聊天页组件引用的 super 词条都能被扫描到。
 */
function collectTsxFiles(dirPath: string): string[] {
	return fs.readdirSync(dirPath, { withFileTypes: true }).flatMap((entry) => {
		const entryPath = path.join(dirPath, entry.name)

		if (entry.isDirectory()) {
			return collectTsxFiles(entryPath)
		}

		return entry.isFile() && entry.name.endsWith(".tsx") ? [entryPath] : []
	})
}

/**
 * 从 useTranslation("super") 或其别名调用里提取词条，避免运行时才发现命名空间路径写错。
 */
function extractSuperTranslationKeys(fileContent: string): string[] {
	const translationAliasMatches = Array.from(
		fileContent.matchAll(
			/const\s*\{\s*t(?:\s*:\s*(\w+))?\s*\}\s*=\s*useTranslation\("super"\)/g,
		),
	)
	const aliases = translationAliasMatches.map((match) => match[1] ?? "t")

	return aliases.flatMap((alias) => {
		const keyPattern = new RegExp(`(?:^|[^\\w.])${alias}\\("([^"]+)"`, "g")
		return Array.from(fileContent.matchAll(keyPattern), (match) => match[1]).flatMap((key) => {
			// 允许在 super 命名空间里显式写 super:key；其它命名空间的 key 不参与本测试校验。
			if (key.includes(":")) {
				return key.startsWith("super:") ? [key.slice("super:".length)] : []
			}

			return [key]
		})
	})
}

/**
 * 按点路径读取 locale 对象，校验组件里引用的 key 在中英文词典中都存在。
 */
function hasLocaleKey(locale: unknown, localeKey: string): boolean {
	return localeKey.split(".").every((segment) => {
		if (locale == null || typeof locale !== "object" || !(segment in locale)) {
			return false
		}

		locale = (locale as Record<string, unknown>)[segment]
		return true
	})
}

describe("superMagicMobile ChatPage super 词条引用", () => {
	it("所有 useTranslation('super') 的 key 都存在于中英文 locale", () => {
		const zhLocale = JSON.parse(fs.readFileSync(SUPER_ZH_LOCALE_PATH, "utf-8")) as unknown
		const enLocale = JSON.parse(fs.readFileSync(SUPER_EN_LOCALE_PATH, "utf-8")) as unknown
		const missingKeys: string[] = []

		for (const filePath of collectTsxFiles(CHAT_PAGE_COMPONENTS_DIR)) {
			const fileContent = fs.readFileSync(filePath, "utf-8")
			const superKeys = extractSuperTranslationKeys(fileContent)

			for (const localeKey of superKeys) {
				if (!hasLocaleKey(zhLocale, localeKey) || !hasLocaleKey(enLocale, localeKey)) {
					missingKeys.push(`${path.relative(process.cwd(), filePath)} -> ${localeKey}`)
				}
			}
		}

		expect(missingKeys).toEqual([])
	})
})
