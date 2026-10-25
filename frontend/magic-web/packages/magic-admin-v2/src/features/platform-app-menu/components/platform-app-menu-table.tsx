import type { ColumnDef } from "@tanstack/react-table"
import { AlertCircle, Edit3, MenuSquare, MoreHorizontal, Trash2 } from "lucide-react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import type { ApiError } from "@magic-admin-v2/api/types"
import { DataTable } from "@magic-admin-v2/components/data-table"
import { EmptyState } from "@magic-admin-v2/components/empty-state"
import { Button } from "@magic-admin-v2/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@magic-admin-v2/components/ui/dropdown-menu"
import { Switch } from "@magic-admin-v2/components/ui/switch"
import { AppMenuIconPreview } from "@magic-admin-v2/features/platform-app-menu/components/app-menu-icon-picker"
import { getMenuName, getOpenMethodLabel } from "@magic-admin-v2/features/platform-app-menu/utils"
import { appMenuStatus, type AppMenuItem } from "@magic-admin-v2/features/platform-app-menu/types"
import { useI18n } from "@magic-admin-v2/i18n/use-i18n"

interface PlatformAppMenuTableProps {
	error: ApiError | null
	hasEditRight: boolean
	isLoading: boolean
	items: AppMenuItem[]
	onDelete: (item: AppMenuItem) => void
	onEdit: (item: AppMenuItem) => void
	onStatusChange: (item: AppMenuItem, checked: boolean) => void
	statusPendingIds: ReadonlySet<string>
}

export function PlatformAppMenuTable({
	error,
	hasEditRight,
	isLoading,
	items,
	onDelete,
	onEdit,
	onStatusChange,
	statusPendingIds,
}: PlatformAppMenuTableProps) {
	const { t } = useTranslation()
	const { language } = useI18n()
	const columns = useMemo<Array<ColumnDef<AppMenuItem>>>(
		() => [
			{
				id: "name",
				size: 260,
				enableSorting: false,
				header: t("appMenu.column.name"),
				cell: ({ row }) => {
					const item = row.original
					return (
						<div className="flex min-w-0 items-center gap-3">
							<AppMenuIconPreview item={item} />
							<div className="min-w-0">
								<div className="truncate font-medium text-foreground">
									{getMenuName(item, language)}
								</div>
								<div className="truncate text-xs text-muted-foreground">
									{item.name_i18n?.en_US || t("common.emptyValue")}
								</div>
							</div>
						</div>
					)
				},
			},
			{
				accessorKey: "path",
				size: 260,
				enableSorting: false,
				header: t("appMenu.column.path"),
				cell: ({ row }) => (
					<span className="block max-w-[280px] truncate text-sm text-muted-foreground">
						{row.original.path || t("common.emptyValue")}
					</span>
				),
			},
			{
				accessorKey: "open_method",
				size: 150,
				enableSorting: false,
				header: () => (
					<span className="whitespace-nowrap">{t("appMenu.column.openMethod")}</span>
				),
				cell: ({ row }) => (
					<span className="whitespace-nowrap text-muted-foreground">
						{getOpenMethodLabel(row.original.open_method, t)}
					</span>
				),
			},
			{
				accessorKey: "sort_order",
				size: 100,
				enableSorting: true,
				sortDescFirst: false,
				header: () => (
					<span className="whitespace-nowrap">{t("appMenu.column.sortOrder")}</span>
				),
				cell: ({ row }) => (
					<span className="whitespace-nowrap text-muted-foreground">
						{row.original.sort_order ?? 0}
					</span>
				),
			},
			{
				accessorKey: "status",
				size: 96,
				enableSorting: false,
				header: () => (
					<span className="whitespace-nowrap">{t("appMenu.column.status")}</span>
				),
				meta: { mobile: { kind: "control" } },
				cell: ({ row }) => {
					const item = row.original
					const isStatusPending = statusPendingIds.has(item.id)

					return (
						<Switch
							data-testid="app-menu-status-switch"
							aria-label={`${getMenuName(item, language)} ${t("appMenu.column.status")}`}
							checked={item.status === appMenuStatus.enabled}
							disabled={!hasEditRight || isStatusPending}
							loading={isStatusPending}
							onCheckedChange={(checked) => onStatusChange(item, checked)}
						/>
					)
				},
			},
			{
				id: "actions",
				size: 72,
				enableHiding: false,
				enableSorting: false,
				header: t("appMenu.column.actions"),
				meta: { fitContent: true },
				cell: ({ row }) => {
					const item = row.original
					return (
						<div className="flex justify-end">
							<DropdownMenu>
								<DropdownMenuTrigger
									asChild
									data-testid="platform-app-menu-menu-trigger"
								>
									<Button
										aria-label={t("appMenu.action.more")}
										data-testid="app-menu-more-button"
										size="icon"
										variant="ghost"
									>
										<MoreHorizontal className="size-4" aria-hidden="true" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent
									align="end"
									data-testid="app-menu-actions-menu"
								>
									<DropdownMenuItem
										data-testid="app-menu-edit-item"
										disabled={!hasEditRight}
										onSelect={() => onEdit(item)}
									>
										<Edit3 className="mr-2 size-4" aria-hidden="true" />
										{t("common.edit")}
									</DropdownMenuItem>
									{item.can_delete !== false ? (
										<>
											<DropdownMenuSeparator />
											<DropdownMenuItem
												data-testid="app-menu-delete-item"
												className="text-destructive focus:text-destructive"
												disabled={!hasEditRight}
												onSelect={() => hasEditRight && onDelete(item)}
											>
												<Trash2
													className="mr-2 size-4"
													aria-hidden="true"
												/>
												{t("appMenu.action.delete")}
											</DropdownMenuItem>
										</>
									) : null}
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					)
				},
			},
		],
		[hasEditRight, language, onDelete, onEdit, onStatusChange, statusPendingIds, t],
	)

	if (error) {
		return (
			<div className="rounded-lg border border-border/50 p-4">
				<EmptyState
					description={error.message}
					icon={AlertCircle}
					testId="app-menu-error"
					title={t("appMenu.error.loadTitle")}
				/>
			</div>
		)
	}

	return (
		<DataTable
			columns={columns}
			containerTestId="app-menu-table"
			data={items}
			emptyState={
				<div className="p-4">
					<EmptyState
						description={t("appMenu.empty.description")}
						icon={MenuSquare}
						testId="app-menu-empty"
						title={t("appMenu.empty.title")}
					/>
				</div>
			}
			getRowId={(item) => item.id}
			isLoading={isLoading}
			loadingTestId="app-menu-loading"
			minWidth={1140}
			rowTestId="app-menu-row"
			stickyRightColumnId="actions"
		/>
	)
}
