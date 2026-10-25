import { PanelLeftClose, PanelLeftOpen, Search, Table2 } from "lucide-react"
import type { MouseEvent } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import type { MagicBaseTable } from "@/apis/modules/magicBase"
import { Badge } from "@/components/shadcn-ui/badge"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"
import SmartTooltip from "@/components/other/SmartTooltip"
import { cn } from "@/utils/cn"
import { getMagicBaseTableDisplayName, getMagicBaseTableName } from "./utils"

interface TableListProps {
	tables: MagicBaseTable[]
	selectedTableId: string | null
	loading: boolean
	error?: unknown
	canManagePermissions?: boolean
	onSelect: (tableId: string) => void
	onOpenTablePermissions?: (tableId: string) => void
	onRetry: () => void
	onToggle: () => void
}

interface TableListToggleProps {
	collapsed: boolean
	label: string
	onToggle: () => void
	className?: string
	"data-testid"?: string
}

export function TableListToggle({
	collapsed,
	label,
	onToggle,
	className,
	"data-testid": testId,
}: TableListToggleProps) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className={cn("size-8 shrink-0", className)}
					aria-label={label}
					aria-controls="magicbase-table-list-panel"
					aria-expanded={!collapsed}
					data-testid={testId}
					onClick={onToggle}
				>
					{collapsed ? (
						<PanelLeftOpen className="size-4" />
					) : (
						<PanelLeftClose className="size-4" />
					)}
				</Button>
			</TooltipTrigger>
			<TooltipContent side="right" sideOffset={6}>
				{label}
			</TooltipContent>
		</Tooltip>
	)
}

type TableContextMenuState = {
	tableId: string
	x: number
	y: number
}

export default function TableList({
	tables,
	selectedTableId,
	loading,
	error,
	canManagePermissions = true,
	onSelect,
	onOpenTablePermissions,
	onRetry,
	onToggle,
}: TableListProps) {
	const { t } = useTranslation("super")
	const [keyword, setKeyword] = useState("")
	const [contextMenu, setContextMenu] = useState<TableContextMenuState | null>(null)
	const menuRef = useRef<HTMLDivElement | null>(null)
	const showSearch = tables.length > 8
	const filteredTables = useMemo(() => {
		if (!showSearch) return tables
		const normalizedKeyword = keyword.trim().toLowerCase()
		if (!normalizedKeyword) return tables
		return tables.filter((table) =>
			[table.table_name, table.table_key, table.description]
				.filter(Boolean)
				.some((value) => value?.toLowerCase().includes(normalizedKeyword)),
		)
	}, [keyword, showSearch, tables])

	const closeContextMenu = useCallback(() => setContextMenu(null), [])

	const handleTableContextMenu = (tableId: string, event: MouseEvent) => {
		event.preventDefault()
		event.stopPropagation()
		setContextMenu({
			tableId,
			x: Math.min(event.clientX, window.innerWidth - 190),
			y: Math.min(event.clientY, window.innerHeight - 80),
		})
	}

	useEffect(() => {
		const handlePointerDown = (event: globalThis.MouseEvent) => {
			if (!contextMenu) return
			if (menuRef.current?.contains(event.target as Node)) return
			closeContextMenu()
		}

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") closeContextMenu()
		}

		window.addEventListener("mousedown", handlePointerDown)
		window.addEventListener("scroll", closeContextMenu, true)
		window.addEventListener("resize", closeContextMenu)
		window.addEventListener("keydown", handleKeyDown)
		return () => {
			window.removeEventListener("mousedown", handlePointerDown)
			window.removeEventListener("scroll", closeContextMenu, true)
			window.removeEventListener("resize", closeContextMenu)
			window.removeEventListener("keydown", handleKeyDown)
		}
	}, [closeContextMenu, contextMenu])

	return (
		<aside
			id="magicbase-table-list-panel"
			className="flex h-full w-[220px] shrink-0 flex-col overflow-hidden border-r border-border/60 bg-muted/30"
		>
			<div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 p-4 pl-1">
				<TableListToggle
					collapsed={false}
					label={t("microAppPage.databasePanel.collapseTableList")}
					onToggle={onToggle}
					className="size-6"
				/>
				{showSearch ? (
					<div className="relative min-w-0 flex-1">
						<Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							value={keyword}
							onChange={(event) => setKeyword(event.target.value)}
							placeholder={t("microAppPage.databasePanel.searchTables")}
							className="h-8 pl-8"
						/>
					</div>
				) : (
					<div className="flex min-w-0 flex-1 items-center justify-between gap-2">
						<span className="truncate text-sm font-semibold text-foreground">
							{t("microAppPage.databasePanel.tableListTitle")}
						</span>
						<span className="shrink-0 rounded-full border border-border/60 bg-background px-2 py-0.5 text-[11px] text-muted-foreground shadow-xs">
							{t("microAppPage.databasePanel.tableCount", { total: tables.length })}
						</span>
					</div>
				)}
			</div>

			<ScrollArea
				className="min-h-0 min-w-0 flex-1 overflow-hidden"
				viewportClassName="overflow-x-hidden [&>div]:!block [&>div]:!w-full [&>div]:!min-w-0"
			>
				<div
					className="w-full min-w-0 max-w-full space-y-1 overflow-hidden p-2"
					data-testid="magicbase-table-list"
				>
					{loading ? (
						<div className="space-y-2 p-2">
							{Array.from({ length: 5 }).map((_, index) => (
								<div
									key={index}
									className="h-14 animate-pulse rounded-md bg-muted"
								/>
							))}
						</div>
					) : null}

					{error ? (
						<div className="space-y-3 p-3 text-sm">
							<p className="text-destructive">
								{t("microAppPage.databasePanel.loadTablesFailed")}
							</p>
							<Button type="button" size="sm" variant="outline" onClick={onRetry}>
								{t("microAppPage.databasePanel.retry")}
							</Button>
						</div>
					) : null}

					{!loading && !error && filteredTables.length === 0 ? (
						<div className="p-3 text-sm text-muted-foreground">
							{keyword
								? t("microAppPage.databasePanel.noMatchedTables")
								: t("microAppPage.databasePanel.noTables")}
						</div>
					) : null}

					{filteredTables.map((table) => {
						const active = table.id === selectedTableId
						const displayName = getMagicBaseTableDisplayName(table)
						const tableName = getMagicBaseTableName(table)
						return (
							<button
								key={table.id}
								type="button"
								className={cn(
									"flex w-full min-w-0 max-w-full items-start gap-2.5 overflow-hidden rounded-md border border-transparent px-2.5 py-2.5 text-left transition-[background-color,border-color,box-shadow] hover:border-border/60 hover:bg-background/60",
									active && "border-primary/20 bg-primary/[0.06] shadow-xs",
								)}
								onClick={() => onSelect(table.id)}
								onContextMenu={(event) => handleTableContextMenu(table.id, event)}
							>
								<span
									className={cn(
										"flex size-7 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background text-muted-foreground",
										active && "border-primary/15 bg-primary/10 text-primary",
									)}
								>
									<Table2 className="size-3.5" />
								</span>
								<span className="block min-w-0 flex-1 overflow-hidden">
									<span className="flex min-w-0 items-center gap-2">
										<SmartTooltip
											elementType="span"
											placement="right"
											sideOffset={8}
											content={displayName}
											className={cn(
												"block min-w-0 truncate text-sm font-medium text-foreground",
												active && "font-semibold",
											)}
										>
											{displayName}
										</SmartTooltip>
										{table.status && table.status !== "enabled" ? (
											<Badge
												variant="outline"
												className="shrink-0 rounded-md"
											>
												{table.status}
											</Badge>
										) : null}
									</span>
									{tableName && tableName !== displayName ? (
										<SmartTooltip
											elementType="span"
											placement="right"
											sideOffset={8}
											content={tableName}
											className="mt-0.5 block truncate text-xs leading-4 text-muted-foreground"
										>
											{tableName}
										</SmartTooltip>
									) : null}
								</span>
							</button>
						)
					})}
				</div>
			</ScrollArea>
			{contextMenu && canManagePermissions ? (
				<div
					ref={menuRef}
					role="menu"
					className="fixed z-[1201] min-w-40 overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
					style={{ left: contextMenu.x, top: contextMenu.y }}
					onContextMenu={(event) => event.preventDefault()}
					onMouseDown={(event) => event.stopPropagation()}
				>
					<button
						type="button"
						role="menuitem"
						className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground"
						onClick={() => {
							onSelect(contextMenu.tableId)
							onOpenTablePermissions?.(contextMenu.tableId)
							closeContextMenu()
						}}
					>
						{t("microAppPage.databasePanel.contextMenu.tablePermission")}
					</button>
				</div>
			) : null}
		</aside>
	)
}
