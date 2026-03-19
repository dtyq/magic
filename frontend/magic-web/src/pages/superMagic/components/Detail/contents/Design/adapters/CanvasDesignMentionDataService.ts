import type {
	DataService,
	MentionItem,
	ProjectFileMentionData,
} from "@/components/business/MentionPanel/types"
import type { I18nTexts } from "@/components/business/MentionPanel/i18n/types"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import type { ImageFileForMention } from "@/components/CanvasDesign/types"
import type { MentionDataServicePortI18n } from "@/components/CanvasDesign/types.magic"

function getExtension(name: string): string {
	const idx = name.lastIndexOf(".")
	return idx >= 0 ? name.slice(idx + 1) : ""
}

export interface ReferenceImageInfo {
	src: string
	fileName: string
	path: string
}

export interface LimitInfo {
	/** 最大参考图数量限制 */
	maxReferenceImages?: number
	/** 当前已选中的参考图路径列表 */
	currentReferenceImages?: string[]
	/** 是否已达到参考图数量限制 */
	isReferenceImageLimitReached?: boolean
	/** 当前图片元素的参考图列表（用户上传等），合并到面板数据源，与 matchableItems 同步 */
	referenceImageInfos?: ReferenceImageInfo[]
}

export type LimitInfoGetter = () => LimitInfo | undefined

/**
 * 画布图片生成输入框专用的 Mention DataService
 * 仅提供当前画布 images 目录下的图片，供 MentionPanel 复用
 * 限制信息由 ImageMessageEditor 通过 setLimitInfoGetter 注册，拉取时按需获取（避免多编辑器/切换模型时的竞态）
 */
export class CanvasDesignMentionDataService implements DataService {
	private limitInfoGetter?: LimitInfoGetter
	private refreshHandler?: () => void

	constructor(private imageFiles: ImageFileForMention[]) { }

	/**
	 * 注册限制信息获取器（由 useMessageEditorMention 在挂载时设置，卸载时清空）
	 * 拉取时调用 getter 获取当前编辑器的最新限制，而非依赖推送的陈旧快照
	 */
	setLimitInfoGetter(getter: LimitInfoGetter | undefined): void {
		this.limitInfoGetter = getter
	}

	/**
	 * 注册刷新回调（由 MentionPanel 的 useDataSource 在挂载时设置，卸载时清空）
	 * 当 referenceImageInfos 变化（如上传成功）时，useMessageEditorMention 调用 requestRefresh 触发面板重新拉取
	 */
	setRefreshHandler(handler: (() => void) | undefined): void {
		this.refreshHandler = handler
	}

	/**
	 * 请求面板刷新（上传成功后调用，若面板已打开则立即更新列表）
	 */
	requestRefresh(): void {
		this.refreshHandler?.()
	}

	private toMentionItems(limitInfo?: LimitInfo | null): MentionItem[] {
		// 基础项：项目 images 目录文件
		const baseItems = this.imageFiles.map((f) => ({
			id: f.path ?? f.name,
			type: MentionItemType.PROJECT_FILE,
			name: f.name,
			icon: getExtension(f.name),
			extension: getExtension(f.name),
			hasChildren: false,
			isFolder: false,
			data: {
				file_id: f.path ?? f.name,
				file_name: f.name,
				file_path: f.path ?? "",
				file_extension: getExtension(f.name),
			} as ProjectFileMentionData,
		}))

		// 合并 referenceImageInfos（当前元素的参考图，与 matchableItems 数据源同步）
		let items = baseItems
		if (limitInfo?.referenceImageInfos?.length) {
			const itemMap = new Map<string, (typeof baseItems)[0]>()
			baseItems.forEach((item) => {
				const key = (item.data as ProjectFileMentionData).file_path || item.id
				if (key) itemMap.set(key, item)
			})
			limitInfo.referenceImageInfos.forEach((info) => {
				const key = info.path || info.fileName
				if (!key) return
				itemMap.set(key, {
					id: info.path ?? info.fileName,
					type: MentionItemType.PROJECT_FILE,
					name: info.fileName,
					icon: getExtension(info.fileName),
					extension: getExtension(info.fileName),
					hasChildren: false,
					isFolder: false,
					data: {
						file_id: info.path ?? info.fileName,
						file_name: info.fileName,
						file_path: info.path ?? "",
						file_extension: getExtension(info.fileName),
					} as ProjectFileMentionData,
				})
			})
			items = Array.from(itemMap.values())
		}

		// 如果达到限制，标记未选中的项为 unSelectable
		if (
			limitInfo?.isReferenceImageLimitReached &&
			limitInfo?.currentReferenceImages &&
			limitInfo.currentReferenceImages.length > 0
		) {
			const currentPathsSet = new Set(limitInfo.currentReferenceImages)
			return items.map((item) => {
				const filePath = (item.data as ProjectFileMentionData).file_path || item.id
				const isSelected = currentPathsSet.has(filePath)
				return {
					...item,
					unSelectable: !isSelected,
				}
			})
		}

		return items
	}

	getDefaultItems(_t?: I18nTexts | MentionDataServicePortI18n): MentionItem[] {
		const limitInfo = this.limitInfoGetter?.()
		return this.toMentionItems(limitInfo)
	}

	searchItems(query: string): MentionItem[] {
		const q = query.toLowerCase().trim()
		const limitInfo = this.limitInfoGetter?.()
		const items = this.toMentionItems(limitInfo)
		if (!q) return items
		return items.filter((item) => item.name.toLowerCase().includes(q))
	}

	fetchMcpList = () => { }
	getFolderItems = () => Promise.resolve([])
	getUploadFiles = () => Promise.resolve([])
	getMcpExtensions = () => Promise.resolve([])
	getAgents = () => Promise.resolve([])
	getToolItems = () => Promise.resolve([])
	preLoadList = () => { }
	getAllHistory = () => Promise.resolve([])
	getCurrentTabs = () => Promise.resolve([])
	hasAgent = () => false
	hasMcp = () => false
	hasTool = () => false
	hasUploadFile = () => false
	hasProjectFile = () => false
	hasFolder = () => false
	removeFromHistory = () => { }
}
