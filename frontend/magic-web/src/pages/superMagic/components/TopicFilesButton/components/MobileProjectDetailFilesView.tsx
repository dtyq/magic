import MagicPopup from "@/components/base-mobile/MagicPopup"
import MagicPullToRefresh from "@/components/base-mobile/MagicPullToRefresh"
import { Input } from "@/components/shadcn-ui/input"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/lib/utils"
import { observer } from "mobx-react-lite"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import MobileBottomSearchBar from "@/pages/superMagicMobile/components/MobileBottomSearchBar"
import { formatFileSize } from "@/utils/string"
import { Check, ChevronLeft, ChevronRight, Download, Home, Plus, Upload, X } from "lucide-react"
import { type ReactNode, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import type { PresetFileType } from "../constant"
import { isMagicSystemFolder } from "../utils/magic-system-folder"
import MobileFilesSelectionBar from "./MobileFilesSelectionBar"
import { TopicFileIcon, type TopicFileMagicVariant } from "./TopicFileIcon"

interface MobileProjectDetailFilesViewProps {
	attachments: AttachmentItem[]
	activeFileId?: string | null
	allowEdit?: boolean
	mobileViewVariant?: "project-detail" | "chat-sheet"
	refreshLoading?: boolean
	onRefresh?: () => Promise<void> | void
	selectionResetKey?: number
	onFileOpen?: (item: AttachmentItem) => void
	onSelectionModeChange?: (isSelectionMode: boolean) => void
	onCreateFile?: (type: PresetFileType, parentPath?: string, fileName?: string) => void
	onCreateFolder?: (parentPath?: string, folderName?: string) => void
	onUploadFile?: () => void
	onBatchDownload?: (items: AttachmentItem[]) => void
	onBatchExportPdf?: (items: AttachmentItem[]) => void
	onBatchExportPpt?: (items: AttachmentItem[]) => void
	onBatchShare?: (items: AttachmentItem[]) => void
	onBatchMove?: (items: AttachmentItem[]) => void
	onBatchDelete?: (items: AttachmentItem[]) => void
}

interface CreateActionItem {
	key: string
	label: string
	icon: ReactNode
	fileType?: PresetFileType
	isFolder?: boolean
	onClick: () => void
}

interface SearchResult {
	item: AttachmentItem
	pathLabel: string
}

const MOBILE_SHEET_MAX_HEIGHT = {
	maxHeight: "calc(100dvh - var(--safe-area-inset-top) - var(--safe-area-inset-bottom) - 16px)",
} as const

const CHAT_SHEET_CARD_SHADOW = "0px 2px 8px 0px rgba(0,0,0,0.04)"

const FILE_TYPE_LABEL_KEYS = {
	txt: "projectDetail.fileType.text",
	md: "projectDetail.fileType.markdown",
	markdown: "projectDetail.fileType.markdown",
	html: "projectDetail.fileType.html",
	htm: "projectDetail.fileType.html",
	wiki: "projectDetail.fileType.wiki",
	json: "projectDetail.fileType.json",
	xml: "projectDetail.fileType.xml",
	pdf: "projectDetail.fileType.pdf",
	js: "projectDetail.fileType.javascript",
	jsx: "projectDetail.fileType.javascript",
	mjs: "projectDetail.fileType.javascript",
	cjs: "projectDetail.fileType.javascript",
	ts: "projectDetail.fileType.typescript",
	tsx: "projectDetail.fileType.typescript",
	css: "projectDetail.fileType.css",
	py: "projectDetail.fileType.python",
	java: "projectDetail.fileType.java",
	go: "projectDetail.fileType.go",
	php: "projectDetail.fileType.php",
	sh: "projectDetail.fileType.shell",
	ppt: "projectDetail.fileType.powerpoint",
	pptx: "projectDetail.fileType.powerpoint",
	doc: "projectDetail.fileType.word",
	docx: "projectDetail.fileType.word",
	xls: "projectDetail.fileType.spreadsheet",
	xlsx: "projectDetail.fileType.spreadsheet",
	csv: "projectDetail.fileType.spreadsheet",
	zip: "projectDetail.fileType.archive",
	rar: "projectDetail.fileType.archive",
	"7z": "projectDetail.fileType.archive",
	png: "projectDetail.fileType.image",
	jpg: "projectDetail.fileType.image",
	jpeg: "projectDetail.fileType.image",
	gif: "projectDetail.fileType.image",
	webp: "projectDetail.fileType.image",
	svg: "projectDetail.fileType.image",
	mp4: "projectDetail.fileType.video",
	mov: "projectDetail.fileType.video",
	webm: "projectDetail.fileType.video",
	mp3: "projectDetail.fileType.audio",
	wav: "projectDetail.fileType.audio",
	m4a: "projectDetail.fileType.audio",
	link: "projectDetail.fileType.link",
	url: "projectDetail.fileType.link",
	custom: "projectDetail.fileType.custom",
	customfile: "projectDetail.fileType.custom",
	design: "projectDetail.fileType.design",
} as const

const MAGIC_CHILD_FOLDER_VARIANTS: Record<string, TopicFileMagicVariant> = {
	cron: "magic-cron",
	skills: "magic-skills",
	memory: "magic-memory",
}

const MAGIC_FILE_VARIANTS: Record<string, TopicFileMagicVariant> = {
	skills: "magic-file-skills",
	agents: "magic-file-agent",
	heartbeat: "magic-file-heartbeat",
	identity: "magic-file-identity",
	soul: "magic-file-soul",
	tools: "magic-file-tools",
	user: "magic-file-user",
	bootstrap: "magic-file-bootstrap",
	memory: "magic-file-memory",
}

function normalizeFileExtension(fileExtension?: string): string {
	return fileExtension?.replace(/^\./, "").toLowerCase() || ""
}

function getAttachmentKey(item: AttachmentItem): string {
	return (
		item.file_id ||
		item.relative_file_path ||
		item.path ||
		`${item.parent_id || "root"}:${item.file_name || item.filename || item.name || "attachment"}`
	)
}

function getAttachmentName(item: AttachmentItem): string {
	return item.display_filename || item.file_name || item.filename || item.name || ""
}

function getVisibleChildren(item?: AttachmentItem): AttachmentItem[] {
	return (item?.children || []).filter((child) => !child?.is_hidden)
}

function getNormalizedPathSegments(item: AttachmentItem): string[] {
	const pathCandidates = [item.relative_file_path, item.path]

	for (const pathCandidate of pathCandidates) {
		if (!pathCandidate) continue
		const segments = pathCandidate
			.replace(/\\/g, "/")
			.split("/")
			.map((segment) => segment.trim())
			.filter(Boolean)

		if (segments.length > 0) {
			return segments
		}
	}

	return []
}

function collectSearchResults(
	nodes: AttachmentItem[],
	keyword: string,
	pathParts: string[] = [],
): SearchResult[] {
	const normalizedKeyword = keyword.trim().toLowerCase()
	const results: SearchResult[] = []

	for (const node of nodes) {
		if (node?.is_hidden) continue

		const nodeName = getAttachmentName(node).toLowerCase()
		const extension = normalizeFileExtension(node.file_extension)

		if (node.is_directory) {
			results.push(
				...collectSearchResults(getVisibleChildren(node), keyword, [
					...pathParts,
					getAttachmentName(node),
				]),
			)
			continue
		}

		if (nodeName.includes(normalizedKeyword) || extension.includes(normalizedKeyword)) {
			results.push({
				item: node,
				pathLabel: pathParts.join(" / ") || "/",
			})
		}
	}

	return results
}

function resolveAttachmentMagicVariant(item: AttachmentItem): TopicFileMagicVariant | undefined {
	if (isMagicSystemFolder(item)) {
		return "magic-root"
	}

	const pathSegments = getNormalizedPathSegments(item)
	if (!pathSegments.includes(".magic")) {
		return undefined
	}

	const attachmentName = getAttachmentName(item).trim().toLowerCase()

	if (item.is_directory) {
		return MAGIC_CHILD_FOLDER_VARIANTS[attachmentName]
	}

	if (normalizeFileExtension(item.file_extension) !== "md") {
		return undefined
	}

	const baseName = attachmentName.replace(/\.md$/i, "")
	return MAGIC_FILE_VARIANTS[baseName]
}

/**
 * 将原型里的 40x40 浅底图标卡片抽成统一渲染，便于文件与文件夹保持相同视觉密度。
 */
function renderAttachmentIconCell(icon: ReactNode) {
	return (
		<div
			className={cn(
				"flex shrink-0 items-center justify-center overflow-hidden bg-muted",
				"size-10 rounded-lg",
			)}
		>
			{icon}
		</div>
	)
}

/**
 * 新移动端文件区：只负责目录浏览、搜索与轻量添加入口，业务写操作通过父层回调下沉。
 */
function MobileProjectDetailFilesView({
	attachments,
	activeFileId,
	allowEdit = true,
	mobileViewVariant = "project-detail",
	refreshLoading = false,
	onRefresh,
	selectionResetKey = 0,
	onFileOpen,
	onSelectionModeChange,
	onCreateFile,
	onCreateFolder,
	onUploadFile,
	onBatchDownload,
	onBatchExportPdf,
	onBatchExportPpt,
	onBatchShare,
	onBatchMove,
	onBatchDelete,
}: MobileProjectDetailFilesViewProps) {
	const { t } = useTranslation("super")
	const isChatSheetVariant = mobileViewVariant === "chat-sheet"
	const [pathStackKeys, setPathStackKeys] = useState<string[]>([])
	const [searchValue, setSearchValue] = useState("")
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
	const [addSheetOpen, setAddSheetOpen] = useState(false)
	const [createSheetOpen, setCreateSheetOpen] = useState(false)
	const [downloadSheetOpen, setDownloadSheetOpen] = useState(false)
	const [createDraft, setCreateDraft] = useState<{
		mode: "file" | "folder"
		type?: PresetFileType
		label: string
		fileName: string
		extension?: string
	} | null>(null)

	const isSearching = searchValue.trim().length > 0

	/**
	 * 目录状态只保留稳定 key；真正展示节点始终从最新 attachments 树重新解析，避免刷新后继续读旧对象引用。
	 */
	const resolvedPathStack = useMemo(() => {
		const resolved: AttachmentItem[] = []
		let currentLevel = attachments.filter((item) => !item?.is_hidden)

		for (const pathKey of pathStackKeys) {
			const matchedItem = currentLevel.find((item) => getAttachmentKey(item) === pathKey)
			if (!matchedItem || !matchedItem.is_directory) {
				break
			}

			resolved.push(matchedItem)
			currentLevel = getVisibleChildren(matchedItem)
		}

		return resolved
	}, [attachments, pathStackKeys])

	const currentParentPath = resolvedPathStack.at(-1)?.relative_file_path

	const currentNodes = useMemo(() => {
		return resolvedPathStack.length === 0
			? attachments.filter((item) => !item?.is_hidden)
			: getVisibleChildren(resolvedPathStack.at(-1))
	}, [attachments, resolvedPathStack])
	const folders = useMemo(() => currentNodes.filter((item) => item.is_directory), [currentNodes])
	const files = useMemo(() => currentNodes.filter((item) => !item.is_directory), [currentNodes])

	const searchResults = useMemo(() => {
		if (!isSearching) return []
		return collectSearchResults(attachments, searchValue)
	}, [attachments, isSearching, searchValue])

	/**
	 * 当前底栏只作用于“当前视图”，因此勾选集合也只从当前展示节点里回推真实 AttachmentItem。
	 */
	const currentSelectableItems = useMemo(() => {
		if (isSearching) {
			return searchResults.map((result) => result.item)
		}

		return [...folders, ...files]
	}, [files, folders, isSearching, searchResults])

	const selectedItems = useMemo(() => {
		return currentSelectableItems.filter((item) => selectedIds.has(getAttachmentKey(item)))
	}, [currentSelectableItems, selectedIds])

	const isAllSelected =
		currentSelectableItems.length > 0 &&
		currentSelectableItems.every((item) => selectedIds.has(getAttachmentKey(item)))

	useEffect(() => {
		setSelectedIds(new Set())
	}, [pathStackKeys, searchValue, selectionResetKey])

	useEffect(() => {
		// attachments 变化后如果当前路径里有目录被删除/移动，自动回退到仍然存在的有效路径。
		if (resolvedPathStack.length === pathStackKeys.length) return
		setPathStackKeys(resolvedPathStack.map((item) => getAttachmentKey(item)))
	}, [pathStackKeys.length, resolvedPathStack])

	useEffect(() => {
		onSelectionModeChange?.(selectedItems.length > 0)
	}, [onSelectionModeChange, selectedItems.length])

	/**
	 * 切换选中态只影响新的移动端外观层，并通过回调通知页面隐藏底部输入区。
	 */
	const toggleSelected = (item: AttachmentItem) => {
		const key = getAttachmentKey(item)
		setSelectedIds((prev) => {
			const next = new Set(prev)
			if (next.has(key)) {
				next.delete(key)
			} else {
				next.add(key)
			}
			return next
		})
	}

	/**
	 * 目录导航仍保持“根目录 / 当前路径”结构，避免把后端树结构直接暴露给视图层。
	 */
	const handleNavigateTo = (index: number) => {
		if (index < 0) {
			setPathStackKeys([])
			return
		}

		setPathStackKeys((prev) => prev.slice(0, index + 1))
	}

	/**
	 * 全选只覆盖当前目录或当前搜索结果，和原型的“当前视图全选”行为保持一致。
	 */
	const handleToggleAll = () => {
		if (isAllSelected) {
			setSelectedIds(new Set())
			return
		}

		setSelectedIds(new Set(currentSelectableItems.map((item) => getAttachmentKey(item))))
	}

	/**
	 * 创建面板里的预置文件图标和列表区保持同一套组件，避免不同入口出现图标分叉。
	 */
	function renderCreateFileIcon(fileExtension?: string) {
		return <TopicFileIcon fileExtension={fileExtension} />
	}

	/**
	 * 行级图标在视图层完成业务判断，让 `.magic` 与目录状态规则更容易顺着页面阅读。
	 */
	function renderRowIcon(item: AttachmentItem) {
		return (
			<TopicFileIcon
				isDirectory={item.is_directory}
				magicVariant={resolveAttachmentMagicVariant(item)}
				hasChildren={getVisibleChildren(item).length > 0}
				fileExtension={item.file_extension}
			/>
		)
	}

	function getFileSecondaryText(item: AttachmentItem): string {
		const normalizedFileExtension = normalizeFileExtension(item.file_extension)
		const fileTypeLabelKey =
			FILE_TYPE_LABEL_KEYS[normalizedFileExtension as keyof typeof FILE_TYPE_LABEL_KEYS] ||
			"projectDetail.fileType.file"
		const fileTypeLabel = t(fileTypeLabelKey)
		const parsedFileSize =
			typeof item.file_size === "number"
				? item.file_size
				: typeof item.file_size === "string" && Number.isFinite(Number(item.file_size))
					? Number(item.file_size)
					: undefined

		if (parsedFileSize !== undefined) {
			return `${formatFileSize(parsedFileSize)} · ${fileTypeLabel}`
		}

		return fileTypeLabel
	}

	function getFolderSecondaryText(item: AttachmentItem): string {
		const childrenCount = getVisibleChildren(item).length
		if (childrenCount === 0) {
			return t("projectDetail.emptyFolder")
		}

		return t("projectDetail.fileItems", { count: childrenCount })
	}

	/**
	 * 菜单 sheet 只负责动作分组；真正的命名输入放到独立 create sheet，贴近原型的两段式交互。
	 */
	function openCreateDraft(nextDraft: NonNullable<typeof createDraft>) {
		setCreateDraft(nextDraft)
		setAddSheetOpen(false)
		setCreateSheetOpen(true)
	}

	/**
	 * 关闭 create sheet 时同步清理输入态，避免下次打开时误复用上一次的名称。
	 */
	function closeCreateSheet() {
		setCreateSheetOpen(false)
		setCreateDraft(null)
	}

	/**
	 * 创建态只更新文件名字段，保持其余类型和扩展名配置不被输入事件覆盖。
	 */
	function handleCreateDraftNameChange(fileName: string) {
		setCreateDraft((prev) => (prev ? { ...prev, fileName } : prev))
	}

	/**
	 * 统一渲染 sheet 分组标题，保证菜单态与原型一致的字号、边距和弱化层级。
	 */
	function renderSheetGroupLabel(label: string) {
		return (
			<p className="px-[14px] pb-0.5 pt-1 text-[13px] leading-5 text-muted-foreground">
				{label}
			</p>
		)
	}

	/**
	 * 统一渲染菜单项与缩进分隔线，避免不同分组出现间距和分隔样式漂移。
	 */
	function renderSheetMenuItem({
		key,
		label,
		icon,
		onClick,
		dataTestId,
		showDivider = false,
	}: {
		key: string
		label: string
		icon: ReactNode
		onClick: () => void
		dataTestId?: string
		showDivider?: boolean
	}) {
		return (
			<div key={key}>
				<button
					type="button"
					className="flex h-14 w-full items-center gap-3 bg-transparent px-[14px] text-left active:opacity-60"
					onClick={onClick}
					data-testid={dataTestId}
				>
					<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
						{icon}
					</div>
					<span className="flex-1 text-left text-base leading-5 text-foreground">
						{label}
					</span>
				</button>
				{showDivider ? <div className="ml-[66px] h-px bg-border" aria-hidden /> : null}
			</div>
		)
	}

	const createActionItems: CreateActionItem[] = [
		{
			key: "txt",
			label: t("topicFiles.contextMenu.createSubMenu.txtFile"),
			icon: renderCreateFileIcon("txt"),
			fileType: "txt",
			onClick: () => {
				openCreateDraft({
					mode: "file",
					type: "txt",
					label: t("topicFiles.contextMenu.createSubMenu.txtFile"),
					fileName: "",
					extension: "txt",
				})
			},
		},
		{
			key: "md",
			label: t("topicFiles.contextMenu.createSubMenu.mdFile"),
			icon: renderCreateFileIcon("md"),
			fileType: "md",
			onClick: () => {
				openCreateDraft({
					mode: "file",
					type: "md",
					label: t("topicFiles.contextMenu.createSubMenu.mdFile"),
					fileName: "",
					extension: "md",
				})
			},
		},
		{
			key: "html",
			label: t("topicFiles.contextMenu.createSubMenu.htmlFile"),
			icon: renderCreateFileIcon("html"),
			fileType: "html",
			onClick: () => {
				openCreateDraft({
					mode: "file",
					type: "html",
					label: t("topicFiles.contextMenu.createSubMenu.htmlFile"),
					fileName: "",
					extension: "html",
				})
			},
		},
		{
			key: "custom",
			label: t("topicFiles.contextMenu.createSubMenu.customFile"),
			icon: renderCreateFileIcon("customFile"),
			fileType: "customFile",
			onClick: () => {
				openCreateDraft({
					mode: "file",
					type: "customFile",
					label: t("topicFiles.contextMenu.createSubMenu.customFile"),
					fileName: "",
				})
			},
		},
	]

	const downloadActionItems = [
		{
			key: "download",
			label: t("topicFiles.contextMenu.download"),
			icon: <Download className="size-5" strokeWidth={1.8} />,
			onClick: () => onBatchDownload?.(selectedItems),
		},
		{
			key: "pdf",
			label: t("topicFiles.contextMenu.downloadPdf"),
			icon: <Download className="size-5" strokeWidth={1.8} />,
			onClick: () => onBatchExportPdf?.(selectedItems),
		},
		{
			key: "ppt",
			label: t("topicFiles.contextMenu.downloadPpt"),
			icon: <Download className="size-5" strokeWidth={1.8} />,
			onClick: () => onBatchExportPpt?.(selectedItems),
		},
	]

	/**
	 * 确认创建时直接复用既有父层回调，只替换展示层，不引入新的业务保存入口。
	 */
	const handleSubmitCreateDraft = async () => {
		if (!createDraft) return

		const trimmedName = createDraft.fileName.trim()
		if (!trimmedName) return

		closeCreateSheet()

		try {
			if (createDraft.mode === "folder") {
				await onCreateFolder?.(currentParentPath, trimmedName)
			} else if (createDraft.type) {
				await onCreateFile?.(createDraft.type, currentParentPath, trimmedName)
			}
		} catch (error) {
			return
		}
	}

	const renderSelectionButton = (item: AttachmentItem) => {
		const isSelected = selectedIds.has(getAttachmentKey(item))

		return (
			<button
				type="button"
				onClick={() => toggleSelected(item)}
				className="flex size-9 shrink-0 items-center justify-center rounded-full active:bg-foreground/[0.06]"
				aria-label={
					isSelected ? t("topicFiles.cancelSelect") : t("topicFiles.batchOperation")
				}
			>
				{isSelected ? (
					<span className="flex size-[22px] items-center justify-center rounded-full bg-primary text-primary-foreground">
						<Check className="size-3.5" strokeWidth={2.5} />
					</span>
				) : (
					<span className="size-[22px] rounded-full border-2 border-muted-foreground/35" />
				)}
			</button>
		)
	}

	const renderFolderRow = (item: AttachmentItem) => {
		const key = getAttachmentKey(item)

		return (
			<div
				key={key}
				className={cn(
					"overflow-hidden bg-card",
					isChatSheetVariant ? "rounded-xl" : "rounded-xl",
				)}
				style={isChatSheetVariant ? { boxShadow: CHAT_SHEET_CARD_SHADOW } : undefined}
			>
				<div
					className={cn(
						"flex select-none items-center gap-3 px-[14px] py-2.5",
						isChatSheetVariant ? "min-h-[56px]" : "min-h-[56px]",
					)}
				>
					<button
						type="button"
						className="flex min-w-0 flex-1 items-center gap-3 text-left active:opacity-70"
						onClick={() =>
							setPathStackKeys((prev) => [...prev, getAttachmentKey(item)])
						}
					>
						{renderAttachmentIconCell(renderRowIcon(item))}
						<div className="min-w-0 flex-1">
							<p
								className={cn(
									"truncate leading-6 text-foreground",
									"text-base font-medium",
								)}
							>
								{getAttachmentName(item)}
							</p>
							<p className="mt-0.5 text-sm leading-4 text-muted-foreground">
								{getFolderSecondaryText(item)}
							</p>
						</div>
					</button>
					{renderSelectionButton(item)}
				</div>
			</div>
		)
	}

	const renderFileRow = (item: AttachmentItem, pathLabel?: string) => {
		const key = getAttachmentKey(item)
		const isActive = activeFileId && item.file_id === activeFileId

		return (
			<div
				key={key}
				className={cn(
					"overflow-hidden bg-card",
					isChatSheetVariant ? "rounded-xl" : "rounded-xl",
					isActive && "ring-1 ring-foreground/10",
				)}
				style={isChatSheetVariant ? { boxShadow: CHAT_SHEET_CARD_SHADOW } : undefined}
			>
				<div
					className={cn(
						"flex select-none items-center gap-3 px-[14px] py-2.5",
						isChatSheetVariant ? "min-h-[56px]" : "min-h-[56px]",
					)}
				>
					<button
						type="button"
						className="flex min-w-0 flex-1 items-center gap-3 text-left active:opacity-70"
						onClick={() => onFileOpen?.(item)}
					>
						{renderAttachmentIconCell(renderRowIcon(item))}
						<div className="min-w-0 flex-1">
							<p
								className={cn(
									"truncate leading-6 text-foreground",
									isChatSheetVariant ? "text-base font-medium" : "text-base",
								)}
							>
								{getAttachmentName(item)}
							</p>
							<p className="mt-0.5 truncate text-sm leading-4 text-muted-foreground">
								{pathLabel || getFileSecondaryText(item)}
							</p>
						</div>
					</button>
					{renderSelectionButton(item)}
				</div>
			</div>
		)
	}

	const renderEmptyState = () => {
		if (refreshLoading) {
			return (
				<div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
					{t("loading")}
				</div>
			)
		}

		if (isSearching) {
			return (
				<div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
					{t("search.searchEmptyDescription", { keyword: searchValue })}
				</div>
			)
		}

		return (
			<div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
				{t("topicFiles.emptyState.title")}
			</div>
		)
	}

	return (
		<div
			className={cn("relative flex h-full min-h-0 flex-col")}
			data-testid="project-detail-mobile-files-view"
		>
			{!isSearching && (
				<div
					className={cn(
						"flex shrink-0 items-center gap-1",
						isChatSheetVariant ? "px-[10px] py-2" : "px-1 py-2",
					)}
				>
					<button
						type="button"
						disabled={resolvedPathStack.length === 0}
						className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground active:bg-foreground/[0.06] disabled:opacity-30"
						onClick={() => handleNavigateTo(resolvedPathStack.length - 2)}
						aria-label={t("back")}
					>
						<ChevronLeft className="h-5 w-5" />
					</button>
					<div className="h-5 w-px shrink-0 bg-border" />
					<button
						type="button"
						className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-foreground/[0.06]"
						onClick={() => handleNavigateTo(-1)}
						aria-label={t("home")}
					>
						<Home className="h-4.5 w-4.5" />
					</button>
					{resolvedPathStack.map((item, index) => (
						<div key={getAttachmentKey(item)} className="flex min-w-0 items-center">
							<ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
							<button
								type="button"
								className={cn(
									"min-w-0 truncate rounded-lg px-2 py-1 text-base leading-6",
									index === resolvedPathStack.length - 1
										? "font-medium text-foreground"
										: "text-muted-foreground active:bg-foreground/[0.05]",
								)}
								onClick={() => handleNavigateTo(index)}
							>
								{getAttachmentName(item)}
							</button>
						</div>
					))}
				</div>
			)}

			<div className="relative min-h-0 flex-1">
				<MagicPullToRefresh
					onRefresh={async () => {
						await onRefresh?.()
					}}
					showSuccessMessage={false}
					disabled={!onRefresh}
					containerClassName="relative min-h-0 flex-1"
				>
					<div className="flex min-h-full flex-col pb-24">
						{isSearching ? (
							searchResults.length === 0 ? (
								renderEmptyState()
							) : (
								<div
									className={cn(
										"flex flex-col gap-2",
										isChatSheetVariant ? "px-[10px] py-2.5" : "py-2",
									)}
								>
									{searchResults.map((result) =>
										renderFileRow(result.item, result.pathLabel || "/"),
									)}
								</div>
							)
						) : folders.length === 0 && files.length === 0 ? (
							renderEmptyState()
						) : (
							<div
								className={cn(
									"flex flex-col gap-2",
									isChatSheetVariant ? "px-[10px] py-2.5" : "py-2",
								)}
							>
								{folders.map((item) => renderFolderRow(item))}
								{files.map((item) => renderFileRow(item))}
							</div>
						)}
					</div>
				</MagicPullToRefresh>

				{/* 添加按钮占据与原型一致的底栏上方位置；进入多选后隐藏，让底部操作区成为唯一主操作。 */}
				{allowEdit && selectedItems.length === 0 && (
					<Button
						type="button"
						size="icon"
						className={cn(
							"absolute bottom-2 right-2 h-12 w-12 rounded-full bg-foreground text-background shadow-lg hover:bg-foreground/90",
						)}
						onClick={() => setAddSheetOpen(true)}
						aria-label={t("projectDetail.fabFilesAria")}
						data-testid="project-detail-files-add-button"
					>
						<Plus className="h-5.5 w-5.5" strokeWidth={2} />
					</Button>
				)}
			</div>

			<div className="relative shrink-0">
				{selectedItems.length > 0 ? (
					<MobileFilesSelectionBar
						isAllSelected={isAllSelected}
						onToggleAll={handleToggleAll}
						onDownload={() => setDownloadSheetOpen(true)}
						onShare={() => onBatchShare?.(selectedItems)}
						onMove={() => onBatchMove?.(selectedItems)}
						onDelete={() => onBatchDelete?.(selectedItems)}
					/>
				) : (
					<MobileBottomSearchBar
						value={searchValue}
						placeholder={t("projectDetail.searchPlaceholder")}
						clearAriaLabel={t("projectDetail.clearSearch")}
						onValueChange={setSearchValue}
						testIdPrefix="project-detail-files-search"
						className={isChatSheetVariant ? "px-[10px] pb-4 pt-2.5" : undefined}
					/>
				)}
			</div>

			<MagicPopup
				visible={addSheetOpen}
				onClose={() => setAddSheetOpen(false)}
				title={t("projectDetail.addTitle")}
				headerVariant="actionHeader"
				headerTitle={t("projectDetail.addTitle")}
				headerLeadingAction={{
					icon: <X className="size-[22px] text-foreground" />,
					ariaLabel: t("close"),
					onClick: () => setAddSheetOpen(false),
					testId: "project-detail-files-menu-close-button",
				}}
				position="bottom"
				className="rounded-t-xl border-0 bg-muted"
				bodyClassName="flex flex-col overflow-hidden p-0"
				style={MOBILE_SHEET_MAX_HEIGHT}
				destroyOnClose={false}
			>
				<div
					className="flex flex-col gap-2.5 overflow-y-auto px-[10px] pb-[max(var(--safe-area-inset-bottom),16px)] pt-2"
					data-testid="project-detail-files-menu-sheet"
				>
					<div className="flex flex-col gap-1.5">
						{renderSheetGroupLabel(t("projectDetail.createSection"))}
						<div className="w-full shrink-0 overflow-hidden rounded-lg bg-card">
							{createActionItems.map((item, index) =>
								renderSheetMenuItem({
									key: item.key,
									label: item.label,
									icon: item.icon,
									onClick: item.onClick,
									dataTestId: `project-detail-files-create-${item.key}-button`,
									showDivider: index < createActionItems.length - 1,
								}),
							)}
						</div>
					</div>

					<div className="flex flex-col gap-1.5">
						{renderSheetGroupLabel(t("projectDetail.organizeSection"))}
						<div className="w-full shrink-0 overflow-hidden rounded-lg bg-card">
							{renderSheetMenuItem({
								key: "folder",
								label: t("topicFiles.contextMenu.createFolder"),
								icon: <TopicFileIcon isDirectory />,
								onClick: () =>
									openCreateDraft({
										mode: "folder",
										label: t("topicFiles.contextMenu.createFolder"),
										fileName: "",
									}),
								dataTestId: "project-detail-files-create-folder-button",
							})}
						</div>
					</div>

					<div className="flex flex-col gap-1.5">
						{renderSheetGroupLabel(t("projectDetail.importSection"))}
						<div className="w-full shrink-0 overflow-hidden rounded-lg bg-card">
							{renderSheetMenuItem({
								key: "upload",
								label: t("topicFiles.contextMenu.uploadFile"),
								icon: (
									<Upload
										className="size-5.5 text-foreground/70"
										strokeWidth={1.5}
									/>
								),
								onClick: () => {
									onUploadFile?.()
									setAddSheetOpen(false)
								},
								dataTestId: "project-detail-files-upload-button",
							})}
						</div>
					</div>
				</div>
			</MagicPopup>

			<MagicPopup
				visible={createSheetOpen}
				onClose={closeCreateSheet}
				title={t("projectDetail.addTitle")}
				headerVariant="actionHeader"
				headerTitle={t("projectDetail.addTitle")}
				headerLeadingAction={{
					icon: <X className="size-[22px] text-foreground" />,
					ariaLabel: t("close"),
					onClick: closeCreateSheet,
					testId: "project-detail-files-create-close-button",
				}}
				headerTrailingAction={{
					icon: <Check className="size-[22px] text-white" strokeWidth={2.5} />,
					ariaLabel: t("confirm"),
					onClick: () => {
						void handleSubmitCreateDraft()
					},
					disabled: !createDraft?.fileName.trim(),
					tone: "primary",
					testId: "project-detail-files-create-confirm-button",
				}}
				position="bottom"
				className="rounded-t-xl border-0 bg-muted"
				bodyClassName="flex flex-col overflow-hidden p-0"
				style={MOBILE_SHEET_MAX_HEIGHT}
				destroyOnClose={false}
			>
				<div
					className="flex flex-col gap-2 px-[10px] pb-[max(var(--safe-area-inset-bottom),16px)] pt-2"
					data-testid="project-detail-files-create-sheet"
				>
					<p className="px-[14px] text-sm leading-5 text-muted-foreground">
						{createDraft?.mode === "folder"
							? t("projectDetail.createFolderNameLabel")
							: t("projectDetail.createFileNameLabel")}
					</p>
					<div className="flex h-12 items-center overflow-hidden rounded-lg bg-card">
						<div className="pl-[14px]">
							{createDraft?.mode === "folder" ? (
								<TopicFileIcon isDirectory />
							) : (
								renderCreateFileIcon(createDraft?.extension || createDraft?.type)
							)}
						</div>
						<div className="mx-3 h-5 w-px shrink-0 bg-border" aria-hidden />
						<Input
							value={createDraft?.fileName || ""}
							onChange={(event) => handleCreateDraftNameChange(event.target.value)}
							placeholder={t(
								createDraft?.mode === "folder"
									? "projectDetail.createFolderNamePlaceholder"
									: "projectDetail.createFileNamePlaceholder",
							)}
							className="h-12 min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 py-0 text-base text-foreground shadow-none focus-visible:ring-0"
							autoFocus
							data-testid="project-detail-files-create-name-input"
						/>
						{createDraft?.extension ? (
							<span className="pr-[14px] text-base text-muted-foreground">
								.{createDraft.extension}
							</span>
						) : null}
					</div>
				</div>
			</MagicPopup>

			<MagicPopup
				visible={downloadSheetOpen}
				onClose={() => setDownloadSheetOpen(false)}
				title={t("topicFiles.downloadTitle")}
				headerVariant="actionHeader"
				headerTitle={t("topicFiles.downloadTitle")}
				headerLeadingAction={{
					icon: <X className="size-[22px] text-foreground" />,
					ariaLabel: t("close"),
					onClick: () => setDownloadSheetOpen(false),
					testId: "project-detail-files-download-close-button",
				}}
				position="bottom"
				className="rounded-t-xl border-0 bg-muted"
				bodyClassName="flex flex-col overflow-hidden px-2.5 pb-[max(var(--safe-area-inset-bottom),16px)] pt-2"
				style={MOBILE_SHEET_MAX_HEIGHT}
				destroyOnClose={false}
			>
				<div className="overflow-hidden rounded-lg bg-card">
					{downloadActionItems.map((item, index) => (
						<button
							key={item.key}
							type="button"
							className={cn(
								"flex h-14 w-full items-center gap-3 bg-transparent px-3.5 text-left active:opacity-60",
								index > 0 && "border-t border-border/60",
							)}
							onClick={() => {
								item.onClick()
								setDownloadSheetOpen(false)
							}}
						>
							<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
								{item.icon}
							</div>
							<span className="flex-1 text-left text-base leading-5 text-foreground">
								{item.label}
							</span>
						</button>
					))}
				</div>
			</MagicPopup>
		</div>
	)
}

export default observer(MobileProjectDetailFilesView)
