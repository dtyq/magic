function getJsonSignature(value: unknown): string {
	try {
		return JSON.stringify(value ?? null)
	} catch {
		return String(value)
	}
}

function collectAttachments(list: unknown[] | undefined, result: unknown[] = []): unknown[] {
	if (!Array.isArray(list)) return result
	for (const item of list) {
		if (!item || typeof item !== "object") continue
		result.push(item)
		const children = (item as { children?: unknown[] }).children
		collectAttachments(children, result)
	}
	return result
}

function getAttachmentName(item: Record<string, unknown>): string {
	return String(item.file_name || item.filename || item.name || "")
}

function joinRelativePath(parentDir: string, name: string): string {
	const parent = (parentDir || "").replace(/\/+$/, "")
	const child = (name || "").replace(/^\/+/, "")
	if (!parent) return child
	if (!child) return parent
	return `${parent}/${child}`
}

function normalizeDirectoryPath(relativePath?: string): string | undefined {
	if (!relativePath) return undefined
	const path = relativePath.replace(/\/+$/, "")
	return path ? `${path}/` : ""
}

function getBaseFolderPath(mainFile: Record<string, unknown> | undefined): string | undefined {
	const relativePath =
		typeof mainFile?.relative_file_path === "string" ? mainFile.relative_file_path : undefined
	if (relativePath) {
		if (mainFile?.is_directory) return normalizeDirectoryPath(relativePath)
		const fileName = typeof mainFile?.file_name === "string" ? mainFile.file_name : ""
		if (fileName && relativePath.endsWith(fileName)) {
			return relativePath.slice(0, -fileName.length)
		}
		return normalizeDirectoryPath(relativePath.replace(/[^/]*$/, ""))
	}
	const name = mainFile ? getAttachmentName(mainFile) : ""
	if (mainFile?.is_directory && name) return normalizeDirectoryPath(name)
	return undefined
}

function normalizeAttachmentItem(item: Record<string, unknown>) {
	return {
		file_id: item.file_id,
		file_name: item.file_name,
		parent_id: item.parent_id,
		relative_file_path: item.relative_file_path,
		updated_at: item.updated_at,
		file_version: item.file_version,
		display_config: item.display_config,
	}
}

function collectFolderScopedItems(
	attachmentList: unknown[] | undefined,
	mainFileId: string | undefined,
): Record<string, unknown>[] {
	if (!Array.isArray(attachmentList) || !mainFileId) return []

	const allAttachments = collectAttachments(attachmentList) as Record<string, unknown>[]
	const mainFile = allAttachments.find((item) => item?.file_id === mainFileId)
	const baseFolderPath = getBaseFolderPath(mainFile)
	const baseDir = (baseFolderPath || "").replace(/\/+$/, "")
	const scoped = new Map<string, Record<string, unknown>>()

	const visit = (item: Record<string, unknown> | undefined, parentDir: string) => {
		if (!item) return
		const relativePath =
			typeof item.relative_file_path === "string" && item.relative_file_path
				? item.relative_file_path.replace(/\/+$/, "")
				: joinRelativePath(parentDir, getAttachmentName(item))
		const key = String(item.file_id || relativePath || "")
		if (key) scoped.set(key, item)
		const childParent = item.is_directory ? relativePath || parentDir : parentDir
		const children = item.children
		if (!Array.isArray(children)) return
		children.forEach((child) => {
			if (child && typeof child === "object") {
				visit(child as Record<string, unknown>, childParent)
			}
		})
	}

	if (mainFile) {
		const rootParent = baseDir.includes("/") ? baseDir.slice(0, baseDir.lastIndexOf("/")) : ""
		visit(mainFile, rootParent)
	}

	allAttachments.forEach((item) => {
		const relativePath = item?.relative_file_path
		const key = String(item.file_id || relativePath || "")
		if (!key || scoped.has(key)) return
		if (baseFolderPath !== undefined) {
			if (typeof relativePath === "string" && relativePath.startsWith(baseFolderPath)) {
				scoped.set(key, item)
			}
			return
		}
		if (item?.file_id === mainFileId) scoped.set(key, item)
	})

	return Array.from(scoped.values())
}

/**
 * Signature of files under the current PPT folder only.
 * Other template folders must not invalidate this preview.
 */
export function getFolderScopedAttachmentSignature(
	attachmentList: unknown[] | undefined,
	mainFileId: string | undefined,
): string {
	if (!Array.isArray(attachmentList) || !mainFileId) return ""
	return getJsonSignature(
		collectFolderScopedItems(attachmentList, mainFileId).map(normalizeAttachmentItem),
	)
}
