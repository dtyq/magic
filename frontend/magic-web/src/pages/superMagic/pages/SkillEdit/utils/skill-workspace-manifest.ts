import yaml from "js-yaml"
import i18n from "i18next"
import { SupportLocales } from "@/constants/locale"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { SkillWorkspaceManifest } from "../store/types"

/** API skill detail fields used for default-slot PATCH (structurally matches SkillDetailResponse) */
export interface SkillDetailDefaultSlotSource {
	name_i18n?: Record<string, string> | null
	description_i18n?: Record<string, string> | null
}

type SkillI18nTextShape = Record<SupportLocales, string>

export interface DefaultSlotUpdatePayload {
	name_i18n?: SkillI18nTextShape
	description_i18n?: SkillI18nTextShape
}

/** Root folder for skill workspace files under project */
export const MAGIC_SKILLS_ROOT = ".magic/skills" as const

export const SKILL_CONFIG_FILE_NAME = "skill_config.yaml" as const
export const SKILL_MD_FILE_NAME = "SKILL.md" as const

export const SKILL_CONFIG_RELATIVE_PATH = `${MAGIC_SKILLS_ROOT}/${SKILL_CONFIG_FILE_NAME}`

export function normalizeRelativeFilePath(path: string | undefined | null): string {
	if (!path) return ""
	return path.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "").replace(/\/+$/, "")
}

export function matchesRelativePath(
	itemPath: string | undefined | null,
	targetSuffix: string,
): boolean {
	const n = normalizeRelativeFilePath(itemPath)
	const t = normalizeRelativeFilePath(targetSuffix)
	if (!n || !t) return false
	return n === t || n.endsWith(`/${t}`)
}

export function findAttachmentByRelativePath(
	list: AttachmentItem[],
	relativePath: string,
): AttachmentItem | undefined {
	return list.find((item) => {
		if (item.is_directory || item.type === "directory") return false
		return matchesRelativePath(item.relative_file_path, relativePath)
	})
}

export function buildSkillMdRelativePath(skillDir: string): string {
	const trimmed = skillDir.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "")
	return `${MAGIC_SKILLS_ROOT}/${trimmed}/${SKILL_MD_FILE_NAME}`
}

type AttachmentPathFields = AttachmentItem & { file_path?: string; file_type?: string }

function itemProjectRelativePath(item: AttachmentPathFields): string {
	return normalizeRelativeFilePath(item.relative_file_path ?? item.file_path ?? item.path ?? "")
}

/** Walk tree by segment names (same idea as getParentIdFromPath). */
export function findDirectoryIdBySegmentWalk(
	tree: AttachmentItem[],
	segments: readonly string[],
): string | undefined {
	if (!segments.length) return undefined
	let current = tree
	let lastId: string | undefined

	for (const segment of segments) {
		const found = current.find((item) => {
			const ext = item as AttachmentPathFields
			const isDir = Boolean(
				ext.is_directory || ext.type === "directory" || ext.file_type === "directory",
			)
			if (!isDir) return false
			const fn = item.file_name ?? item.name ?? item.filename ?? ""
			return fn === segment
		})
		if (!found?.file_id) return undefined
		lastId = String(found.file_id)
		current = (found.children as AttachmentItem[]) || []
	}
	return lastId
}

/** Resolve directory file_id from flat attachment list (exact or suffix path). */
export function findDirectoryIdByRelativePath(
	list: AttachmentItem[],
	relativeDirPath: string,
): string | undefined {
	const target = normalizeRelativeFilePath(relativeDirPath)
	if (!target) return undefined
	for (const item of list) {
		const ext = item as AttachmentPathFields
		if (!ext.is_directory && ext.type !== "directory" && ext.file_type !== "directory") continue
		const p = itemProjectRelativePath(ext)
		if (!p) continue
		if (p === target || matchesRelativePath(p, target)) {
			const id = item.file_id
			if (id !== undefined && id !== null && `${id}` !== "") return String(id)
		}
	}
	return undefined
}

/** Skill dir segment(s) under .magic/skills when relative path is .../SKILL.md */
export function parseSkillDirFromSkillMdRelativePath(
	relativePath: string | undefined | null,
): string | null {
	const n = normalizeRelativeFilePath(relativePath)
	if (!n) return null
	const parts = n.split("/").filter(Boolean)
	if (parts.length < 3) return null
	const last = parts[parts.length - 1]
	if (last.toLowerCase() !== SKILL_MD_FILE_NAME.toLowerCase()) return null
	const dirPart = parts.slice(0, -1).join("/")
	const prefix = `${MAGIC_SKILLS_ROOT}/`
	if (dirPart.startsWith(prefix)) {
		const inner = dirPart.slice(prefix.length)
		if (!inner || inner.includes("..")) return null
		return inner
	}
	const embedded = `/${MAGIC_SKILLS_ROOT}/`
	const idx = dirPart.indexOf(embedded)
	if (idx === -1) return null
	const inner = dirPart.slice(idx + embedded.length)
	if (!inner || inner.includes("..")) return null
	return inner
}

type AttachmentWithTimes = AttachmentItem & {
	updated_at?: string
	updatedAt?: string
	modify_time?: string | number
}

export function getAttachmentUpdatedAtMs(item: AttachmentItem): number {
	const ext = item as AttachmentWithTimes
	const raw = ext.updated_at ?? ext.updatedAt ?? ext.modify_time
	if (typeof raw === "number" && Number.isFinite(raw)) return raw
	if (typeof raw === "string" && raw.trim()) {
		const t = Date.parse(raw)
		if (!Number.isNaN(t)) return t
	}
	return 0
}

/**
 * Among `.magic/skills/<dir>/SKILL.md` paths, returns `dir` whose SKILL.md has the latest
 * `updated_at` (ties: lexicographically last dir name).
 */
export function pickLastModifiedSkillDirWithSkillMd(list: AttachmentItem[]): string | null {
	const bestMsByDir = new Map<string, number>()

	for (const item of list) {
		if (item.is_directory || item.type === "directory") continue
		const dir = parseSkillDirFromSkillMdRelativePath(item.relative_file_path)
		if (!dir) continue
		const ms = getAttachmentUpdatedAtMs(item)
		const prev = bestMsByDir.get(dir) ?? 0
		if (ms >= prev) bestMsByDir.set(dir, Math.max(prev, ms))
	}

	if (bestMsByDir.size === 0) return null

	const sorted = Array.from(bestMsByDir.entries()).sort((a, b) => {
		if (b[1] !== a[1]) return b[1] - a[1]
		return b[0].localeCompare(a[0])
	})
	return sorted[0]?.[0] ?? null
}

const SKILL_CONFIG_YAML_SKILL_KEY = "skill"
const SKILL_CONFIG_YAML_DIR_KEY = "dir"

type SkillConfigYamlShape = {
	[SKILL_CONFIG_YAML_SKILL_KEY]?: {
		[SKILL_CONFIG_YAML_DIR_KEY]?: string
	}
}

/** Minimal skill_config.yaml when the file is missing before publish */
export function buildDefaultSkillConfigYaml(skillDir: string): string {
	const safe = skillDir.trim()
	if (!safe) throw new Error("skillDir is required for skill_config.yaml")
	return `${yaml
		.dump({ skill: { dir: safe } }, { lineWidth: -1, quotingType: '"', forceQuotes: true })
		.trimEnd()}\n`
}

export function parseSkillConfigYaml(content: string): string | null {
	try {
		const data = yaml.load(content) as SkillConfigYamlShape | null | undefined
		const dir = data?.[SKILL_CONFIG_YAML_SKILL_KEY]?.[SKILL_CONFIG_YAML_DIR_KEY]
		if (typeof dir !== "string") return null
		const trimmed = dir.trim()
		return trimmed.length > 0 ? trimmed : null
	} catch {
		return null
	}
}

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---/

interface SkillMdFrontmatter {
	name?: unknown
	"name-cn"?: unknown
	name_cn?: unknown
	description?: unknown
	"description-cn"?: unknown
	description_cn?: unknown
}

function asTrimmedString(v: unknown): string {
	if (typeof v !== "string") return ""
	return v.trim()
}

export function parseSkillMdFrontmatter(content: string): SkillWorkspaceManifest {
	const match = content.match(FRONTMATTER_REGEX)
	if (!match?.[1]) {
		return emptyManifest()
	}

	let data: SkillMdFrontmatter
	try {
		data = yaml.load(match[1]) as SkillMdFrontmatter
	} catch {
		return emptyManifest()
	}

	if (!data || typeof data !== "object") return emptyManifest()

	const nameCn = asTrimmedString(data["name-cn"] ?? data.name_cn)
	const descCn = asTrimmedString(data["description-cn"] ?? data.description_cn)

	return {
		nameDefault: asTrimmedString(data.name),
		nameCn,
		descriptionDefault: asTrimmedString(data.description),
		descriptionCn: descCn,
	}
}

function emptyManifest(): SkillWorkspaceManifest {
	return {
		nameDefault: "",
		nameCn: "",
		descriptionDefault: "",
		descriptionCn: "",
	}
}

export function pickManifestSkillName(manifest: SkillWorkspaceManifest | null): string {
	if (!manifest) return ""

	const i18nMap: Record<string, string> = {
		[SupportLocales.enUS]: manifest.nameDefault,
		[SupportLocales.zhCN]: manifest.nameCn,
		default: manifest.nameDefault,
	}

	const language = i18n.language?.toLowerCase() ?? "en"
	const preferredKeys = language.startsWith("zh")
		? [SupportLocales.zhCN, "zh", SupportLocales.enUS, "en", SupportLocales.fallback]
		: [SupportLocales.enUS, "en", SupportLocales.zhCN, "zh", SupportLocales.fallback]

	for (const key of preferredKeys) {
		const value = i18nMap[key]
		if (value) return value
	}

	return manifest.nameDefault || manifest.nameCn
}

function isDefaultSlotEmpty(raw: Record<string, string> | null | undefined): boolean {
	const v = raw?.[SupportLocales.fallback]
	return !v || !String(v).trim()
}

export function buildDefaultSlotUpdateParams(
	detail: SkillDetailDefaultSlotSource,
	manifest: SkillWorkspaceManifest | null,
): DefaultSlotUpdatePayload | null {
	if (!manifest) return null

	const nameRaw = detail.name_i18n as Record<string, string> | undefined
	const descRaw = detail.description_i18n as Record<string, string> | undefined

	let nameI18n: SkillI18nTextShape | undefined
	let descriptionI18n: SkillI18nTextShape | undefined

	if (isDefaultSlotEmpty(nameRaw) && manifest.nameDefault.trim()) {
		nameI18n = {
			[SupportLocales.fallback]: manifest.nameDefault.trim(),
			[SupportLocales.enUS]: nameRaw?.[SupportLocales.enUS] ?? "",
			[SupportLocales.zhCN]: nameRaw?.[SupportLocales.zhCN] ?? "",
		}
	}

	if (isDefaultSlotEmpty(descRaw) && manifest.descriptionDefault.trim()) {
		descriptionI18n = {
			[SupportLocales.fallback]: manifest.descriptionDefault.trim(),
			[SupportLocales.enUS]: descRaw?.[SupportLocales.enUS] ?? "",
			[SupportLocales.zhCN]: descRaw?.[SupportLocales.zhCN] ?? "",
		}
	}

	if (!nameI18n && !descriptionI18n) return null

	const params: DefaultSlotUpdatePayload = {}
	if (nameI18n) params.name_i18n = nameI18n
	if (descriptionI18n) params.description_i18n = descriptionI18n
	return params
}
