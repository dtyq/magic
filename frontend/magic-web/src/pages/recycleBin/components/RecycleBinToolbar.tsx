import { useId, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { FolderSearch, LayoutGrid, List, RotateCcw, Search, Trash2, RefreshCw } from "lucide-react"
import MagicTooltip from "@/components/base/MagicTooltip"
import { Button } from "@/components/shadcn-ui/button"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/shadcn-ui/input-group"
import type { RecycleBinFileView } from "./recycle-bin-file-view"

interface RecycleBinToolbarProps {
	onRefresh?: () => void
	refreshing?: boolean
	refreshDisabled?: boolean
	title: string
	searchValue: string
	hasSelection: boolean
	isAllSelected: boolean
	isPartiallySelected: boolean
	onToggleSelectAll: (checked: boolean) => void
	onCancelSelection: () => void
	onRestoreSelection: () => void
	onDeleteSelection: () => void
	onSearchChange: (value: string) => void
	onSearchReset: () => void
	fileView?: RecycleBinFileView
	onFileViewChange?: (view: RecycleBinFileView) => void
	onSearchSubmit?: () => void
	queryForm?: ReactNode
	searchDisabled?: boolean
	actionsDisabled?: boolean
	selectedCount?: number
}

export function RecycleBinToolbar({
	onRefresh,
	refreshing = false,
	refreshDisabled = false,
	title,
	searchValue,
	hasSelection,
	isAllSelected,
	isPartiallySelected,
	onToggleSelectAll,
	onCancelSelection,
	onRestoreSelection,
	onDeleteSelection,
	onSearchChange,
	onSearchReset,
	fileView,
	onFileViewChange,
	onSearchSubmit,
	queryForm,
	searchDisabled = false,
	actionsDisabled = false,
	selectedCount = 0,
}: RecycleBinToolbarProps) {
	const { t } = useTranslation("super")
	const selectionId = useId()
	const refreshButton = onRefresh && (
		<MagicTooltip title={t("fileViewer.tabs.refresh")}>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="size-8 shrink-0"
				aria-label={t("fileViewer.tabs.refresh")}
				disabled={refreshing || refreshDisabled}
				onClick={onRefresh}
				data-testid="recycle-bin-refresh"
			>
				<RefreshCw size={16} className={refreshing ? "animate-spin" : undefined} />
			</Button>
		</MagicTooltip>
	)
	if (fileView) {
		return (
			<>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div
						className="flex flex-wrap gap-1 rounded-lg bg-muted p-1"
						role="group"
						aria-label={t("recycleBin.project.views")}
					>
						{[
							{
								id: "list" as const,
								label: t("recycleBin.project.list"),
								Icon: List,
							},
							{
								id: "grid" as const,
								label: t("recycleBin.project.grid"),
								Icon: LayoutGrid,
							},
							{
								id: "location" as const,
								label: t("recycleBin.project.location"),
								Icon: FolderSearch,
							},
						].map(({ id, label, Icon }) => (
							<Button
								key={id}
								type="button"
								size="sm"
								variant={fileView === id ? "secondary" : "ghost"}
								aria-pressed={fileView === id}
								disabled={searchDisabled}
								onClick={() => onFileViewChange?.(id)}
							>
								<Icon size={16} />
								{label}
							</Button>
						))}
					</div>
					<div className="flex w-full items-center gap-2 sm:w-auto">
						<InputGroup className="h-9 flex-1 sm:w-56">
							<InputGroupAddon>
								<Search size={16} />
							</InputGroupAddon>
							<InputGroupInput
								type="search"
								value={searchValue}
								disabled={searchDisabled}
								aria-label={t("recycleBin.project.namePlaceholder")}
								placeholder={t("recycleBin.project.namePlaceholder")}
								onChange={(event) => onSearchChange(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === "Enter" && !event.nativeEvent.isComposing) {
										event.preventDefault()
										onSearchSubmit?.()
									}
								}}
							/>
						</InputGroup>
						{refreshButton}
					</div>
				</div>
				{queryForm}
				<div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
					<div className="flex flex-wrap items-center gap-2 text-xs">
						<Checkbox
							id={selectionId}
							checked={
								isAllSelected ? true : isPartiallySelected ? "indeterminate" : false
							}
							disabled={actionsDisabled}
							onCheckedChange={(checked) => onToggleSelectAll(checked === true)}
						/>
						<label htmlFor={selectionId}>{t("recycleBin.project.selectShown")}</label>
						<span className="text-muted-foreground">
							{hasSelection
								? t("recycleBin.project.selected", { count: selectedCount })
								: title}
						</span>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						{hasSelection && (
							<Button
								variant="ghost"
								size="sm"
								onClick={onCancelSelection}
								disabled={actionsDisabled}
							>
								{t("recycleBin.bulkActions.cancelSelection")}
							</Button>
						)}
						<Button
							variant="outline"
							size="sm"
							disabled={!hasSelection || actionsDisabled}
							onClick={onRestoreSelection}
						>
							<RotateCcw size={16} />
							{t("recycleBin.bulkActions.restore")}
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="text-destructive"
							disabled={!hasSelection || actionsDisabled}
							onClick={onDeleteSelection}
						>
							<Trash2 size={16} />
							{t("recycleBin.bulkActions.permanentDelete")}
						</Button>
					</div>
				</div>
			</>
		)
	}
	return (
		<>
			<div className="flex w-full items-center justify-between gap-3.5 rounded-[10px] bg-card px-3 py-2">
				<h2 className="text-lg font-medium leading-normal text-foreground">{title}</h2>
				{refreshButton}
			</div>

			<div className="flex w-full items-center justify-between gap-[12px] rounded-[10px] bg-card px-3 py-2">
				<div className="flex items-center gap-2">
					<Checkbox
						id="select-all"
						data-testid="recycle-bin-select-all"
						checked={
							isAllSelected ? true : isPartiallySelected ? "indeterminate" : false
						}
						onCheckedChange={(checked) => onToggleSelectAll(checked === true)}
					/>
					<label
						htmlFor="select-all"
						className="cursor-pointer text-sm font-medium leading-none text-foreground"
					>
						{t("recycleBin.bulkActions.selectAll")}
					</label>
				</div>
				{hasSelection ? (
					<div className="flex items-center gap-[8px]">
						<Button
							variant="outline"
							size="default"
							className="h-9 rounded-lg px-4 shadow-sm"
							onClick={onCancelSelection}
							type="button"
							data-testid="recycle-bin-cancel-selection"
						>
							{t("recycleBin.bulkActions.cancelSelection")}
						</Button>
						<Button
							size="default"
							className="h-9 gap-[8px] rounded-lg px-4"
							onClick={onRestoreSelection}
							type="button"
							data-testid="recycle-bin-restore-selection"
						>
							<RotateCcw className="size-4" />
							{t("recycleBin.bulkActions.restore")}
						</Button>
						<Button
							variant="destructive"
							size="default"
							className="h-9 gap-[8px] rounded-lg px-4"
							onClick={onDeleteSelection}
							type="button"
							data-testid="recycle-bin-delete-selection"
						>
							<Trash2 className="size-4" />
							{t("recycleBin.bulkActions.permanentDelete")}
						</Button>
					</div>
				) : (
					<div className="flex items-center gap-2">
						<InputGroup className="h-9 w-64 rounded-lg border border-border bg-background shadow-sm">
							<InputGroupAddon>
								<Search className="size-4" />
							</InputGroupAddon>
							<InputGroupInput
								placeholder={t("recycleBin.search.placeholder")}
								className="px-3 py-1 text-sm"
								value={searchValue}
								onChange={(event) => onSearchChange(event.target.value)}
								data-testid="recycle-bin-search-input"
							/>
						</InputGroup>
						<Button
							variant="outline"
							size="default"
							className="h-9 rounded-lg px-4 shadow-sm"
							onClick={onSearchReset}
							type="button"
							data-testid="recycle-bin-search-reset"
						>
							{t("recycleBin.search.reset")}
						</Button>
					</div>
				)}
			</div>
		</>
	)
}
