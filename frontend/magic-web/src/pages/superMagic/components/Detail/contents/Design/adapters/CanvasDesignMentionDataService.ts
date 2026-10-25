import type {
	DataService,
	MentionData,
	MentionItem,
	ProjectFileMentionData,
} from "@/components/business/MentionPanel/types"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import { getFolderMentionData } from "@/components/business/MentionPanel/utils/directoryMention"
import type { I18nTexts } from "@/components/business/MentionPanel/i18n/types"
import {
	type CatalogRequest,
	type EffectRequest,
	type MentionStoreRequest,
	type MentionStoreResult,
	type SearchRequest,
} from "@/components/business/MentionPanel/dispatch"
import type {
	CanvasReferenceElementsContext,
	ProjectAttachmentMentionNode,
} from "@/components/CanvasDesign/public/props"
import type { ResolveCanvasResourceReference } from "@/components/CanvasDesign/public/resource-reference"
import type {
	ReferenceAssetPerTypeLimits,
	ReferenceAssetTypeCounts,
	ReferenceResourceFileInfo,
	ReferenceResourceTypeFilter,
} from "@/components/CanvasDesign/ui/editors/message/reference-assets/reference-resource.types"
import {
	classifyReferenceAssetFile,
	isReferenceAssetTypeCapacityBlocked,
	isReferenceResourceCurrentlySelected,
	isReferenceResourceTypeAllowed,
} from "@/components/CanvasDesign/ui/editors/message/reference-assets/referenceResourceSelection"
import {
	isCanvasElementsMentionItemId,
	MentionPanelCanvasElementsStore,
	type ActiveCanvasElementsContext,
	type CanvasElementResolvedFile,
} from "@/components/business/MentionPanel/runtime/builtin/domains/canvas-elements"
import { resolveCanvasStorageResourceReference } from "@/components/CanvasDesign/runtime/shared/path/canvasResourcePath"

function getExtension(name: string): string {
	const idx = name.lastIndexOf(".")
	return idx >= 0 ? name.slice(idx + 1) : ""
}

function normalizeRelativePath(path: string): string {
	if (!path) return ""
	return path.startsWith("/") ? path.slice(1) : path
}

function normalizePathSlashes(path: string): string {
	return normalizeRelativePath(path).replace(/\\/g, "/").trim()
}

function normalizeFolderLookupKey(path: string | undefined): string {
	return normalizePathSlashes(path || "").replace(/^\/+|\/+$/g, "")
}

function normalizeCanvasElementResourcePath(path: string): string {
	const trimmed = path.trim()
	if (!trimmed) return ""

	const withoutQuery = trimmed.split(/[?#]/)[0] ?? ""
	const urlPath = (() => {
		try {
			return new URL(withoutQuery).pathname
		} catch {
			return withoutQuery
		}
	})()

	return normalizePathSlashes(urlPath).replace(/^(\.\/)+/, "")
}

/**
 * 仅对「设计附件 DSL 式路径」等需要补全显示名的条目写入副标题前缀：
 * - 同级其它根文件夹（如「新建文件夹」）下的文件不加前缀，避免 `新建画布/新建文件夹/...`
 * - `file_path` 已以设计根名开头时不再写 metadata，避免 `新建画布/新建画布/...`
 */
function shouldAttachMentionFileSubtitleParentPrefix(
	attachmentRoots: ProjectAttachmentMentionNode[],
	normalizedFilePath: string,
	designRootFolderName: string,
): boolean {
	const fp = normalizePathSlashes(normalizedFilePath)
	const root = normalizePathSlashes(designRootFolderName)
	if (!fp || !root) return false

	if (fp === root || fp.startsWith(`${root}/`)) {
		return false
	}

	for (const n of attachmentRoots) {
		if (!n.isDirectory || !n.name?.trim()) continue
		const seg = normalizePathSlashes(n.name)
		if (!seg || seg === root) continue
		if (fp === seg || fp.startsWith(`${seg}/`)) {
			return false
		}
	}

	return true
}

function findFolderNode(
	nodes: ProjectAttachmentMentionNode[],
	folderId: string,
): ProjectAttachmentMentionNode | null {
	const targetKey = normalizeFolderLookupKey(folderId)
	for (const n of nodes) {
		if (
			n.isDirectory &&
			(n.id === folderId ||
				n.path === folderId ||
				normalizeFolderLookupKey(n.id) === targetKey ||
				normalizeFolderLookupKey(n.path) === targetKey)
		) {
			return n
		}
		if (n.children?.length) {
			const found = findFolderNode(n.children, folderId)
			if (found) return found
		}
	}
	return null
}

interface AttachmentFileEntry {
	name: string
	path: string
	extension?: string
	fileId: string
	displayConfig?: ProjectAttachmentMentionNode["display_config"]
}

interface AttachmentFileLookup {
	files: AttachmentFileEntry[]
	byNormalizedPathEntries: Map<string, AttachmentFileEntry[]>
	byFileId: Map<string, AttachmentFileEntry>
}

function flattenAttachmentFiles(nodes: ProjectAttachmentMentionNode[]): AttachmentFileEntry[] {
	const out: AttachmentFileEntry[] = []
	for (const n of nodes) {
		if (!n.isDirectory) {
			out.push({
				name: n.name,
				path: n.path,
				extension: n.extension,
				fileId: n.fileId,
				displayConfig: n.display_config,
			})
			continue
		}
		if (n.children?.length) {
			out.push(...flattenAttachmentFiles(n.children))
		}
	}
	return out
}

export interface LimitInfo {
	/** 最大参考文件数量限制 */
	maxReferenceFiles?: number
	/** 当前已选中的参考文件路径列表 */
	currentReferenceFiles?: string[]
	/** 是否已达到参考文件数量限制 */
	isReferenceFileLimitReached?: boolean
	/** 当前资源选择器允许的文件类型 */
	referenceResourceType?: ReferenceResourceTypeFilter
	/** 当前元素的参考文件列表（用户上传等），合并到面板数据源，与 matchableItems 同步 */
	referenceFileInfos?: ReferenceResourceFileInfo[]
	assetLimits?: ReferenceAssetPerTypeLimits
	currentAssetCounts?: ReferenceAssetTypeCounts
	/** 宿主资源解析器，用于资源同一性比较。 */
	resolveResourceReference?: ResolveCanvasResourceReference
	/** 面包屑等文案用；搜索列表右侧路径与 MessageEditor 一致，由 MentionPanel renderer 根据 file_path 计算 */
	projectFilesPathPrefix?: string
	/** 设计根目录显示名，副标题为 `{prefix}/{父路径}`（与 workspace renderer 约定 metadata 键） */
	mentionFileSubtitleParentPrefix?: string
}

export type LimitInfoGetter = () => LimitInfo | undefined

/**
 * 画布设计场景专用的 Mention DataService：附件树层级 + 与 MessageEditor 一致的合并/过滤规则
 */
export class CanvasDesignMentionDataService implements DataService {
	private attachmentRoots: ProjectAttachmentMentionNode[]
	private limitInfoGetter?: LimitInfoGetter
	private refreshHandler?: () => void
	private readonly canvasElementsStore = new MentionPanelCanvasElementsStore()
	private canvasElementsRootFolderId?: string
	private attachmentFileLookup: AttachmentFileLookup | null = null

	constructor(initialAttachmentRoots: ProjectAttachmentMentionNode[]) {
		this.attachmentRoots = initialAttachmentRoots
	}

	/** 宿主树更新时替换内存根，与「重建 DataService」等价但不换实例 */
	syncProjectAttachmentRoots(roots: ProjectAttachmentMentionNode[]): void {
		this.attachmentRoots = roots
		this.invalidateAttachmentLookup()
		this.invalidateCanvasElementsCache()
	}

	setLimitInfoGetter(getter: LimitInfoGetter | undefined): void {
		this.limitInfoGetter = getter
		this.invalidateCanvasElementsCache()
	}

	setRefreshHandler(handler: (() => void) | undefined): void {
		this.refreshHandler = handler
	}

	requestRefresh(): void {
		this.invalidateCanvasElementsCache()
		this.refreshHandler?.()
	}

	invalidateCanvasElementsCache(): void {
		this.canvasElementsStore.invalidateCache()
	}

	setCanvasReferenceElementsContext(context: CanvasReferenceElementsContext | undefined): void {
		const nextRootFolderId = context?.rootFolderId
		this.canvasElementsRootFolderId = nextRootFolderId
		this.canvasElementsStore.setActiveContext(
			context
				? ({
						designProjectId: context.rootFolderId || "current-canvas",
						canvasName: context.canvasName || "当前画布",
						getCanvasDocument: context.getCanvasDocument,
						resolveFileBySrc: (src) => this.resolveCanvasElementFileBySrc(src),
					} satisfies ActiveCanvasElementsContext)
				: null,
		)
	}

	private resolveCanvasElementFileBySrc(src: string): CanvasElementResolvedFile | null {
		const file = this.findAttachmentFileBySrc(src)
		if (!file) {
			return null
		}

		const limitInfo = this.limitInfoGetter?.()
		const ext = file.extension || getExtension(file.name)
		const rawPath = file.path
		const filePath = normalizeRelativePath(rawPath)
		const unSelectable = this.isReferenceFileSelectionBlocked(
			{
				rawPath,
				filePath,
				fileExtension: ext,
				fileId: file.fileId,
			},
			limitInfo,
		)

		const resolvedFile: CanvasElementResolvedFile = {
			file_id: file.fileId,
			file_name: file.name,
			file_extension: ext,
			relative_file_path: filePath || rawPath,
			unSelectable,
		}
		if (file.displayConfig) resolvedFile.display_config = file.displayConfig
		return resolvedFile
	}

	private invalidateAttachmentLookup(): void {
		this.attachmentFileLookup = null
	}

	private getAttachmentFileLookup(): AttachmentFileLookup {
		if (this.attachmentFileLookup) return this.attachmentFileLookup

		const files = flattenAttachmentFiles(this.attachmentRoots)
		const byNormalizedPathEntries = new Map<string, AttachmentFileEntry[]>()
		const byFileId = new Map<string, AttachmentFileEntry>()

		const addPathEntry = (key: string, file: AttachmentFileEntry) => {
			if (!key) return
			const bucket = byNormalizedPathEntries.get(key)
			if (!bucket) {
				byNormalizedPathEntries.set(key, [file])
				return
			}
			if (!bucket.includes(file)) bucket.push(file)
		}

		for (const file of files) {
			const normalizedPath = normalizeCanvasElementResourcePath(file.path)
			addPathEntry(normalizedPath, file)
			if (file.fileId && !byFileId.has(file.fileId)) {
				byFileId.set(file.fileId, file)
			}
		}

		this.attachmentFileLookup = {
			files,
			byNormalizedPathEntries,
			byFileId,
		}
		return this.attachmentFileLookup
	}

	private findAttachmentFileBySrc(src: string): AttachmentFileEntry | null {
		const attachmentLookup = this.getAttachmentFileLookup()
		const resolveResourceReference = this.limitInfoGetter?.()?.resolveResourceReference
		if (!resolveResourceReference) return null

		const resolution = resolveCanvasStorageResourceReference(src, resolveResourceReference, {
			requireAttachment: true,
		})
		if (resolution.status !== "resolved" || resolution.resourceKind !== "workspace-file") {
			return null
		}

		if (resolution.attachmentId) {
			const byFileId = attachmentLookup.byFileId.get(resolution.attachmentId)
			if (byFileId) return byFileId
		}

		const workspacePath = normalizeCanvasElementResourcePath(resolution.workspacePath || "")
		if (!workspacePath) return null
		const matches = attachmentLookup.byNormalizedPathEntries.get(workspacePath) ?? []
		return matches.length === 1 ? matches[0] : null
	}

	private getCanvasElementsRootItem(t?: I18nTexts): MentionItem | null {
		return this.canvasElementsStore.getRootMentionItem({
			lazy: true,
			label: t?.defaultItems.canvasElements,
		})
	}

	private getCanvasElementsRootItemForFolder(
		folderId?: string,
		t?: I18nTexts,
	): MentionItem | null {
		if (!folderId) return null
		if (
			!this.canvasElementsRootFolderId ||
			normalizeFolderLookupKey(folderId) !==
				normalizeFolderLookupKey(this.canvasElementsRootFolderId)
		) {
			return null
		}

		return this.getCanvasElementsRootItem(t)
	}

	private injectCanvasElementsRootItem(
		items: MentionItem[],
		folderId?: string,
		t?: I18nTexts,
	): MentionItem[] {
		const rootItem = this.getCanvasElementsRootItemForFolder(folderId, t)
		if (!rootItem || items.some((item) => item.id === rootItem.id)) return items

		return [{ ...rootItem, description: undefined }, ...items]
	}

	private isReferenceFileSelectionBlocked(
		file: {
			rawPath: string
			filePath: string
			fileExtension: string
			fileId: string
		},
		limitInfo?: LimitInfo | null,
	): boolean {
		const targetPath = file.rawPath || file.filePath
		if (
			!isReferenceResourceTypeAllowed({
				filePath: targetPath,
				fileExtension: file.fileExtension,
				referenceResourceType: limitInfo?.referenceResourceType,
			})
		) {
			return true
		}

		if (!limitInfo?.assetLimits || !limitInfo.currentAssetCounts) return false

		return isReferenceAssetTypeCapacityBlocked({
			fileClass: classifyReferenceAssetFile({
				filePath: targetPath,
				fileExtension: file.fileExtension,
			}),
			assetLimits: limitInfo.assetLimits,
			currentAssetCounts: limitInfo.currentAssetCounts,
			candidatePaths: [file.rawPath, file.filePath, file.fileId],
			currentReferenceFiles: limitInfo.currentReferenceFiles,
			resolveResourceReference: limitInfo.resolveResourceReference,
		})
	}

	private fileNodeToMentionItem(
		node: ProjectAttachmentMentionNode,
		limitInfo?: LimitInfo | null,
	): MentionItem {
		const ext = node.extension || getExtension(node.name)
		const rawPath = (node.path || node.id || "") as string
		const filePath = normalizeRelativePath(rawPath)
		const unSelectable = this.isReferenceFileSelectionBlocked(
			{
				rawPath,
				filePath,
				fileExtension: ext,
				fileId: node.id,
			},
			limitInfo,
		)
		const trimmedSubtitlePrefix = limitInfo?.mentionFileSubtitleParentPrefix?.trim() ?? ""
		const attachSubtitlePrefix =
			trimmedSubtitlePrefix.length > 0 &&
			shouldAttachMentionFileSubtitleParentPrefix(
				this.attachmentRoots,
				filePath || rawPath,
				trimmedSubtitlePrefix,
			)

		return {
			id: node.id,
			type: MentionItemType.PROJECT_FILE,
			name: node.name,
			icon: ext,
			extension: ext,
			hasChildren: false,
			isFolder: false,
			path: filePath || rawPath,
			unSelectable,
			...(attachSubtitlePrefix
				? {
						metadata: { mentionFileSubtitleParentPrefix: trimmedSubtitlePrefix },
					}
				: {}),
			data: {
				file_id: node.fileId,
				file_name: node.name,
				file_path: filePath || rawPath,
				file_extension: ext,
			} as ProjectFileMentionData,
		}
	}

	private dirNodeToMentionItem(node: ProjectAttachmentMentionNode): MentionItem {
		const rel = normalizeRelativePath(node.path)
		const childCount = node.children?.length ?? 0
		return {
			id: node.id,
			type: MentionItemType.FOLDER,
			name: node.name,
			icon: "file-folder",
			hasChildren: childCount > 0,
			isFolder: true,
			path: node.path,
			unSelectable: false,
			data: getFolderMentionData({
				directoryId: node.fileId,
				directoryName: node.name,
				directoryPath: rel,
				directoryMetadata: node.display_config?.type ? node.display_config : undefined,
			}),
		}
	}

	private levelToMentionItems(
		nodes: ProjectAttachmentMentionNode[],
		limitInfo?: LimitInfo | null,
	): MentionItem[] {
		return nodes.map((n) =>
			n.isDirectory ? this.dirNodeToMentionItem(n) : this.fileNodeToMentionItem(n, limitInfo),
		)
	}

	/** 合并附件树中的文件与 referenceFileInfos，并打上 unSelectable */
	private toMergedFlatFileItems(limitInfo?: LimitInfo | null): MentionItem[] {
		const baseFiles = this.getAttachmentFileLookup().files
		const itemMap = new Map<string, MentionItem>()

		for (const f of baseFiles) {
			const key = f.path || f.fileId || f.name
			if (!key) continue
			const pseudo: ProjectAttachmentMentionNode = {
				id: f.fileId,
				fileId: f.fileId,
				name: f.name,
				path: f.path,
				extension: f.extension,
				isDirectory: false,
			}
			itemMap.set(key, this.fileNodeToMentionItem(pseudo, limitInfo))
		}

		if (limitInfo?.referenceFileInfos?.length) {
			for (const info of limitInfo.referenceFileInfos) {
				const key = info.path || info.fileName
				if (!key) continue
				const ext = getExtension(info.fileName)
				const pseudo: ProjectAttachmentMentionNode = {
					id: info.path ?? info.fileName,
					fileId: info.path ?? info.fileName,
					name: info.fileName,
					path: info.path ?? "",
					extension: ext,
					isDirectory: false,
				}
				itemMap.set(key, this.fileNodeToMentionItem(pseudo, limitInfo))
			}
		}

		const items = Array.from(itemMap.values())
		return this.applyReferenceSelectionLimit(items, limitInfo)
	}

	private applyReferenceSelectionLimit(
		items: MentionItem[],
		limitInfo?: LimitInfo | null,
	): MentionItem[] {
		if (
			!limitInfo?.isReferenceFileLimitReached ||
			!limitInfo?.currentReferenceFiles ||
			limitInfo.currentReferenceFiles.length === 0
		) {
			return items
		}
		const nextItems = items.map((item) => {
			if (item.type !== MentionItemType.PROJECT_FILE) {
				return item
			}
			const d = item.data as ProjectFileMentionData
			const candidates = [d.file_path, item.path, item.id].filter(Boolean) as string[]
			return {
				...item,
				unSelectable:
					Boolean(item.unSelectable) ||
					!isReferenceResourceCurrentlySelected(
						candidates,
						limitInfo.currentReferenceFiles,
						limitInfo.resolveResourceReference,
					),
			}
		})
		return nextItems
	}

	/** 仅附件树子树中的文件（不含 referenceFileInfos 合并） */
	private flatAttachmentSubtreeFileItems(
		nodes: ProjectAttachmentMentionNode[],
		limitInfo?: LimitInfo | null,
	): MentionItem[] {
		const baseFiles = flattenAttachmentFiles(nodes)
		const items = baseFiles.map((f) => {
			const pseudo: ProjectAttachmentMentionNode = {
				id: f.fileId,
				fileId: f.fileId,
				name: f.name,
				path: f.path,
				extension: f.extension,
				isDirectory: false,
			}
			return this.fileNodeToMentionItem(pseudo, limitInfo)
		})
		return this.applyReferenceSelectionLimit(items, limitInfo)
	}

	/**
	 * 默认返回项目附件根目录；画布内的“当前目录默认进入”由 MentionPanel 初始状态控制。
	 * 无虚拟根；根级 PanelState.DEFAULT + 空 navigationStack 时不显示返回键。
	 */
	private getDefaultItems(t: I18nTexts): MentionItem[] {
		void t
		const limitInfo = this.limitInfoGetter?.()
		return this.applyReferenceSelectionLimit(
			this.levelToMentionItems(this.attachmentRoots, limitInfo),
			limitInfo,
		)
	}

	private searchItems(query: string, scopeFolderId?: string): MentionItem[] {
		const q = query.toLowerCase().trim()
		const limitInfo = this.limitInfoGetter?.()
		let items: MentionItem[]
		const trimmedScope = scopeFolderId?.trim()
		if (isCanvasElementsMentionItemId(trimmedScope)) {
			return this.canvasElementsStore.searchItems(
				query,
				trimmedScope,
				this.matchesCanvasElementQuery,
			)
		}
		if (trimmedScope) {
			const node = findFolderNode(this.attachmentRoots, trimmedScope)
			items = node?.children?.length
				? this.flatAttachmentSubtreeFileItems(node.children, limitInfo)
				: []
		} else {
			items = this.toMergedFlatFileItems(limitInfo)
		}
		// 与 MessageEditor @ 面板一致：不设 item.description，由 workspace-files renderer
		// 根据 file_path / file_name 在搜索态展示父目录路径（见 getTypeDescription）
		if (!q) return items
		const fileItems = items.filter((item) => this.itemMatchesSearchQuery(item, q))
		if (trimmedScope) return fileItems

		return [
			...this.canvasElementsStore.searchItems(
				query,
				undefined,
				this.matchesCanvasElementQuery,
			),
			...fileItems,
		]
	}

	private matchesCanvasElementQuery(target: string, query: string): boolean {
		return target.toLowerCase().includes(query.toLowerCase())
	}

	private itemMatchesSearchQuery(item: MentionItem, q: string): boolean {
		if (item.name?.toLowerCase().includes(q)) return true
		if (item.path?.toLowerCase().includes(q)) return true
		if (item.extension?.toLowerCase().includes(q)) return true
		if (item.type === MentionItemType.PROJECT_FILE && item.data) {
			const d = item.data as ProjectFileMentionData
			if (d.file_name?.toLowerCase().includes(q)) return true
			if (d.file_path?.toLowerCase().includes(q)) return true
		}
		return false
	}

	private getFolderItems(folderId: string, t?: I18nTexts): Promise<MentionItem[]> {
		if (isCanvasElementsMentionItemId(folderId)) {
			return Promise.resolve(this.canvasElementsStore.getFolderMentionItems(folderId))
		}

		const limitInfo = this.limitInfoGetter?.()
		const node = findFolderNode(this.attachmentRoots, folderId)
		const folderItems = node?.children?.length
			? this.applyReferenceSelectionLimit(
					this.levelToMentionItems(node.children, limitInfo),
					limitInfo,
				)
			: []

		return Promise.resolve(this.injectCanvasElementsRootItem(folderItems, folderId, t))
	}

	private hasFolder(folderId: string): boolean {
		if (isCanvasElementsMentionItemId(folderId)) return true
		return findFolderNode(this.attachmentRoots, folderId) !== null
	}

	dispatch(request: MentionStoreRequest): Promise<MentionStoreResult> | MentionStoreResult {
		return this.handleDispatch(request)
	}

	private handleDispatch(
		request: MentionStoreRequest,
	): Promise<MentionStoreResult> | MentionStoreResult {
		switch (request.kind) {
			case "default":
				return {
					items: this.getDefaultItems(request.options.t),
				}
			case "search": {
				const r = request as SearchRequest
				return {
					items: this.searchItems(r.query, r.scopeFolderId),
				}
			}
			case "children":
				return this.getFolderItems(request.id, request.options?.t).then((items) => ({
					items,
				}))
			case "catalog":
				return this.resolveCatalogItems(request)
			case "effect":
				return this.runEffect(request)
			case "validate":
				return {
					isValid: this.validateMention(request.item),
				}
			default:
				return {}
		}
	}

	private resolveCatalogItems(request: CatalogRequest): MentionStoreResult {
		void request
		return {
			items: [],
		}
	}

	private runEffect(request: EffectRequest): MentionStoreResult {
		void request
		return {}
	}

	private hasProjectFile(fileId: string) {
		const limitInfo = this.limitInfoGetter?.()
		return this.toMergedFlatFileItems(limitInfo).some((item) => {
			return (item.data as ProjectFileMentionData | undefined)?.file_id === fileId
		})
	}

	private validateMention(item: { type: string; data?: MentionData }): boolean {
		if (item.type === MentionItemType.PROJECT_FILE) {
			const fileId = this.getProjectFileId(item.data)
			if (!fileId) return false
			return this.hasProjectFile(fileId)
		}

		if (item.type === MentionItemType.FOLDER) {
			const directoryId = this.getDirectoryId(item.data)
			if (!directoryId) return false
			return this.hasFolder(directoryId)
		}

		return false
	}

	private getProjectFileId(data?: MentionData): string | undefined {
		if (!data) return undefined
		if (!("file_id" in data)) return undefined
		return typeof data.file_id === "string" ? data.file_id : undefined
	}

	private getDirectoryId(data?: MentionData): string | undefined {
		if (!data) return undefined
		if (!("directory_id" in data)) return undefined
		return typeof data.directory_id === "string" ? data.directory_id : undefined
	}
}
