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
import type { ProjectAttachmentMentionNode } from "@/components/CanvasDesign/types"
import type {
	ReferenceAssetPerTypeLimits,
	ReferenceAssetTypeCounts,
	ReferenceResourceFileInfo,
	ReferenceResourceTypeFilter,
} from "@/components/CanvasDesign/components/MessageEditor/reference-assets/reference-resource.types"
import {
	classifyReferenceAssetFile,
	isReferenceAssetTypeCapacityBlocked,
	isReferenceResourceCurrentlySelected,
	isReferenceResourceTypeAllowed,
} from "@/components/CanvasDesign/components/MessageEditor/reference-assets/referenceResourceSelection"

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
	for (const n of nodes) {
		if (n.isDirectory && (n.id === folderId || n.path === folderId)) return n
		if (n.children?.length) {
			const found = findFolderNode(n.children, folderId)
			if (found) return found
		}
	}
	return null
}

function flattenAttachmentFiles(nodes: ProjectAttachmentMentionNode[]): Array<{
	name: string
	path: string
	extension?: string
	fileId: string
}> {
	const out: Array<{
		name: string
		path: string
		extension?: string
		fileId: string
	}> = []
	for (const n of nodes) {
		if (!n.isDirectory) {
			out.push({
				name: n.name,
				path: n.path,
				extension: n.extension,
				fileId: n.fileId,
			})
			continue
		}
		if (n.children?.length) out.push(...flattenAttachmentFiles(n.children))
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

	constructor(initialAttachmentRoots: ProjectAttachmentMentionNode[]) {
		this.attachmentRoots = initialAttachmentRoots
	}

	/** 宿主树更新时替换内存根，与「重建 DataService」等价但不换实例 */
	syncProjectAttachmentRoots(roots: ProjectAttachmentMentionNode[]): void {
		this.attachmentRoots = roots
	}

	setLimitInfoGetter(getter: LimitInfoGetter | undefined): void {
		this.limitInfoGetter = getter
	}

	setRefreshHandler(handler: (() => void) | undefined): void {
		this.refreshHandler = handler
	}

	requestRefresh(): void {
		this.refreshHandler?.()
	}

	private fileNodeToMentionItem(
		node: ProjectAttachmentMentionNode,
		limitInfo?: LimitInfo | null,
	): MentionItem {
		const ext = node.extension || getExtension(node.name)
		const rawPath = (node.path || node.id || "") as string
		const filePath = normalizeRelativePath(rawPath)
		const unSelectable = !isReferenceResourceTypeAllowed({
			filePath: rawPath || filePath,
			fileExtension: ext,
			referenceResourceType: limitInfo?.referenceResourceType,
		})
		const isCapacityBlocked =
			limitInfo?.assetLimits && limitInfo.currentAssetCounts
				? isReferenceAssetTypeCapacityBlocked({
						fileClass: classifyReferenceAssetFile({
							filePath: rawPath || filePath,
							fileExtension: ext,
						}),
						assetLimits: limitInfo.assetLimits,
						currentAssetCounts: limitInfo.currentAssetCounts,
						candidatePaths: [rawPath, filePath, node.id],
						currentReferenceFiles: limitInfo.currentReferenceFiles,
					})
				: false
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
			unSelectable: unSelectable || isCapacityBlocked,
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
		const baseFiles = flattenAttachmentFiles(this.attachmentRoots)
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
		return items.filter((item) => this.itemMatchesSearchQuery(item, q))
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

	private getFolderItems(folderId: string): Promise<MentionItem[]> {
		const limitInfo = this.limitInfoGetter?.()
		const node = findFolderNode(this.attachmentRoots, folderId)
		if (!node?.children?.length) return Promise.resolve([])
		return Promise.resolve(
			this.applyReferenceSelectionLimit(
				this.levelToMentionItems(node.children, limitInfo),
				limitInfo,
			),
		)
	}

	private hasFolder(folderId: string): boolean {
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
				return this.getFolderItems(request.id).then((items) => ({ items }))
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
