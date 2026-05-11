import { observer } from "mobx-react-lite"
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn, useMount, useUpdateEffect } from "ahooks"
import { FileText, ChevronDown } from "lucide-react"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Skeleton } from "@/components/shadcn-ui/skeleton"
import { Button } from "@/components/shadcn-ui/button"
import { KnowledgeApi } from "@/apis"
import { Knowledge } from "@/types/knowledge"
import magicToast from "@/components/base/MagicToaster/utils"
import { StepNavigation } from "../../../components"
import type { LocalDocumentStore } from "../../../store"
import { ContentNode } from "@/pages/superMagic/pages/CrewEdit/components/StepDetailPanel/KnowledgeDetailView/types/content-node"
import { DocumentTree } from "@/pages/superMagic/pages/CrewEdit/components/StepDetailPanel/KnowledgeDetailView/utils/DocumentTree"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import MarkdownSourcePanel from "@/pages/superMagic/pages/CrewEdit/components/StepDetailPanel/KnowledgeDetailView/components/MarkdownSourcePanel"
import FormattedContentPanel from "@/pages/superMagic/pages/CrewEdit/components/StepDetailPanel/KnowledgeDetailView/components/FormattedContentPanel"
import TopicResizeHandle from "@/pages/superMagic/pages/TopicPage/components/TopicResizeHandle"
import { cn } from "@/lib/tiptap-utils"
import { buildFragmentConfig } from "../../../utils/strategyConfigConverter"

// 布局常量
const SIDEBAR_MIN_PX = 200
const SIDEBAR_DEFAULT_PX = 280
const PREVIEW_MIN_PX = 200
const RESIZE_HANDLE_PX = 8
const SIDEBAR_STORAGE_KEY = "MAGIC:chunk-preview-sidebar-width"
const LEFT_PREVIEW_STORAGE_KEY = "MAGIC:chunk-preview-left-width"

/**
 * 读取存储的侧边栏宽度
 */
function readStoredSidebarWidth(): number {
	try {
		const raw = localStorage.getItem(SIDEBAR_STORAGE_KEY)
		if (!raw) return SIDEBAR_DEFAULT_PX
		const n = parseInt(raw, 10)
		if (Number.isNaN(n)) return SIDEBAR_DEFAULT_PX
		return Math.max(SIDEBAR_MIN_PX, n)
	} catch {
		return SIDEBAR_DEFAULT_PX
	}
}

/**
 * 读取存储的左侧预览宽度比例（0-1）
 */
function readStoredLeftPreviewRatio(): number {
	try {
		const raw = localStorage.getItem(LEFT_PREVIEW_STORAGE_KEY)
		if (!raw) return 0.5
		const n = parseFloat(raw)
		if (Number.isNaN(n)) return 0.5
		return Math.max(0.2, Math.min(0.8, n))
	} catch {
		return 0.5
	}
}

/**
 * 限制侧边栏宽度
 */
function clampSidebarWidth(width: number, containerWidth: number): number {
	if (containerWidth <= RESIZE_HANDLE_PX) return SIDEBAR_MIN_PX
	const maxWidth = containerWidth - PREVIEW_MIN_PX * 2 - RESIZE_HANDLE_PX * 2
	return Math.max(SIDEBAR_MIN_PX, Math.min(maxWidth, width))
}

/**
 * 限制预览面板宽度比例
 */
function clampPreviewRatio(ratio: number): number {
	return Math.max(0.2, Math.min(0.8, ratio))
}

/**
 * ChunkPreviewStep组件Props
 */
export interface ChunkPreviewStepProps {
	store: LocalDocumentStore
	onNext: () => void
	onPrevious: () => void
	showPrevious?: boolean // 是否显示上一步按钮
}

/**
 * Local Documents第3步：Chunk预览
 * 按照 Figma 设计稿布局：左侧边栏（文档列表+层级树）+ 右侧双栏（原始预览+分块预览）
 * 三个面板都支持拖拽调整宽度
 */
export const ChunkPreviewStep = observer(function ChunkPreviewStep({
	store,
	onNext,
	onPrevious,
	showPrevious = true,
}: ChunkPreviewStepProps) {
	const { t } = useTranslation("crew/create")
	const [selectedDocIndex, setSelectedDocIndex] = useState(0)
	const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set())
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const [originalContent, setOriginalContent] = useState<string>("")
	const isLoadingRef = useRef(false)
	const abortControllerRef = useRef<AbortController | null>(null)
	const requestIdRef = useRef(0)

	// 拖拽相关状态
	const containerRef = useRef<HTMLDivElement>(null)
	const previewContainerRef = useRef<HTMLDivElement>(null)
	const [sidebarWidthPx, setSidebarWidthPx] = useState(readStoredSidebarWidth)
	const [leftPreviewRatio, setLeftPreviewRatio] = useState(readStoredLeftPreviewRatio)
	const sidebarWidthRef = useRef(sidebarWidthPx)
	const leftPreviewRatioRef = useRef(leftPreviewRatio)
	const [isDraggingSidebar, setIsDraggingSidebar] = useState(false)
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const [isDraggingPreview, setIsDraggingPreview] = useState(false)

	// 更新 ref
	useEffect(() => {
		sidebarWidthRef.current = sidebarWidthPx
	}, [sidebarWidthPx])

	useEffect(() => {
		leftPreviewRatioRef.current = leftPreviewRatio
	}, [leftPreviewRatio])

	/**
	 * 限制侧边栏宽度到容器范围
	 */
	const clampSidebarToContainer = useMemoizedFn(() => {
		const el = containerRef.current
		if (!el) return
		const w = el.clientWidth
		if (w <= 0) return
		const next = clampSidebarWidth(sidebarWidthRef.current, w)
		if (next !== sidebarWidthRef.current) {
			sidebarWidthRef.current = next
			setSidebarWidthPx(next)
			try {
				localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next))
			} catch {
				/* ignore */
			}
		}
	})

	useMount(() => {
		queueMicrotask(() => clampSidebarToContainer())
	})

	useEffect(() => {
		const el = containerRef.current
		if (!el) return
		const ro = new ResizeObserver(() => clampSidebarToContainer())
		ro.observe(el)
		return () => ro.disconnect()
	}, [clampSidebarToContainer])

	/**
	 * 处理侧边栏拖拽
	 */
	const handleSidebarResizeStart = useMemoizedFn((e: ReactMouseEvent<HTMLDivElement>) => {
		e.preventDefault()
		setIsDraggingSidebar(true)
		const startX = e.clientX
		const startWidth = sidebarWidthRef.current

		const onMove = (moveEvent: MouseEvent) => {
			const containerW = containerRef.current?.clientWidth ?? 0
			const delta = moveEvent.clientX - startX
			const next = clampSidebarWidth(startWidth + delta, containerW)
			sidebarWidthRef.current = next
			setSidebarWidthPx(next)
		}

		const onUp = () => {
			setIsDraggingSidebar(false)
			try {
				localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarWidthRef.current))
			} catch {
				/* ignore */
			}
			document.removeEventListener("mousemove", onMove)
			document.removeEventListener("mouseup", onUp)
		}

		document.addEventListener("mousemove", onMove)
		document.addEventListener("mouseup", onUp)
	})

	/**
	 * 处理预览面板拖拽
	 */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const handlePreviewResizeStart = useMemoizedFn((e: ReactMouseEvent<HTMLDivElement>) => {
		e.preventDefault()
		setIsDraggingPreview(true)
		const startX = e.clientX
		const previewContainer = previewContainerRef.current
		if (!previewContainer) return

		const containerRect = previewContainer.getBoundingClientRect()
		const startRatio = leftPreviewRatioRef.current

		const onMove = (moveEvent: MouseEvent) => {
			const delta = moveEvent.clientX - startX
			const availableWidth = containerRect.width - RESIZE_HANDLE_PX
			const deltaRatio = delta / availableWidth
			const newRatio = clampPreviewRatio(startRatio + deltaRatio)
			leftPreviewRatioRef.current = newRatio
			setLeftPreviewRatio(newRatio)
		}

		const onUp = () => {
			setIsDraggingPreview(false)
			try {
				localStorage.setItem(LEFT_PREVIEW_STORAGE_KEY, String(leftPreviewRatioRef.current))
			} catch {
				/* ignore */
			}
			document.removeEventListener("mousemove", onMove)
			document.removeEventListener("mouseup", onUp)
		}

		document.addEventListener("mousemove", onMove)
		document.addEventListener("mouseup", onUp)
	})

	/**
	 * 读取文件内容为文本
	 */
	const readFileAsText = useMemoizedFn(async (file: File): Promise<string> => {
		return new Promise((resolve, reject) => {
			const reader = new FileReader()
			reader.onload = (e) => resolve(e.target?.result as string)
			reader.onerror = reject
			reader.readAsText(file)
		})
	})

	/**
	 * 加载预览数据
	 */
	const loadPreviewData = useMemoizedFn(async () => {
		// 取消之前的请求
		if (abortControllerRef.current) {
			abortControllerRef.current.abort()
			abortControllerRef.current = null
		}

		// 从过滤后的文件列表获取选中的文件
		const uploadedFiles = store.uploadedFiles.filter((f) => f.status === "done")
		const selectedFile = uploadedFiles[selectedDocIndex]
		if (!selectedFile) {
			console.log("[ChunkPreviewStep] No file selected, waiting for data to load...")
			// 清空之前的数据
			store.setPreviewData([])
			store.setPreviewLoading(false)
			isLoadingRef.current = false
			return
		}

		// 生成新的请求ID
		requestIdRef.current += 1
		const currentRequestId = requestIdRef.current

		// 创建新的 AbortController
		const abortController = new AbortController()
		abortControllerRef.current = abortController

		isLoadingRef.current = true
		store.setPreviewLoading(true)

		try {
			// 1. 读取原始文件内容
			let fileContent: string
			if (store.editModeOriginalContent) {
				// 编辑模式：使用预加载的原始内容
				fileContent = store.editModeOriginalContent
			} else if (selectedFile.file) {
				// 创建模式：从 File 对象读取
				fileContent = await readFileAsText(selectedFile.file)
			} else {
				throw new Error("No file content available")
			}

			// 检查请求是否已被取消
			if (abortController.signal.aborted || currentRequestId !== requestIdRef.current) {
				console.log("[ChunkPreviewStep] Request cancelled or outdated")
				return
			}

			setOriginalContent(fileContent)

			// 2. 调用分段预览接口
			// 使用策略配置转换函数构建FragmentConfig
			const fragmentConfig = buildFragmentConfig(store.strategyConfig)

			// 根据用户配置的解析策略构建 document_file 参数
			const isPreciseParsing =
				store.strategyConfig.parsingStrategy === "precise" &&
				store.strategyConfig.enablePreciseParsing

			const response = await KnowledgeApi.crewSegmentPreview({
				strategy_config: {
					parsing_type: isPreciseParsing ? 1 : 0, // 1-精确解析, 0-快速解析
					image_extraction: isPreciseParsing ? store.strategyConfig.extractImages : false,
					table_extraction: isPreciseParsing ? store.strategyConfig.extractTables : false,
					image_ocr: isPreciseParsing ? store.strategyConfig.extractOCR : false,
				},
				fragment_config: fragmentConfig,
				document_file: {
					name: selectedFile.name,
					key: selectedFile.key || selectedFile.path || "",
					type: Knowledge.CreateKnowledgeFileType.EXTERNAL_FILE,
					third_file_id: "",
				},
			})

			// 再次检查请求是否已被取消或过时
			if (abortController.signal.aborted || currentRequestId !== requestIdRef.current) {
				console.log("[ChunkPreviewStep] Request completed but cancelled or outdated")
				return
			}

			store.setPreviewData(response.document_nodes || [])
		} catch (error) {
			// 忽略被取消的请求错误
			if (
				error instanceof Error &&
				(error.name === "AbortError" ||
					error.message?.includes("abort") ||
					error.message?.includes("cancel"))
			) {
				console.log("[ChunkPreviewStep] Request aborted")
				return
			}

			// 只有当前请求才显示错误
			if (currentRequestId === requestIdRef.current) {
				console.error("Load preview data failed:", error)
				magicToast.error(t("documentCreate.preview.loadFailed"))
			}
		} finally {
			// 只有当前请求才更新加载状态
			if (currentRequestId === requestIdRef.current) {
				store.setPreviewLoading(false)
				isLoadingRef.current = false
				abortControllerRef.current = null
			}
		}
	})

	useEffect(() => {
		// 每次进入该步骤时都重新加载预览数据
		// 因为用户可能在第2步修改了策略配置
		console.log("[ChunkPreviewStep] Component mounted, loading preview data")
		loadPreviewData()

		// 组件卸载时取消请求
		return () => {
			if (abortControllerRef.current) {
				abortControllerRef.current.abort()
				abortControllerRef.current = null
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	// 监听 uploadedFiles 变化，如果从空变为有数据，重新加载
	useUpdateEffect(() => {
		if (store.uploadedFiles.length > 0 && store.previewData.length === 0) {
			console.log(
				"[ChunkPreviewStep] uploadedFiles loaded in edit mode, retry loading preview data",
			)
			loadPreviewData()
		}
	}, [store.uploadedFiles.length])

	// 当选中的文档改变时，重新加载预览数据（使用 useUpdateEffect 跳过首次渲染）
	useUpdateEffect(() => {
		console.log("[ChunkPreviewStep] selectedDocIndex changed to:", selectedDocIndex)
		loadPreviewData()
	}, [selectedDocIndex])

	/**
	 * 构建文档树
	 */
	const documentTree = useMemo(() => {
		if (store.previewData.length === 0) return null
		return new DocumentTree(store.previewData)
	}, [store.previewData])

	/**
	 * 获取根节点的子节点（用于 Level 渲染）
	 * 过滤掉 level 为 -1 的节点（非标题内容）
	 */
	const rootChildren = useMemo(() => {
		if (!documentTree) return []
		const root = documentTree.getRoot()
		if (!root) return []
		const children = documentTree.getChildren(root.id)
		// 只保留有层级信息的节点（level >= 0）
		return children.filter((child) => child.level >= 0)
	}, [documentTree])

	/**
	 * 自动展开所有层级节点
	 */
	useEffect(() => {
		if (!documentTree) return

		const root = documentTree.getRoot()
		if (!root) return

		const allNodeIds = new Set<number>()
		const collectAllNodeIds = (nodeId: number) => {
			allNodeIds.add(nodeId)
			const children = documentTree.getChildren(nodeId)
			children.forEach((child) => collectAllNodeIds(child.id))
		}

		// 从根节点开始收集所有节点ID
		collectAllNodeIds(root.id)
		setExpandedNodes(allNodeIds)
	}, [documentTree])

	/**
	 * 切换节点展开/收起
	 */
	const toggleNode = useMemoizedFn((nodeId: number) => {
		const newExpanded = new Set(expandedNodes)
		if (newExpanded.has(nodeId)) {
			newExpanded.delete(nodeId)
		} else {
			newExpanded.add(nodeId)
		}
		setExpandedNodes(newExpanded)
	})

	/**
	 * 滚动到指定节点
	 */
	const scrollToNode = useMemoizedFn((nodeId: number) => {
		const targetElement = document.getElementById(`node-${nodeId}`)
		if (targetElement) {
			targetElement.scrollIntoView({
				behavior: "smooth",
				block: "start",
			})
		}
	})

	/**
	 * 递归渲染层级树节点
	 */
	const renderTreeNode = (node: ContentNode, depth: number): JSX.Element | null => {
		if (!documentTree) return null

		const children = documentTree.getChildren(node.id)
		const hasChildren = children.length > 0
		const isExpanded = expandedNodes.has(node.id)

		// 只显示 section-title 类型的节点
		if (
			node.type !== Knowledge.DocumentNodeType.SECTION_TITLE &&
			node.type !== Knowledge.DocumentNodeType.TITLE
		) {
			return <>{children.map((child) => renderTreeNode(child, depth))}</>
		}

		const paddingLeft = depth === 0 ? 8 : depth === 1 ? 24 : 40

		return (
			<div key={node.id}>
				<Button
					variant="ghost"
					className="h-auto w-full justify-start gap-2 px-2 py-2 text-left text-sm font-normal"
					style={{ paddingLeft: `${paddingLeft}px` }}
					onClick={() => scrollToNode(node.id)}
				>
					{hasChildren && (
						<ChevronDown
							className={`size-4 shrink-0 transition-transform ${isExpanded ? "" : "-rotate-90"}`}
							style={{ opacity: hasChildren ? 1 : 0 }}
							onClick={(e) => {
								e.stopPropagation()
								toggleNode(node.id)
							}}
						/>
					)}
					<span className="flex-1 truncate">{node.text}</span>
				</Button>
				{isExpanded && hasChildren && (
					<div>{children.map((child) => renderTreeNode(child, depth + 1))}</div>
				)}
			</div>
		)
	}

	const uploadedFiles = store.uploadedFiles.filter((f) => f.status === "done")

	return (
		<div className="flex h-full flex-col">
			{/* 主容器：带 border 的三栏布局 */}
			<div
				ref={containerRef}
				className="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-border"
			>
				{/* 左侧边栏：Hierarchical Chunking */}
				<div
					className="flex shrink-0 flex-col border-r border-border"
					style={{
						width: sidebarWidthPx,
						transition: isDraggingSidebar ? "none" : "width 0.2s ease",
					}}
				>
					{/* 标题 */}
					<div className="flex h-12 flex-shrink-0 items-center border-b border-border px-3">
						<h3 className="truncate text-sm font-medium">
							{t("documentCreate.preview.hierarchicalChunking")}
						</h3>
					</div>

					<div className="flex min-h-0 flex-1 flex-col gap-6 overflow-scroll px-2.5 py-3">
						{/* Documents 部分 */}
						<div className="flex flex-col">
							<div className="flex h-9 items-center">
								<h4 className="text-sm font-medium">
									{t("documentCreate.preview.documents")} ({uploadedFiles.length})
								</h4>
							</div>
							<div className="flex flex-col gap-1.5">
								{uploadedFiles.map((file, index) => (
									<Button
										key={file.uid}
										variant={selectedDocIndex === index ? "secondary" : "ghost"}
										className="h-auto justify-start gap-2 px-2 py-2 text-sm font-normal"
										onClick={() => setSelectedDocIndex(index)}
									>
										<FileText className="size-4 shrink-0" />
										<span className="flex-1 truncate text-left">
											{file.name}
										</span>
									</Button>
								))}
							</div>
						</div>

						{rootChildren.length > 0 && (
							<ScrollArea className="min-h-[50%] flex-1 [&_[data-slot='scroll-area-scrollbar']]:hidden [&_[data-slot='scroll-area-viewport']>div]:!block">
								<div className="flex flex-col">
									<div className="flex h-9 items-center">
										<h4 className="text-sm font-medium">
											{t("documentCreate.preview.level")}
										</h4>
									</div>
									<div className="flex flex-col">
										{rootChildren.map((child) => renderTreeNode(child, 0))}
									</div>
								</div>
							</ScrollArea>
						)}
					</div>
				</div>

				{/* 侧边栏拖拽手柄 - 覆盖在右侧 border 上 */}
				<div className="relative w-0 shrink-0">
					<div
						className="absolute left-0 top-0 z-10 h-full"
						style={{
							width: RESIZE_HANDLE_PX,
							transform: "translateX(-50%)",
						}}
					>
						<TopicResizeHandle
							onMouseDown={handleSidebarResizeStart}
							className={cn(
								"h-full w-full",
								isDraggingSidebar && "before:opacity-100",
							)}
						/>
					</div>
				</div>

				{/* 右侧内容区域 */}
				<div ref={previewContainerRef} className="flex min-w-0 flex-1 flex-col">
					{/* 加载状态 */}
					{store.previewLoading && (
						<div className="flex flex-1 items-center justify-center">
							<div className="w-full max-w-4xl space-y-4 px-8">
								<Skeleton className="h-32 w-full" />
								<Skeleton className="h-64 w-full" />
							</div>
						</div>
					)}

					{/* 预览内容 */}
					{!store.previewLoading && store.previewData.length > 0 && (
						<div className="flex min-h-0 flex-1">
							{/* TODO: 原文预览功能暂时隐藏，后续开启 */}
							{/* <div
							className="flex min-w-0 shrink-0 flex-col border-r border-border"
							style={{
								width: `${leftPreviewRatio * 100}%`,
								transition: isDraggingPreview ? "none" : "width 0.2s ease",
							}}
						>
							<div className="flex h-12 items-center border-b border-border px-3">
								<h3 className="truncate text-sm font-medium">
									{t("documentCreate.preview.originalDocumentPreview")}
								</h3>
							</div>
							<div className="min-h-0 flex-1 overflow-hidden">
								<MarkdownSourcePanel content={originalContent} />
							</div>
						</div> */}

							{/* 预览面板拖拽手柄 - 覆盖在中间 border 上 */}
							{/* <div className="relative w-0 shrink-0">
							<div
								className="absolute left-0 top-0 z-10 h-full"
								style={{
									width: RESIZE_HANDLE_PX,
									transform: "translateX(-50%)",
								}}
							>
								<TopicResizeHandle
									onMouseDown={handlePreviewResizeStart}
									className={cn(
										"h-full w-full",
										isDraggingPreview && "before:opacity-100",
									)}
								/>
							</div>
						</div> */}

							{/* Chunk Preview */}
							<div className="flex min-w-0 flex-1 flex-col">
								<div className="flex h-12 items-center border-b border-border px-3">
									<h3 className="truncate text-sm font-medium">
										{t("documentCreate.preview.chunkPreview")}
									</h3>
								</div>
								<div className="min-h-0 flex-1 overflow-hidden">
									<FormattedContentPanel documentNodes={store.previewData} />
								</div>
							</div>
						</div>
					)}

					{/* 空状态 */}
					{!store.previewLoading && store.previewData.length === 0 && (
						<div className="flex flex-1 items-center justify-center">
							<div className="flex flex-col items-center gap-4 text-center">
								<FileText className="size-12 text-muted-foreground" />
								<p className="text-sm text-muted-foreground">
									{t("documentCreate.preview.noData")}
								</p>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* 底部导航 - 在容器外面 */}
			<div className="shrink-0 px-8 py-8">
				<StepNavigation
					showPrevious={showPrevious}
					onPrevious={onPrevious}
					onNext={onNext}
					nextDisabled={store.previewData.length === 0}
					nextLoading={store.previewLoading}
				/>
			</div>
		</div>
	)
})
