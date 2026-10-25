import type { AttachmentItem } from "../hooks/types"
import { resolveAttachmentKey } from "./attachmentIndex"
import { resolveFileHelpPath, type FileHelpContext } from "./magic-system-folder"

export type SkillFileKind =
	| "library"
	| "skill"
	| "entry"
	| "references"
	| "scripts"
	| "assets"
	| "templates"
	| "examples"
	| "evals"
	| "evalCases"
	| "evalInputs"
	| "agents"
	| "readme"
	| "license"
	| "publishConfig"
	| "support"

export interface SkillFileStructure {
	readonly kinds: ReadonlyMap<string, SkillFileKind>
	/** 同一次派生复用父路径，供系统文件说明判断根目录与子目录。 */
	readonly paths: ReadonlyMap<string, string>
}

interface FileEntry {
	key: string
	item: AttachmentItem
	parentKey: string | null
	fallbackKey: string
}

interface SkillDirectory {
	kind: SkillFileKind
	root: string
	resourceRoot?: string
}

const SKILLS_ROOT = ".magic/skills"

const RESOURCE_DIRECTORIES: Readonly<Record<string, SkillFileKind>> = {
	references: "references",
	reference: "references",
	scripts: "scripts",
	assets: "assets",
	resources: "assets",
	templates: "templates",
	examples: "examples",
	evals: "evals",
	agents: "agents",
}

/** 复用现有节点 key 规则，仅遍历已加载附件，不为用途另建完整文件索引。 */
function* getEntries(attachments: readonly AttachmentItem[]): Generator<FileEntry> {
	const stack: FileEntry[] = attachments
		.map((item, i) => ({
			item,
			key: resolveAttachmentKey(item, `root-${i}`),
			parentKey: null,
			fallbackKey: `root-${i}`,
		}))
		.reverse()
	while (stack.length) {
		const entry = stack.pop()
		if (!entry) break
		if (entry.item.is_hidden) continue
		yield entry
		const children = entry.item.children ?? []
		for (let i = children.length - 1; i >= 0; i--) {
			const item = children[i]
			const fallbackKey = `${entry.fallbackKey}-${i}`
			stack.push({
				item,
				key: resolveAttachmentKey(item, fallbackKey),
				parentKey: entry.key,
				fallbackKey,
			})
		}
	}
}

/**
 * 只在附件快照变化时派生；行渲染通过 key 查询，不读 Skill 正文、不请求未展开目录。
 * `.magic/skills/a` 先表示技能容器；已加载的 `a/b/SKILL.md` 可确认内层包根。
 * `a/examples/SKILL.md` 则保留示例用途，不能把支持资料提升成另一个技能。
 */
export function buildSkillFileKinds(
	attachments: readonly AttachmentItem[],
	context?: FileHelpContext,
): SkillFileStructure {
	const paths = new Map<string, string>()
	const kinds = new Map<string, SkillFileKind>()
	const candidates = new Set<string>()
	const skillEntries: Array<FileEntry & { path: string; scope: string }> = []

	for (const entry of getEntries(attachments)) {
		const { item, key, parentKey } = entry
		const isDirectory = item.is_directory === true || item.type === "directory"
		const path = resolveFileHelpPath(item, parentKey === null ? "" : paths.get(parentKey))
		paths.set(key, path)
		const space = item.file_reference?.space_type ?? item.space_type ?? context?.kind
		if (!path) continue
		if (path !== SKILLS_ROOT && !path.startsWith(`${SKILLS_ROOT}/`)) continue
		const scope =
			item.file_reference?.space_type === "project"
				? item.file_reference.project_id
				: context && "projectId" in context
					? context.projectId
					: space === "user"
						? "user"
						: ""
		skillEntries.push({ ...entry, path, scope })
		if (!isDirectory && path.toLowerCase().endsWith("/skill.md")) {
			candidates.add(`${scope}:${path.slice(0, -"/SKILL.md".length)}`)
		}
	}

	const directories = new Map<string, SkillDirectory>()
	function getDirectory(path: string, scope: string): SkillDirectory {
		const segments = path.split("/")
		let state: SkillDirectory = { kind: "library", root: SKILLS_ROOT }
		let current = SKILLS_ROOT
		for (let i = 2; i < segments.length; i++) {
			const name = segments[i]
			const parent = current
			current += `/${name}`
			const key = `${scope}:${current}`
			const cached = directories.get(key)
			if (cached) {
				state = cached
				continue
			}
			if (i === 2) {
				state = { kind: "skill", root: current }
			} else if (state.resourceRoot) {
				// 仅约定的直接子目录细分用途，其余后代继续继承，例如 assets/references。
				if (
					parent === state.resourceRoot &&
					state.kind === "assets" &&
					name === "templates"
				)
					state = { ...state, kind: "templates", resourceRoot: current }
				else if (
					parent === state.resourceRoot &&
					state.kind === "evals" &&
					name === "files"
				)
					state = { ...state, kind: "evalInputs", resourceRoot: current }
			} else {
				const resourceKind =
					parent === state.root && Object.hasOwn(RESOURCE_DIRECTORIES, name)
						? RESOURCE_DIRECTORIES[name]
						: undefined
				if (resourceKind) state = { ...state, kind: resourceKind, resourceRoot: current }
				else if (candidates.has(key)) state = { kind: "skill", root: current }
				else state = { ...state, kind: "support" }
			}
			directories.set(key, state)
		}
		return state
	}

	for (const { item, key, path, scope } of skillEntries) {
		if (item.is_directory === true || item.type === "directory") {
			const directory = getDirectory(path, scope)
			kinds.set(
				key,
				directory.resourceRoot && path !== directory.resourceRoot
					? "support"
					: directory.kind,
			)
			continue
		}
		const separator = path.lastIndexOf("/")
		const parent = path.slice(0, separator)
		const name = path.slice(separator + 1)
		if (parent === SKILLS_ROOT) {
			kinds.set(key, name === "skill_config.yaml" ? "publishConfig" : "support")
			continue
		}
		const directory = getDirectory(parent, scope)
		let kind: SkillFileKind = "support"
		if (path === `${directory.root}/evals/evals.json`) kind = "evalCases"
		else if (parent === directory.root) {
			if (name.toLowerCase() === "skill.md") kind = "entry"
			else if (name === "README.md") kind = "readme"
			else if (/^LICEN[CS]E(?:\.(?:md|txt))?$/.test(name)) kind = "license"
		}
		kinds.set(key, kind)
	}
	return { kinds, paths }
}
