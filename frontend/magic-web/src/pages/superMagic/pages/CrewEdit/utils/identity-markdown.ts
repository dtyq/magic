import yaml from "js-yaml"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"

/** Matches skill_config / workspace YAML scalar style */
const IDENTITY_FRONTMATTER_YAML_DUMP_OPTIONS = {
	lineWidth: -1,
	quotingType: '"' as const,
	forceQuotes: true,
}

export const IDENTITY_MARKDOWN_FILE_NAME = "IDENTITY.md"

/** Canonical project-relative path for crew identity markdown */
export const IDENTITY_MARKDOWN_RELATIVE_PATH = ".magic/IDENTITY.md" as const
export const MAGIC_ROOT_DIRECTORY_NAME = ".magic" as const

type AttachmentPathFields = AttachmentItem & {
	file_path?: string
	file_type?: string
	type?: string
}

export interface IdentityMarkdownData {
	name: string
	description: string
	nameCn?: string
	nameEn?: string
	role?: string
	roleCn?: string
	roleEn?: string
	descriptionCn?: string
	descriptionEn?: string
	promptZh?: string
	promptEn?: string
}

interface FrontmatterRange {
	start: number
	rawFrontmatter: string
	suffix: string
}

export interface UpdateIdentityMarkdownResult {
	content: string
	updatedName: boolean
	updatedDescription: boolean
}

export function findIdentityMarkdownFile(files: AttachmentItem[]): AttachmentItem | null {
	const byPath = files.find((file) => isIdentityMarkdownAttachmentByPath(file))
	if (byPath) return byPath

	return findIdentityMarkdownInAttachmentTree(files)
}

export function normalizeWorkspaceRelativePath(path: string | undefined | null): string {
	if (!path) return ""
	return path.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "").replace(/\/+$/, "")
}

function isDirectoryAttachment(item: AttachmentPathFields): boolean {
	return Boolean(item.is_directory || item.type === "directory" || item.file_type === "directory")
}

function isIdentityMarkdownAttachmentByPath(file: AttachmentItem): boolean {
	const ext = file as AttachmentPathFields
	if (isDirectoryAttachment(ext)) return false

	const combined = normalizeWorkspaceRelativePath(
		ext.relative_file_path ?? ext.file_path ?? ext.path ?? "",
	)
	if (!combined) return false

	return combined === IDENTITY_MARKDOWN_RELATIVE_PATH
}

function findIdentityMarkdownInAttachmentTree(nodes: AttachmentItem[]): AttachmentItem | null {
	const magicRoot = nodes.find((node) => {
		const ext = node as AttachmentPathFields
		if (!isDirectoryAttachment(ext)) return false
		return (
			(ext.file_name ?? ext.name ?? ext.filename ?? "").trim() === MAGIC_ROOT_DIRECTORY_NAME
		)
	}) as AttachmentPathFields | undefined
	if (!magicRoot) return null

	const children = (magicRoot.children ?? []) as AttachmentItem[]
	return (
		children.find((child) => {
			const childExt = child as AttachmentPathFields
			if (isDirectoryAttachment(childExt)) return false
			const childName = (
				childExt.file_name ??
				childExt.name ??
				childExt.filename ??
				""
			).trim()
			return childName === IDENTITY_MARKDOWN_FILE_NAME
		}) ?? null
	)
}

export function getIdentityMarkdownFileSignature(file: AttachmentItem | null): string {
	if (!file?.file_id) return ""

	return [
		file.file_id,
		file.updated_at ?? "",
		file.file_version ?? "",
		file.version ?? "",
		file.last_updated_at ?? "",
	].join(":")
}

export function parseIdentityMarkdown(content: string): IdentityMarkdownData {
	const normalizedContent = normalizeText(content)
	const { attributes, blockAttributeKeys, body } = extractFrontmatter(normalizedContent)
	const hasFrontmatter = Object.keys(attributes).length > 0
	const normalizedBody = body.trim()
	const promptZh = extractLocaleComment(normalizedBody, "zh")
	const promptEn = hasFrontmatter || promptZh ? removeLocaleComments(normalizedBody).trim() : ""
	const fallbackDescription = removeLeadingNameHeading(normalizedBody)

	const name =
		cleanInlineValue(getAttributeValue(attributes, ["name"])) ||
		parseInlineField(normalizedBody, ["name", "title", "标题", "名称"]) ||
		parseFirstHeading(normalizedBody)
	const nameCn = cleanInlineValue(getAttributeValue(attributes, ["name-cn", "name_cn"]))
	const nameEn = cleanInlineValue(getAttributeValue(attributes, ["name-en", "name_en"]))
	const role = cleanInlineValue(getAttributeValue(attributes, ["role"]))
	const roleCn = cleanInlineValue(getAttributeValue(attributes, ["role-cn", "role_cn"]))
	const roleEn = cleanInlineValue(getAttributeValue(attributes, ["role-en", "role_en"]))

	const description =
		cleanFrontmatterValue({
			value: getAttributeValue(attributes, ["description"]),
			isBlockValue: hasBlockAttribute(blockAttributeKeys, ["description"]),
		}) ||
		parseSection(normalizedBody, ["description", "desc", "描述"]) ||
		parseInlineField(normalizedBody, ["description", "desc", "描述"]) ||
		fallbackDescription
	const descriptionCn = cleanFrontmatterValue({
		value: getAttributeValue(attributes, ["description-cn", "description_cn"]),
		isBlockValue: hasBlockAttribute(blockAttributeKeys, ["description-cn", "description_cn"]),
	})
	const descriptionEn = cleanFrontmatterValue({
		value: getAttributeValue(attributes, ["description-en", "description_en"]),
		isBlockValue: hasBlockAttribute(blockAttributeKeys, ["description-en", "description_en"]),
	})

	return {
		name,
		description,
		nameCn,
		nameEn,
		role,
		roleCn,
		roleEn,
		descriptionCn,
		descriptionEn,
		promptZh,
		promptEn,
	}
}

export function buildIdentityMarkdown({
	name,
	description,
	nameCn,
	nameEn,
	role,
	roleCn,
	roleEn,
	descriptionCn,
	descriptionEn,
	promptZh,
	promptEn,
}: IdentityMarkdownData): string {
	const frontmatterLines = [
		"---",
		...buildFrontmatterYamlLines([
			["name", name],
			["name-cn", nameCn],
			["name-en", nameEn],
			["role", role],
			["role-cn", roleCn],
			["role-en", roleEn],
			["description", description],
			["description-cn", descriptionCn],
			["description-en", descriptionEn],
		]),
		"---",
	]
	const contentBlocks = [buildLocaleCommentBlock("zh", promptZh), promptEn?.trim() || ""].filter(
		Boolean,
	)

	if (contentBlocks.length === 0) return frontmatterLines.join("\n")

	return `${frontmatterLines.join("\n")}\n\n${contentBlocks.join("\n\n")}`.trimEnd()
}

export function updateIdentityMarkdownContent({
	originalContent,
	nextData,
	previousData,
}: {
	originalContent: string
	nextData: IdentityMarkdownData
	previousData?: IdentityMarkdownData | null
}): UpdateIdentityMarkdownResult {
	let content = normalizeText(originalContent)
	const nextName = nextData.name.trim()
	const nextDescription = nextData.description.trim()
	const previousName = previousData?.name?.trim() ?? ""
	const previousDescription = previousData?.description?.trim() ?? ""

	const shouldUpdateName = nextName !== previousName
	const shouldUpdateDescription = nextDescription !== previousDescription

	if (!shouldUpdateName && !shouldUpdateDescription) {
		return {
			content,
			updatedName: true,
			updatedDescription: true,
		}
	}

	let updatedName = !shouldUpdateName
	let updatedDescription = !shouldUpdateDescription

	if (shouldUpdateName) {
		const result =
			replaceFrontmatterField(content, "name", nextName) ??
			replaceInlineField(content, ["name", "title", "标题", "名称"], nextName) ??
			replaceFirstHeading(content, nextName)
		if (result) {
			content = result
			updatedName = true
		}
	}

	if (shouldUpdateDescription) {
		const result =
			replaceFrontmatterField(content, "description", nextDescription) ??
			replaceSection(content, ["description", "desc", "描述"], nextDescription) ??
			replaceInlineField(content, ["description", "desc", "描述"], nextDescription) ??
			replaceLegacyBodyDescription(content, nextDescription)
		if (result) {
			content = result
			updatedDescription = true
		}
	}

	return {
		content,
		updatedName,
		updatedDescription,
	}
}

export function syncIdentityMarkdownContent({
	originalContent,
	nextData,
}: {
	originalContent: string
	nextData: IdentityMarkdownData
}): string {
	const normalizedContent = normalizeText(originalContent)
	const frontmatterRange = extractFrontmatterRange(normalizedContent)
	if (!frontmatterRange) return buildIdentityMarkdown(nextData)

	const nextSupportedEntries = buildFrontmatterYamlLines([
		["name", nextData.name],
		["name-cn", nextData.nameCn],
		["name-en", nextData.nameEn],
		["role", nextData.role],
		["role-cn", nextData.roleCn],
		["role-en", nextData.roleEn],
		["description", nextData.description],
		["description-cn", nextData.descriptionCn],
		["description-en", nextData.descriptionEn],
	])
	const supportedKeys = new Set(IDENTITY_FRONTMATTER_KEYS)
	const preservedLines = collectUnsupportedFrontmatterLines(
		frontmatterRange.rawFrontmatter,
		supportedKeys,
	)
	const mergedFrontmatterLines = [...nextSupportedEntries, ...preservedLines]
	const frontmatter = `---\n${mergedFrontmatterLines.join("\n")}\n---`

	return `${normalizedContent.slice(0, frontmatterRange.start)}${frontmatter}${frontmatterRange.suffix}`
}

function normalizeText(content: string): string {
	return content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n")
}

function extractFrontmatter(content: string): {
	attributes: Record<string, string>
	blockAttributeKeys: Set<string>
	body: string
} {
	if (!content.startsWith("---\n")) {
		return { attributes: {}, blockAttributeKeys: new Set<string>(), body: content }
	}

	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
	if (!frontmatterMatch) {
		return { attributes: {}, blockAttributeKeys: new Set<string>(), body: content }
	}

	const [, rawFrontmatter, body] = frontmatterMatch
	const lines = rawFrontmatter.split("\n")
	const attributes: Record<string, string> = {}
	const blockAttributeKeys = new Set<string>()

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index]
		const keyMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
		if (!keyMatch) continue

		const [, rawKey, rawValue] = keyMatch
		const key = rawKey.trim().toLowerCase()
		const value = rawValue.trim()

		if (value === "|" || value === ">") {
			const blockLines: string[] = []
			let nextIndex = index + 1

			while (nextIndex < lines.length) {
				const nextLine = lines[nextIndex]
				if (/^\s{2,}/.test(nextLine) || nextLine === "") {
					blockLines.push(nextLine.replace(/^\s{2}/, ""))
					nextIndex += 1
					continue
				}
				break
			}

			attributes[key] = blockLines.join("\n").trim()
			blockAttributeKeys.add(key)
			index = nextIndex - 1
			continue
		}

		attributes[key] = value
	}

	return { attributes, blockAttributeKeys, body }
}

function cleanInlineValue(value?: string): string {
	return decodeYamlScalarString(value)
}

function cleanBlockValue(value?: string): string {
	return value?.trim() ?? ""
}

function cleanFrontmatterValue({
	value,
	isBlockValue,
}: {
	value?: string
	isBlockValue: boolean
}): string {
	if (isBlockValue) return cleanBlockValue(value)
	return cleanInlineValue(value)
}

function getAttributeValue(
	attributes: Record<string, string>,
	candidateKeys: string[],
): string | undefined {
	for (const key of candidateKeys) {
		const value = attributes[key.toLowerCase()]
		if (value != null) return value
	}

	return undefined
}

function buildOrderedFrontmatterObject(
	entries: Array<[string, string | undefined]>,
): Record<string, string> {
	const obj: Record<string, string> = {}
	for (const [key, value] of entries) {
		const normalizedValue = value?.trim()
		if (!normalizedValue) continue
		obj[key] = normalizedValue
	}
	return obj
}

function dumpIdentityFrontmatterYaml(obj: Record<string, string>): string {
	if (Object.keys(obj).length === 0) return ""
	return yaml.dump(obj, IDENTITY_FRONTMATTER_YAML_DUMP_OPTIONS).trimEnd()
}

function buildFrontmatterYamlLines(entries: Array<[string, string | undefined]>): string[] {
	const yamlText = dumpIdentityFrontmatterYaml(buildOrderedFrontmatterObject(entries))
	return yamlText ? yamlText.split("\n") : []
}

function dumpYamlScalar(value: string): string {
	return yaml.dump(value, IDENTITY_FRONTMATTER_YAML_DUMP_OPTIONS).trimEnd()
}

function decodeYamlScalarString(value?: string): string {
	const normalizedValue = value?.trim()
	if (!normalizedValue) return ""

	// Frontmatter inline strings are dumped with quotes.
	if (!/^["']/.test(normalizedValue)) return normalizedValue

	try {
		const parsedValue = yaml.load(normalizedValue)
		if (parsedValue == null) return ""
		return String(parsedValue).trim()
	} catch {
		return normalizedValue.replace(/^["']|["']$/g, "").trim()
	}
}

function parseInlineField(content: string, labels: string[]): string {
	for (const label of labels) {
		const matcher = new RegExp(`^${escapeForRegExp(label)}\\s*:\\s*(.+)$`, "im")
		const match = content.match(matcher)
		if (match?.[1]) return match[1].trim()
	}

	return ""
}

function parseFirstHeading(content: string): string {
	const match = content.match(/^#\s+(.+)$/m)
	return match?.[1]?.trim() ?? ""
}

function parseSection(content: string, labels: string[]): string {
	for (const label of labels) {
		const matcher = new RegExp(
			`^##\\s+${escapeForRegExp(label)}\\s*\\n([\\s\\S]*?)(?=^##\\s+.+$|\\Z)`,
			"im",
		)
		const match = content.match(matcher)
		if (match?.[1]) return match[1].trim()
	}

	return ""
}

function removeLeadingNameHeading(content: string): string {
	return content.replace(/^#\s+.+$(?:\n+)?/m, "").trim()
}

function extractLocaleComment(content: string, locale: string): string {
	const matcher = new RegExp(`<!--\\s*${escapeForRegExp(locale)}\\s*\\n([\\s\\S]*?)\\n-->`, "i")
	const match = content.match(matcher)
	return match?.[1]?.trim() ?? ""
}

function removeLocaleComments(content: string): string {
	return content.replace(/<!--\s*[a-z_]+\s*\n[\s\S]*?\n-->\s*/gi, "").trim()
}

function buildLocaleCommentBlock(locale: string, content?: string): string {
	const normalizedContent = content?.trim()
	if (!normalizedContent) return ""

	return `<!--${locale}\n${normalizedContent}\n-->`
}

function replaceFrontmatterField(content: string, key: string, nextValue: string): string | null {
	const range = extractFrontmatterRange(content)
	if (!range) return null

	const lines = range.rawFrontmatter.split("\n")
	const nextLines: string[] = []
	let replaced = false

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index]
		const keyMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
		if (!keyMatch || normalizeAttributeKey(keyMatch[1]) !== normalizeAttributeKey(key)) {
			nextLines.push(line)
			continue
		}

		replaced = true
		const [, rawKey, rawValue] = keyMatch
		const trimmedValue = rawValue.trim()

		if (trimmedValue === "|" || trimmedValue === ">") {
			nextLines.push(`${rawKey}: ${trimmedValue}`)
			nextLines.push(...formatYamlBlockLines(nextValue))

			let nextIndex = index + 1
			while (nextIndex < lines.length) {
				const nextLine = lines[nextIndex]
				if (/^\s{2,}/.test(nextLine) || nextLine === "") {
					nextIndex += 1
					continue
				}
				break
			}
			index = nextIndex - 1
			continue
		}

		nextLines.push(`${rawKey}: ${dumpYamlScalar(nextValue)}`)
	}

	if (!replaced) return null

	const frontmatter = `---\n${nextLines.join("\n")}\n---`
	return `${content.slice(0, range.start)}${frontmatter}${range.suffix}`
}

function replaceInlineField(content: string, labels: string[], nextValue: string): string | null {
	for (const label of labels) {
		const matcher = new RegExp(`^(${escapeForRegExp(label)}\\s*:\\s*)(.+)$`, "im")
		if (!matcher.test(content)) continue
		return content.replace(matcher, `$1${nextValue}`)
	}

	return null
}

function replaceFirstHeading(content: string, nextValue: string): string | null {
	const matcher = /^#\s+(.+)$/m
	if (!matcher.test(content)) return null
	return content.replace(matcher, `# ${nextValue}`)
}

function replaceSection(content: string, labels: string[], nextValue: string): string | null {
	for (const label of labels) {
		const matcher = new RegExp(
			`^(##\\s+${escapeForRegExp(label)}\\s*\\n)([\\s\\S]*?)(?=^##\\s+.+$|\\Z)`,
			"im",
		)
		if (!matcher.test(content)) continue
		return content.replace(matcher, (_, title) => `${title}${nextValue}\n`)
	}

	return null
}

function replaceLegacyBodyDescription(content: string, nextValue: string): string | null {
	if (extractFrontmatterRange(content) || extractLocaleComment(content, "zh")) return null

	const headingMatch = content.match(/^(#\s+.+)(?:\n+)([\s\S]*)$/)
	if (!headingMatch) return null

	const [, heading] = headingMatch
	return nextValue ? `${heading}\n\n${nextValue}` : heading
}

function extractFrontmatterRange(content: string): FrontmatterRange | null {
	const match = content.match(/^---\n([\s\S]*?)\n---([\s\S]*)$/)
	if (!match || match.index == null) return null

	return {
		start: match.index,
		rawFrontmatter: match[1],
		suffix: match[2],
	}
}

function formatYamlBlockLines(value: string): string[] {
	if (!value) return ["  "]
	return value.split("\n").map((line) => `  ${line}`)
}

function escapeForRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function normalizeAttributeKey(value: string): string {
	return value.trim().toLowerCase().replace(/-/g, "_")
}

function hasBlockAttribute(blockAttributeKeys: Set<string>, candidateKeys: string[]): boolean {
	return candidateKeys.some((key) => blockAttributeKeys.has(key.toLowerCase()))
}

function collectUnsupportedFrontmatterLines(
	rawFrontmatter: string,
	supportedKeys: Set<string>,
): string[] {
	const lines = rawFrontmatter.split("\n")
	const preservedLines: string[] = []

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index]
		const keyMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
		if (!keyMatch) {
			preservedLines.push(line)
			continue
		}

		const [, rawKey, rawValue] = keyMatch
		const normalizedKey = normalizeAttributeKey(rawKey)
		const isBlockValue = rawValue.trim() === "|" || rawValue.trim() === ">"

		if (!supportedKeys.has(normalizedKey)) preservedLines.push(line)

		if (!isBlockValue) continue

		let nextIndex = index + 1
		while (nextIndex < lines.length) {
			const nextLine = lines[nextIndex]
			if (/^\s{2,}/.test(nextLine) || nextLine === "") {
				if (!supportedKeys.has(normalizedKey)) preservedLines.push(nextLine)
				nextIndex += 1
				continue
			}
			break
		}
		index = nextIndex - 1
	}

	return trimLeadingBlankLines(preservedLines)
}

function trimLeadingBlankLines(lines: string[]): string[] {
	let index = 0
	while (index < lines.length && lines[index] === "") index += 1
	return lines.slice(index)
}

const IDENTITY_FRONTMATTER_KEYS = [
	"name",
	"name-cn",
	"name_cn",
	"name-en",
	"name_en",
	"role",
	"role-cn",
	"role_cn",
	"role-en",
	"role_en",
	"description",
	"description-cn",
	"description_cn",
	"description-en",
	"description_en",
]
