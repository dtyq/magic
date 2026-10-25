import { Columns3Cog, Loader2, Pencil, Plus, RefreshCw, ShieldCheck, Trash2, X } from "lucide-react"
import { useRef } from "react"
import { useTranslation } from "react-i18next"
import { useSize } from "ahooks"

import type {
	MagicBaseColumn,
	MagicBaseFilterGroup,
	MagicBasePermissionsResponse,
	MagicBaseRow,
	MagicBaseSortRule,
	MagicBaseTable,
} from "@/apis/modules/magicBase"
import { Button } from "@/components/shadcn-ui/button"
import { ConfirmDialog } from "@/components/shadcn-composed/confirm-dialog"
import { Switch } from "@/components/shadcn-ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"
import { cn } from "@/utils/cn"

import DataFilterBar from "./DataFilterBar"
import DataFilterSummary from "./DataFilterSummary"
import DataGrid, { type MagicBaseCellSelection } from "./DataGrid"
import DatabaseSettingsSidePanel, { type DatabaseSidePanel } from "./DatabaseSettingsSidePanel"
import {
	getMagicBaseTableDisplayName,
	getMagicBaseTableName,
	type MagicBaseGridColumn,
} from "./utils"
import * as layout from "../../layoutConstants"

export type { DatabaseSidePanel } from "./DatabaseSettingsSidePanel"

interface DatabaseTablePanelProps {
	projectId?: string
	selectedTableId: string | null
	selectedTable?: MagicBaseTable
	tableError?: unknown
	tableLoading: boolean
	tableListCollapsed: boolean
	activeSidePanel: DatabaseSidePanel | null
	rows: MagicBaseRow[]
	rowsError?: unknown
	rowsLoading: boolean
	gridColumns: MagicBaseGridColumn[]
	displayColumns: MagicBaseColumn[]
	sort: MagicBaseSortRule | null
	selectionResetKey: string
	permissions?: MagicBasePermissionsResponse
	permissionsLoading: boolean
	total: number
	totalKnown: boolean
	loadedRowCount: number
	hasMoreRows: boolean
	loadingMoreRows: boolean
	selectedRowCount: number
	canEditSelectedRow: boolean
	canDeleteSelectedRows: boolean
	canManagePermissions: boolean
	canManageStaticPermissions: boolean
	refreshing: boolean
	permissionDiscardConfirmOpen: boolean
	showSystemFields: boolean
	filter: MagicBaseFilterGroup
	onSidePanelChange: (panel: DatabaseSidePanel | null) => void
	onShowSystemFieldsChange: (show: boolean) => void
	onCreateRow: () => void
	onEditSelectedRow: () => void
	onDeleteSelectedRows: () => void
	onSortChange: (field: string) => void
	onSelectionChange: (selection: MagicBaseCellSelection) => void
	onClearSelection: () => void
	onFilterChange: (filter: MagicBaseFilterGroup) => void
	onLoadMoreRows: () => void
	onOpenEditRow: (recordId: string) => void
	onRequestDeleteRows: (selection: MagicBaseCellSelection) => void
	onOpenRowPermissions: (selection: MagicBaseCellSelection) => void
	onOpenColumnPermissions: (selection: MagicBaseCellSelection) => void
	onRefreshTable: () => void
	onRefreshRows: () => void
	onRefreshPermissions: () => void
	onRefresh: () => void
	onPermissionDirtyChange: (dirty: boolean) => void
	onDiscardPermissionChanges: () => void
	onContinueEditingPermissions: () => void
}

interface DataToolbarActionsProps {
	activeSidePanel: DatabaseSidePanel | null
	canManagePermissions: boolean
	refreshing: boolean
	onSidePanelChange: (panel: DatabaseSidePanel | null) => void
	onRefresh: () => void
}

function DataToolbarActions({
	activeSidePanel,
	canManagePermissions,
	refreshing,
	onSidePanelChange,
	onRefresh,
}: DataToolbarActionsProps) {
	const { t } = useTranslation("super")

	return (
		<div className="flex items-center gap-1">
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						type="button"
						variant={activeSidePanel === "structure" ? "secondary" : "outline"}
						size="icon"
						className={cn(
							"size-8 shadow-xs",
							activeSidePanel !== "structure" && "bg-background",
						)}
						aria-label={t("microAppPage.databasePanel.fieldSettings")}
						aria-pressed={activeSidePanel === "structure"}
						onClick={() =>
							onSidePanelChange(activeSidePanel === "structure" ? null : "structure")
						}
						data-testid="magicbase-field-settings"
					>
						<Columns3Cog className="size-4" />
					</Button>
				</TooltipTrigger>
				<TooltipContent side="bottom">
					{t("microAppPage.databasePanel.fieldSettings")}
				</TooltipContent>
			</Tooltip>
			{canManagePermissions ? (
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							type="button"
							variant={activeSidePanel === "permissions" ? "secondary" : "outline"}
							size="icon"
							className={cn(
								"size-8 shadow-xs",
								activeSidePanel !== "permissions" && "bg-background",
							)}
							aria-label={t("microAppPage.databasePanel.accessPermissions")}
							aria-pressed={activeSidePanel === "permissions"}
							onClick={() =>
								onSidePanelChange(
									activeSidePanel === "permissions" ? null : "permissions",
								)
							}
							data-testid="magicbase-access-permissions"
						>
							<ShieldCheck className="size-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom">
						{t("microAppPage.databasePanel.accessPermissions")}
					</TooltipContent>
				</Tooltip>
			) : null}
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						type="button"
						variant="outline"
						size="icon"
						className="size-8 bg-background shadow-xs"
						aria-label={t("microAppPage.databasePanel.refresh")}
						aria-busy={refreshing}
						disabled={refreshing}
						onClick={onRefresh}
						data-testid="magicbase-refresh"
					>
						<RefreshCw
							className={cn("size-4", refreshing && "animate-spin")}
							data-testid="magicbase-refresh-icon"
						/>
					</Button>
				</TooltipTrigger>
				<TooltipContent side="bottom">
					{refreshing ? t("refreshing") : t("microAppPage.databasePanel.refresh")}
				</TooltipContent>
			</Tooltip>
		</div>
	)
}

export default function DatabaseTablePanel({
	projectId,
	selectedTableId,
	selectedTable,
	tableError,
	tableLoading,
	tableListCollapsed,
	activeSidePanel,
	rows,
	rowsError,
	rowsLoading,
	gridColumns,
	displayColumns,
	sort,
	selectionResetKey,
	permissions,
	permissionsLoading,
	total,
	totalKnown,
	loadedRowCount,
	hasMoreRows,
	loadingMoreRows,
	selectedRowCount,
	canEditSelectedRow,
	canDeleteSelectedRows,
	canManagePermissions,
	canManageStaticPermissions,
	refreshing,
	permissionDiscardConfirmOpen,
	showSystemFields,
	filter,
	onSidePanelChange,
	onShowSystemFieldsChange,
	onCreateRow,
	onEditSelectedRow,
	onDeleteSelectedRows,
	onSortChange,
	onSelectionChange,
	onClearSelection,
	onFilterChange,
	onLoadMoreRows,
	onOpenEditRow,
	onRequestDeleteRows,
	onOpenRowPermissions,
	onOpenColumnPermissions,
	onRefreshTable,
	onRefreshRows,
	onRefreshPermissions,
	onRefresh,
	onPermissionDirtyChange,
	onDiscardPermissionChanges,
	onContinueEditingPermissions,
}: DatabaseTablePanelProps) {
	const { t } = useTranslation("super")
	const workspaceRef = useRef<HTMLDivElement>(null)
	const workspaceSize = useSize(workspaceRef)
	const measuredWorkspaceWidth = workspaceSize?.width ?? 0
	const availableSettingsWidth =
		measuredWorkspaceWidth > layout.DATABASE_GRID_MIN_PX
			? measuredWorkspaceWidth - layout.DATABASE_GRID_MIN_PX
			: layout.DATABASE_SETTINGS_PANEL_MAX_PX
	const settingsPanelMaxWidth = Math.min(
		layout.DATABASE_SETTINGS_PANEL_MAX_PX,
		availableSettingsWidth,
	)
	const tableDisplayName = getMagicBaseTableDisplayName(selectedTable)
	const tableName = getMagicBaseTableName(selectedTable)

	if (!selectedTableId) return null

	return (
		<>
			<div
				data-testid="magicbase-table-header"
				className={cn(
					"border-b border-border/60 bg-background/95 px-4 py-3",
					tableListCollapsed && "pl-10",
				)}
			>
				<div className="flex min-w-0 items-center justify-between gap-4">
					<div className="flex min-w-0 items-center gap-2">
						<div className="flex min-w-0 items-start gap-2.5">
							<div className="min-w-0">
								<h3
									className="truncate text-sm font-semibold text-foreground"
									title={tableDisplayName}
								>
									{tableDisplayName ||
										t("microAppPage.databasePanel.loadingTable")}
								</h3>
								{tableName && tableName !== tableDisplayName ? (
									<p
										className="truncate text-xs text-muted-foreground"
										title={tableName}
									>
										{tableName}
									</p>
								) : null}
							</div>
							<span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
								{totalKnown
									? t("microAppPage.databasePanel.totalRows", { total })
									: t("microAppPage.databasePanel.loadedRows", { total })}
							</span>
						</div>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						{tableLoading ? (
							<span className="flex items-center gap-2 text-xs text-muted-foreground">
								<Loader2 className="size-3.5 animate-spin" />
								{t("microAppPage.databasePanel.loading")}
							</span>
						) : null}
						{selectedRowCount > 0 ? (
							<div
								className="flex h-8 items-center gap-1 rounded-md border border-primary/15 bg-primary/5 px-1.5"
								data-testid="magicbase-selection-actions"
								data-preserve-grid-selection
							>
								<span className="px-1 text-xs text-muted-foreground">
									{t("microAppPage.databasePanel.selectedRows", {
										total: selectedRowCount,
									})}
								</span>
								<Button
									type="button"
									size="sm"
									variant="ghost"
									className="h-7 gap-1 px-2"
									onClick={onClearSelection}
								>
									<X className="size-3.5" />
									{t("microAppPage.databasePanel.contextMenu.clearSelection")}
								</Button>
								{canEditSelectedRow ? (
									<Button
										type="button"
										size="sm"
										variant="ghost"
										className="h-7 gap-1 px-2"
										onClick={onEditSelectedRow}
									>
										<Pencil className="size-3.5" />
										{t("microAppPage.databasePanel.rowEdit")}
									</Button>
								) : null}
								{canDeleteSelectedRows ? (
									<Button
										type="button"
										size="sm"
										variant="ghost"
										className="h-7 gap-1 px-2 text-destructive hover:text-destructive"
										onClick={onDeleteSelectedRows}
									>
										<Trash2 className="size-3.5" />
										{t("microAppPage.databasePanel.rowDelete")}
									</Button>
								) : null}
							</div>
						) : null}
						<label
							className="flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-2.5 text-xs text-foreground shadow-xs"
							data-preserve-grid-selection
						>
							<span>{t("microAppPage.databasePanel.showSystemFields")}</span>
							<Switch
								checked={showSystemFields}
								onCheckedChange={onShowSystemFieldsChange}
								aria-label={t("microAppPage.databasePanel.showSystemFields")}
								data-testid="magicbase-system-fields-toggle"
							/>
						</label>
						<DataFilterBar
							columns={displayColumns}
							value={filter}
							onChange={onFilterChange}
						/>
						<Button
							type="button"
							size="sm"
							className="h-8 gap-1.5 shadow-sm"
							disabled={!selectedTable}
							onClick={onCreateRow}
						>
							<Plus className="size-3.5" />
							{t("microAppPage.databasePanel.rowCreate")}
						</Button>
						<DataToolbarActions
							activeSidePanel={activeSidePanel}
							canManagePermissions={canManagePermissions}
							refreshing={refreshing}
							onSidePanelChange={onSidePanelChange}
							onRefresh={onRefresh}
						/>
					</div>
				</div>
			</div>

			<div ref={workspaceRef} className="flex min-h-0 flex-1 bg-background">
				<div className="flex min-w-0 flex-1 flex-col">
					<DataFilterSummary
						columns={displayColumns}
						value={filter}
						onChange={onFilterChange}
					/>
					{tableError ? (
						<div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm">
							<p className="text-destructive">
								{t("microAppPage.databasePanel.loadTableFailed")}
							</p>
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={onRefreshTable}
							>
								{t("microAppPage.databasePanel.retry")}
							</Button>
						</div>
					) : (
						<div className="min-h-0 flex-1">
							{rowsError ? (
								<div className="flex h-full flex-col items-center justify-center gap-3 text-sm">
									<p className="text-destructive">
										{t("microAppPage.databasePanel.loadRowsFailed")}
									</p>
									<Button
										type="button"
										size="sm"
										variant="outline"
										onClick={onRefreshRows}
									>
										{t("microAppPage.databasePanel.retry")}
									</Button>
								</div>
							) : (
								<div className="h-full">
									<DataGrid
										columns={gridColumns}
										rows={rows}
										sort={sort}
										loading={rowsLoading || tableLoading}
										selectionResetKey={selectionResetKey}
										onSortChange={onSortChange}
										onSelectionChange={onSelectionChange}
										onOpenEditRow={onOpenEditRow}
										onDeleteRows={onRequestDeleteRows}
										canManagePermissions={canManageStaticPermissions}
										total={total}
										totalKnown={totalKnown}
										loadedRowCount={loadedRowCount}
										hasMore={hasMoreRows}
										loadingMore={loadingMoreRows}
										onLoadMore={onLoadMoreRows}
										onOpenRowPermissions={onOpenRowPermissions}
										onOpenColumnPermissions={onOpenColumnPermissions}
									/>
								</div>
							)}
						</div>
					)}
				</div>

				{activeSidePanel &&
				selectedTable &&
				(activeSidePanel !== "permissions" || canManagePermissions) ? (
					<DatabaseSettingsSidePanel
						view={activeSidePanel}
						projectId={projectId || ""}
						table={selectedTable}
						columns={displayColumns}
						permissions={permissions}
						permissionsLoading={permissionsLoading}
						canManagePermissions={canManagePermissions}
						maxWidth={settingsPanelMaxWidth}
						onClose={() => onSidePanelChange(null)}
						onPermissionDirtyChange={onPermissionDirtyChange}
						onRefreshPermissions={onRefreshPermissions}
						onRefreshTable={onRefreshTable}
					/>
				) : null}
			</div>

			<ConfirmDialog
				open={permissionDiscardConfirmOpen}
				title={t("microAppPage.databasePanel.dynamicUnsavedTitle")}
				description={t("microAppPage.databasePanel.dynamicUnsavedDescription")}
				confirmText={t("microAppPage.databasePanel.dynamicDiscardChanges")}
				cancelText={t("microAppPage.databasePanel.dynamicContinueEditing")}
				variant="destructive"
				destructivePresentation="soft"
				dialogSize="sm"
				onConfirm={onDiscardPermissionChanges}
				onCancel={onContinueEditingPermissions}
			/>
		</>
	)
}
