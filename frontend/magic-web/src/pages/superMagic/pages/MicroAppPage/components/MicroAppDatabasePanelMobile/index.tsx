import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { ArrowLeft, Database, RefreshCw, X } from "lucide-react"
import useSWR from "swr"

import { MagicBaseApi } from "@/apis"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { Button } from "@/components/shadcn-ui/button"

import MobileDatabaseTableDetail from "./MobileDatabaseTableDetail"
import MobileDatabaseTableList from "./MobileDatabaseTableList"
import { getMagicBaseTableDisplayName, getMagicBaseTableName } from "../MicroAppDatabasePanel/utils"

interface MicroAppDatabasePanelMobileProps {
	open: boolean
	projectId?: string
	projectName?: string
	onOpenChange: (open: boolean) => void
}

/**
 * 移动端数据库使用底部双层弹层：先选择数据表，再进入表详情。
 * 该组件只共享 MagicBase API，不复用桌面端左右分栏组件。
 */
export default function MicroAppDatabasePanelMobile({
	open,
	projectId,
	projectName,
	onOpenChange,
}: MicroAppDatabasePanelMobileProps) {
	const { t } = useTranslation("super")
	const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
	const {
		data: tables = [],
		error,
		isLoading,
		mutate: refreshTables,
	} = useSWR(
		open && projectId ? ["magicbase-mobile", "tables", projectId] : null,
		([, , currentProjectId]) => MagicBaseApi.getTables(currentProjectId),
	)
	const selectedTable = tables.find((table) => table.id === selectedTableId)

	useEffect(() => {
		if (open) setSelectedTableId(null)
	}, [open])

	const handleClose = () => onOpenChange(false)
	const title = selectedTable
		? getMagicBaseTableDisplayName(selectedTable)
		: t("microAppPage.databasePanel.title")
	const subtitle = selectedTable
		? getMagicBaseTableName(selectedTable) !== title
			? getMagicBaseTableName(selectedTable)
			: ""
		: projectName || ""

	return (
		<MagicPopup
			visible={open}
			position="bottom"
			onClose={handleClose}
			hideDefaultHandle
			title={t("microAppPage.databasePanel.title")}
			bodyClassName="h-[90dvh] max-h-[90dvh] overflow-hidden rounded-t-[20px] border-0 bg-mobile-background p-0"
		>
			<div className="flex h-full min-h-0 flex-col">
				<header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
					{selectedTableId ? (
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="size-9 shrink-0"
							onClick={() => setSelectedTableId(null)}
							aria-label={t("microAppPage.mobileDatabase.backToTables")}
						>
							<ArrowLeft className="size-[18px]" aria-hidden />
						</Button>
					) : (
						<div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<Database className="size-[18px]" aria-hidden />
						</div>
					)}

					<div className="min-w-0 flex-1">
						<p className="truncate text-base font-medium text-foreground">{title}</p>
						{subtitle ? (
							<p className="truncate text-xs text-muted-foreground">{subtitle}</p>
						) : null}
					</div>

					{!selectedTableId ? (
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="size-9 shrink-0"
							onClick={() => void refreshTables()}
							disabled={!projectId || isLoading}
							aria-label={t("microAppPage.databasePanel.refresh")}
						>
							<RefreshCw className="size-4" aria-hidden />
						</Button>
					) : null}
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-9 shrink-0"
						onClick={handleClose}
						aria-label={t("common.close")}
					>
						<X className="size-[18px]" aria-hidden />
					</Button>
				</header>

				{selectedTableId && projectId ? (
					<MobileDatabaseTableDetail projectId={projectId} tableId={selectedTableId} />
				) : (
					<MobileDatabaseTableList
						tables={tables}
						loading={isLoading}
						error={error}
						onSelect={setSelectedTableId}
						onRetry={() => void refreshTables()}
					/>
				)}
			</div>
		</MagicPopup>
	)
}
