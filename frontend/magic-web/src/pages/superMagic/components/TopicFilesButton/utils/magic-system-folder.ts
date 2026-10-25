import type { AttachmentItem } from "../hooks/types"

/** Keep in sync with MAGIC_ROOT_DIRECTORY_NAME (identity-markdown.ts). */
const MAGIC_FOLDER_NAME = ".magic" as const
const PROJECT_INSTRUCTIONS_FILE_NAME = "AGENTS.md" as const

/** 场景属于文件定义工作区；使用某个员工聊天不等于正在编辑该员工。 */
export type FileHelpContext =
	{ kind: "project" | "claw" | "crew"; projectId: string } | { kind: "user" | "unknown" }

export type SystemFileHelpKind =
	| "projectMagic"
	| "userMagic"
	| "clawMagic"
	| "crewMagic"
	| "projectInstructions"
	| "directoryInstructions"
	| "clawInstructions"
	| "clawIdentity"
	| "clawSoul"
	| "crewInstructions"
	| "agentInstructions"
	| "instructionFile"
	| "crewIdentity"
	| "crewSoul"

/** 优先使用真实空间路径；仅有文件名时，必须由已知父节点确定目录作用域。 */
export function resolveFileHelpPath(item: AttachmentItem, parentPath?: string): string {
	const raw = item.file_reference?.space_relative_path ?? item.relative_file_path ?? item.path
	if (raw) {
		const normalized = raw
			.trim()
			.replace(/^\.\//, "")
			.replace(/^\/+|\/+$/g, "")
		const parts = normalized.split("/")
		if (parts.some((part) => part === ".." || part.includes("\0"))) return ""
		if (parts[0] === ".workspace" && item.file_reference?.space_type !== "user") parts.shift()
		if (parts[0] === "~" && (item.file_reference?.space_type ?? item.space_type) === "user")
			parts.shift()
		return parts.filter((part) => part && part !== ".").join("/")
	}
	if (parentPath === undefined) return ""
	const name = item.file_name || item.name || item.filename || ""
	return name ? [parentPath, name].filter(Boolean).join("/") : ""
}

/**
 * 展示用途与删除保护分开：后者仍使用下方既有宽匹配，不能因文案细化而放宽保护。
 * 用户挂载文件优先于页面场景；其它项目的文件也不能继承当前龙虾或员工身份。
 */
export function resolveSystemFileHelpKind(
	item: AttachmentItem,
	path = resolveFileHelpPath(item),
	context?: FileHelpContext,
): SystemFileHelpKind | undefined {
	const reference = item.file_reference
	const space = reference?.space_type ?? item.space_type
	let owner: FileHelpContext["kind"] = context?.kind ?? "unknown"
	if (space === "user") owner = "user"
	else if (reference?.space_type === "project") {
		if (!context || !("projectId" in context) || context.projectId !== reference.project_id)
			owner = "project"
	}
	if (item.is_directory) {
		if (path !== MAGIC_FOLDER_NAME) return
		switch (owner) {
			case "user":
				return "userMagic"
			case "claw":
				return "clawMagic"
			case "crew":
				return "crewMagic"
			case "project":
				return "projectMagic"
			default:
				return
		}
	}
	if (owner === "crew") {
		if (path === ".magic/IDENTITY.md") return "crewIdentity"
		if (path === ".magic/SOUL.md") return "crewSoul"
	}
	if (owner === "claw") {
		if (path === ".magic/IDENTITY.md") return "clawIdentity"
		if (path === ".magic/SOUL.md") return "clawSoul"
	}
	const name = path.split("/").at(-1) || item.file_name || item.name || item.filename
	if (name !== PROJECT_INSTRUCTIONS_FILE_NAME) return
	if (owner === "user" || owner === "unknown" || !path) return "instructionFile"
	if (path === ".magic/AGENTS.md") {
		if (owner === "claw") return "clawInstructions"
		if (owner === "crew") return "crewInstructions"
		return "agentInstructions"
	}
	// `.magic` 中的资料不参与普通目录规则索引，也不能冒充定义根的行为指令。
	if (path.split("/").includes(MAGIC_FOLDER_NAME)) return "instructionFile"
	return path === PROJECT_INSTRUCTIONS_FILE_NAME ? "projectInstructions" : "directoryInstructions"
}

export interface ProjectInstructionsFileCandidate {
	readonly is_directory?: boolean
	readonly name?: string
	readonly file_name?: string
	readonly filename?: string
	readonly display_filename?: string
	readonly relative_file_path?: string
	readonly path?: string
}

export type ProjectInstructionsFileKind = "project" | "magic"

function basenameMatchesProjectInstructionsFile(item: ProjectInstructionsFileCandidate): boolean {
	const candidates = [item.name, item.file_name, item.filename, item.display_filename]
	return candidates.some((candidate) => candidate?.trim() === PROJECT_INSTRUCTIONS_FILE_NAME)
}

function pathLeafSegmentIsProjectInstructionsFile(path?: string): boolean {
	if (!path) return false
	const segments = path.replace(/\\/g, "/").split("/").filter(Boolean)
	return segments[segments.length - 1] === PROJECT_INSTRUCTIONS_FILE_NAME
}

function pathIsUnderMagicFolder(path?: string): boolean {
	if (!path) return false
	return path.replace(/\\/g, "/").split("/").filter(Boolean).includes(MAGIC_FOLDER_NAME)
}

/**
 * 区分普通项目规则与 `.magic/AGENTS.md`，避免各文件列表重复猜测路径语义。
 * 只负责本次新增的 AGENTS.md 分类，不改变现有 `.magic` 文件体系。
 */
export function resolveProjectInstructionsFileKind(
	item: ProjectInstructionsFileCandidate,
): ProjectInstructionsFileKind | undefined {
	if (item.is_directory) return undefined

	const isInstructionsFile =
		basenameMatchesProjectInstructionsFile(item) ||
		pathLeafSegmentIsProjectInstructionsFile(item.relative_file_path) ||
		pathLeafSegmentIsProjectInstructionsFile(item.path)
	if (!isInstructionsFile) return undefined

	if (pathIsUnderMagicFolder(item.relative_file_path) || pathIsUnderMagicFolder(item.path)) {
		return "magic"
	}

	return "project"
}

function basenameMatchesMagicFolder(item: AttachmentItem): boolean {
	const candidates = [item.name, item.file_name, item.filename, item.display_filename]
	for (const c of candidates) {
		const value = typeof c === "string" ? c.trim() : ""
		if (value === MAGIC_FOLDER_NAME) return true
	}
	return false
}

function pathLeafSegmentIsMagicFolder(path?: string): boolean {
	if (!path) return false
	const normalized = path.replace(/\\/g, "/")
	const segments = normalized.split("/").filter(Boolean)
	const leaf = segments[segments.length - 1]
	return leaf === MAGIC_FOLDER_NAME
}

/** True only for the root `.magic` directory node — not descendants under `.magic/`. */
export function isMagicSystemFolder(item: AttachmentItem): boolean {
	if (!item.is_directory) return false
	if (basenameMatchesMagicFolder(item)) return true
	return (
		pathLeafSegmentIsMagicFolder(item.relative_file_path) ||
		pathLeafSegmentIsMagicFolder(item.path)
	)
}

/** True when the node is `.magic` itself or any file/folder stored under a `.magic/` path. */
export function isNodeUnderMagicSystemFolder(item: AttachmentItem): boolean {
	if (isMagicSystemFolder(item)) return true

	const pathCandidates = [item.relative_file_path, item.path]
	for (const pathCandidate of pathCandidates) {
		if (!pathCandidate) continue
		const segments = pathCandidate.replace(/\\/g, "/").split("/").filter(Boolean)
		if (segments.includes(MAGIC_FOLDER_NAME)) return true
	}

	return false
}

function subtreeContainsMagicFolder(node: AttachmentItem): boolean {
	if (isMagicSystemFolder(node)) return true
	if (!node.is_directory || !node.children?.length) return false
	for (const child of node.children) {
		if (subtreeContainsMagicFolder(child)) return true
	}
	return false
}

/**
 * True when deleting the current selection implies removing `.magic`:
 * `.magic` is selected, a selected folder's subtree contains it, or any selected
 * file/folder lives under a `.magic/` path (mobile cascade only stores descendant file ids).
 */
export function hasMagicSystemFolderInDeletionSelection(
	items: AttachmentItem[],
	selectedItems: Set<string>,
	getItemId: (item: AttachmentItem) => string,
): boolean {
	function walk(nodes: AttachmentItem[]): boolean {
		for (const node of nodes) {
			const id = getItemId(node)
			if (selectedItems.has(id)) {
				if (subtreeContainsMagicFolder(node)) return true
				if (isNodeUnderMagicSystemFolder(node)) return true
			} else if (node.is_directory && node.children?.length) {
				if (walk(node.children)) return true
			}
		}
		return false
	}
	return walk(items)
}

function findAttachmentByKey(
	items: AttachmentItem[],
	key: string,
	getItemId: (item: AttachmentItem) => string,
): AttachmentItem | undefined {
	for (const node of items) {
		if (getItemId(node) === key) return node
		if (node.children?.length) {
			const found = findAttachmentByKey(node.children, key, getItemId)
			if (found) return found
		}
	}
	return undefined
}

/**
 * Pick mobile delete-sheet magic warning copy: single when selection is only under `.magic`,
 * multi when `.magic` is mixed with other paths.
 */
export function resolveMagicDeleteWarningVariant(
	attachments: AttachmentItem[],
	selectedKeys: Set<string>,
	getItemId: (item: AttachmentItem) => string,
): "none" | "single" | "multi" {
	if (!hasMagicSystemFolderInDeletionSelection(attachments, selectedKeys, getItemId)) {
		return "none"
	}

	const hasSelectionOutsideMagic = [...selectedKeys].some((key) => {
		const node = findAttachmentByKey(attachments, key, getItemId)
		if (!node) return false
		return !isNodeUnderMagicSystemFolder(node)
	})

	return hasSelectionOutsideMagic ? "multi" : "single"
}

interface SingleDeleteConfirmContentKeyParams {
	isFolder: boolean
	isMagicFolder: boolean
}

/**
 * 统一单文件/文件夹删除的正文 key 选择，避免移动端 sheet 与桌面 modal 分叉后漏掉 `.magic` 特殊提示。
 */
export function resolveSingleDeleteConfirmContentKey({
	isFolder,
	isMagicFolder,
}: SingleDeleteConfirmContentKeyParams) {
	if (isMagicFolder) return "topicFiles.contextMenu.deleteMagicFolderContent"
	if (isFolder) return "topicFiles.contextMenu.deleteFolderContent"
	return "topicFiles.contextMenu.deleteFileDescription"
}

interface BatchDeleteConfirmContentKeyParams {
	containsFolders: boolean
	touchesMagicFolder: boolean
}

/**
 * 批量删除优先提示 `.magic` 风险，其次再回退到通用文件夹/文件文案。
 */
export function resolveBatchDeleteConfirmContentKey({
	containsFolders,
	touchesMagicFolder,
}: BatchDeleteConfirmContentKeyParams) {
	if (touchesMagicFolder) return "topicFiles.contextMenu.confirmBatchDeleteWithMagicSystemFolder"
	if (containsFolders) return "topicFiles.contextMenu.confirmBatchDeleteWithFolders"
	return "topicFiles.contextMenu.confirmBatchDelete"
}
