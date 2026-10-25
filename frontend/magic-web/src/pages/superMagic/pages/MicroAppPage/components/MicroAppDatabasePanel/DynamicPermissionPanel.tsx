import {
	Columns3,
	DatabaseZap,
	Info,
	Loader2,
	LockKeyhole,
	Rows3,
	Save,
	ShieldCheck,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { MagicBaseApi } from "@/apis"
import type {
	MagicBaseColumn,
	MagicBaseDynamicPermissions,
	MagicBasePermissionScope,
	MagicBaseTable,
} from "@/apis/modules/magicBase"
import { Badge } from "@/components/shadcn-ui/badge"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/shadcn-ui/select"
import { cn } from "@/utils/cn"

type PermissionScope = "public" | "private_user" | "private_department" | "private_org" | "disabled"

interface DynamicPermissionPanelProps {
	projectId: string
	table: MagicBaseTable
	columns: MagicBaseColumn[]
	canManagePermissions: boolean
	onUpdated: () => void
	onDirtyChange?: (dirty: boolean) => void
}

const PERMISSION_SCOPES: PermissionScope[] = [
	"public",
	"private_user",
	"private_department",
	"private_org",
	"disabled",
]

function normalizeScope(value?: string, fallback: PermissionScope = "public"): PermissionScope {
	return PERMISSION_SCOPES.includes(value as PermissionScope)
		? (value as PermissionScope)
		: fallback
}

function buildDraft(
	table: MagicBaseTable,
	columns: MagicBaseColumn[],
): Required<MagicBaseDynamicPermissions> {
	const tableColumns = table.dynamic_permissions?.columns || {}
	return {
		table: {
			read_scope: normalizeScope(table.dynamic_permissions?.table?.read_scope),
			insert_scope: normalizeScope(
				table.dynamic_permissions?.table?.insert_scope,
				"disabled",
			),
		},
		row: {
			read_scope: normalizeScope(table.dynamic_permissions?.row?.read_scope),
			edit_scope: normalizeScope(table.dynamic_permissions?.row?.edit_scope, "private_user"),
			delete_scope: normalizeScope(
				table.dynamic_permissions?.row?.delete_scope,
				"private_user",
			),
		},
		columns: Object.fromEntries(
			columns
				.filter((column) => column.source !== "system")
				.map((column) => [
					column.column_key,
					{
						read_scope: normalizeScope(
							tableColumns[column.column_key]?.read_scope ||
								column.dynamic_permission?.read_scope,
						),
						edit_scope: normalizeScope(
							tableColumns[column.column_key]?.edit_scope ||
								column.dynamic_permission?.edit_scope,
							"private_user",
						),
					},
				]),
		),
	}
}

function scopeBadgeClass(scope: PermissionScope): string {
	return {
		public: "border-emerald-200 bg-emerald-50 text-emerald-700",
		private_user: "border-blue-200 bg-blue-50 text-blue-700",
		private_department: "border-cyan-200 bg-cyan-50 text-cyan-700",
		private_org: "border-amber-200 bg-amber-50 text-amber-700",
		disabled: "border-rose-200 bg-rose-50 text-rose-700",
	}[scope]
}

function ScopeControl({
	value,
	editable,
	onChange,
}: {
	value: PermissionScope
	editable: boolean
	onChange: (scope: PermissionScope) => void
}) {
	const { t } = useTranslation("super")
	if (!editable) {
		return (
			<Badge
				variant="outline"
				className={cn("max-w-full rounded-md font-normal", scopeBadgeClass(value))}
			>
				{t(`microAppPage.databasePanel.dynamicScope.${value}`)}
			</Badge>
		)
	}

	return (
		<Select value={value} onValueChange={(nextValue) => onChange(nextValue as PermissionScope)}>
			<SelectTrigger size="sm" className="w-full max-w-[180px]">
				<SelectValue />
			</SelectTrigger>
			<SelectContent align="end">
				{PERMISSION_SCOPES.map((scope) => (
					<SelectItem key={scope} value={scope}>
						{t(`microAppPage.databasePanel.dynamicScope.${scope}`)}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	)
}

function PermissionLine({
	label,
	description,
	value,
	editable,
	onChange,
}: {
	label: string
	description: string
	value: PermissionScope
	editable: boolean
	onChange: (scope: PermissionScope) => void
}) {
	return (
		<div className="flex min-h-14 items-center justify-between gap-4 border-b border-border/70 px-4 py-2 last:border-b-0">
			<div className="min-w-0">
				<div className="text-sm font-medium text-foreground">{label}</div>
				<div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
			</div>
			<ScopeControl value={value} editable={editable} onChange={onChange} />
		</div>
	)
}

export default function DynamicPermissionPanel({
	projectId,
	table,
	columns,
	canManagePermissions,
	onUpdated,
	onDirtyChange,
}: DynamicPermissionPanelProps) {
	const { t } = useTranslation("super")
	const dynamicColumns = useMemo(
		() => columns.filter((column) => column.source !== "system"),
		[columns],
	)
	const systemColumnCount = columns.length - dynamicColumns.length
	const [saving, setSaving] = useState(false)
	const sourceDraft = useMemo(() => buildDraft(table, columns), [columns, table])
	const [savedDraft, setSavedDraft] = useState(sourceDraft)
	const [draft, setDraft] = useState(sourceDraft)
	const draftTableIdRef = useRef(table.id)
	const isDirty = useMemo(
		() => JSON.stringify(draft) !== JSON.stringify(savedDraft),
		[draft, savedDraft],
	)
	const isDirtyRef = useRef(isDirty)
	isDirtyRef.current = isDirty

	useEffect(() => {
		const tableChanged = draftTableIdRef.current !== table.id
		if (!tableChanged && isDirtyRef.current) return

		draftTableIdRef.current = table.id
		setSavedDraft(sourceDraft)
		setDraft(sourceDraft)
	}, [sourceDraft, table.id])

	useEffect(() => {
		onDirtyChange?.(isDirty)
	}, [isDirty, onDirtyChange])

	useEffect(
		() => () => {
			onDirtyChange?.(false)
		},
		[onDirtyChange],
	)

	const setTableScope = (key: keyof MagicBasePermissionScope, scope: PermissionScope) => {
		setDraft((current) => ({
			...current,
			table: { ...current.table, [key]: scope },
		}))
	}

	const setRowScope = (key: keyof MagicBasePermissionScope, scope: PermissionScope) => {
		setDraft((current) => ({
			...current,
			row: { ...current.row, [key]: scope },
		}))
	}

	const setColumnScope = (
		columnKey: string,
		key: "read_scope" | "edit_scope",
		scope: PermissionScope,
	) => {
		setDraft((current) => ({
			...current,
			columns: {
				...current.columns,
				[columnKey]: { ...current.columns[columnKey], [key]: scope },
			},
		}))
	}

	const handleSave = async () => {
		if (!isDirty) return
		setSaving(true)
		try {
			await MagicBaseApi.updateDynamicPermissions(projectId, table.id, {
				dynamic_permissions: draft,
			})
			setSavedDraft(draft)
			toast.success(t("microAppPage.databasePanel.dynamicSaveSuccess"))
			onUpdated()
		} catch (error) {
			console.error("Failed to update MagicBase dynamic permissions", error)
			toast.error(t("microAppPage.databasePanel.dynamicSaveFailed"))
		} finally {
			setSaving(false)
		}
	}

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="border-b border-border px-4 py-3">
				<div className="flex items-center justify-between gap-3">
					<div className="flex min-w-0 items-center gap-3">
						<div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700">
							<ShieldCheck className="size-4" />
						</div>
						<h4 className="truncate text-sm font-medium text-foreground">
							{t("microAppPage.databasePanel.dynamicTitle")}
						</h4>
					</div>
					{canManagePermissions && isDirty ? (
						<Button
							size="sm"
							className="shrink-0 gap-1.5"
							disabled={saving}
							onClick={handleSave}
						>
							{saving ? (
								<Loader2 className="size-3.5 animate-spin" />
							) : (
								<Save className="size-3.5" />
							)}
							{t("microAppPage.databasePanel.dynamicSave")}
						</Button>
					) : null}
				</div>
				<p className="mt-2 pl-12 text-xs leading-5 text-muted-foreground">
					{t("microAppPage.databasePanel.dynamicDescription")}
				</p>
			</div>

			<div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50/70 px-4 py-2 text-xs leading-5 text-amber-800">
				<Info className="mt-0.5 size-3.5 shrink-0" />
				<span className="min-w-0">
					{t("microAppPage.databasePanel.dynamicAdminNotice")}
				</span>
			</div>

			<ScrollArea className="min-h-0 flex-1">
				<section className="border-b border-border">
					<div className="flex items-center gap-2 bg-muted/40 px-4 py-2">
						<DatabaseZap className="size-4 text-muted-foreground" />
						<h5 className="text-xs font-medium text-foreground">
							{t("microAppPage.databasePanel.dynamicTableSection")}
						</h5>
					</div>
					<PermissionLine
						label={t("microAppPage.databasePanel.dynamicAction.tableRead")}
						description={t(
							"microAppPage.databasePanel.dynamicAction.tableReadDescription",
						)}
						value={normalizeScope(draft.table.read_scope)}
						editable={canManagePermissions}
						onChange={(scope) => setTableScope("read_scope", scope)}
					/>
					<PermissionLine
						label={t("microAppPage.databasePanel.dynamicAction.tableInsert")}
						description={t(
							"microAppPage.databasePanel.dynamicAction.tableInsertDescription",
						)}
						value={normalizeScope(draft.table.insert_scope)}
						editable={canManagePermissions}
						onChange={(scope) => setTableScope("insert_scope", scope)}
					/>
				</section>

				<section className="border-b border-border">
					<div className="flex items-center gap-2 bg-muted/40 px-4 py-2">
						<Rows3 className="size-4 text-muted-foreground" />
						<h5 className="text-xs font-medium text-foreground">
							{t("microAppPage.databasePanel.dynamicRowSection")}
						</h5>
					</div>
					{(["read", "edit", "delete"] as const).map((action) => (
						<PermissionLine
							key={action}
							label={t(
								`microAppPage.databasePanel.dynamicAction.row${action[0].toUpperCase()}${action.slice(1)}`,
							)}
							description={t(
								`microAppPage.databasePanel.dynamicAction.row${action[0].toUpperCase()}${action.slice(1)}Description`,
							)}
							value={normalizeScope(draft.row[`${action}_scope`])}
							editable={canManagePermissions}
							onChange={(scope) => setRowScope(`${action}_scope`, scope)}
						/>
					))}
				</section>

				<section>
					<div className="flex items-center justify-between gap-3 bg-muted/40 px-4 py-2">
						<div className="flex items-center gap-2">
							<Columns3 className="size-4 text-muted-foreground" />
							<h5 className="text-xs font-medium text-foreground">
								{t("microAppPage.databasePanel.dynamicColumnSection")}
							</h5>
						</div>
						<span className="text-xs text-muted-foreground">
							{t("microAppPage.databasePanel.dynamicColumnCount", {
								total: dynamicColumns.length,
							})}
						</span>
					</div>
					<div
						className="divide-y divide-border/70"
						data-testid="magicbase-dynamic-column-list"
					>
						{dynamicColumns.map((column) => {
							const permission = draft.columns[column.column_key] || {}
							return (
								<div key={column.id || column.column_key} className="px-4 py-3">
									<div className="min-w-0">
										<div className="truncate text-sm font-medium text-foreground">
											{column.column_name}
										</div>
										<div className="truncate font-mono text-xs text-muted-foreground">
											{column.column_key}
										</div>
									</div>
									<div className="mt-3 grid grid-cols-2 gap-3">
										<div className="min-w-0">
											<div className="mb-1.5 text-xs text-muted-foreground">
												{t(
													"microAppPage.databasePanel.permissionAction.read",
												)}
											</div>
											<ScopeControl
												value={normalizeScope(permission.read_scope)}
												editable={canManagePermissions}
												onChange={(scope) =>
													setColumnScope(
														column.column_key,
														"read_scope",
														scope,
													)
												}
											/>
										</div>
										<div className="min-w-0">
											<div className="mb-1.5 text-xs text-muted-foreground">
												{t(
													"microAppPage.databasePanel.permissionAction.edit",
												)}
											</div>
											<ScopeControl
												value={normalizeScope(permission.edit_scope)}
												editable={canManagePermissions}
												onChange={(scope) =>
													setColumnScope(
														column.column_key,
														"edit_scope",
														scope,
													)
												}
											/>
										</div>
									</div>
								</div>
							)
						})}
					</div>
					{systemColumnCount > 0 ? (
						<div className="flex items-center gap-2 border-t border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
							<LockKeyhole className="size-3.5" />
							{t("microAppPage.databasePanel.dynamicSystemFields", {
								total: systemColumnCount,
							})}
						</div>
					) : null}
				</section>
			</ScrollArea>
		</div>
	)
}
