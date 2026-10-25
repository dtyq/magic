import { getMagicProjectType, type MagicProjectKind } from "@/constants/magicProjectTypes"
import type { AttachmentItem } from "../hooks/types"
import { buildAttachmentIndex, resolveAttachmentKey, type AttachmentIndex } from "./attachmentIndex"
import {
	buildSkillFileKinds,
	type SkillFileKind,
	type SkillFileStructure,
} from "./skill-file-structure"
import {
	resolveFileHelpPath,
	resolveSystemFileHelpKind,
	type FileHelpContext,
	type SystemFileHelpKind,
} from "./magic-system-folder"
import {
	getUserResourceKind,
	type UserResourceKind,
} from "../../UserSpace/userSpaceFilePresentation"
import type { TopicFileMagicVariant } from "../components/TopicFileIcon"
import type { ClawFileHelpKind } from "../../../pages/ClawPlayground/components/ClawFileHelpTag"
import {
	getChildrenForCustomMetadataIconPath,
	getFileTreeIconType,
	getFileIconType,
	isMagicProjectConfigFile,
} from "../../MessageList/components/MessageAttachment/utils"

export interface FilePresentationIndex {
	attachments: AttachmentIndex
	skills: SkillFileStructure
	byPath: ReadonlyMap<string, AttachmentItem>
}

const indexes = new WeakMap<AttachmentItem[], FilePresentationIndex>()

/** 数组引用代表已加载快照；树、消息、Tab 复用同一次派生，旧快照随引用释放。 */
export function getFilePresentationIndex(tree: AttachmentItem[]): FilePresentationIndex {
	const cached = indexes.get(tree)
	if (cached) return cached
	// 平铺列表有时仍携带 children；移除已作为子节点出现的重复根，避免按每个平铺项重复遍历子树。
	const childKeys = new Set(
		tree.flatMap((item) =>
			(item.children ?? []).map((child) => resolveAttachmentKey(child, "")).filter(Boolean),
		),
	)
	const roots = childKeys.size
		? tree.filter((item) => !childKeys.has(resolveAttachmentKey(item, "")))
		: tree
	const attachments = buildAttachmentIndex(roots)
	const skills = buildSkillFileKinds(roots)
	const byPath = new Map<string, AttachmentItem>()
	for (const [key, path] of skills.paths) {
		const item = attachments.getItemByKey(key)
		if (item && path) byPath.set(path, item)
	}
	const index = { attachments, skills, byPath }
	indexes.set(tree, index)
	return index
}

export interface FilePresentation {
	item: AttachmentItem
	name: string
	path: string
	context: FileHelpContext
	isDirectory: boolean
	type: string
	projectKind?: MagicProjectKind
	magicVariant?: TopicFileMagicVariant
	systemKind?: SystemFileHelpKind
	skillKind?: SkillFileKind
	userKind?: UserResourceKind
	clawKind?: ClawFileHelpKind
	customChildren?: unknown[]
}

export interface FilePresentationOptions {
	context?: FileHelpContext
	index?: FilePresentationIndex
	/** 调用方已持有的分类与路径，避免搜索后的树丢失技能入口。 */
	skillKind?: SkillFileKind
	path?: string
}

const CLAW_DIRECTORIES = {
	cron: ["scheduledTasks", "magic-cron"],
	skills: ["installedSkills", "magic-skills"],
	memory: ["memoryFolder", "magic-memory"],
} as const
const CLAW_FILES = {
	"skills.md": ["skillList", "magic-file-skills"],
	"agents.md": ["prompts", "magic-file-agent"],
	"heartbeat.md": ["proactiveExecution", "magic-file-heartbeat"],
	"identity.md": ["identityInfo", "magic-file-identity"],
	"soul.md": ["guidelines", "magic-file-soul"],
	"tools.md": ["toolList", "magic-file-tools"],
	"user.md": ["aboutYou", "magic-file-user"],
	"bootstrap.md": ["initialSetup", "magic-file-bootstrap"],
	"memory.md": ["memoryFile", "magic-file-memory"],
} as const

/** 仅组合已知文件事实，不请求文件、不推导安装状态，也不根据其它项目的同名路径补资料。 */
export function resolveFilePresentation(
	source: AttachmentItem,
	options: FilePresentationOptions = {},
): FilePresentation {
	const input =
		source.relative_file_path || typeof source.file_path !== "string"
			? source
			: { ...source, relative_file_path: source.file_path }
	let context: FileHelpContext = options.context ?? { kind: "unknown" }
	const reference = input.file_reference
	const user = (reference?.space_type ?? input.space_type) === "user"
	const inputProjectId =
		reference?.space_type === "project"
			? reference.project_id
			: typeof input.project_id === "string"
				? input.project_id
				: typeof input.source_project_id === "string"
					? input.source_project_id
					: undefined
	const sameOwner = user
		? context.kind === "user"
		: !inputProjectId || ("projectId" in context && context.projectId === inputProjectId)
	if (user) context = { kind: "user" }
	else if (inputProjectId && !sameOwner) context = { kind: "project", projectId: inputProjectId }
	const index = sameOwner ? options.index : undefined
	const candidate =
		index?.attachments.getItemById(input.file_id) ??
		(!input.file_id && resolveFileHelpPath(input)
			? index?.byPath.get(resolveFileHelpPath(input))
			: undefined)
	const candidateReference = candidate?.file_reference
	const candidateIsUser = (candidateReference?.space_type ?? candidate?.space_type) === "user"
	const current =
		candidateIsUser !== (context.kind === "user") ||
		(candidateReference?.space_type === "project" &&
			(!("projectId" in context) || candidateReference.project_id !== context.projectId))
			? undefined
			: candidate
	// 当前快照是事实来源；仅缺失字段沿用消息携带的值，显式 null 保留删除语义。
	const item: AttachmentItem = current
		? {
				...input,
				...Object.fromEntries(
					Object.entries(current).filter(([, value]) => value !== undefined),
				),
			}
		: input
	const key = resolveAttachmentKey(item, "")
	const path = options.path ?? index?.skills.paths.get(key) ?? resolveFileHelpPath(item)
	const isDirectory = item.is_directory === true || item.type === "directory"
	const normalizedItem = { ...item, is_directory: isDirectory, relative_file_path: path }
	const skillKind =
		options.skillKind ??
		index?.skills.kinds.get(key) ??
		(path === ".magic/skills" || path.startsWith(".magic/skills/")
			? buildSkillFileKinds([{ ...normalizedItem, children: undefined }], context).kinds.get(
					resolveAttachmentKey(normalizedItem, "root-0"),
				)
			: undefined)
	const systemKind = skillKind
		? undefined
		: resolveSystemFileHelpKind(normalizedItem, path, context)
	const userKind = context.kind === "user" ? getUserResourceKind(normalizedItem) : undefined
	let magicVariant: TopicFileMagicVariant | undefined =
		isDirectory && path === ".magic" ? "magic-root" : undefined
	let clawKind: ClawFileHelpKind | undefined
	if (systemKind) {
		magicVariant = isDirectory
			? "magic-root"
			: systemKind.endsWith("Identity")
				? "magic-file-identity"
				: systemKind.endsWith("Soul")
					? "magic-file-soul"
					: "magic-file-agent"
	}
	if (context.kind === "claw" && path.split("/").length === 2 && path.startsWith(".magic/")) {
		const name = path.slice(".magic/".length).toLowerCase()
		const definitions: Readonly<
			Record<string, readonly [ClawFileHelpKind, TopicFileMagicVariant]>
		> = isDirectory ? CLAW_DIRECTORIES : CLAW_FILES
		const definition = definitions[name]
		if (definition) [clawKind, magicVariant] = definition
	}
	if (userKind === "memory" || userKind === "coreMemory" || userKind === "projectCoreMemory")
		magicVariant = isDirectory ? "magic-memory" : "magic-file-memory"
	return {
		item: normalizedItem,
		name:
			item.display_filename ||
			item.file_name ||
			item.name ||
			item.filename ||
			path.split("/").at(-1) ||
			"",
		path,
		context,
		isDirectory,
		systemKind,
		skillKind,
		userKind,
		clawKind,
		magicVariant,
		projectKind: isMagicProjectConfigFile(
			item.file_name || item.display_filename || item.filename || item.name,
		)
			? undefined
			: getMagicProjectType(normalizedItem.display_config?.type)?.kind,
		type:
			getFileTreeIconType(normalizedItem) ||
			getFileIconType(normalizedItem) ||
			item.file_extension ||
			"",
		customChildren: getChildrenForCustomMetadataIconPath(normalizedItem, (id) =>
			index?.attachments.getItemById(id),
		),
	}
}
