import { useEffect, useMemo, useRef, useState, type ReactNode, type KeyboardEvent } from "react"
import { useMemoizedFn } from "ahooks"
import { ChevronRight, FolderTree, Loader2, RotateCw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import SmartTooltip from "@/components/other/SmartTooltip"
import { FileResourceIcon } from "../FileResourceIcon"
import CustomTree from "../CustomTree/CustomTree"
import { useTreeUI } from "../../hooks/useTreeUI"
import { useVisibleTreeRows } from "../../hooks/useVisibleTreeRows"
import {
	resolveFilePresentation,
	type getFilePresentationIndex,
} from "../../utils/file-presentation"
import type { FileManagerProps } from "./types"
import type { AttachmentIndex } from "../../utils/attachmentIndex"
import type { AttachmentItem } from "../../hooks/types"
import type { FileManagerLocationSnapshot } from "@/models/config/repositories/SuperProjectStateTypes"

export function FileManagerPlaces({
	rootId,
	rootName,
	directoryId,
	attachments,
	index,
	context,
	presentationIndex,
	onNavigate,
	onOpen,
	directorySource,
	before,
	getPopupContainer,
	initialState,
	onStateChange,
	ready,
}: {
	rootId: string
	rootName: string
	directoryId: string
	attachments: AttachmentItem[]
	index: AttachmentIndex
	context: FileManagerProps["context"]
	presentationIndex: ReturnType<typeof getFilePresentationIndex>
	directorySource: NonNullable<FileManagerProps["spaceConfig"]>["directorySource"]
	onNavigate: (id: string) => void
	onOpen: (file: AttachmentItem) => void
	before?: ReactNode
	getPopupContainer: () => HTMLElement | null
	initialState?: FileManagerLocationSnapshot["places"]
	onStateChange: (state: FileManagerLocationSnapshot["places"], deferred: boolean) => void
	ready: boolean
}) {
	const { t } = useTranslation("super")
	const viewport = useRef<HTMLDivElement>(null)
	const [rootExpanded, setRootExpanded] = useState(initialState?.rootExpanded ?? true)
	const [keys, setKeys] = useState<React.Key[]>(initialState?.expandedIds ?? [])
	const { expandedKeys, setExpandedKeys } = useTreeUI({
		enableCache: false,
		expandedKeys: keys,
		onExpandedKeysChange: setKeys,
	})
	const scrollTop = useRef(initialState?.scrollTop ?? 0)
	const restored = useRef(false)
	const expandedPending = expandedKeys.some((id) => {
		const state = index.getItemById(String(id))?.directoryLoadState
		return state === "unloaded" || state === "loading" || state === "error"
	})
	const emitState = useMemoizedFn((deferred = false) => {
		if (ready)
			onStateChange(
				{
					rootExpanded,
					expandedIds: expandedKeys.map(String),
					scrollTop: scrollTop.current,
				},
				deferred,
			)
	})
	const restoreScroll = useMemoizedFn(() => {
		if (restored.current || !ready || expandedPending || !viewport.current?.clientHeight) return
		viewport.current.scrollTop = scrollTop.current
		restored.current = true
	})
	useEffect(() => {
		restoreScroll()
		emitState()
	}, [ready, keys, rootExpanded, expandedPending, restoreScroll, emitState])
	const tree = useVisibleTreeRows({ attachmentTree: attachments, expandedKeys })
	const [focusId, setFocusId] = useState<string | null>(null)
	const pendingFocus = useRef<string | null>(null)
	const previousDirectory = useRef<string | undefined>(initialState ? directoryId : undefined)
	const revealDirectory = useMemoizedFn(() => {
		if (previousDirectory.current === directoryId) return
		if (directoryId !== rootId && !index.getItemById(directoryId)) return
		previousDirectory.current = directoryId
		setRootExpanded(true)
		setExpandedKeys((previous) => [
			...new Set([
				...previous,
				...index
					.getParentItemsById(directoryId)
					.flatMap((item) => (item.file_id ? [item.file_id] : [])),
			]),
		])
	})
	useEffect(revealDirectory, [directoryId, index, revealDirectory])
	useEffect(() => {
		if (!directorySource) return
		for (const key of expandedKeys) {
			const file = index.getItemById(String(key))
			if (file?.directoryLoadState === "unloaded")
				void directorySource.loadDirectory(String(key)).catch(() => undefined)
		}
	}, [directorySource, expandedKeys, index])
	const toggle = (file: AttachmentItem, all = false) => {
		const id = file.file_id
		if (!id || file.directoryLoadState === "loading") return
		const opening = !tree.expandedKeySet.has(id) || file.directoryLoadState === "error"
		const ids = all
			? [
					id,
					...index
						.getDescendantKeysById(id)
						.filter((key) => index.getItemByKey(key)?.is_directory),
				]
			: [id]
		setExpandedKeys((previous) =>
			opening
				? [...new Set([...previous, ...ids])]
				: previous.filter((key) => !ids.includes(String(key))),
		)
		if (file.directoryLoadState === "error")
			void directorySource?.loadDirectory(id).catch(() => undefined)
	}
	const focusPendingRow = useMemoizedFn(() => {
		const key = pendingFocus.current
		if (!key) return
		const element = Array.from(
			viewport.current?.querySelectorAll<HTMLElement>("[data-place-key]") ?? [],
		).find((node) => node.dataset.placeKey === key)
		if (element) {
			element.focus({ preventScroll: true })
			pendingFocus.current = null
		}
	})
	const focusRow = (id: string) => {
		pendingFocus.current = id
		setFocusId(id)
		focusPendingRow()
	}
	const onKeyDown = (event: KeyboardEvent, file: AttachmentItem) => {
		const id = file.file_id
		if (
			!id ||
			!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
		)
			return
		event.preventDefault()
		const position = tree.visibleNodeIndexByKey.get(id) ?? 0
		if (event.key === "ArrowRight" && file.is_directory && !tree.expandedKeySet.has(id)) {
			toggle(file, event.altKey)
			return
		}
		if (event.key === "ArrowLeft") {
			if (tree.expandedKeySet.has(id)) toggle(file, event.altKey)
			else {
				const parent = index.getParentItemById(id)?.file_id
				if (parent) focusRow(parent)
			}
			return
		}
		const next =
			event.key === "Home"
				? 0
				: event.key === "End"
					? tree.visibleNodes.length - 1
					: position + (event.key === "ArrowUp" ? -1 : 1)
		const key =
			tree.visibleNodes[Math.max(0, Math.min(next, tree.visibleNodes.length - 1))]?.key
		if (key) focusRow(String(key))
	}
	const emptyRows = useMemo(
		() => ({
			visibleRows: [],
			visibleNodes: [],
			visibleNodeIndexByKey: new Map<string, number>(),
		}),
		[],
	)
	return (
		<aside
			aria-label={t("fileManager.places")}
			className="flex min-h-0 w-[204px] shrink-0 flex-col border-r border-border/60 bg-muted/40 px-2 py-3 max-md:w-44"
		>
			{before}
			<p className="px-2 pb-2 text-[11px] font-medium text-muted-foreground">
				{t("fileManager.places")}
			</p>
			<div
				data-manager-target={rootId}
				className={cn(
					"mb-1 flex h-8 items-center rounded-md text-xs data-[manager-drop-target=true]:bg-blue-500/10 data-[manager-drop-target=true]:ring-1 data-[manager-drop-target=true]:ring-inset data-[manager-drop-target=true]:ring-blue-500",
					directoryId === rootId && "bg-accent text-accent-foreground",
				)}
			>
				<button
					className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded focus-visible:ring-2 focus-visible:ring-ring"
					aria-expanded={rootExpanded}
					aria-label={t(rootExpanded ? "fileTree.collapseAll" : "fileTree.expandAll")}
					onClick={() => setRootExpanded(!rootExpanded)}
				>
					<ChevronRight
						size={12}
						className={cn(
							"transition-transform duration-150 motion-reduce:transition-none",
							rootExpanded && "rotate-90",
						)}
					/>
				</button>
				<button
					className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2 rounded pr-2 text-left focus-visible:ring-2 focus-visible:ring-ring"
					onClick={() => onNavigate(rootId)}
					aria-current={directoryId === rootId ? "page" : undefined}
				>
					<FolderTree size={15} className="shrink-0" />
					<SmartTooltip
						fileName
						elementType="span"
						className="min-w-0 text-xs leading-4"
						placement="bottom"
						sideOffset={4}
						getPopupContainer={getPopupContainer}
					>
						{rootName}
					</SmartTooltip>
				</button>
			</div>
			<div
				ref={viewport}
				onWheelCapture={() => {
					restored.current = true
				}}
				onScroll={(event) => {
					if (restored.current && ready) {
						scrollTop.current = event.currentTarget.scrollTop
						emitState(true)
					}
				}}
				className="min-h-0 flex-1 overflow-y-auto"
				role="tree"
				aria-label={t("fileManager.places")}
			>
				<CustomTree
					{...(rootExpanded ? tree : emptyRows)}
					expandedKeys={expandedKeys}
					selectedKeys={[directoryId]}
					scrollElementRef={viewport}
					scrollToKey={focusId}
					onMountedRowsChange={() => {
						restoreScroll()
						focusPendingRow()
					}}
					titleRender={({ item, level, isLeaf }) => {
						if (!item?.file_id) return null
						const id = item.file_id
						const presentation = resolveFilePresentation(item, {
							context,
							index: presentationIndex,
						})
						const expanded = tree.expandedKeySet.has(id)
						const failed = item.directoryLoadState === "error"
						return (
							<div
								role="treeitem"
								aria-level={level + 1}
								aria-expanded={item.is_directory ? expanded : undefined}
								data-manager-target={item.is_directory ? id : undefined}
								className={cn(
									"flex h-[30px] min-w-0 items-center rounded-md text-xs hover:bg-accent/50 data-[manager-drop-target=true]:bg-blue-500/10 data-[manager-drop-target=true]:ring-1 data-[manager-drop-target=true]:ring-inset data-[manager-drop-target=true]:ring-blue-500",
									directoryId === id && "bg-accent text-accent-foreground",
								)}
								style={{ paddingLeft: level * 14 }}
							>
								<button
									className={cn(
										"flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed",
										isLeaf && "invisible",
									)}
									disabled={isLeaf || item.directoryLoadState === "loading"}
									tabIndex={-1}
									aria-label={t(
										failed
											? "userSpace.retry"
											: expanded
												? "fileTree.collapseAll"
												: "fileTree.expandAll",
									)}
									onClick={(event) => {
										event.stopPropagation()
										toggle(item, event.altKey)
									}}
								>
									{item.directoryLoadState === "loading" ? (
										<Loader2 size={12} className="animate-spin" />
									) : failed ? (
										<RotateCw size={12} className="text-destructive" />
									) : (
										<ChevronRight
											size={12}
											className={cn(
												"transition-transform duration-150 motion-reduce:transition-none",
												expanded && "rotate-90",
											)}
										/>
									)}
								</button>
								<button
									data-place-key={id}
									className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded pr-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
									onClick={() =>
										item.is_directory ? onNavigate(id) : onOpen(item)
									}
									onKeyDown={(event) => onKeyDown(event, item)}
									aria-current={directoryId === id ? "page" : undefined}
								>
									{/* 图标类型不一（img / svg / 远程图），统一包一层 shrink-0，防止长文件名挤压 flex 行时图标被压缩变形。 */}
									<span className="inline-flex shrink-0 items-center justify-center">
										<FileResourceIcon presentation={presentation} size={15} />
									</span>
									<SmartTooltip
										fileName
										elementType="span"
										className="min-w-0 text-xs leading-4"
										placement="bottom"
										sideOffset={4}
										getPopupContainer={getPopupContainer}
									>
										{presentation.name}
									</SmartTooltip>
								</button>
							</div>
						)
					}}
				/>
			</div>
		</aside>
	)
}
