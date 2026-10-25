import { useRef } from "react"
import { useFileTagVisibility } from "../hooks/useFileTagVisibility"
import { getFilePresentationIndex } from "../utils/file-presentation"
import type { FileHelpContext } from "../utils/magic-system-folder"
import { ProjectFileTag } from "./TopicFileTag"
import { useFileAccess } from "@/pages/superMagic/providers/FileAccessProvider"
import { filterFileAccessMenuItems } from "../utils/file-access-menu"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import MagicPullToRefresh from "@/components/base-mobile/MagicPullToRefresh"
import { ScrollEdgeFadeContainer } from "@/components/base-mobile/ScrollEdgeFade"
import magicToast from "@/components/base/MagicToaster/utils"
import MobilePathBreadcrumb from "@/pages/superMagic/components/MobilePathBreadcrumb"
import { DataEmptyState } from "@/pages/superMagicMobile/components/DataEmptyState"
import { Input } from "@/components/shadcn-ui/input"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { cn } from "@/utils/cn"
import { isEmpty } from "lodash-es"
import { observer } from "mobx-react-lite"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import { detectContentTypeRender } from "@/pages/superMagic/components/Detail/components/FilesViewer/utils/preview"
import { getAppEntryFile } from "@/pages/superMagic/components/MessageList/components/MessageAttachment/utils"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import MobileBottomSearchBar from "@/pages/superMagicMobile/components/MobileBottomSearchBar"
import { formatFileSize } from "@/utils/string"
import { Check, Plus, Upload, X } from "lucide-react"
import { type ReactNode, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import type { PresetFileType } from "../constant"
import MobileFilesSelectionBar from "./MobileFilesSelectionBar"
import { MobileFileDownloadSheet } from "./MobileFileDownloadSheet"
import { MobileAttachmentRowIcon } from "./MobileAttachmentRowIcon"
import { TopicFileIcon } from "./TopicFileIcon"
import {
	menuItemsIncludeNoWaterMarkDownload,
	type MobileDownloadMenuItem,
} from "../utils/build-single-file-download-menu"
import {
	getAttachmentDisplayName,
	getAttachmentKey,
	getVisibleAttachmentChildren,
} from "../utils/getAttachmentKey"
import {
	collectAttachmentsBySelectedKeys,
	collectCurrentViewSelectableKeys,
	getAttachmentNodeSelectionState,
	toggleAllInCurrentView,
	toggleAttachmentSelection,
} from "../utils/mobileAttachmentTreeSelection"
import MobileFileSelectionCheckbox from "./MobileFileSelectionCheckbox"
import {
	ProjectFileImagePreviewProvider,
	useProjectFileImagePreviewManager,
} from "./ProjectFileImagePreviewProvider"

interface MobileProjectDetailFilesViewProps {
	fileHelpContext?: FileHelpContext
	attachments: AttachmentItem[]
	activeFileId?: string | null
	allowEdit?: boolean
	mobileViewVariant?: "project-detail" | "chat-sheet"
	refreshLoading?: boolean
	onRefresh?: () => Promise<void> | void
	selectionResetKey?: number
	setUserSelectDetail?: (detail: unknown) => void
	onFileOpen?: (item: AttachmentItem) => void
	onSelectionModeChange?: (isSelectionMode: boolean) => void
	onCreateFile?: (type: PresetFileType, parentPath?: string, fileName?: string) => void
	onCreateFolder?: (parentPath?: string, folderName?: string) => void
	onUploadFile?: () => void
	allowDownload?: boolean
	getSingleFileDownloadMenuItems?: (item: AttachmentItem) => MobileDownloadMenuItem[]
	preloadWaterMarkFreeModal?: () => void
	onSelectedKeysChange?: (keys: Set<string>) => void
	onBatchZipDownload?: () => void
	batchDownloadLoading?: boolean
	onBatchShare?: (selectedKeys: Set<string>) => void
	onBatchCopy?: (selectedKeys: Set<string>) => void
	onBatchMove?: (selectedKeys: Set<string>) => void
	onBatchDelete?: (selectedKeys: Set<string>) => void
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

/** Keep list row icons at the same pixel size as TopicFileIcon default (size-6). */
const MOBILE_ATTACHMENT_ROW_ICON_SIZE = 24

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

function normalizeFileExtension(fileExtension?: string): string {
	return fileExtension?.replace(/^\./, "").toLowerCase() || ""
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

		const nodeName = getAttachmentDisplayName(node).toLowerCase()
		const extension = normalizeFileExtension(node.file_extension)

		if (node.is_directory) {
			results.push(
				...collectSearchResults(getVisibleAttachmentChildren(node), keyword, [
					...pathParts,
					getAttachmentDisplayName(node),
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

/** Align with TopicFilesCore: map AttachmentItem to FileItem for content-type preview detection. */
function toFileItem(item: AttachmentItem): FileItem {
	return {
		file_id: item.file_id || "",
		file_name: item.name || item.file_name || "",
		display_filename: item.name || item.file_name,
		is_directory: item.is_directory,
		children: item.children as FileItem[] | undefined,
		// PPT preview resolves slide paths relative to the project directory.
		relative_file_path: item.relative_file_path,
		parent_id: item.parent_id,
		display_config: item.display_config,
		file_extension: item.file_extension,
		file_size: item.file_size,
	}
}

/**
 * Share the 40px icon cell so files and folders have consistent visual density.
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
 * Browse and search files locally; delegate write operations to parent callbacks.
 */
function MobileProjectDetailFilesView({
	fileHelpContext,
	attachments,
	activeFileId,
	allowEdit = true,
	mobileViewVariant = "project-detail",
	refreshLoading = false,
	onRefresh,
	selectionResetKey = 0,
	setUserSelectDetail,
	onFileOpen,
	onSelectionModeChange,
	onCreateFile,
	onCreateFolder,
	onUploadFile,
	allowDownload = true,
	getSingleFileDownloadMenuItems,
	preloadWaterMarkFreeModal,
	onSelectedKeysChange,
	onBatchZipDownload,
	batchDownloadLoading = false,
	onBatchShare,
	onBatchCopy,
	onBatchMove,
	onBatchDelete,
}: MobileProjectDetailFilesViewProps) {
	const { permissions: access } = useFileAccess()
	const { t } = useTranslation("super")
	const skillFiles = useMemo(() => getFilePresentationIndex(attachments).skills, [attachments])
	const isChatSheetVariant = mobileViewVariant === "chat-sheet"
	const [pathStackKeys, setPathStackKeys] = useState<string[]>([])
	const [searchValue, setSearchValue] = useState("")
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
	const [addSheetOpen, setAddSheetOpen] = useState(false)
	const [createSheetOpen, setCreateSheetOpen] = useState(false)
	const [batchDownloadSheetOpen, setBatchDownloadSheetOpen] = useState(false)
	const [singleDownloadSheetOpen, setSingleDownloadSheetOpen] = useState(false)
	const [singleDownloadTarget, setSingleDownloadTarget] = useState<AttachmentItem | null>(null)
	const [createDraft, setCreateDraft] = useState<{
		mode: "file" | "folder"
		type?: PresetFileType
		label: string
		fileName: string
		extension?: string
	} | null>(null)

	const isSearching = searchValue.trim().length > 0

	/**
	 * Store stable directory keys and resolve them from the latest attachments to avoid stale nodes after refresh.
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
			currentLevel = getVisibleAttachmentChildren(matchedItem)
		}

		return resolved
	}, [attachments, pathStackKeys])

	const currentParentPath = resolvedPathStack.at(-1)?.relative_file_path

	const currentNodes = useMemo(() => {
		return resolvedPathStack.length === 0
			? attachments.filter((item) => !item?.is_hidden)
			: getVisibleAttachmentChildren(resolvedPathStack.at(-1))
	}, [attachments, resolvedPathStack])
	const folders = useMemo(() => currentNodes.filter((item) => item.is_directory), [currentNodes])
	const files = useMemo(() => currentNodes.filter((item) => !item.is_directory), [currentNodes])

	const searchResults = useMemo(() => {
		if (!isSearching) return []
		return collectSearchResults(attachments, searchValue)
	}, [attachments, isSearching, searchValue])

	const currentSelectableItems = useMemo(() => {
		if (isSearching) {
			return searchResults.map((result) => result.item)
		}

		return [...folders, ...files]
	}, [files, folders, isSearching, searchResults])
	const imagePreviewManager = useProjectFileImagePreviewManager({ attachments })

	const currentViewSelectableKeys = useMemo(() => {
		if (isSearching) {
			return searchResults.map((result) => getAttachmentKey(result.item))
		}

		return collectCurrentViewSelectableKeys(currentSelectableItems)
	}, [currentSelectableItems, isSearching, searchResults])

	const hasSelection = selectedIds.size > 0

	const selectedItems = useMemo(
		() => collectAttachmentsBySelectedKeys(attachments, selectedIds),
		[attachments, selectedIds],
	)

	const selectedInViewCount = currentViewSelectableKeys.filter((key) =>
		selectedIds.has(key),
	).length
	const isAllSelected =
		currentViewSelectableKeys.length > 0 &&
		selectedInViewCount === currentViewSelectableKeys.length
	const isPartiallySelected = selectedInViewCount > 0 && !isAllSelected

	// Search mode clears selection; folder navigation keeps cross-directory picks (prototype).
	useEffect(() => {
		setSelectedIds(new Set())
	}, [searchValue, selectionResetKey])

	useEffect(() => {
		// Return to the remaining valid path if a directory is removed or moved.
		if (resolvedPathStack.length === pathStackKeys.length) return
		setPathStackKeys(resolvedPathStack.map((item) => getAttachmentKey(item)))
	}, [pathStackKeys.length, resolvedPathStack])

	useEffect(() => {
		onSelectionModeChange?.(hasSelection)
	}, [hasSelection, onSelectionModeChange])

	// Keep parent useBatchDownload.selectedItems in sync with local multi-select state.
	useEffect(() => {
		onSelectedKeysChange?.(selectedIds)
	}, [onSelectedKeysChange, selectedIds])

	/**
	 * Notify the page about selection changes so it can hide the bottom composer.
	 */
	const toggleSelected = (item: AttachmentItem) => {
		setSelectedIds((prev) => toggleAttachmentSelection(item, prev))
	}

	/**
	 * Keep directory navigation in root/current-path form rather than exposing the backend tree.
	 */
	const handleNavigateTo = (index: number) => {
		if (index < 0) {
			setPathStackKeys([])
			return
		}

		setPathStackKeys((prev) => prev.slice(0, index + 1))
	}

	/**
	 * Select all items only in the current directory or current search results.
	 */
	const handleToggleAll = () => {
		setSelectedIds((prev) => toggleAllInCurrentView(currentViewSelectableKeys, prev))
	}

	/**
	 * Reuse list icons for preset file types in the create panel.
	 */
	function renderCreateFileIcon(fileExtension?: string) {
		return <TopicFileIcon fileExtension={fileExtension} />
	}

	/**
	 * Folder row click: special display_config folders open preview; normal folders drill down.
	 * Mirrors TopicFilesCore folder onClick (content-type render / app entry file).
	 */
	function handleFolderRowClick(item: AttachmentItem) {
		if (isEmpty(item.display_config)) {
			setPathStackKeys((prev) => [...prev, getAttachmentKey(item)])
			return
		}

		if (!access.view || !access.preview) return

		const fileItem = toFileItem(item)
		const contentTypeConfig = detectContentTypeRender(fileItem)

		if (contentTypeConfig) {
			if (onFileOpen && item.file_id) {
				onFileOpen(item)
			}

			const transformedData = contentTypeConfig.dataTransformer
				? contentTypeConfig.dataTransformer(fileItem)
				: item

			setUserSelectDetail?.({
				type: contentTypeConfig.detailType,
				data: {
					...item,
					...transformedData,
					file_id: item.file_id,
					file_name: item.name || item.file_name,
					display_config: item.display_config,
				},
				currentFileId: item.file_id,
				attachments,
			})
			return
		}

		const appEntryFile = getAppEntryFile(item.children || [], item.display_config)
		if (appEntryFile) {
			onFileOpen?.(appEntryFile)
			return
		}

		if (item.display_config?.type === "custom") {
			magicToast.error(t("topicFiles.customMainFileNotFound"))
			return
		}

		setPathStackKeys((prev) => [...prev, getAttachmentKey(item)])
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
		const childrenCount = getVisibleAttachmentChildren(item).length
		if (childrenCount === 0) {
			return t("projectDetail.emptyFolder")
		}

		return t("projectDetail.fileItems", { count: childrenCount })
	}

	/**
	 * Group actions in the menu sheet and collect names in a separate create sheet.
	 */
	function openCreateDraft(nextDraft: NonNullable<typeof createDraft>) {
		setCreateDraft(nextDraft)
		setAddSheetOpen(false)
		setCreateSheetOpen(true)
	}

	/**
	 * Clear the draft on close so reopening cannot reuse the previous name.
	 */
	function closeCreateSheet() {
		setCreateSheetOpen(false)
		setCreateDraft(null)
	}

	/**
	 * Update only the name so input changes preserve the file type and extension.
	 */
	function handleCreateDraftNameChange(fileName: string) {
		setCreateDraft((prev) => (prev ? { ...prev, fileName } : prev))
	}

	/**
	 * Render consistent group labels across the action sheet.
	 */
	function renderSheetGroupLabel(label: string) {
		return (
			<p className="px-[14px] pb-0.5 pt-1 text-[13px] leading-5 text-muted-foreground">
				{label}
			</p>
		)
	}

	/**
	 * Share menu rows and inset dividers to preserve spacing across groups.
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

	const batchZipMenuItems = useMemo<MobileDownloadMenuItem[]>(
		() =>
			allowDownload && access.download && onBatchZipDownload
				? [
						{
							key: "batchZip",
							label: t("topicFiles.contextMenu.download"),
							onClick: () => onBatchZipDownload(),
						},
					]
				: [],
		[allowDownload, access.download, onBatchZipDownload, t],
	)

	const singleDownloadMenuItems = useMemo(() => {
		if (!singleDownloadTarget || !getSingleFileDownloadMenuItems) return []
		return allowDownload
			? filterFileAccessMenuItems(
					getSingleFileDownloadMenuItems(singleDownloadTarget),
					access,
				)
			: []
	}, [getSingleFileDownloadMenuItems, singleDownloadTarget, access, allowDownload])

	/** Open per-file export sheet (used when exactly one item is selected in the bottom bar). */
	const openSingleFileDownloadSheet = (item: AttachmentItem) => {
		if (!allowDownload || !getSingleFileDownloadMenuItems) return
		const menuItems = filterFileAccessMenuItems(getSingleFileDownloadMenuItems(item), access)
		if (menuItems.length === 0) return
		// Start modal chunk load as soon as user opens the sheet (mobile equivalent of desktop hover).
		if (menuItemsIncludeNoWaterMarkDownload(menuItems)) preloadWaterMarkFreeModal?.()
		setSingleDownloadTarget(item)
		setSingleDownloadSheetOpen(true)
	}

	/** Bottom-bar download: one selection → single-file menu; multiple → batch ZIP sheet. */
	const handleSelectionDownload = () => {
		if (!allowDownload || selectedItems.length === 0) return

		if (selectedItems.length === 1) {
			openSingleFileDownloadSheet(selectedItems[0])
			return
		}

		if (!access.download || !onBatchZipDownload) return
		setBatchDownloadSheetOpen(true)
	}

	const canSelectionDownload = useMemo(() => {
		if (!allowDownload || selectedItems.length === 0) return false
		if (selectedItems.length === 1) {
			if (!getSingleFileDownloadMenuItems) return false
			return (
				filterFileAccessMenuItems(getSingleFileDownloadMenuItems(selectedItems[0]), access)
					.length > 0
			)
		}
		return access.download && Boolean(onBatchZipDownload)
	}, [allowDownload, getSingleFileDownloadMenuItems, onBatchZipDownload, selectedItems, access])

	/**
	 * Confirm creation through existing parent callbacks without adding a persistence path.
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
		const selectionState = getAttachmentNodeSelectionState(item, selectedIds)
		const isFullySelected = selectionState === "all"

		return (
			<MobileFileSelectionCheckbox
				state={selectionState}
				onClick={() => toggleSelected(item)}
				data-testid="mobile-file-checkbox"
				ariaLabel={
					isFullySelected ? t("topicFiles.cancelSelect") : t("topicFiles.batchOperation")
				}
			/>
		)
	}

	const labelsRef = useRef<HTMLDivElement>(null)
	useFileTagVisibility(labelsRef)

	const renderFolderRow = (item: AttachmentItem) => {
		const key = getAttachmentKey(item)

		return (
			<div
				key={key}
				data-file-id={item.file_id || undefined}
				data-file-kind="folder"
				data-testid="project-detail-mobile-file-row"
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
					data-file-label-row
					data-testid="mobile-folder-content"
				>
					<button
						type="button"
						className="flex min-w-0 flex-1 items-center gap-3 text-left active:opacity-70"
						onClick={() => handleFolderRowClick(item)}
						data-file-name-container
						data-testid="mobile-folder-button"
					>
						{renderAttachmentIconCell(
							<MobileAttachmentRowIcon
								item={item}
								attachments={attachments}
								skillKind={skillFiles.kinds.get(key)}
								filePath={skillFiles.paths.get(key)}
								fileHelpContext={fileHelpContext}
								size={MOBILE_ATTACHMENT_ROW_ICON_SIZE}
							/>,
						)}
						<div className="min-w-0 flex-1">
							<p
								className={cn(
									"truncate leading-6 text-foreground",
									"text-base font-medium",
								)}
								data-file-name
								data-testid="mobile-folder-name"
							>
								{getAttachmentDisplayName(item)}
							</p>
							<p
								className="mt-0.5 text-sm leading-4 text-muted-foreground"
								data-testid="mobile-folder-description"
							>
								{getFolderSecondaryText(item)}
							</p>
						</div>
					</button>
					{/* Keep help beside open/selection controls so touching it cannot trigger file actions. */}
					<div data-file-tag className="w-max max-w-none shrink-0 empty:hidden">
						<ProjectFileTag
							item={item}
							skillKind={skillFiles.kinds.get(key)}
							path={skillFiles.paths.get(key)}
							context={fileHelpContext}
						/>
					</div>
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
				data-file-id={item.file_id || undefined}
				data-file-kind="file"
				data-testid="project-detail-mobile-file-row"
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
					data-file-label-row
					data-testid="mobile-file-content"
				>
					<button
						type="button"
						className="flex min-w-0 flex-1 items-center gap-3 text-left active:opacity-70"
						onClick={() => {
							if (access.view && access.preview) onFileOpen?.(item)
						}}
						data-file-name-container
						data-testid="mobile-file-button"
					>
						{renderAttachmentIconCell(
							<MobileAttachmentRowIcon
								item={item}
								attachments={attachments}
								skillKind={skillFiles.kinds.get(key)}
								filePath={skillFiles.paths.get(key)}
								fileHelpContext={fileHelpContext}
								size={MOBILE_ATTACHMENT_ROW_ICON_SIZE}
							/>,
						)}
						<div className="min-w-0 flex-1">
							<p
								className={cn(
									"truncate leading-6 text-foreground",
									isChatSheetVariant ? "text-base font-medium" : "text-base",
								)}
								data-file-name
								data-testid="mobile-file-name"
							>
								{getAttachmentDisplayName(item)}
							</p>
							<p
								className="mt-0.5 truncate text-sm leading-4 text-muted-foreground"
								data-testid="mobile-file-description"
							>
								{pathLabel || getFileSecondaryText(item)}
							</p>
						</div>
					</button>
					{/* Keep help beside open/selection controls so touching it cannot trigger file actions. */}
					<div data-file-tag className="w-max max-w-none shrink-0 empty:hidden">
						<ProjectFileTag
							item={item}
							skillKind={skillFiles.kinds.get(key)}
							path={skillFiles.paths.get(key)}
							context={fileHelpContext}
						/>
					</div>
					{renderSelectionButton(item)}
				</div>
			</div>
		)
	}

	/** Selects the mobile file-list placeholder for loading, search-empty, and default-empty states. */
	const renderEmptyState = () => {
		if (refreshLoading) {
			return (
				<div
					className="flex flex-1 items-center justify-center text-sm text-muted-foreground"
					data-testid="mobile-files-loading"
				>
					{t("loading")}
				</div>
			)
		}

		if (isSearching) {
			return (
				<DataEmptyState
					variant="chatFilesSearch"
					compact
					className="min-h-0 flex-1 py-12"
					testId="mobile-files-search-empty"
				/>
			)
		}

		return (
			<div
				className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground"
				data-testid="mobile-files-empty"
			>
				{t("topicFiles.emptyState.title")}
			</div>
		)
	}

	return (
		<ProjectFileImagePreviewProvider manager={imagePreviewManager}>
			<div
				ref={labelsRef}
				className={cn("relative flex h-full min-h-0 flex-col")}
				data-testid="project-detail-mobile-files-view"
			>
				{!isSearching && (
					<MobilePathBreadcrumb
						className={cn(isChatSheetVariant ? "px-[10px] py-2" : "px-1 py-2")}
						canBack={resolvedPathStack.length > 0}
						onBack={() => handleNavigateTo(resolvedPathStack.length - 2)}
						onGoHome={() => handleNavigateTo(-1)}
						backLabel={t("back")}
						homeLabel={t("home")}
						backButtonTestId="project-detail-mobile-back-button"
						homeButtonTestId="project-detail-mobile-home-button"
						homeIconClassName="h-4.5 w-4.5"
						separatorClassName="h-4 w-4 text-muted-foreground/60"
						segmentButtonClassName="px-2 text-base leading-6"
						scrollTestId="project-detail-files-breadcrumb-scroll"
						segments={resolvedPathStack.map((item, index) => ({
							key: getAttachmentKey(item),
							label: getAttachmentDisplayName(item),
							onClick: () => handleNavigateTo(index),
						}))}
					/>
				)}

				{/* flex-col shell so ScrollEdgeFade flex-1 gets a bounded height (same as MobileFilesMoveSheet). */}
				<div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
					<ScrollEdgeFadeContainer
						fadeColor="mobile-background"
						className="min-h-0 flex-1"
						scrollClassName="no-scrollbar"
						contentDeps={[
							attachments.length,
							folders.length,
							files.length,
							searchResults.length,
							searchValue,
							refreshLoading,
							hasSelection,
						]}
					>
						<MagicPullToRefresh
							embedInParentScroll
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
											data-testid="mobile-files-search-list"
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
										data-testid="mobile-files-list"
									>
										{folders.map((item) => renderFolderRow(item))}
										{files.map((item) => renderFileRow(item))}
									</div>
								)}
							</div>
						</MagicPullToRefresh>
					</ScrollEdgeFadeContainer>

					{/* Keep the file action FAB outside ScrollEdgeFadeContainer's isolated stacking context so the bottom search shadow cannot cover it. */}
					{allowEdit && !hasSelection && (
						<Button
							type="button"
							size="icon"
							className={cn(
								"absolute bottom-1 right-2 z-30 h-12 w-12 rounded-full bg-foreground text-background hover:bg-foreground/90",
							)}
							onClick={() => setAddSheetOpen(true)}
							aria-label={t("projectDetail.fabFilesAria")}
							data-testid="project-detail-files-add-button"
						>
							<Plus className="size-[22px]" strokeWidth={2} />
						</Button>
					)}
				</div>

				<div className="relative z-10 shrink-0 bg-mobile-background">
					{hasSelection ? (
						<MobileFilesSelectionBar
							isAllSelected={isAllSelected}
							isPartiallySelected={isPartiallySelected}
							onToggleAll={handleToggleAll}
							onDownload={canSelectionDownload ? handleSelectionDownload : undefined}
							onShare={access.share ? () => onBatchShare?.(selectedIds) : undefined}
							onCopy={() => onBatchCopy?.(selectedIds)}
							onMove={() => onBatchMove?.(selectedIds)}
							onDelete={() => onBatchDelete?.(selectedIds)}
						/>
					) : (
						<MobileBottomSearchBar
							value={searchValue}
							placeholder={t("projectDetail.searchPlaceholder")}
							clearAriaLabel={t("projectDetail.clearSearch")}
							onValueChange={setSearchValue}
							testIdPrefix="project-detail-files-search"
							className={
								isChatSheetVariant
									? "pb-[max(var(--safe-area-inset-bottom),24px)] pt-2.5"
									: undefined
							}
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
						icon: <X />,
						ariaLabel: t("close"),
						onClick: () => setAddSheetOpen(false),
						testId: "project-detail-files-menu-close-button",
					}}
					position="bottom"
					// Keep focus scrolling in the viewport instead of moving the fixed action header.
					className="rounded-t-xl border-0 bg-muted supports-[overflow:clip]:overflow-clip"
					bodyClassName="flex min-h-0 flex-col overflow-hidden p-0 supports-[overflow:clip]:overflow-clip"
					style={MOBILE_SHEET_MAX_HEIGHT}
					destroyOnClose={false}
				>
					{/* The action groups scroll independently of the fixed sheet header. */}
					<ScrollArea
						className="grid min-h-0 w-full min-w-0 flex-1"
						viewportClassName="h-auto min-h-0 min-w-0 px-[10px] pb-[max(var(--safe-area-inset-bottom),16px)] pt-2 [&>div]:!flex [&>div]:w-full [&>div]:flex-col [&>div]:gap-2.5"
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
					</ScrollArea>
				</MagicPopup>

				<MagicPopup
					visible={createSheetOpen}
					onClose={closeCreateSheet}
					title={t("projectDetail.addTitle")}
					headerVariant="actionHeader"
					headerTitle={t("projectDetail.addTitle")}
					headerLeadingAction={{
						icon: <X />,
						ariaLabel: t("close"),
						onClick: closeCreateSheet,
						testId: "project-detail-files-create-close-button",
					}}
					headerTrailingAction={{
						icon: <Check />,
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
									renderCreateFileIcon(
										createDraft?.extension || createDraft?.type,
									)
								)}
							</div>
							<div className="mx-3 h-5 w-px shrink-0 bg-border" aria-hidden />
							<Input
								value={createDraft?.fileName || ""}
								onChange={(event) =>
									handleCreateDraftNameChange(event.target.value)
								}
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

				<MobileFileDownloadSheet
					visible={batchDownloadSheetOpen}
					onClose={() => setBatchDownloadSheetOpen(false)}
					mode="batch"
					menuItems={batchZipMenuItems}
					selectedCount={selectedItems.length}
					isLoading={batchDownloadLoading}
				/>

				<MobileFileDownloadSheet
					visible={singleDownloadSheetOpen}
					onClose={() => {
						setSingleDownloadSheetOpen(false)
						setSingleDownloadTarget(null)
					}}
					mode="single"
					title={
						singleDownloadTarget
							? getAttachmentDisplayName(singleDownloadTarget)
							: undefined
					}
					menuItems={singleDownloadMenuItems}
					preloadWaterMarkFreeModal={preloadWaterMarkFreeModal}
				/>
			</div>
		</ProjectFileImagePreviewProvider>
	)
}

export default observer(MobileProjectDetailFilesView)
