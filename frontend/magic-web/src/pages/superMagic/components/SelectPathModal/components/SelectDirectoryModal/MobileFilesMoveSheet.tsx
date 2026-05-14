import { Check, ChevronLeft, ChevronRight, Home, Search, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { Sheet, SheetContent, SheetTitle } from "@/components/shadcn-ui/sheet"
import { cn } from "@/lib/utils"
import MobileBottomSearchBar from "@/pages/superMagicMobile/components/MobileBottomSearchBar"

import type { AttachmentItem } from "../../../TopicFilesButton/hooks"
import FoldIcon from "@/pages/superMagic/assets/svg/file-folder.svg"
import { getDirectoriesFromPath, getItemId, getItemName } from "../../utils/attachmentUtils"

interface MobileFilesMoveSheetProps {
	visible: boolean
	title: string
	attachments: AttachmentItem[]
	defaultPath?: AttachmentItem[]
	disabledFolderIds?: string[]
	rootLabel: string
	backLabel: string
	homeLabel: string
	closeLabel: string
	confirmLabel: string
	clearSearchAriaLabel: string
	searchPlaceholder: string
	searchEmptyDescription: string
	emptyTip: string
	onClose: () => void
	onSubmit: (params: { path: AttachmentItem[] }) => void
}

interface DirectorySearchResult {
	directory: AttachmentItem
	pathLabel: string
}

const HEADER_BUTTON_CLASS =
	"absolute top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)]"

/**
 * 目录选择器只展示可见文件夹，避免隐藏节点在移动端搜索和移动目标里重新暴露。
 */
function getVisibleDirectories(items: AttachmentItem[]): AttachmentItem[] {
	return items.filter((item) => item.is_directory && !item.is_hidden)
}

/**
 * 搜索态需要恢复完整目录路径，因此这里从整棵树中回溯目标目录的祖先链。
 */
function findDirectoryPath(
	items: AttachmentItem[],
	targetId: string,
	ancestorPath: AttachmentItem[] = [],
): AttachmentItem[] | null {
	for (const item of getVisibleDirectories(items)) {
		const nextPath = [...ancestorPath, item]
		if (getItemId(item) === targetId) return nextPath

		if (item.children) {
			const matchedPath = findDirectoryPath(item.children, targetId, nextPath)
			if (matchedPath) return matchedPath
		}
	}

	return null
}

/**
 * 搜索结果遵循原型语义：只返回目录，并附带父路径文案帮助用户判断命中位置。
 */
function searchDirectories(
	items: AttachmentItem[],
	keyword: string,
	ancestorNames: string[] = [],
): DirectorySearchResult[] {
	const normalizedKeyword = keyword.trim().toLowerCase()
	if (!normalizedKeyword) return []

	const results: DirectorySearchResult[] = []
	for (const item of getVisibleDirectories(items)) {
		const directoryName = getItemName(item)
		if (directoryName.toLowerCase().includes(normalizedKeyword)) {
			results.push({
				directory: item,
				pathLabel: ancestorNames.join(" / "),
			})
		}

		if (item.children) {
			results.push(
				...searchDirectories(item.children, keyword, [...ancestorNames, directoryName]),
			)
		}
	}

	return results
}

/**
 * 行级箭头只在存在子目录时展示，避免对不可继续下钻的目标制造误导。
 */
function hasChildDirectories(item: AttachmentItem): boolean {
	return getVisibleDirectories(item.children || []).length > 0
}

/**
 * 渐隐遮罩复用原型的滚动反馈，让顶部导航和底部搜索在长列表下更容易分层阅读。
 */
function ScrollArea({ children }: { children: React.ReactNode }) {
	const scrollRef = useRef<HTMLDivElement>(null)
	const [showTopMask, setShowTopMask] = useState(false)
	const [showBottomMask, setShowBottomMask] = useState(false)

	/**
	 * 每次滚动后同步顶部和底部遮罩状态，保留原型里的可滚动提示。
	 */
	const updateMaskVisibility = useCallback(() => {
		const element = scrollRef.current
		if (!element) return

		setShowTopMask(element.scrollTop > 4)
		setShowBottomMask(element.scrollTop + element.clientHeight < element.scrollHeight - 4)
	}, [])

	useEffect(() => {
		const animationFrameId = requestAnimationFrame(updateMaskVisibility)
		return () => cancelAnimationFrame(animationFrameId)
	}, [children, updateMaskVisibility])

	return (
		<div
			className="relative min-h-0 flex-1 overflow-hidden"
			data-testid="select-directory-mobile-scroll-area"
		>
			<div
				ref={scrollRef}
				onScroll={updateMaskVisibility}
				className="no-scrollbar h-full overflow-y-auto"
			>
				{children}
			</div>
			<div
				className="pointer-events-none absolute inset-x-0 top-0 h-8 transition-opacity duration-150"
				style={{
					background:
						"linear-gradient(to bottom, rgb(var(--muted-rgb) / 1), rgb(var(--muted-rgb) / 0))",
					opacity: showTopMask ? 1 : 0,
				}}
			/>
			<div
				className="pointer-events-none absolute inset-x-0 bottom-0 h-10 transition-opacity duration-150"
				style={{
					background:
						"linear-gradient(to top, rgb(var(--muted-rgb) / 1), rgb(var(--muted-rgb) / 0))",
					opacity: showBottomMask ? 1 : 0,
				}}
			/>
		</div>
	)
}

/**
 * 面包屑只负责轻量导航，搜索态下隐藏，避免和搜索结果的信息层级冲突。
 */
function Breadcrumb({
	pathStack,
	onNavigateTo,
	backLabel,
	homeLabel,
}: {
	pathStack: AttachmentItem[]
	onNavigateTo: (index: number) => void
	backLabel: string
	homeLabel: string
}) {
	return (
		<div className="flex shrink-0 items-center gap-1 overflow-hidden px-[14px] py-1">
			<button
				type="button"
				disabled={pathStack.length === 0}
				onClick={() => onNavigateTo(pathStack.length - 2)}
				className="flex size-10 shrink-0 items-center justify-center rounded-full text-foreground active:bg-foreground/[0.06] disabled:opacity-30"
				data-testid="select-directory-mobile-back-button"
				aria-label={backLabel}
			>
				<ChevronLeft className="size-5" />
			</button>
			<div className="mx-1 h-4 w-px shrink-0 bg-border" />
			<button
				type="button"
				onClick={() => onNavigateTo(-1)}
				className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-foreground/[0.06]"
				data-testid="select-directory-mobile-home-button"
				aria-label={homeLabel}
			>
				<Home className="size-[18px]" />
			</button>
			{pathStack.map((item, index) => (
				<div key={getItemId(item)} className="flex min-w-0 items-center">
					<ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
					<button
						type="button"
						onClick={() => onNavigateTo(index)}
						className={cn(
							"min-w-0 truncate rounded-lg px-1.5 py-1 text-left text-[15px] leading-5",
							index === pathStack.length - 1
								? "font-medium text-foreground"
								: "text-muted-foreground active:bg-foreground/[0.05]",
						)}
						data-testid={`select-directory-mobile-breadcrumb-${getItemId(item)}`}
					>
						{getItemName(item)}
					</button>
				</div>
			))}
		</div>
	)
}

/**
 * 卡片容器统一目录行的圆角和阴影，避免根目录与普通目录在密度上分裂。
 */
function DirectoryCard({ children }: { children: React.ReactNode }) {
	return (
		<div
			className="overflow-hidden rounded-xl bg-card"
			style={{ boxShadow: "0px 2px 8px 0px rgba(0,0,0,0.04)" }}
		>
			{children}
		</div>
	)
}

/**
 * 根目录入口只在顶层显示，保留原型里“先选根，再确认”的选择语义。
 */
function RootRow({
	rootLabel,
	selected,
	onSelect,
}: {
	rootLabel: string
	selected: boolean
	onSelect: () => void
}) {
	return (
		<button
			type="button"
			onClick={onSelect}
			className="flex min-h-[56px] w-full items-center gap-3 px-[14px] py-3 text-left active:bg-foreground/[0.04]"
			data-testid="select-directory-mobile-root-select-button"
		>
			<div
				className={cn(
					"flex size-5 shrink-0 items-center justify-center rounded-full border-2",
					selected
						? "border-primary bg-primary text-primary-foreground"
						: "border-border bg-transparent",
				)}
			>
				{selected ? <div className="size-2 rounded-full bg-primary-foreground" /> : null}
			</div>
			<Home className="size-[22px] shrink-0 text-muted-foreground" />
			<span className="min-w-0 flex-1 truncate text-[16px] font-medium leading-5 text-foreground">
				{rootLabel}
			</span>
		</button>
	)
}

/**
 * 目录行保持“左选右钻”双操作区，避免用户点击整行后直接丢失当前浏览上下文。
 */
function DirectoryRow({
	directory,
	secondaryText,
	selected,
	disabled,
	onSelect,
	onDrillIn,
}: {
	directory: AttachmentItem
	secondaryText?: string
	selected: boolean
	disabled: boolean
	onSelect: () => void
	onDrillIn?: () => void
}) {
	const directoryId = getItemId(directory)

	return (
		<div className={cn("flex min-h-[56px] items-center", disabled && "opacity-50")}>
			<button
				type="button"
				onClick={onSelect}
				disabled={disabled}
				className="flex min-w-0 flex-1 items-center gap-3 px-[14px] py-3 text-left active:bg-foreground/[0.04] disabled:pointer-events-none"
				data-testid={`select-directory-mobile-folder-select-${directoryId}`}
			>
				<div
					className={cn(
						"flex size-5 shrink-0 items-center justify-center rounded-full border-2",
						selected
							? "border-primary bg-primary text-primary-foreground"
							: "border-border bg-transparent",
					)}
				>
					{selected ? (
						<div className="size-2 rounded-full bg-primary-foreground" />
					) : null}
				</div>
				<img
					src={FoldIcon}
					alt=""
					width={22}
					height={18}
					className="h-[18px] w-[22px] shrink-0 object-contain"
					aria-hidden
				/>
				<div className="min-w-0 flex-1">
					<p className="truncate text-[16px] font-medium leading-5 text-foreground">
						{getItemName(directory)}
					</p>
					{secondaryText ? (
						<p className="mt-0.5 truncate text-[13px] leading-4 text-muted-foreground">
							{secondaryText}
						</p>
					) : null}
				</div>
			</button>
			{onDrillIn ? (
				<>
					<div className="h-8 w-px shrink-0 bg-border" />
					<button
						type="button"
						onClick={onDrillIn}
						className="flex h-full min-h-[56px] w-12 shrink-0 items-center justify-center text-muted-foreground active:bg-foreground/[0.04]"
						data-testid={`select-directory-mobile-folder-drill-${directoryId}`}
						aria-label={getItemName(directory)}
					>
						<ChevronRight className="size-[18px]" />
					</button>
				</>
			) : null}
		</div>
	)
}

/**
 * 移动端专用 View 只承载浏览、搜索和选择目标目录的展示逻辑，不接入创建目录等桌面扩展能力。
 */
function MobileFilesMoveSheet({
	visible,
	title,
	attachments,
	defaultPath = [],
	disabledFolderIds = [],
	rootLabel,
	backLabel,
	homeLabel,
	closeLabel,
	confirmLabel,
	clearSearchAriaLabel,
	searchPlaceholder,
	searchEmptyDescription,
	emptyTip,
	onClose,
	onSubmit,
}: MobileFilesMoveSheetProps) {
	const [pathStack, setPathStack] = useState<AttachmentItem[]>(defaultPath)
	const [selectedPath, setSelectedPath] = useState<AttachmentItem[] | null>(null)
	const [query, setQuery] = useState("")

	useEffect(() => {
		if (!visible) return

		setPathStack(defaultPath)
		setSelectedPath(null)
		setQuery("")
	}, [defaultPath, visible])

	const isSearching = query.trim().length > 0
	const currentDirectories = useMemo(() => {
		return getVisibleDirectories(getDirectoriesFromPath(attachments, pathStack))
	}, [attachments, pathStack])
	const searchResults = useMemo(() => {
		if (!isSearching) return []
		return searchDirectories(attachments, query)
	}, [attachments, isSearching, query])
	const selectedDirectoryId = useMemo(() => {
		if (selectedPath === null) return null

		const selectedDirectory = selectedPath.at(-1)
		return selectedDirectory ? getItemId(selectedDirectory) : "root"
	}, [selectedPath])

	/**
	 * 面包屑导航只回退浏览路径，不自动替换已选目标，避免误提交到非预期目录。
	 */
	function handleNavigateTo(index: number) {
		if (index < 0) {
			setPathStack([])
			return
		}

		setPathStack((previousPath) => previousPath.slice(0, index + 1))
	}

	/**
	 * 根目录是合法目标，因此用空路径数组表达“已选择根目录”而不是回退为未选择态。
	 */
	function handleSelectRoot() {
		setSelectedPath([])
	}

	/**
	 * 搜索结果和当前层列表最终都要回落为完整路径，保证提交给旧链路的数据结构不变。
	 */
	function handleSelectDirectory(directory: AttachmentItem, shouldResolveFromTree = false) {
		const directoryId = getItemId(directory)
		if (disabledFolderIds.includes(directoryId)) return

		if (shouldResolveFromTree) {
			const matchedPath = findDirectoryPath(attachments, directoryId)
			if (matchedPath) {
				setSelectedPath(matchedPath)
			}
			return
		}

		setSelectedPath([...pathStack, directory])
	}

	/**
	 * 下钻操作只改变浏览上下文，不直接改变选中目标，保持和原型一致的双区域交互。
	 */
	function handleDrillIn(directory: AttachmentItem, shouldResolveFromTree = false) {
		const nextPath = shouldResolveFromTree
			? findDirectoryPath(attachments, getItemId(directory)) || [...pathStack, directory]
			: [...pathStack, directory]
		setPathStack(nextPath)
	}

	/**
	 * 搜索输入沿用原型行为：一旦进入搜索态就回到根层搜索整棵目录树。
	 */
	function handleSearchValueChange(nextValue: string) {
		setQuery(nextValue)
		if (nextValue.trim()) {
			setPathStack([])
		}
	}

	/**
	 * 确认动作继续向旧的 `onSubmit({ path })` 契约回传，避免改动原有移动文件链路。
	 */
	function handleConfirm() {
		if (selectedPath === null) return

		onSubmit({ path: selectedPath })
		onClose()
	}

	return (
		<Sheet open={visible} onOpenChange={(nextVisible) => !nextVisible && onClose()}>
			<SheetContent
				side="bottom"
				showClose={false}
				aria-describedby={undefined}
				className="flex h-[calc(100dvh-var(--safe-area-inset-top,0px))] max-h-[calc(100dvh-var(--safe-area-inset-top,0px))] min-h-[calc(100dvh-var(--safe-area-inset-top,0px))] flex-col overflow-hidden rounded-t-[14px] border-0 bg-muted p-0 !pb-0"
				data-testid="select-directory-mobile-sheet-root"
			>
				<div className="flex flex-col items-center py-1.5">
					<div className="h-1 w-20 rounded-full bg-muted-foreground/30" aria-hidden />
				</div>

				<div className="relative flex h-14 shrink-0 items-center justify-center px-16 py-2">
					<button
						type="button"
						onClick={onClose}
						className={cn(HEADER_BUTTON_CLASS, "left-[10px] bg-card text-foreground")}
						data-testid="select-directory-mobile-close-button"
						aria-label={closeLabel}
					>
						<X className="size-[22px]" />
					</button>

					<SheetTitle className="max-w-[247px] truncate text-center text-[18px] font-semibold leading-6 text-foreground">
						{title}
					</SheetTitle>

					<button
						type="button"
						onClick={handleConfirm}
						disabled={selectedPath === null}
						className={cn(
							HEADER_BUTTON_CLASS,
							"right-[10px] bg-primary text-primary-foreground active:opacity-80 disabled:opacity-40",
						)}
						data-testid="select-directory-mobile-confirm-button"
						aria-label={confirmLabel}
					>
						<Check className="size-[22px]" strokeWidth={2.5} />
					</button>
				</div>

				{!isSearching ? (
					<div className="shrink-0 px-[14px]">
						<Breadcrumb
							pathStack={pathStack}
							onNavigateTo={handleNavigateTo}
							backLabel={backLabel}
							homeLabel={homeLabel}
						/>
					</div>
				) : null}

				<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
					<ScrollArea>
						<div
							className="flex flex-col gap-2 px-[14px] py-2 pb-4"
							data-testid="select-directory-mobile-list"
						>
							{isSearching ? (
								searchResults.length === 0 ? (
									<div
										className="flex items-center justify-center px-6 py-12 text-center text-[14px] text-muted-foreground"
										data-testid="select-directory-mobile-search-empty"
									>
										<div className="flex items-center gap-2">
											<Search className="size-4 shrink-0" />
											<span>{searchEmptyDescription}</span>
										</div>
									</div>
								) : (
									searchResults.map(({ directory, pathLabel }) => {
										const directoryId = getItemId(directory)
										const isDisabled = disabledFolderIds.includes(directoryId)
										return (
											<DirectoryCard key={directoryId}>
												<DirectoryRow
													directory={directory}
													secondaryText={pathLabel || undefined}
													selected={selectedDirectoryId === directoryId}
													disabled={isDisabled}
													onSelect={() =>
														handleSelectDirectory(directory, true)
													}
													onDrillIn={
														hasChildDirectories(directory)
															? () => handleDrillIn(directory, true)
															: undefined
													}
												/>
											</DirectoryCard>
										)
									})
								)
							) : (
								<>
									{pathStack.length === 0 ? (
										<DirectoryCard>
											<RootRow
												rootLabel={rootLabel}
												selected={selectedDirectoryId === "root"}
												onSelect={handleSelectRoot}
											/>
										</DirectoryCard>
									) : null}
									{currentDirectories.length === 0 ? (
										<div
											className="px-6 py-12 text-center text-[14px] text-muted-foreground"
											data-testid="select-directory-mobile-empty"
										>
											{emptyTip}
										</div>
									) : (
										currentDirectories.map((directory) => {
											const directoryId = getItemId(directory)
											const isDisabled =
												disabledFolderIds.includes(directoryId)
											return (
												<DirectoryCard key={directoryId}>
													<DirectoryRow
														directory={directory}
														selected={
															selectedDirectoryId === directoryId
														}
														disabled={isDisabled}
														onSelect={() =>
															handleSelectDirectory(directory)
														}
														onDrillIn={
															hasChildDirectories(directory)
																? () => handleDrillIn(directory)
																: undefined
														}
													/>
												</DirectoryCard>
											)
										})
									)}
								</>
							)}
						</div>
					</ScrollArea>

					<div
						className="relative z-10 shrink-0 bg-muted"
						data-testid="select-directory-mobile-search-dock"
					>
						<MobileBottomSearchBar
							value={query}
							placeholder={searchPlaceholder}
							clearAriaLabel={clearSearchAriaLabel}
							onValueChange={handleSearchValueChange}
							testIdPrefix="select-directory-mobile-search"
						/>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	)
}

export default MobileFilesMoveSheet
