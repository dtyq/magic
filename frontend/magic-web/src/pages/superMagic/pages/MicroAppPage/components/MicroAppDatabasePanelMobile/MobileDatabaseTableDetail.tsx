import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import useSWR from "swr"

import { MagicBaseApi } from "@/apis"
import type {
	MagicBaseColumn,
	MagicBasePermissionsResponse,
	MagicBaseRow,
} from "@/apis/modules/magicBase"
import { Badge } from "@/components/shadcn-ui/badge"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"

import {
	MAGIC_BASE_PAGE_SIZE,
	buildMagicBaseRowsRequest,
	formatCellValue,
	getDefaultSort,
	getDisplayColumns,
} from "../MicroAppDatabasePanel/utils"
import { STATIC_DATABASE_PERMISSIONS_ENABLED } from "../databasePermissionFeatures"

type MobileDatabaseTab = "data" | "structure" | "permissions"

interface MobileDatabaseTableDetailProps {
	projectId: string
	tableId: string
}

function MobileDatabaseTabs({
	value,
	onChange,
}: {
	value: MobileDatabaseTab
	onChange: (value: MobileDatabaseTab) => void
}) {
	const { t } = useTranslation("super")
	return (
		<div
			className={cn(
				"grid shrink-0 rounded-xl bg-muted p-1",
				STATIC_DATABASE_PERMISSIONS_ENABLED ? "grid-cols-3" : "grid-cols-2",
			)}
			role="tablist"
		>
			{(
				[
					["data", t("microAppPage.databasePanel.dataTab")],
					["structure", t("microAppPage.databasePanel.structureTab")],
					...(STATIC_DATABASE_PERMISSIONS_ENABLED
						? [["permissions", t("microAppPage.databasePanel.permissionsTab")] as const]
						: []),
				] as const
			).map(([key, label]) => (
				<button
					key={key}
					type="button"
					role="tab"
					aria-selected={value === key}
					className={cn(
						"h-8 rounded-lg px-2 text-xs text-muted-foreground",
						value === key && "bg-background font-medium text-foreground shadow-sm",
					)}
					onClick={() => onChange(key)}
				>
					{label}
				</button>
			))}
		</div>
	)
}

function MobileDatabaseRows({
	rows,
	columns,
}: {
	rows: MagicBaseRow[]
	columns: MagicBaseColumn[]
}) {
	const { t } = useTranslation("super")
	const businessColumns = columns.filter((column) => column.source !== "system").slice(0, 4)
	const visibleColumns = businessColumns.length > 0 ? businessColumns : columns.slice(0, 4)

	if (rows.length === 0) {
		return (
			<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
				{t("microAppPage.databasePanel.noRows")}
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-2">
			{rows.map((row, index) => (
				<div
					key={String(row.id ?? index)}
					className="rounded-xl border border-border bg-background p-3"
				>
					{visibleColumns.map((column) => (
						<div
							key={column.id || column.column_key}
							className="flex min-w-0 items-start justify-between gap-4 py-1"
						>
							<span className="shrink-0 text-xs text-muted-foreground">
								{column.column_name || column.column_key}
							</span>
							<span className="min-w-0 break-all text-right text-sm text-foreground">
								{formatCellValue(row[column.column_key])}
							</span>
						</div>
					))}
				</div>
			))}
		</div>
	)
}

function MobileDatabaseStructure({ columns }: { columns: MagicBaseColumn[] }) {
	const { t } = useTranslation("super")
	if (columns.length === 0) {
		return (
			<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
				{t("microAppPage.databasePanel.noColumns")}
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-2">
			{columns.map((column) => (
				<div
					key={column.id || column.column_key}
					className="rounded-xl border border-border bg-background p-3"
				>
					<div className="flex min-w-0 items-center justify-between gap-3">
						<div className="min-w-0">
							<p className="truncate text-sm font-medium text-foreground">
								{column.column_name || column.column_key}
							</p>
							<p className="truncate font-mono text-xs text-muted-foreground">
								{column.column_key}
							</p>
						</div>
						<Badge variant="outline" className="shrink-0 rounded-md">
							{column.data_type}
						</Badge>
					</div>
					<div className="mt-2 flex flex-wrap gap-1.5">
						<Badge variant={column.source === "system" ? "secondary" : "outline"}>
							{column.source === "system"
								? t("microAppPage.databasePanel.systemField")
								: t("microAppPage.databasePanel.schemaField")}
						</Badge>
						{column.is_required ? (
							<Badge variant="outline">
								{t("microAppPage.databasePanel.required")}
							</Badge>
						) : null}
					</div>
				</div>
			))}
		</div>
	)
}

function MobileDatabasePermissions({
	permissions,
}: {
	permissions?: MagicBasePermissionsResponse
}) {
	const { t } = useTranslation("super")
	const groups = [
		{
			key: "table",
			label: t("microAppPage.databasePanel.permissionType.table"),
			count: permissions?.table_permissions.length || 0,
		},
		{
			key: "column",
			label: t("microAppPage.databasePanel.permissionType.column"),
			count: permissions?.column_permissions.length || 0,
		},
		{
			key: "row",
			label: t("microAppPage.databasePanel.permissionType.row"),
			count: permissions?.row_permissions.length || 0,
		},
	]

	return (
		<div className="flex flex-col gap-3">
			<div className="grid grid-cols-3 gap-2">
				{groups.map((group) => (
					<div
						key={group.key}
						className="rounded-xl border border-border bg-background p-3"
					>
						<p className="text-xs text-muted-foreground">{group.label}</p>
						<p className="mt-1 text-xl font-semibold text-foreground">{group.count}</p>
					</div>
				))}
			</div>
			<p className="rounded-xl bg-muted px-3 py-2 text-xs leading-5 text-muted-foreground">
				{t("microAppPage.mobileDatabase.readOnlyHint")}
			</p>
		</div>
	)
}

export default function MobileDatabaseTableDetail({
	projectId,
	tableId,
}: MobileDatabaseTableDetailProps) {
	const { t } = useTranslation("super")
	const [activeTab, setActiveTab] = useState<MobileDatabaseTab>("data")
	const [page, setPage] = useState(1)

	useEffect(() => {
		setActiveTab("data")
		setPage(1)
	}, [tableId])

	const {
		data: table,
		error: tableError,
		isLoading: tableLoading,
	} = useSWR(
		["magicbase-mobile", "table", projectId, tableId],
		([, , currentProjectId, currentTableId]) =>
			MagicBaseApi.getTable(currentProjectId, currentTableId),
	)
	const rowsRequest = useMemo(
		() => buildMagicBaseRowsRequest({ table, sort: getDefaultSort(), page }),
		[page, table],
	)
	const {
		data: rowsData,
		error: rowsError,
		isLoading: rowsLoading,
	} = useSWR(
		activeTab === "data" && table
			? ["magicbase-mobile", "rows", projectId, tableId, rowsRequest]
			: null,
		([, , currentProjectId, currentTableId, currentRowsRequest]) =>
			MagicBaseApi.queryRows(currentProjectId, currentTableId, currentRowsRequest),
		{ keepPreviousData: true },
	)
	const { data: permissions, isLoading: permissionsLoading } = useSWR(
		STATIC_DATABASE_PERMISSIONS_ENABLED && activeTab === "permissions"
			? ["magicbase-mobile", "permissions", projectId, tableId]
			: null,
		([, , currentProjectId, currentTableId]) =>
			MagicBaseApi.getPermissions(currentProjectId, currentTableId),
	)

	const columns = useMemo(() => getDisplayColumns(table), [table])
	const total = rowsData?.total || 0
	const totalPages = Math.max(1, Math.ceil(total / MAGIC_BASE_PAGE_SIZE))
	const loading = tableLoading || rowsLoading || permissionsLoading
	const error = tableError || rowsError

	return (
		<div className="flex min-h-0 flex-1 flex-col px-3 pb-5">
			<div className="mb-3 shrink-0">
				<MobileDatabaseTabs value={activeTab} onChange={setActiveTab} />
			</div>

			<div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
				{loading ? (
					<div className="flex h-full items-center justify-center">
						<Loader2 className="size-6 animate-spin text-muted-foreground" />
					</div>
				) : null}
				{!loading && error ? (
					<div className="flex h-full items-center justify-center px-6 text-center text-sm text-destructive">
						{activeTab === "data"
							? t("microAppPage.databasePanel.loadRowsFailed")
							: t("microAppPage.databasePanel.loadTableFailed")}
					</div>
				) : null}
				{!loading && !error && activeTab === "data" ? (
					<MobileDatabaseRows rows={rowsData?.list || []} columns={columns} />
				) : null}
				{!loading && !error && activeTab === "structure" ? (
					<MobileDatabaseStructure columns={columns} />
				) : null}
				{STATIC_DATABASE_PERMISSIONS_ENABLED &&
				!loading &&
				!error &&
				activeTab === "permissions" ? (
					<MobileDatabasePermissions permissions={permissions} />
				) : null}
			</div>

			{activeTab === "data" && total > 0 ? (
				<div className="mt-3 flex shrink-0 items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
					<span>{t("microAppPage.databasePanel.pageInfo", { page, totalPages })}</span>
					<div className="flex items-center gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={page <= 1}
							onClick={() => setPage((current) => Math.max(1, current - 1))}
						>
							{t("microAppPage.databasePanel.previous")}
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={page >= totalPages}
							onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
						>
							{t("microAppPage.databasePanel.next")}
						</Button>
					</div>
				</div>
			) : null}
		</div>
	)
}
