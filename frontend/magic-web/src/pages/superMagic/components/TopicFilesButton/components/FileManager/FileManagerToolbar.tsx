import {
	ArrowLeft,
	ArrowRight,
	ArrowUp,
	ArrowDown,
	ArrowDownUp,
	Check,
	ChevronRight,
	ChevronDown,
	Copy,
	FolderPlus,
	LayoutGrid,
	List,
	Scissors,
	ClipboardPaste,
	Search,
	Upload,
	RefreshCw,
	Trash2,
} from "lucide-react"
import { Fragment, type ComponentProps, type ReactNode, useState } from "react"
import { useTranslation } from "react-i18next"
import MagicTooltip from "@/components/base/MagicTooltip"
import MagicDropdown from "@/components/base/MagicDropdown"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { cn } from "@/utils/cn"
import FileMenuDropdown from "../FileMenuDropdown"
import UploadMenuDropdown from "../UploadMenuDropdown"
import { isMac } from "@/utils/devices"
import type {
	FileManagerActions,
	FileManagerPathItem,
	FileManagerSort,
	FileManagerSortDirection,
	FileManagerView,
} from "./types"

interface Props {
	projectRecycle?: boolean
	management?: {
		onOpenRecycle: () => void
		createMenu: Omit<ComponentProps<typeof FileMenuDropdown>, "children">
		uploadMenu: Omit<ComponentProps<typeof UploadMenuDropdown>, "children">
		actions: FileManagerActions
	}
	toolbarLeading?: ReactNode
	/** 选择模式将路径、搜索和刷新放到同一条可自适应工具栏。 */
	compact?: boolean
	path: FileManagerPathItem[]
	canBack: boolean
	canForward: boolean
	canUp: boolean
	back: () => void
	forward: () => void
	up: () => void
	onNavigate: (id: string) => void
	query: string
	onQuery: (query: string) => void
	view: FileManagerView
	onView: (view: FileManagerView) => void
	sort: FileManagerSort
	sortDirection: FileManagerSortDirection
	sortOptions: Record<FileManagerSort, string>
	onSort: (sort: FileManagerSort) => void
	onRefresh: () => void
	loading: boolean
	getPopupContainer: () => HTMLElement | null
}

export function FileManagerToolbar(props: Props) {
	const { t } = useTranslation("super")
	const [searchFocused, setSearchFocused] = useState(false)
	const management = props.management
	const navigation = [
		{
			label: t("fileManager.back"),
			Icon: ArrowLeft,
			run: props.back,
			disabled: !props.canBack,
		},
		{
			label: t("fileManager.forward"),
			Icon: ArrowRight,
			run: props.forward,
			disabled: !props.canForward,
		},
		{ label: t("fileManager.up"), Icon: ArrowUp, run: props.up, disabled: !props.canUp },
	]
	const commands = [
		{ command: "cut", label: t("fileManager.cut"), Icon: Scissors },
		{ command: "copy", label: t("fileManager.copy"), Icon: Copy },
		{ command: "paste", label: t("fileManager.paste"), Icon: ClipboardPaste },
	] as const
	const sortEntries = Object.entries(props.sortOptions) as [FileManagerSort, string][]
	const sortSelector = (
		<MagicDropdown
			menu={{
				items: sortEntries.map(([id, label]) => ({
					key: id,
					label: (
						<div className="flex items-center justify-between gap-3">
							<span className="truncate">{label}</span>
							{props.sort === id && (
								<span className="flex shrink-0 items-center gap-1 text-primary">
									{props.sortDirection === "ascending" ? (
										<ArrowUp size={12} />
									) : (
										<ArrowDown size={12} />
									)}
									<Check size={14} />
								</span>
							)}
						</div>
					),
				})),
				onClick: ({ key }) => props.onSort(key as FileManagerSort),
			}}
			getPopupContainer={() => props.getPopupContainer() ?? document.body}
		>
			<button
				type="button"
				aria-label={t("fileManager.sort")}
				className="flex h-7 min-w-0 shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted"
			>
				<ArrowDownUp size={14} className="shrink-0" />
				<span className="max-w-20 truncate">{props.sortOptions[props.sort]}</span>
				<ChevronDown size={12} className="shrink-0" />
			</button>
		</MagicDropdown>
	)
	const search = (
		<div
			className={cn(
				"relative min-w-24 shrink-0 transition-[width,flex-basis] duration-200",
				props.compact
					? searchFocused
						? "w-64 max-w-[18rem] flex-[0_0_16rem]"
						: "w-40 flex-[0_0_10rem]"
					: "w-40 flex-[0_1_10rem]",
			)}
		>
			<Search
				size={16}
				className="pointer-events-none absolute left-2 top-1.5 text-muted-foreground"
			/>
			<Input
				value={props.query}
				onChange={(event) => props.onQuery(event.target.value)}
				placeholder={
					!management
						? t("fileManager.searchProjectFiles")
						: t("userSpace.searchDirectory")
				}
				aria-label={
					!management
						? t("fileManager.searchProjectFiles")
						: t("userSpace.searchDirectory")
				}
				onFocus={() => {
					if (props.compact) setSearchFocused(true)
				}}
				onBlur={(event) => {
					if (props.compact && !event.currentTarget.value) setSearchFocused(false)
				}}
				className="h-7 cursor-text rounded-md bg-muted/30 pl-8 text-xs"
			/>
		</div>
	)
	const refresh = (
		<MagicTooltip
			title={t("fileViewer.tabs.refresh")}
			getPopupContainer={props.getPopupContainer}
		>
			<Button
				variant="ghost"
				size="icon"
				className="size-7 cursor-pointer disabled:pointer-events-auto disabled:cursor-not-allowed"
				aria-label={t("fileViewer.tabs.refresh")}
				onClick={props.onRefresh}
				disabled={props.loading}
			>
				<RefreshCw size={16} />
			</Button>
		</MagicTooltip>
	)
	const navigationButtons = navigation.map(({ label, Icon, run, disabled }) => (
		<MagicTooltip key={label} title={label} getPopupContainer={props.getPopupContainer}>
			<Button
				variant="ghost"
				size="icon"
				className="size-7 cursor-pointer disabled:pointer-events-auto disabled:cursor-not-allowed"
				aria-label={label}
				onClick={run}
				disabled={disabled}
			>
				<Icon size={16} />
			</Button>
		</MagicTooltip>
	))
	const pathNavigation = (
		<nav
			aria-label={t("fileManager.path")}
			className="flex min-w-0 flex-[1_1_14rem] items-center overflow-x-auto"
		>
			{props.path.map((part, index) => (
				<div key={part.id ?? "root"} className="flex min-w-0 shrink-0 items-center">
					{index > 0 && (
						<ChevronRight size={16} className="shrink-0 text-muted-foreground" />
					)}
					<MagicTooltip title={part.name} getPopupContainer={props.getPopupContainer}>
						<Button
							variant="ghost"
							size="sm"
							className={cn(
								"h-7 max-w-44 cursor-pointer truncate px-2 text-xs font-normal disabled:pointer-events-auto disabled:cursor-not-allowed",
								"data-[manager-drop-target=true]:bg-blue-500/10 data-[manager-drop-target=true]:ring-1 data-[manager-drop-target=true]:ring-inset data-[manager-drop-target=true]:ring-blue-500",
							)}
							aria-current={index === props.path.length - 1 ? "page" : undefined}
							disabled={part.id === null}
							onClick={() => part.id !== null && props.onNavigate(part.id)}
							data-manager-target={part.id ?? undefined}
						>
							{part.name}
						</Button>
					</MagicTooltip>
				</div>
			))}
		</nav>
	)
	if (props.compact) {
		return (
			<div className="flex min-w-0 shrink-0 flex-wrap items-center gap-1 border-b border-border/60 px-3 py-2">
				{props.toolbarLeading}
				{pathNavigation}
				{search}
				{refresh}
			</div>
		)
	}
	return (
		<>
			<div className="flex shrink-0 flex-wrap items-center gap-1 px-3 pb-1 pt-2">
				{props.toolbarLeading}
				{navigationButtons}
				{pathNavigation}
				{management && (
					<Button
						variant="ghost"
						size="sm"
						className="ml-auto h-7 cursor-pointer gap-1.5 text-xs font-normal text-muted-foreground disabled:pointer-events-auto disabled:cursor-not-allowed"
						onClick={management.onOpenRecycle}
					>
						<Trash2 size={14} />
						{props.projectRecycle
							? t("fileManager.recycle.projectTitle")
							: t("fileManager.recycle.title")}
					</Button>
				)}
			</div>
			<div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border/60 px-3 pb-2 pt-1">
				{management && (
					<>
						<FileMenuDropdown
							{...management.createMenu}
							overlayClassName="[&_[role=menuitem]]:cursor-pointer [&_[data-disabled]]:cursor-not-allowed"
							disabled={!management.actions.canExecute("createFolder")}
							getPopupContainer={() => props.getPopupContainer() ?? document.body}
						>
							<Button
								variant="ghost"
								size="sm"
								className="h-7 cursor-pointer gap-1.5 px-2 text-xs font-normal disabled:pointer-events-auto disabled:cursor-not-allowed"
								disabled={!management.actions.canExecute("createFolder")}
							>
								<FolderPlus size={16} />
								{t("topicFiles.contextMenu.createFile")}
								<ChevronDown size={12} />
							</Button>
						</FileMenuDropdown>
						<UploadMenuDropdown
							{...management.uploadMenu}
							overlayClassName="[&_[role=menuitem]]:cursor-pointer [&_[data-disabled]]:cursor-not-allowed"
							disabled={!management.actions.canExecute("upload")}
							getPopupContainer={() => props.getPopupContainer() ?? document.body}
						>
							<Button
								variant="ghost"
								size="sm"
								className="h-7 cursor-pointer gap-1.5 px-2 text-xs font-normal disabled:pointer-events-auto disabled:cursor-not-allowed"
								disabled={!management.actions.canExecute("upload")}
							>
								<Upload size={16} />
								{t("userSpace.upload")}
								<ChevronDown size={12} />
							</Button>
						</UploadMenuDropdown>
						{commands.map(({ command, label, Icon }) => (
							<Fragment key={command}>
								{command === "cut" && (
									<span aria-hidden className="mx-1 h-4 w-px bg-border/60" />
								)}
								<MagicTooltip
									key={command}
									title={
										management.actions.getDisabledReason(command) ??
										`${label} (${management.actions.shortcuts[command]})`
									}
									getPopupContainer={props.getPopupContainer}
								>
									<span
										className={
											management.actions.canExecute(command)
												? "inline-flex"
												: "inline-flex cursor-not-allowed"
										}
									>
										<Button
											variant="ghost"
											size="sm"
											className="h-7 w-7 cursor-pointer rounded-md px-0"
											disabled={!management.actions.canExecute(command)}
											onClick={() => management.actions.execute(command)}
											aria-label={label}
											aria-keyshortcuts={`${isMac ? "Meta" : "Control"}+${command === "cut" ? "X" : command === "copy" ? "C" : "V"}`}
										>
											<Icon size={16} />
										</Button>
									</span>
								</MagicTooltip>
							</Fragment>
						))}
					</>
				)}
				<div className="flex-1" />
				{sortSelector}
				{management && (
					<div className="flex items-center gap-0.5 rounded-lg bg-muted/60 p-0.5">
						{(
							[
								{ view: "grid", Icon: LayoutGrid, label: t("userSpace.gridView") },
								{ view: "list", Icon: List, label: t("userSpace.listView") },
							] as const
						).map(({ view, Icon, label }) => (
							<MagicTooltip
								key={view}
								title={label}
								getPopupContainer={props.getPopupContainer}
							>
								<Button
									variant="ghost"
									size="icon"
									className={cn(
										"h-6 w-7 cursor-pointer rounded-md disabled:pointer-events-auto disabled:cursor-not-allowed",
										props.view === view &&
											"bg-background shadow-sm hover:bg-background",
									)}
									aria-label={label}
									aria-pressed={props.view === view}
									onClick={() => props.onView(view)}
								>
									<Icon size={16} />
								</Button>
							</MagicTooltip>
						))}
					</div>
				)}
				{search}
				{refresh}
			</div>
		</>
	)
}
