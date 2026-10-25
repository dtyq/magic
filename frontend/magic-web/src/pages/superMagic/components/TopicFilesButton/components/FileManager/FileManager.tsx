import { useEffect, useMemo, useRef, useDeferredValue, useState, lazy, Suspense } from "react"
import { FileManagerRecycleHeader } from "./FileManagerRecycleHeader"
import { cn } from "@/utils/cn"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { buildAttachmentIndex, resolveAttachmentId } from "../../utils/attachmentIndex"
import {
	getFilePresentationIndex,
	resolveFilePresentation,
	type FilePresentation,
} from "../../utils/file-presentation"
import { useTreeUI } from "../../hooks/useTreeUI"
import { useVisibleTreeRows } from "../../hooks/useVisibleTreeRows"
import {
	useFileManagerColumns,
	getFileManagerColumnText,
	getFileManagerColumnValue,
	getCompactNameColumnWidth,
} from "../../hooks/useFileManagerColumns"
import { useFileManagerNavigation } from "../../hooks/useFileManagerNavigation"
import { useFileManagerSelection } from "../../hooks/useFileManagerSelection"
import type { AttachmentItem } from "../../hooks/types"
import { FileManagerToolbar } from "./FileManagerToolbar"
import { FileManagerPlaces } from "./FileManagerPlaces"
import { FileManagerContent } from "./FileManagerContent"
import { FileManagerManagement, type FileManagerManagementState } from "./FileManagerManagement"
import type { FileManagerProps, FileManagerRevealRequest, FileManagerSort } from "./types"
import type { FileManagerLocationSnapshot } from "@/models/config/repositories/SuperProjectStateTypes"
import magicToast from "@/components/base/MagicToaster/utils"

const RecycleBinContent = lazy(() =>
	import("@/pages/recycleBin/components/RecycleBinContent").then((module) => ({
		default: module.RecycleBinContent,
	})),
)

const noExpandedKeys: React.Key[] = []

/** 完整管理器负责桌面交互；附件索引仍由原文件数据提供，不另建 store。 */
export function FileManager(props: FileManagerProps) {
	const { t, i18n } = useTranslation("super")
	const selecting = props.mode === "select" || props.mode === "destination"
	const destination = props.mode === "destination"
	const disabledFolderIds = props.mode === "destination" ? props.disabledFolderIds : undefined
	const initialState = useRef(props.initialState).current
	const requestedInitialDirectoryId =
		props.rootId === null
			? null
			: (props.initialDirectoryId ?? (initialState?.directoryId || props.rootId))
	const initialDirectoryId = disabledFolderIds?.has(requestedInitialDirectoryId ?? "")
		? props.rootId
		: requestedInitialDirectoryId
	const locating =
		props.initialDirectoryId !== undefined &&
		props.initialDirectoryId !== (initialState?.directoryId || props.rootId)
	const [recycle, setRecycle] = useState(
		!selecting &&
			!props.onOpenRecycle &&
			(props.areaRequest
				? props.areaRequest.area === "recycle"
				: !locating && initialState?.area === "recycle"),
	)
	const interacted = useRef(Boolean(props.areaRequest))
	const handledAreaRequest = useRef(props.isActive ? props.areaRequest?.requestId : undefined)
	useEffect(() => {
		const request = props.areaRequest
		if (
			selecting ||
			props.onOpenRecycle ||
			!props.isActive ||
			!request ||
			handledAreaRequest.current === request.requestId
		)
			return
		handledAreaRequest.current = request.requestId
		interacted.current = true
		// 只切换显示区域，文件目录、选择和滚动状态保留；附件加载失败也不阻止查看回收站。
		setRecycle(request.area === "recycle")
	}, [props.areaRequest, props.isActive, props.onOpenRecycle, selecting])
	const projectRecycle = props.context.kind === "project" && !props.spaceConfig?.scope
	const places = useRef(
		initialState?.places ?? { expandedIds: [], rootExpanded: true, scrollTop: 0 },
	)
	const [recycleCount, setRecycleCount] = useState(0)
	const activeProps = { ...props, isActive: props.isActive && !recycle }
	const container = useRef<HTMLDivElement>(null)
	const viewport = useRef<HTMLDivElement>(null)
	const compactNameWidth = useMemo(
		() =>
			selecting
				? getCompactNameColumnWidth(
						props.attachments
							.slice(0, 256)
							.map((item) =>
								String(
									item.display_filename ||
										item.file_name ||
										item.filename ||
										item.name ||
										"",
								),
							),
					)
				: undefined,
		[props.attachments, selecting],
	)
	const listColumns = useFileManagerColumns(initialState?.columns, {
		defaultNameWidth: compactNameWidth,
	})
	const getColumnText = useMemoizedFn((file: FilePresentation, column: FileManagerSort) =>
		getFileManagerColumnText(file, column, i18n.language, props.rootName),
	)
	const navigation = useFileManagerNavigation(
		initialDirectoryId,
		selecting ? "list" : props.defaultView,
		locating && initialState
			? {
					...initialState,
					query: "",
					selectedIds: [],
					focusedId: null,
					anchorId: null,
					scrollTop: 0,
					scrollLeft: 0,
				}
			: initialState,
	)
	const { location } = navigation
	const view = selecting ? "list" : navigation.view
	const index = useMemo(() => buildAttachmentIndex(props.attachments), [props.attachments])
	const handledReveal = useRef<number>()
	const [pendingReveal, setPendingReveal] = useState<FileManagerRevealRequest>()
	const setLocation = navigation.setLocation
	const reveal = useMemoizedFn(() => {
		const request = props.revealRequest
		if (
			!request ||
			handledReveal.current === request.requestId ||
			!props.isActive ||
			props.dataReady === false ||
			props.loading ||
			props.error ||
			props.rootId === null
		)
			return
		handledReveal.current = request.requestId
		if (!index.getItemById(request.fileId)) {
			magicToast.info(t("fileManager.locateUnavailable"))
			return
		}
		// 从清单定位进入父目录，避免目录折叠或旧搜索隐藏目标；勾选集合仍由调用方保留。
		const parent = index.getParentItemById(request.fileId)
		const parentId = (parent && resolveAttachmentId(parent)) ?? props.rootId
		setRecycle(false)
		navigation.navigate(parentId)
		setLocation((current) => ({ ...current, query: "" }))
		setPendingReveal(request)
	})
	useEffect(reveal, [
		props.revealRequest,
		props.isActive,
		props.dataReady,
		props.loading,
		props.error,
		props.rootId,
		index,
		reveal,
	])
	const presentationIndex = useMemo(
		() => getFilePresentationIndex(props.attachments),
		[props.attachments],
	)
	const directory =
		location.directoryId === null || location.directoryId === props.rootId
			? undefined
			: index.getItemById(location.directoryId)
	const query = useDeferredValue(
		location.query.trim().toLocaleLowerCase(i18n.language.replaceAll("_", "-")),
	)
	const missing =
		location.directoryId !== null &&
		props.dataReady !== false &&
		location.directoryId !== props.rootId &&
		!directory &&
		!props.loading
	const error = Boolean(props.error || missing || directory?.directoryLoadState === "error")
	const loading = Boolean(
		props.dataReady === false ||
		props.loading ||
		directory?.directoryLoadState === "loading" ||
		directory?.directoryLoadState === "unloaded",
	)
	const [expandedKeys, setExpandedKeys] = useState<React.Key[]>(initialState?.expandedIds ?? [])
	const [searchExpandedKeys, setSearchExpandedKeys] = useState<React.Key[]>([])
	const searchingProject = selecting && Boolean(query)
	const listTree = useTreeUI({
		enableCache: false,
		expandedKeys: searchingProject ? searchExpandedKeys : expandedKeys,
		onExpandedKeysChange: searchingProject ? setSearchExpandedKeys : setExpandedKeys,
	})
	const contentLoading =
		loading ||
		expandedKeys.some((id) => {
			const state = index.getItemById(String(id))?.directoryLoadState
			return state === "unloaded" || state === "loading"
		})
	const navigate = navigation.navigate
	useEffect(() => {
		// 已保存位置或外部初始路径也要遵守移动限制，不能绕过目录行的禁用状态。
		if (props.rootId !== null && disabledFolderIds?.has(location.directoryId ?? ""))
			navigate(props.rootId)
	}, [disabledFolderIds, location.directoryId, props.rootId, navigate])
	const expandedError = expandedKeys.some(
		(id) => index.getItemById(String(id))?.directoryLoadState === "error",
	)
	useEffect(() => {
		if (!missing || props.context.kind !== "project" || props.error || props.rootId === null)
			return
		const ancestor = [...(initialState?.ancestorIds ?? [])]
			.reverse()
			.find((id) => index.getItemById(id)?.is_directory)
		navigate(ancestor ?? props.rootId)
		magicToast.info(t("fileManager.restoredDirectoryUnavailable"))
	}, [missing, props.context.kind, props.error, initialState, index, navigate, props.rootId, t])
	const sorted = useMemo(() => {
		const collator = new Intl.Collator(i18n.language.replaceAll("_", "-"), {
			numeric: true,
			sensitivity: "base",
		})
		const children = new Map<string, AttachmentItem[]>()
		const sortChildren = (files: AttachmentItem[]) =>
			files
				.filter(
					(item) =>
						!item.is_hidden &&
						(!destination || item.is_directory) &&
						(selecting ? resolveAttachmentId(item) : item.file_id),
				)
				.map((item) => {
					const id = selecting ? resolveAttachmentId(item) : item.file_id
					if (item.is_directory)
						return { ...item, file_id: id, children: children.get(id ?? "") ?? [] }
					return item.file_id === id ? item : { ...item, file_id: id }
				})
				.sort((a, b) => {
					if (Boolean(a.is_directory) !== Boolean(b.is_directory))
						return a.is_directory ? -1 : 1
					const left = resolveFilePresentation(a, {
						context: props.context,
						index: presentationIndex,
					})
					const right = resolveFilePresentation(b, {
						context: props.context,
						index: presentationIndex,
					})
					const leftValue = getFileManagerColumnValue(left, navigation.sort)
					const rightValue = getFileManagerColumnValue(right, navigation.sort)
					if (leftValue === null && rightValue !== null) return 1
					if (rightValue === null && leftValue !== null) return -1
					const difference =
						leftValue === null || rightValue === null
							? 0
							: typeof leftValue === "number" && typeof rightValue === "number"
								? leftValue - rightValue
								: collator.compare(String(leftValue), String(rightValue))
					if (difference)
						return difference * (navigation.sortDirection === "ascending" ? 1 : -1)
					return (
						collator.compare(left.name, right.name) ||
						collator.compare(a.file_id ?? "", b.file_id ?? "")
					)
				})
		// 后代先排序，一次生成展示投影；展开和选择只计算可见行，不重新扫描全部附件。
		for (const key of [...index.allKeys].reverse()) {
			const file = index.getItemByKey(key)
			const id = file && (selecting ? resolveAttachmentId(file) : file.file_id)
			if (file?.is_directory && id) children.set(id, sortChildren(file.children ?? []))
		}
		return { roots: sortChildren(props.attachments), children }
	}, [
		index,
		props.attachments,
		props.context,
		presentationIndex,
		navigation.sort,
		navigation.sortDirection,
		i18n.language,
		selecting,
		destination,
	])
	const searchTree = useMemo(() => {
		if (!searchingProject) return null
		const included = new Set<string>()
		const expanded: string[] = []
		const children = new Map<string, AttachmentItem[]>()
		const locale = i18n.language.replaceAll("_", "-")
		// 后序传播命中节点到祖先，只投影必要目录；清空搜索后恢复原来的展开集合。
		for (const key of [...index.allKeys].reverse()) {
			const entry = index.getEntryByKey(key)
			if (!entry) continue
			const presentation = resolveFilePresentation(entry.item, {
				context: props.context,
				index: presentationIndex,
			})
			if (
				(!destination || entry.item.is_directory) &&
				(presentation.name.toLocaleLowerCase(locale).includes(query) ||
					(entry.item.relative_file_path ?? "").toLocaleLowerCase(locale).includes(query))
			)
				included.add(key)
			if (included.has(key) && entry.parentKey) included.add(entry.parentKey)
			const id = resolveAttachmentId(entry.item)
			if (entry.item.is_directory && id) {
				const matches = (sorted.children.get(id) ?? []).filter((item) =>
					included.has(item.file_id ?? ""),
				)
				children.set(
					id,
					matches.map((item) =>
						item.is_directory
							? { ...item, children: children.get(item.file_id ?? "") ?? [] }
							: item,
					),
				)
				if (matches.length) expanded.push(id)
			}
		}
		return {
			roots: sorted.roots
				.filter((item) => included.has(item.file_id ?? ""))
				.map((item) =>
					item.is_directory
						? { ...item, children: children.get(item.file_id ?? "") ?? [] }
						: item,
				),
			expanded,
		}
	}, [
		searchingProject,
		query,
		index,
		sorted,
		presentationIndex,
		props.context,
		i18n.language,
		destination,
	])
	useEffect(() => {
		setSearchExpandedKeys(searchTree?.expanded ?? [])
	}, [searchTree])
	const currentChildren = useMemo(() => {
		if (searchTree) return searchTree.roots
		const children =
			location.directoryId === null
				? []
				: location.directoryId === props.rootId
					? sorted.roots
					: (sorted.children.get(location.directoryId) ?? [])
		return query
			? children.filter((item) =>
					resolveFilePresentation(item, {
						context: props.context,
						index: presentationIndex,
					})
						.name.toLocaleLowerCase()
						.includes(query),
				)
			: children
	}, [
		location.directoryId,
		props.rootId,
		sorted,
		query,
		props.context,
		presentationIndex,
		searchTree,
	])
	const visible = useVisibleTreeRows({
		attachmentTree: currentChildren,
		expandedKeys:
			view === "list" && (!query || searchingProject)
				? listTree.expandedKeys
				: noExpandedKeys,
	})
	const items = useMemo(
		() =>
			visible.visibleNodes.flatMap(({ item }) =>
				item
					? [
							resolveFilePresentation(item, {
								context: props.context,
								index: presentationIndex,
							}),
						]
					: [],
			),
		[visible.visibleNodes, props.context, presentationIndex],
	)
	const rowDetails = useMemo(
		() =>
			new Map(
				visible.visibleNodes.map((node) => [
					node.item?.file_id ?? "",
					{
						level: node.level,
						expanded: visible.expandedKeySet.has(String(node.key)),
						expandable: !node.isLeaf,
					},
				]),
			),
		[visible.visibleNodes, visible.expandedKeySet],
	)
	const toggleListFolder = (file: AttachmentItem, all = false) => {
		if (disabledFolderIds?.has(file.file_id ?? "")) return
		if (!file.file_id || file.directoryLoadState === "loading") return
		const id = file.file_id
		const opening = !visible.expandedKeySet.has(id) || file.directoryLoadState === "error"
		const keys = all
			? [
					id,
					...index
						.getDescendantKeysById(id)
						.filter((key) => index.getItemByKey(key)?.is_directory),
				]
			: [id]
		listTree.setExpandedKeys((previous) =>
			opening
				? [...new Set([...previous, ...keys])]
				: previous.filter((key) => !keys.includes(String(key))),
		)
		if (file.directoryLoadState === "error")
			void props.spaceConfig?.directorySource?.loadDirectory(id).catch(() => undefined)
	}
	useEffect(() => {
		if (!props.spaceConfig?.directorySource) return
		for (const key of listTree.expandedKeys) {
			if (index.getItemById(String(key))?.directoryLoadState === "unloaded")
				void props.spaceConfig.directorySource
					.loadDirectory(String(key))
					.catch(() => undefined)
		}
	}, [index, listTree.expandedKeys, props.spaceConfig?.directorySource])
	const ids = useMemo(() => items.map(({ item }) => item.file_id ?? ""), [items])
	const selection = useFileManagerSelection({
		ids,
		location,
		setLocation: navigation.setLocation,
		ready: !contentLoading && !error && !expandedError,
		checked:
			props.mode === "select"
				? {
						ids: props.checkedIds,
						onChange: (addedIds, removedIds) =>
							props.onCheckChange({
								added: addedIds.flatMap((id) => {
									const item = index.getItemById(id)
									return item
										? [item.file_id ? item : { ...item, file_id: id }]
										: []
								}),
								removedIds,
							}),
					}
				: undefined,
	})
	const onOpen = useMemoizedFn((file: AttachmentItem) => {
		if (disabledFolderIds?.has(file.file_id ?? "")) return
		if (file.is_directory && file.file_id) navigation.navigate(file.file_id)
		else if (!selecting) props.onOpen(file)
	})
	const path = useMemo(
		() => [
			{ id: props.rootId, name: props.rootName },
			...(directory && location.directoryId !== null
				? [...index.getParentItemsById(location.directoryId), directory]
				: []
			)
				.filter(
					(file) =>
						resolveAttachmentId(file) && resolveAttachmentId(file) !== props.rootId,
				)
				.map((file) => ({
					id: resolveAttachmentId(file) ?? "",
					name: resolveFilePresentation(file, {
						context: props.context,
						index: presentationIndex,
					}).name,
				})),
		],
		[
			props.rootId,
			props.rootName,
			directory,
			index,
			location.directoryId,
			props.context,
			presentationIndex,
		],
	)

	const parentId = path.at(-2)?.id
	const getPopupContainer = () => container.current
	const onDirectoryChange = props.onDirectoryChange
	useEffect(() => {
		if (location.directoryId !== null && !disabledFolderIds?.has(location.directoryId))
			onDirectoryChange?.(location.directoryId)
	}, [location.directoryId, onDirectoryChange, disabledFolderIds])
	const emitState = useMemoizedFn((deferred = false) => {
		if (loading || error) return
		const snapshot: FileManagerLocationSnapshot = {
			directoryId:
				location.directoryId === props.rootId || location.directoryId === null
					? ""
					: location.directoryId,
			ancestorIds: path.slice(1, -1).flatMap(({ id }) => (id === null ? [] : [id])),
			view,
			sort: navigation.sort,
			sortDirection: navigation.sortDirection,
			area: recycle ? "recycle" : "files",
			query: location.query,
			selectedIds: [...location.selectedIds],
			focusedId: location.focusedId,
			anchorId: location.anchorId,
			...navigation.getScrollPosition(),
			expandedIds: listTree.expandedKeys.map(String),
			places: places.current,
			columns: { visibleIds: listColumns.visibleIds, widths: listColumns.widths },
		}
		props.onStateChange?.(snapshot, { deferred, userInteraction: interacted.current })
		interacted.current = false
	})
	useEffect(() => {
		emitState()
	}, [
		location,
		view,
		navigation.sort,
		navigation.sortDirection,
		recycle,
		expandedKeys,
		listColumns.visibleIds,
		listColumns.widths,
		loading,
		error,
		emitState,
	])
	const renderManager = (management?: FileManagerManagementState) => {
		const operations = management?.operations
		const commands = management?.commands
		const gestures = management?.gestures
		return (
			<div
				ref={container}
				data-file-manager={props.scopeKey}
				tabIndex={-1}
				onKeyDown={commands?.onClipboardKeyDown}
				onPointerDownCapture={() => {
					interacted.current = true
				}}
				onKeyDownCapture={() => {
					interacted.current = true
				}}
				onDragStart={gestures?.onDragStart}
				onDragEnd={gestures?.onDragEnd}
				onDragOver={gestures?.onDragOver}
				onDragLeave={gestures?.onDragLeave}
				onDrop={gestures?.onDrop}
				className="flex h-full min-h-0 flex-col bg-background text-foreground"
			>
				{recycle && (
					<FileManagerRecycleHeader
						projectName={projectRecycle ? props.rootName : undefined}
						onBack={() => setRecycle(false)}
					/>
				)}
				{recycle && props.isActive && (
					<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
						<p className="text-xs text-muted-foreground">
							{props.spaceConfig?.scope
								? t("fileManager.recycle.scope")
								: t("recycleBin.project.scope")}
						</p>
						<Suspense
							fallback={
								<p className="p-4 text-xs text-muted-foreground">
									{t("userSpace.loading")}
								</p>
							}
						>
							<RecycleBinContent
								onPreview={props.onPreviewFile}
								onPreviewRemoved={props.onPreviewRemoved}
								key={props.identityKey}
								projectId={
									props.spaceConfig?.scope
										? undefined
										: props.projectId || props.selectedProject?.id || ""
								}
								activeTab={{ id: "files", count: recycleCount }}
								requireDeleteConfirmation
								onMutationComplete={props.onRefresh}
								onTabCountChange={(id, count) => {
									if (id === "files") setRecycleCount(count)
								}}
							/>
						</Suspense>
					</div>
				)}
				<div className={cn("flex min-h-0 flex-1", recycle && "hidden")}>
					{!selecting &&
						!props.hidePlaces &&
						props.rootId !== null &&
						location.directoryId !== null && (
							<FileManagerPlaces
								initialState={initialState?.places}
								ready={!loading && !error && activeProps.isActive}
								onStateChange={(state, deferred) => {
									places.current = state
									emitState(deferred)
								}}
								rootId={props.rootId}
								rootName={props.rootName}
								directoryId={location.directoryId}
								attachments={sorted.roots}
								index={index}
								context={props.context}
								presentationIndex={presentationIndex}
								directorySource={props.spaceConfig?.directorySource}
								onOpen={props.onOpen}
								onNavigate={navigation.navigate}
								before={props.placesBefore}
								getPopupContainer={getPopupContainer}
							/>
						)}
					<div className="flex min-h-0 min-w-0 flex-1 flex-col">
						<FileManagerToolbar
							projectRecycle={projectRecycle}
							toolbarLeading={props.toolbarLeading}
							compact={selecting}
							management={
								operations && commands
									? {
											onOpenRecycle:
												props.onOpenRecycle ?? (() => setRecycle(true)),
											actions: commands,
											createMenu: {
												onAddFile: operations.createFile,
												onAddFolder: operations.createFolder,
												onAddDesign: operations.onAddDesign,
												onAddSelfMedia: operations.onAddSelfMedia,
												onAddAICard: operations.onAddAICard,
											},
											uploadMenu: {
												onUploadFile: operations.uploadFile,
												onUploadFolder: operations.onUploadFolder,
												onImportFromOtherProject:
													operations.onImportFromOtherProject,
											},
										}
									: undefined
							}
							path={path}
							canBack={navigation.canBack}
							canForward={navigation.canForward}
							canUp={parentId != null}
							back={navigation.back}
							forward={navigation.forward}
							up={() => parentId != null && navigation.navigate(parentId)}
							onNavigate={navigation.navigate}
							query={location.query}
							onQuery={(value) =>
								navigation.setLocation((current) => ({ ...current, query: value }))
							}
							view={view}
							onView={navigation.setView}
							sort={navigation.sort}
							sortOptions={listColumns.labels}
							sortDirection={navigation.sortDirection}
							onSort={navigation.setSort}
							onRefresh={props.onRefresh}
							loading={contentLoading}
							getPopupContainer={getPopupContainer}
						/>
						<FileManagerContent
							mode={props.mode ?? "manage"}
							disabledFolderIds={disabledFolderIds}
							listColumns={listColumns}
							sort={navigation.sort}
							sortDirection={navigation.sortDirection}
							onSort={navigation.setSort}
							getColumnText={getColumnText}
							management={management}
							rowDetails={rowDetails}
							onToggleFolder={toggleListFolder}
							viewport={viewport}
							directoryId={location.directoryId}
							items={items}
							view={view}
							selection={selection}
							revealRequest={pendingReveal}
							initialScrollTop={location.scrollTop}
							initialScrollLeft={location.scrollLeft}
							restoreReady={!expandedError}
							onScroll={(top, left) => {
								navigation.onScroll(top, left)
								emitState(true)
							}}
							onOpen={onOpen}
							onBack={navigation.back}
							onForward={navigation.forward}
							onUp={() => parentId != null && navigation.navigate(parentId)}
							isActive={activeProps.isActive && !operations?.busy}
							loading={contentLoading}
							error={error}
							onRefresh={props.onRefresh}
							query={query}
							renderTag={props.renderTag}
							getPopupContainer={getPopupContainer}
						/>
						<div
							role="status"
							aria-live="polite"
							className="flex min-h-8 shrink-0 items-center justify-between gap-3 border-t border-border/60 bg-muted/20 px-3 py-1.5 text-[11px] text-muted-foreground"
						>
							<span>
								{selection.selectedIds.size
									? t("userSpace.selectedCount", {
											count: selection.selectedIds.size,
										})
									: t("fileManager.itemCount", { count: items.length })}
							</span>
							<span>
								{management?.status ??
									(destination
										? t("selectPathModal.selectStorageLocation")
										: t("fileManager.checkSelectionHint"))}
							</span>
						</div>
					</div>
				</div>
			</div>
		)
	}
	return selecting ? (
		renderManager()
	) : (
		<FileManagerManagement
			manager={activeProps}
			index={index}
			presentationIndex={presentationIndex}
			directory={directory}
			directoryId={location.directoryId}
			selection={selection}
			ids={ids}
			container={container}
			viewport={viewport}
			onOpen={onOpen}
			onNavigate={navigation.navigate}
			ready={!loading && !error}
		>
			{renderManager}
		</FileManagerManagement>
	)
}
