import { observer } from "mobx-react-lite"
import { useState, useRef, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn, useRequest } from "ahooks"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Spinner } from "@/components/shadcn-ui/spinner"
import { ChevronRight, BookMarked } from "lucide-react"
import { Switch } from "@/components/shadcn-ui/switch"
import { StepNavigation } from "../../../components"
import type { WikiDocumentStore } from "../../../store"
import { cn } from "@/lib/utils"
import useResizablePanel from "@/pages/superMagic/hooks/useResizablePanel"
import TopicResizeHandle from "@/pages/superMagic/pages/TopicPage/components/TopicResizeHandle"
import { KnowledgeApi } from "@/apis"
import {
	SourceType,
	ParentType,
	ProviderType,
	type SourceBindingNode,
} from "@/types/source-binding"
import WikiFileSelector from "../components/WikiFileSelector"

const WIKI_LIST_DEFAULT_PX = 320
const WIKI_LIST_MIN_PX = 240
const WIKI_LIST_MAX_PX = 480
const WIKI_LIST_WIDTH_KEY = "MAGIC:document-create-wiki-list-width"

/**
 * WikiSelectionStep组件Props
 */
export interface WikiSelectionStepProps {
	store: WikiDocumentStore
	onNext: () => void
	/** 下一步按钮文本 */
	nextText?: string
	/** 是否隐藏下一步按钮的箭头图标 */
	hideNextIcon?: boolean
	/** 是否显示加载状态 */
	nextLoading?: boolean
	/** 编辑中的文档 code：存在时表示仅改配置，可不重新选择企业知识库 */
	editDocumentCode?: string | null
}

/**
 * Enterprise Wiki第1步：选择企业知识库和文档
 * 两栏布局：Select Wiki → Select File
 * 设计稿: https://www.figma.com/design/6Y4cUmZyEJnas4qKtbcJ5Y/Magic---SuperMagic-Shadcn?node-id=14854-2353209
 */
export const WikiSelectionStep = observer(function WikiSelectionStep({
	store,
	onNext,
	nextText,
	hideNextIcon,
	nextLoading,
	editDocumentCode = null,
}: WikiSelectionStepProps) {
	const { t } = useTranslation("crew/create")
	const containerRef = useRef<HTMLDivElement>(null)

	// 本地状态 - 多选知识库
	const [selectedWikiIds, setSelectedWikiIds] = useState<string[]>([])
	const [wikiCheckboxMap, setWikiCheckboxMap] = useState<Record<string, boolean>>({})
	const [currentViewWikiId, setCurrentViewWikiId] = useState<string | null>(null)
	const [selectedFileIds, setSelectedFileIds] = useState<string[]>([])
	const [clampedWikiWidth, setClampedWikiWidth] = useState(WIKI_LIST_DEFAULT_PX)

	// 同步 store 的状态到本地状态（用于回显）
	useEffect(() => {
		// 初始化时，如果 store 有数据，同步到本地状态
		if (store.selectedWikis.length > 0 && selectedWikiIds.length === 0) {
			const wikiIds = store.selectedWikis.map((w) => w.wikiId)
			const checkboxMap: Record<string, boolean> = {}
			store.selectedWikis.forEach((w) => {
				checkboxMap[w.wikiId] = w.isWholeWikiSelected
			})
			setSelectedWikiIds(wikiIds)
			setWikiCheckboxMap(checkboxMap)
			// 默认显示第一个知识库
			if (currentViewWikiId === null) {
				setCurrentViewWikiId(wikiIds[0] || null)
				const firstWiki = store.selectedWikis[0]
				if (firstWiki) {
					setSelectedFileIds([...firstWiki.selectedFileIds])
				}
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [store.selectedWikis.length])

	useEffect(() => {
		store.setConfigUpdateMode(Boolean(editDocumentCode))
	}, [editDocumentCode, store])

	// 加载企业知识库列表
	const { data: wikis = [], loading: wikisLoading } = useRequest(
		async () => {
			const res = await KnowledgeApi.getSourceBindingNodes({
				source_type: SourceType.ENTERPRISE_KNOWLEDGE_BASE,
				provider: ProviderType.TEAMSHARE,
				parent_type: ParentType.ROOT,
			})
			return res?.list || []
		},
		{
			refreshDeps: [],
		},
	)

	// 拖拽调整宽度
	const {
		width: wikiWidthPx,
		isDragging: isDraggingWiki,
		handleMouseDown: onWikiResizeStart,
	} = useResizablePanel({
		minWidth: WIKI_LIST_MIN_PX,
		maxWidth: WIKI_LIST_MAX_PX,
		defaultWidth: WIKI_LIST_DEFAULT_PX,
		storageKey: WIKI_LIST_WIDTH_KEY,
		direction: "left",
	})

	// 动态限制宽度，确保 File 列始终可见
	useEffect(() => {
		const container = containerRef.current
		if (!container) return

		const updateWidths = () => {
			const containerWidth = container.clientWidth
			if (containerWidth <= 0) return

			const FILE_LIST_MIN = 400 // File 列最小宽度
			const RESIZE_HANDLE_WIDTH = 8 // 拖拽手柄宽度

			// 计算 Wiki 列的最大宽度
			let maxWiki = WIKI_LIST_MAX_PX
			if (currentViewWikiId) {
				// 两栏模式：Wiki + File
				maxWiki = Math.min(
					WIKI_LIST_MAX_PX,
					containerWidth - FILE_LIST_MIN - RESIZE_HANDLE_WIDTH,
				)
			}
			maxWiki = Math.max(WIKI_LIST_MIN_PX, maxWiki)
			const clampedWiki = Math.max(WIKI_LIST_MIN_PX, Math.min(maxWiki, wikiWidthPx))
			setClampedWikiWidth(clampedWiki)
		}

		updateWidths()

		const resizeObserver = new ResizeObserver(updateWidths)
		resizeObserver.observe(container)

		return () => resizeObserver.disconnect()
	}, [wikiWidthPx, currentViewWikiId])

	/**
	 * 处理wiki点击（展开文档列表）
	 */
	const handleWikiClick = useMemoizedFn((wikiRef: string) => {
		// 更新当前查看的知识库
		setCurrentViewWikiId(wikiRef)

		// 如果该知识库已经在 store 中，加载其文件选择
		const existingWiki = store.selectedWikis.find((w) => w.wikiId === wikiRef)
		if (existingWiki) {
			setSelectedFileIds([...existingWiki.selectedFileIds])
		} else {
			setSelectedFileIds([])
		}
	})

	/**
	 * 处理wiki checkbox（选择整个知识库）
	 */
	const handleWikiCheckbox = useMemoizedFn(
		(wikiRef: string, wikiName: string, checked: boolean, e: React.MouseEvent) => {
			e.stopPropagation()

			if (checked) {
				// 勾选整个知识库
				const newCheckboxMap = { ...wikiCheckboxMap, [wikiRef]: true }
				setWikiCheckboxMap(newCheckboxMap)

				// 添加到已选列表
				if (!selectedWikiIds.includes(wikiRef)) {
					setSelectedWikiIds([...selectedWikiIds, wikiRef])
				}

				// 更新 store
				store.setSelectedWiki(wikiRef, true, wikiName)

				// 如果是当前查看的知识库，清空文件选择
				if (currentViewWikiId === wikiRef) {
					setSelectedFileIds([])
				}
			} else {
				// 取消勾选整个知识库
				const newCheckboxMap = { ...wikiCheckboxMap }
				delete newCheckboxMap[wikiRef]
				setWikiCheckboxMap(newCheckboxMap)

				// 从已选列表移除
				setSelectedWikiIds(selectedWikiIds.filter((id) => id !== wikiRef))

				// 从 store 移除
				store.removeWiki(wikiRef)

				// 如果是当前查看的知识库，清空文件选择
				if (currentViewWikiId === wikiRef) {
					setSelectedFileIds([])
				}
			}
		},
	)

	/**
	 * 处理文档选择变化
	 */
	const handleDocumentSelectionChange = useMemoizedFn(
		(fileIds: string[], nodes: SourceBindingNode[]) => {
			if (!currentViewWikiId) return

			setSelectedFileIds(fileIds)

			// 获取当前知识库名称
			const currentWiki = wikis.find((w) => w.node_ref === currentViewWikiId)
			const wikiName = currentWiki?.name || ""

			// 如果选择了文件，需要确保该知识库在 store 中
			if (fileIds.length > 0) {
				if (!selectedWikiIds.includes(currentViewWikiId)) {
					setSelectedWikiIds([...selectedWikiIds, currentViewWikiId])
				}
				store.setSelectedWiki(currentViewWikiId, false, wikiName)
				store.setSelectedFiles(fileIds, currentViewWikiId)
				store.cacheFileNodes(nodes, currentViewWikiId)
			} else {
				// 如果取消了所有文件选择，且没有勾选整个知识库，则从 store 移除
				if (!wikiCheckboxMap[currentViewWikiId]) {
					store.removeWiki(currentViewWikiId)
					setSelectedWikiIds(selectedWikiIds.filter((id) => id !== currentViewWikiId))
				} else {
					store.setSelectedFiles(fileIds, currentViewWikiId)
				}
			}
		},
	)

	const canGoNext = store.canGoNext(1)

	// 判断当前查看的知识库是否选中了整个知识库
	const isCurrentWikiWholeSelected = currentViewWikiId
		? wikiCheckboxMap[currentViewWikiId] === true
		: false

	return (
		<div className="flex h-full flex-col">
			{/* 两栏布局容器 */}
			<div
				ref={containerRef}
				className="flex min-h-0 flex-1 overflow-hidden rounded-md border border-border"
			>
				{/* 第一栏：Select Wiki */}
				<div
					className="flex shrink-0 flex-col bg-background"
					style={{
						width: currentViewWikiId ? clampedWikiWidth : undefined,
						flex: currentViewWikiId ? undefined : 1,
						minWidth: 0,
						willChange: isDraggingWiki ? "width" : undefined,
						transition: isDraggingWiki ? "none" : "width 0.2s ease",
					}}
				>
					<div
						className={cn(
							"shrink-0 border-b border-border px-4 py-3",
							currentViewWikiId && "border-r",
						)}
					>
						<div className="text-sm font-medium">
							{t("documentCreate.wiki.selectWiki")}
						</div>
					</div>
					<div
						className={cn(
							"relative flex min-h-0 flex-1 overflow-hidden",
							currentViewWikiId && "border-r border-border",
						)}
					>
						<ScrollArea className="flex-1">
							<div className="space-y-1 p-2">
								{wikisLoading ? (
									<div className="flex items-center justify-center py-8">
										<Spinner className="animate-spin" size={16} />
									</div>
								) : wikis.length === 0 ? (
									<div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
										{t("documentCreate.common.emptyState")}
									</div>
								) : (
									wikis.map((wiki) => {
										const isWikiChecked =
											wikiCheckboxMap[wiki.node_ref] === true
										const isCurrentView = currentViewWikiId === wiki.node_ref

										// 判断是否处于半选状态：知识库在选中列表中但没有选中整个知识库
										const wikiSelection = store.selectedWikis.find(
											(w) => w.wikiId === wiki.node_ref,
										)
										const hasSelectedFiles =
											wikiSelection &&
											wikiSelection.selectedFileIds.length > 0 &&
											!wikiSelection.isWholeWikiSelected

										// 计算 Checkbox 状态
										const checkboxState = isWikiChecked
											? true
											: hasSelectedFiles
												? "indeterminate"
												: false

										return (
											<div
												key={wiki.node_ref}
												className={cn(
													"group flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-accent",
													isCurrentView && "bg-accent",
												)}
												onClick={() => handleWikiClick(wiki.node_ref)}
											>
												<Checkbox
													checked={checkboxState}
													onClick={(e: React.MouseEvent) =>
														handleWikiCheckbox(
															wiki.node_ref,
															wiki.name,
															!isWikiChecked,
															e,
														)
													}
													className="mt-0.5 shrink-0"
												/>
												<BookMarked className="mt-0.5 size-4 shrink-0 text-foreground" />
												<div className="min-w-0 flex-1">
													<div className="truncate text-sm font-medium">
														{wiki.name ||
															t("documentCreate.wiki.unnamedWiki")}
													</div>
												</div>
												{isCurrentView && (
													<ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
												)}
											</div>
										)
									})
								)}
							</div>
						</ScrollArea>

						{/* Wiki 拖拽手柄 - 绝对定位在右侧 */}
						{currentViewWikiId && (
							<div
								className="absolute right-0 top-0 h-full"
								style={{ pointerEvents: "none" }}
							>
								<div style={{ pointerEvents: "auto", height: "100%" }}>
									<TopicResizeHandle
										onMouseDown={onWikiResizeStart}
										className={cn(
											"h-full shrink-0",
											isDraggingWiki && "before:opacity-100",
										)}
									/>
								</div>
							</div>
						)}
					</div>
				</div>

				{/* 第二栏：Select File（选中wiki时显示） */}
				{currentViewWikiId && (
					<div className="flex flex-1 flex-col bg-background">
						<div className="shrink-0 border-b border-border px-4 py-3">
							<div className="text-sm font-medium">
								{t("documentCreate.wiki.selectDocument")}
							</div>
						</div>
						<div className="flex-1 overflow-scroll">
							<div className={cn(isCurrentWikiWholeSelected && "opacity-50")}>
								<WikiFileSelector
									knowledgeBaseRef={currentViewWikiId}
									selectedFileIds={selectedFileIds}
									onSelectionChange={handleDocumentSelectionChange}
									disabled={isCurrentWikiWholeSelected}
									showSelectAll={!isCurrentWikiWholeSelected}
									className="h-full"
								/>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Real-time Updates 配置 */}
			<div className="mt-6 flex items-start gap-3 rounded-lg border border-border bg-background px-4 py-3">
				<Switch
					checked={store.enableRealtimeUpdates}
					onCheckedChange={(checked) => store.setEnableRealtimeUpdates(checked)}
				/>
				<div className="flex flex-1 flex-col gap-1">
					<div className="text-sm font-medium">
						{t("documentCreate.wiki.realtimeUpdates")}
					</div>
					<div className="text-xs text-muted-foreground">
						{t("documentCreate.wiki.realtimeUpdatesDescription")}
					</div>
				</div>
			</div>

			{/* 底部导航 */}
			<div className="shrink-0 px-8 py-8">
				<StepNavigation
					showPrevious={false}
					onNext={onNext}
					nextDisabled={!canGoNext}
					nextText={nextText}
					hideNextIcon={hideNextIcon}
					nextLoading={nextLoading}
				/>
			</div>
		</div>
	)
})
