import { ArrowDown, ArrowUp, ChevronsUpDown, Loader2 } from "lucide-react"
import type { MouseEvent, MutableRefObject, RefObject, UIEvent } from "react"
import { useTranslation } from "react-i18next"

import type { MagicBaseRow, MagicBaseSortRule } from "@/apis/modules/magicBase"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import { MicroAppDatabaseEmptyIllustration } from "@/pages/superMagic/components/MicroAppStateIllustration"

import type { CellCoordinate, ContextMenuPosition, MagicBaseCellSelection } from "./DataGrid.types"
import type { MagicBaseGridColumn } from "./utils"
import { formatCellValue } from "./utils"

interface DataGridViewProps {
	rootRef: RefObject<HTMLDivElement | null>
	menuRef: RefObject<HTMLDivElement | null>
	columns: MagicBaseGridColumn[]
	rows: MagicBaseRow[]
	sort: MagicBaseSortRule | null
	total: number
	totalKnown: boolean
	loadedRowCount: number
	hasMore: boolean
	loadingMore: boolean
	contextMenuPosition: ContextMenuPosition | null
	activeSelection: MagicBaseCellSelection
	canEditSelectedRow: boolean
	canManagePermissions: boolean
	hasSelectedConfigurableColumns: boolean
	suppressHeaderSortRef: MutableRefObject<boolean>
	onSortChange: (field: string) => void
	onLoadMore: () => void
	onOpenEditRow?: (rowId: string) => void
	isHeaderSelected: (columnIndex: number) => boolean
	isRowSelected: (rowIndex: number) => boolean
	onHeaderMouseDown: (columnIndex: number, event: MouseEvent) => void
	onHeaderMouseEnter: (columnIndex: number) => void
	onHeaderMouseUp: () => void
	onHeaderContextMenu: (columnIndex: number, event: MouseEvent) => void
	onCellMouseDown: (cell: CellCoordinate, event: MouseEvent) => void
	onCellMouseEnter: (cell: CellCoordinate) => void
	onCellMouseUp: () => void
	onCellContextMenu: (cell: CellCoordinate, event: MouseEvent) => void
	onGridMouseMove: (event: MouseEvent<HTMLDivElement>) => void
	onGridMouseLeave: () => void
	onContextMenuEdit: () => void
	onContextMenuDelete: () => void
	onContextMenuRowPermission: () => void
	onContextMenuColumnPermission: () => void
	onClearSelection: () => void
}

function SortIcon({ columnKey, sort }: { columnKey: string; sort: MagicBaseSortRule | null }) {
	if (sort?.field !== columnKey) {
		return (
			<ChevronsUpDown className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
		)
	}
	return sort.order === "asc" ? (
		<ArrowUp className="size-3.5 text-foreground" />
	) : (
		<ArrowDown className="size-3.5 text-foreground" />
	)
}

function getRowRecordId(row: MagicBaseRow): string {
	return String(row.id ?? row.record_id ?? "")
}

export default function DataGridView({
	rootRef,
	menuRef,
	columns,
	rows,
	sort,
	total,
	totalKnown,
	loadedRowCount,
	hasMore,
	loadingMore,
	contextMenuPosition,
	activeSelection,
	canEditSelectedRow,
	canManagePermissions,
	hasSelectedConfigurableColumns,
	suppressHeaderSortRef,
	onSortChange,
	onLoadMore,
	onOpenEditRow,
	isHeaderSelected,
	isRowSelected,
	onHeaderMouseDown,
	onHeaderMouseEnter,
	onHeaderMouseUp,
	onHeaderContextMenu,
	onCellMouseDown,
	onCellMouseEnter,
	onCellMouseUp,
	onCellContextMenu,
	onGridMouseMove,
	onGridMouseLeave,
	onContextMenuEdit,
	onContextMenuDelete,
	onContextMenuRowPermission,
	onContextMenuColumnPermission,
	onClearSelection,
}: DataGridViewProps) {
	const { t } = useTranslation("super")
	const handleScroll = (event: UIEvent<HTMLDivElement>) => {
		if (!hasMore || loadingMore) return
		const { scrollTop, clientHeight, scrollHeight } = event.currentTarget
		if (scrollTop + clientHeight >= scrollHeight - 160) onLoadMore()
	}

	return (
		<div
			ref={rootRef}
			data-testid="magicbase-data-grid"
			className="h-full min-w-0 overflow-auto bg-muted/20"
			onMouseDown={(event) => {
				if (event.button === 0 && event.target === event.currentTarget) onClearSelection()
			}}
			onMouseMove={onGridMouseMove}
			onMouseLeave={onGridMouseLeave}
			onScroll={handleScroll}
		>
			<table className="w-full min-w-max caption-bottom border-separate border-spacing-0 bg-background text-sm">
				<thead className="sticky top-0 isolate z-20 bg-muted shadow-[0_1px_0_0_hsl(var(--border))] [&_tr]:border-b">
					<tr className="border-b border-border/60">
						{columns.map((column, columnIndex) => (
							<th
								key={column.key}
								data-magicbase-header-column-index={columnIndex}
								className={cn(
									"h-10 min-w-[180px] whitespace-nowrap border-b border-r border-border/60 bg-muted p-0 text-left align-middle font-medium text-foreground",
									isHeaderSelected(columnIndex) &&
										"bg-accent ring-1 ring-inset ring-primary/30",
								)}
								onMouseDown={(event) => onHeaderMouseDown(columnIndex, event)}
								onMouseEnter={() => onHeaderMouseEnter(columnIndex)}
								onMouseUp={onHeaderMouseUp}
								onContextMenu={(event) => onHeaderContextMenu(columnIndex, event)}
							>
								<Button
									type="button"
									variant="ghost"
									className="group h-full w-full justify-between rounded-none px-3 py-2 text-left hover:bg-accent"
									onClick={() => {
										if (suppressHeaderSortRef.current) {
											suppressHeaderSortRef.current = false
											return
										}
										onSortChange(column.key)
									}}
								>
									<span className="min-w-0">
										<span className="block truncate text-xs font-medium text-foreground">
											{column.name}
										</span>
									</span>
									<SortIcon columnKey={column.key} sort={sort} />
								</Button>
							</th>
						))}
					</tr>
				</thead>
				<tbody className="[&_tr:last-child]:border-0">
					{rows.length === 0 ? (
						<tr>
							<td
								colSpan={Math.max(columns.length, 1)}
								className="h-56 text-center text-sm text-muted-foreground"
							>
								<div className="flex flex-col items-center justify-center gap-1 py-4">
									<MicroAppDatabaseEmptyIllustration size="sm" />
									<span>{t("microAppPage.databasePanel.noRows")}</span>
								</div>
							</td>
						</tr>
					) : (
						rows.map((row, rowIndex) => {
							const recordId = getRowRecordId(row)
							const selected = isRowSelected(rowIndex)
							return (
								<tr
									key={recordId || rowIndex}
									className={cn(
										"border-b transition-colors hover:bg-primary/[0.035]",
										rowIndex % 2 === 1 && "bg-muted/20",
									)}
								>
									{columns.map((column, columnIndex) => {
										const value = row[column.key]
										return (
											<td
												key={column.key}
												data-testid="magicbase-data-cell"
												data-magicbase-row-index={rowIndex}
												data-magicbase-column-index={columnIndex}
												className={cn(
													"h-11 max-w-[280px] select-none border-b border-r border-border/50 px-3 py-2 text-xs",
													columnIndex === 0 &&
														"font-medium text-foreground",
													value == null && "text-muted-foreground",
													selected && "bg-primary/10",
												)}
												title={formatCellValue(value)}
												onMouseDown={(event) =>
													onCellMouseDown(
														{ rowIndex, columnIndex },
														event,
													)
												}
												onMouseEnter={() =>
													onCellMouseEnter({ rowIndex, columnIndex })
												}
												onMouseUp={onCellMouseUp}
												onContextMenu={(event) =>
													onCellContextMenu(
														{ rowIndex, columnIndex },
														event,
													)
												}
												onDoubleClick={() => {
													if (column.source !== "schema" || !recordId)
														return
													onOpenEditRow?.(recordId)
												}}
											>
												<span className="block truncate">
													{formatCellValue(value)}
												</span>
											</td>
										)
									})}
								</tr>
							)
						})
					)}
				</tbody>
			</table>
			{rows.length > 0 ? (
				<div
					className="sticky left-0 flex h-10 w-full items-center justify-center border-t border-border/60 bg-background text-xs text-muted-foreground"
					data-testid="magicbase-load-more-status"
				>
					{loadingMore ? (
						<span className="flex items-center gap-2">
							<Loader2 className="size-3.5 animate-spin" />
							{t("microAppPage.databasePanel.loadingMore")}
						</span>
					) : hasMore ? (
						totalKnown ? (
							t("microAppPage.databasePanel.loadProgress", {
								loaded: loadedRowCount,
								total,
							})
						) : (
							t("microAppPage.databasePanel.loadProgressUnknown", {
								loaded: loadedRowCount,
								total,
							})
						)
					) : (
						t("microAppPage.databasePanel.loadedAll", { total })
					)}
				</div>
			) : null}
			{contextMenuPosition ? (
				<div
					ref={menuRef}
					role="menu"
					className="fixed z-[1201] min-w-40 overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
					style={{ left: contextMenuPosition.x, top: contextMenuPosition.y }}
					onContextMenu={(event) => event.preventDefault()}
					onMouseDown={(event) => event.stopPropagation()}
				>
					<button
						type="button"
						role="menuitem"
						disabled={!canEditSelectedRow}
						className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
						onClick={onContextMenuEdit}
					>
						{t("microAppPage.databasePanel.contextMenu.editRow")}
					</button>
					<button
						type="button"
						role="menuitem"
						disabled={activeSelection.rowIds.length === 0}
						className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm text-destructive outline-none hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-50"
						onClick={onContextMenuDelete}
					>
						{t("microAppPage.databasePanel.contextMenu.deleteRows")}
					</button>
					{canManagePermissions ? (
						<>
							<div className="-mx-1 my-1 h-px bg-border" />
							<button
								type="button"
								role="menuitem"
								disabled={activeSelection.rowIds.length === 0}
								className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
								onClick={onContextMenuRowPermission}
							>
								{t("microAppPage.databasePanel.contextMenu.rowPermission")}
							</button>
							<button
								type="button"
								role="menuitem"
								disabled={!hasSelectedConfigurableColumns}
								className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
								onClick={onContextMenuColumnPermission}
							>
								{t("microAppPage.databasePanel.contextMenu.columnPermission")}
							</button>
						</>
					) : null}
					<div className="-mx-1 my-1 h-px bg-border" />
					<button
						type="button"
						role="menuitem"
						className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground"
						onClick={onClearSelection}
					>
						{t("microAppPage.databasePanel.contextMenu.clearSelection")}
					</button>
				</div>
			) : null}
		</div>
	)
}
