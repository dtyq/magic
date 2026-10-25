import {
	memo,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	type FocusEvent,
	type KeyboardEvent,
	type MouseEvent,
	type ReactNode,
	type MutableRefObject,
} from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import SmartTooltip from "@/components/other/SmartTooltip"
import MagicTooltip from "@/components/base/MagicTooltip"
import MagicDropdown from "@/components/base/MagicDropdown"
import { MoreHorizontal, ChevronRight, Loader2, RotateCw } from "lucide-react"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { Button } from "@/components/shadcn-ui/button"
import type { InputRef } from "antd"
import type { TopicFilesMenuItem } from "../../utils/menu-items"
import { FileResourceIcon } from "../FileResourceIcon"
import { ProjectFileTag } from "../TopicFileTag"
import type { FilePresentation } from "../../utils/file-presentation"
import type { FileManagerView, FileManagerTreeRow, FileManagerSort } from "./types"
import type { useRename } from "../../hooks/useRename"
import InputWithError from "../InputWithError"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"

interface Props {
	columns: FileManagerSort[]
	getColumnText: (file: FilePresentation, column: FileManagerSort) => string
	rename?: ReturnType<typeof useRename>
	showActions: boolean
	row?: FileManagerTreeRow
	striped?: boolean
	onToggleFolder: (all?: boolean) => void
	id: string
	presentation: FilePresentation
	view: FileManagerView
	selected: boolean
	focused: boolean
	cut?: boolean
	menuItems?: TopicFilesMenuItem[]
	onCheck?: () => void
	readOnly?: boolean
	disabled?: boolean
	tag?: ReactNode
	onSelect: (event: MouseEvent<HTMLElement>) => void
	onOpen: () => void
	getPopupContainer: () => HTMLElement | null
}

export const FileManagerItem = memo(function FileManagerItem({
	columns,
	getColumnText,
	rename,
	showActions,
	row,
	striped,
	onToggleFolder,
	id,
	presentation,
	view,
	selected,
	focused,
	cut,
	menuItems,
	onCheck,
	readOnly = false,
	disabled = false,
	tag,
	onSelect,
	onOpen,
	getPopupContainer,
}: Props) {
	const { t } = useTranslation("super")
	const grid = view === "grid"
	const { item, name, isDirectory } = presentation
	const fileTag = tag ?? <ProjectFileTag item={item} presentation={presentation} />
	const rowElement = (
		<div
			id={id}
			role="option"
			aria-selected={selected}
			aria-disabled={disabled || undefined}
			aria-label={name}
			draggable={!readOnly && !onCheck && !rename}
			data-manager-item={item.file_id}
			data-manager-target={isDirectory ? item.file_id : undefined}
			onClick={(event) => {
				if (
					!disabled &&
					event.target instanceof Node &&
					event.currentTarget.contains(event.target)
				)
					onSelect(event)
			}}
			onDoubleClick={(event) => {
				if (
					!disabled &&
					event.target instanceof Node &&
					event.currentTarget.contains(event.target)
				)
					onOpen()
			}}
			style={!grid ? { gridTemplateColumns: "var(--manager-columns)" } : undefined}
			className={cn(
				"group relative h-full w-full min-w-0 cursor-pointer select-none rounded-md text-xs outline-none transition-colors duration-150 motion-reduce:transition-none",
				grid ? "flex flex-col items-center gap-1 px-1 py-2" : "grid items-center px-3",
				!grid &&
					(selected
						? onCheck
							? "bg-primary/5"
							: "bg-blue-500 text-white"
						: striped
							? "bg-muted/35 hover:bg-muted/60"
							: "hover:bg-muted/40"),
				!grid && focused && !selected && "bg-muted/60",
				cut && "opacity-45",
				disabled && "cursor-not-allowed opacity-40",
				"data-[manager-drop-target=true]:bg-blue-500/10 data-[manager-drop-target=true]:ring-1 data-[manager-drop-target=true]:ring-inset data-[manager-drop-target=true]:ring-blue-500",
			)}
		>
			<div
				className={cn(
					"flex min-w-0",
					grid ? "w-full flex-col items-center gap-1.5" : "items-center gap-1.5 px-2",
				)}
				style={!grid ? { paddingLeft: (row?.level ?? 0) * 16 } : undefined}
			>
				{!grid && (
					<button
						tabIndex={-1}
						className={cn(
							"flex size-4 shrink-0 cursor-pointer items-center justify-center rounded disabled:cursor-not-allowed",
							!row?.expandable && "invisible",
						)}
						disabled={
							disabled || !row?.expandable || item.directoryLoadState === "loading"
						}
						aria-expanded={row?.expanded}
						aria-label={t(
							item.directoryLoadState === "error"
								? "userSpace.retry"
								: row?.expanded
									? "fileTree.collapseAll"
									: "fileTree.expandAll",
						)}
						onDoubleClick={(event) => event.stopPropagation()}
						onClick={(event) => {
							event.stopPropagation()
							onToggleFolder(event.altKey)
						}}
					>
						{item.directoryLoadState === "loading" ? (
							<Loader2 size={12} className="animate-spin" />
						) : item.directoryLoadState === "error" ? (
							<RotateCw size={12} />
						) : (
							<ChevronRight
								size={12}
								className={cn(
									"transition-transform duration-150 motion-reduce:transition-none",
									row?.expanded && "rotate-90",
								)}
							/>
						)}
					</button>
				)}
				{onCheck && (
					<Checkbox
						checked={selected}
						onCheckedChange={onCheck}
						aria-label={t("fileManager.checkItem", { name })}
						className="size-4 shrink-0"
						onClick={(event) => event.stopPropagation()}
						onDoubleClick={(event) => event.stopPropagation()}
						onPointerDown={(event) => event.stopPropagation()}
					/>
				)}
				<span
					className={cn(
						"pointer-events-none flex shrink-0 items-center justify-center rounded-md",
						grid && "h-16 w-[72px] rounded-[9px] group-hover:bg-muted/60",
						grid && selected && !onCheck && "bg-muted/80",
						grid && focused && "bg-muted/80",
					)}
				>
					<FileResourceIcon
						presentation={presentation}
						size={grid ? 44 : 16}
						className={
							grid && !isDirectory
								? "drop-shadow-[0_1px_2px_rgba(0,0,0,0.18)]"
								: undefined
						}
					/>
				</span>
				{rename ? (
					<FileManagerNameInput
						rename={rename}
						grid={grid}
						isDirectory={isDirectory}
						getPopupContainer={getPopupContainer}
					/>
				) : (
					<SmartTooltip
						fileName
						elementType="span"
						placement="bottom"
						sideOffset={4}
						maxLines={grid ? 2 : 1}
						getPopupContainer={getPopupContainer}
						className={cn(
							"min-w-0 max-w-full",
							grid
								? "line-clamp-2 rounded-[5px] px-1 py-px text-center text-[13px] font-medium leading-[17px] tracking-normal [overflow-wrap:anywhere]"
								: "truncate text-xs leading-4",
							grid &&
								selected &&
								!onCheck &&
								"bg-blue-600 text-white dark:bg-blue-500",
							focused && !selected && "underline underline-offset-4",
						)}
					>
						{name}
					</SmartTooltip>
				)}
				{!grid && <span className="ml-auto shrink-0">{fileTag}</span>}
			</div>
			{grid
				? fileTag && (
						<span className="flex max-w-full justify-center text-muted-foreground">
							{fileTag}
						</span>
					)
				: columns
						.filter((column) => column !== "name")
						.map((column) => {
							const value = getColumnText(presentation, column)
							return (
								<MagicTooltip
									key={column}
									title={value}
									getPopupContainer={getPopupContainer}
								>
									<span
										className={cn(
											"truncate px-2 text-[11px]",
											column === "size" && "text-right tabular-nums",
											selected && !onCheck
												? "text-white/85"
												: "text-muted-foreground",
										)}
									>
										{value}
									</span>
								</MagicTooltip>
							)
						})}

			{!onCheck && showActions && (
				<MagicDropdown
					overlayClassName="[&_[role=menuitem]]:cursor-pointer [&_[data-disabled]]:cursor-not-allowed"
					trigger={["click"]}
					menu={{ items: menuItems }}
					getPopupContainer={() => getPopupContainer() ?? document.body}
				>
					<Button
						size="icon"
						variant="ghost"
						className="absolute right-1 top-1 size-6 cursor-pointer"
						aria-label={t("userSpace.actions", { name })}
						onClick={(event) => {
							event.stopPropagation()
							if (!selected) onSelect(event)
						}}
					>
						<MoreHorizontal size={16} />
					</Button>
				</MagicDropdown>
			)}
		</div>
	)
	return readOnly || onCheck ? (
		rowElement
	) : (
		<MagicDropdown
			overlayClassName="[&_[role=menuitem]]:cursor-pointer [&_[data-disabled]]:cursor-not-allowed"
			trigger={["contextMenu"]}
			rootClassName="h-full min-w-0"
			menu={{ items: menuItems }}
			getPopupContainer={() => getPopupContainer() ?? document.body}
		>
			{rowElement}
		</MagicDropdown>
	)
})

/** Match grid filename typography: 13px / 17px leading, at most two lines. */
const GRID_NAME_LINE_HEIGHT = 17
const GRID_NAME_MAX_LINES = 2
const GRID_RENAME_PADDING_Y = 1
/** 1px border on each side. Tailwind preflight uses border-box, so height must include it. */
const GRID_RENAME_BORDER_Y = 1
const GRID_RENAME_MIN_HEIGHT =
	GRID_NAME_LINE_HEIGHT + GRID_RENAME_PADDING_Y * 2 + GRID_RENAME_BORDER_Y * 2
const GRID_RENAME_MAX_HEIGHT =
	GRID_NAME_LINE_HEIGHT * GRID_NAME_MAX_LINES +
	GRID_RENAME_PADDING_Y * 2 +
	GRID_RENAME_BORDER_Y * 2

/**
 * Grow with wrapped text from one line up to the filename's two-line cap.
 * scrollHeight includes padding but not border; add borders so two 17px lines actually fit.
 */
function clampGridRenameHeight(scrollHeight: number) {
	return Math.min(
		GRID_RENAME_MAX_HEIGHT,
		Math.max(GRID_RENAME_MIN_HEIGHT, scrollHeight + GRID_RENAME_BORDER_Y * 2),
	)
}

/** Deferred cancel timers keyed by the shared rename input ref. */
const pendingRenameCancelTimers = new WeakMap<object, number>()

/** Expose a textarea as the InputRef useRename already knows how to focus and select. */
function bindRenameTextArea(
	renameInputRef: MutableRefObject<InputRef | null>,
	node: HTMLTextAreaElement | null,
) {
	if (!node) {
		renameInputRef.current = null
		return
	}
	renameInputRef.current = {
		input: node as unknown as HTMLInputElement,
		nativeElement: node,
		focus: (options) => node.focus(options),
		blur: () => node.blur(),
		setSelectionRange: (start, end, direction) => node.setSelectionRange(start, end, direction),
		select: () => node.select(),
	}
}

/** Inline filename editor. Blur-cancel is armed only after the input has actually focused. */
function FileManagerNameInput({
	rename,
	grid,
	isDirectory,
	getPopupContainer,
}: {
	rename: ReturnType<typeof useRename>
	grid: boolean
	isDirectory: boolean
	getPopupContainer: () => HTMLElement | null
}) {
	const { t } = useTranslation("super")
	// Ignore the blur Radix fires while restoring trigger focus after the menu closes.
	const hasFocused = useRef(false)
	const [gridHeight, setGridHeight] = useState(GRID_RENAME_MIN_HEIGHT)
	/** Exit rename without saving, unless a confirm request is already in flight. */
	const cancel = useMemoizedFn(() => {
		if (!rename.isRenamePending()) rename.handleRenameCancel()
	})
	/** Cancel on real blur; skip menu-close focus restore onto the row trigger. */
	const handleBlur = useMemoizedFn(
		(event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
			if (!hasFocused.current) return
			const next = event.relatedTarget
			if (next instanceof Node) {
				const renameRoot = event.currentTarget.closest("[data-manager-rename]")
				const trigger =
					event.currentTarget.closest("[data-radix-context-menu-trigger]") ??
					event.currentTarget.closest("[data-manager-item]")?.parentElement
				// Radix restores focus to the ContextMenu trigger wrapping this row, not into the input.
				if (renameRoot?.contains(next) || trigger?.contains(next)) {
					rename.renameInputRef.current?.focus()
					return
				}
			}
			cancel()
		},
	)
	useEffect(() => {
		const key = rename.renameInputRef
		const pending = pendingRenameCancelTimers.get(key)
		if (pending) window.clearTimeout(pending)
		return () => {
			// 虚拟行真正离开 DOM 时丢弃草稿；StrictMode 重跑 effect 时先清掉延后的 cancel。
			if (rename.renameInputRef.current?.input?.isConnected) return
			const timer = window.setTimeout(() => {
				pendingRenameCancelTimers.delete(key)
				if (!rename.renameInputRef.current?.input?.isConnected) cancel()
			}, 0)
			pendingRenameCancelTimers.set(key, timer)
		}
	}, [cancel, rename.renameInputRef])
	useLayoutEffect(() => {
		if (!grid) return
		const node = rename.renameInputRef.current?.input
		if (!node) return
		// Collapse to one line first so scrollHeight reflects the wrapped content, not the previous box.
		node.style.height = `${GRID_RENAME_MIN_HEIGHT}px`
		setGridHeight(clampGridRenameHeight(node.scrollHeight))
	}, [grid, rename.renameValue, rename.renameInputRef])
	const error = rename.renameValue.trim()
		? rename.renameErrorMessage
		: t(
				isDirectory
					? "filenameValidator.error.folderEmpty"
					: "filenameValidator.error.fileEmpty",
			)
	/** Esc cancels; Enter confirms and must not insert a newline in the grid textarea. */
	const onRenameKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
		event.stopPropagation()
		if (event.nativeEvent.isComposing || event.repeat || rename.isRenamePending()) return
		if (event.key === "Escape") {
			event.preventDefault()
			cancel()
		}
		if (
			event.key === "Enter" &&
			!event.metaKey &&
			!event.ctrlKey &&
			!event.altKey &&
			!event.shiftKey
		) {
			event.preventDefault()
			if (rename.renameValue.trim()) void rename.handleRenameConfirm()
		}
	}
	const renameField = grid ? (
		<textarea
			ref={(node) => bindRenameTextArea(rename.renameInputRef, node)}
			data-testid="file-manager-rename-input"
			value={rename.renameValue}
			aria-label={t("userSpace.rename")}
			readOnly={rename.renamePending}
			rows={1}
			className="box-border w-full min-w-0 max-w-full rounded-[5px] border border-input bg-transparent outline-none"
			style={{
				cursor: "text",
				textAlign: "center",
				fontSize: 13,
				fontWeight: 500,
				lineHeight: `${GRID_NAME_LINE_HEIGHT}px`,
				letterSpacing: 0,
				padding: `${GRID_RENAME_PADDING_Y}px 4px`,
				height: gridHeight,
				minHeight: GRID_RENAME_MIN_HEIGHT,
				maxHeight: GRID_RENAME_MAX_HEIGHT,
				width: "100%",
				minWidth: 0,
				maxWidth: "100%",
				resize: "none",
				// Clip overflow instead of scrolling: a scrollbar steals width and reflows a 2-line name.
				overflowX: "hidden",
				overflowY: "hidden",
				overflowWrap: "anywhere",
				whiteSpace: "pre-wrap",
			}}
			onChange={(event) => rename.setRenameValue(event.target.value)}
			onFocus={() => {
				hasFocused.current = true
			}}
			onBlur={handleBlur}
			onKeyDown={onRenameKeyDown}
		/>
	) : (
		<InputWithError
			ref={rename.renameInputRef}
			data-testid="file-manager-rename-input"
			value={rename.renameValue}
			aria-label={t("userSpace.rename")}
			readOnly={rename.renamePending}
			height={20}
			className="w-full min-w-0 max-w-full"
			style={{
				cursor: "text",
				textAlign: "left",
				fontSize: 12,
				fontWeight: 400,
				lineHeight: "16px",
				letterSpacing: 0,
				padding: "1px 4px",
				width: "100%",
				minWidth: 0,
				maxWidth: "100%",
				overflowX: "auto",
			}}
			errorMessage={error}
			onChange={(event) => rename.setRenameValue(event.target.value)}
			onFocus={() => {
				hasFocused.current = true
			}}
			onBlur={handleBlur}
			onKeyDown={onRenameKeyDown}
		/>
	)
	return (
		<div
			data-manager-rename
			className={cn(
				// Fill the name slot and never grow past it, even for long filenames.
				"relative w-full min-w-0 max-w-full overflow-hidden",
				grid ? "self-stretch" : "flex-1",
			)}
			onPointerDown={(event) => event.stopPropagation()}
			onClick={(event) => event.stopPropagation()}
			onDoubleClick={(event) => event.stopPropagation()}
			onContextMenu={(event) => event.stopPropagation()}
		>
			<Tooltip open={Boolean(error)}>
				<TooltipTrigger asChild>
					<div className="flex w-full min-w-0 max-w-full">{renameField}</div>
				</TooltipTrigger>
				{error && (
					<TooltipContent container={getPopupContainer() ?? undefined} side="bottom">
						<span role="alert">{error}</span>
					</TooltipContent>
				)}
			</Tooltip>
		</div>
	)
}
