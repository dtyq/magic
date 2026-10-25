import { Columns3Cog, ShieldCheck, X } from "lucide-react"
import { useTranslation } from "react-i18next"

import type {
	MagicBaseColumn,
	MagicBasePermissionsResponse,
	MagicBaseTable,
} from "@/apis/modules/magicBase"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea, ScrollBar } from "@/components/shadcn-ui/scroll-area"
import { cn } from "@/utils/cn"
import useResizablePanel from "@/pages/superMagic/hooks/useResizablePanel"
import TopicResizeHandle from "@/pages/superMagic/pages/TopicPage/components/TopicResizeHandle"

import * as layout from "../../layoutConstants"
import PermissionPanel from "./PermissionPanel"
import StructureTable from "./StructureTable"

export type DatabaseSidePanel = "structure" | "permissions"

interface DatabaseSettingsSidePanelProps {
	view: DatabaseSidePanel
	projectId: string
	table: MagicBaseTable
	columns: MagicBaseColumn[]
	permissions?: MagicBasePermissionsResponse
	permissionsLoading: boolean
	canManagePermissions: boolean
	maxWidth: number
	onClose: () => void
	onPermissionDirtyChange: (dirty: boolean) => void
	onRefreshPermissions: () => void
	onRefreshTable: () => void
}

export default function DatabaseSettingsSidePanel({
	view,
	projectId,
	table,
	columns,
	permissions,
	permissionsLoading,
	canManagePermissions,
	maxWidth,
	onClose,
	onPermissionDirtyChange,
	onRefreshPermissions,
	onRefreshTable,
}: DatabaseSettingsSidePanelProps) {
	const { t } = useTranslation("super")
	const isStructure = view === "structure"
	const title = t(
		isStructure
			? "microAppPage.databasePanel.fieldSettings"
			: "microAppPage.databasePanel.accessPermissions",
	)
	const structurePanel = useResizablePanel({
		minWidth: layout.DATABASE_STRUCTURE_PANEL_MIN_PX,
		maxWidth: Math.max(layout.DATABASE_STRUCTURE_PANEL_MIN_PX, maxWidth),
		defaultWidth: layout.DATABASE_STRUCTURE_PANEL_DEFAULT_PX,
		storageKey: layout.MICRO_APP_DATABASE_STRUCTURE_PANEL_STORAGE_KEY,
		direction: "right",
	})
	const permissionPanel = useResizablePanel({
		minWidth: layout.DATABASE_PERMISSION_PANEL_MIN_PX,
		maxWidth: Math.max(layout.DATABASE_PERMISSION_PANEL_MIN_PX, maxWidth),
		defaultWidth: layout.DATABASE_PERMISSION_PANEL_DEFAULT_PX,
		storageKey: layout.MICRO_APP_DATABASE_PERMISSION_PANEL_STORAGE_KEY,
		direction: "right",
	})
	const activePanel = isStructure ? structurePanel : permissionPanel

	return (
		<>
			<div className="flex h-full shrink-0" data-preserve-grid-selection>
				<TopicResizeHandle
					onResizeStart={activePanel.handleResizeStart}
					className={cn(
						"h-full shrink-0",
						activePanel.isDragging && "before:opacity-100",
					)}
				/>
			</div>
			<aside
				className="flex h-full shrink-0 flex-col bg-background shadow-[-8px_0_24px_rgba(15,23,42,0.04)] duration-200 animate-in fade-in slide-in-from-right-4"
				style={{ width: activePanel.width }}
				data-testid="magicbase-settings-side-panel"
				data-preserve-grid-selection
			>
				<header className="flex h-12 shrink-0 items-center justify-between border-b border-border/60 px-4">
					<div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
						{isStructure ? (
							<Columns3Cog className="size-4 text-primary" />
						) : (
							<ShieldCheck className="size-4 text-primary" />
						)}
						<span className="truncate">{title}</span>
					</div>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-8 shrink-0"
						aria-label={t("common.close")}
						onClick={onClose}
					>
						<X className="size-4" />
					</Button>
				</header>

				<div className="min-h-0 flex-1">
					{isStructure ? (
						<ScrollArea className="h-full">
							<StructureTable columns={columns} />
							<ScrollBar orientation="horizontal" />
						</ScrollArea>
					) : (
						<PermissionPanel
							projectId={projectId}
							table={table}
							permissions={permissions}
							loading={permissionsLoading}
							columns={columns}
							canManagePermissions={canManagePermissions}
							onRefreshPermissions={onRefreshPermissions}
							onRefreshTable={onRefreshTable}
							onDirtyChange={onPermissionDirtyChange}
						/>
					)}
				</div>
			</aside>
		</>
	)
}
