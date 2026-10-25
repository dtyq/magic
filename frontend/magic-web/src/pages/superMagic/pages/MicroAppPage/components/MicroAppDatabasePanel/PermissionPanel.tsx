import { Loader2, Settings2, UsersRound } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { ContactApi } from "@/apis"
import type {
	MagicBaseColumn,
	MagicBasePermissionsResponse,
	MagicBaseTable,
} from "@/apis/modules/magicBase"
import MagicAvatar from "@/components/base/MagicAvatar"
import { Badge } from "@/components/shadcn-ui/badge"
import { ScrollArea, ScrollBar } from "@/components/shadcn-ui/scroll-area"
import { cn } from "@/utils/cn"
import { STATIC_DATABASE_PERMISSIONS_ENABLED } from "../databasePermissionFeatures"
import DynamicPermissionPanel from "./DynamicPermissionPanel"

interface PermissionPanelProps {
	projectId: string
	table: MagicBaseTable
	permissions?: MagicBasePermissionsResponse
	loading?: boolean
	columns: MagicBaseColumn[]
	canManagePermissions?: boolean
	onRefreshPermissions: () => void
	onRefreshTable: () => void
	onDirtyChange?: (dirty: boolean) => void
}

type AssignableSubjectType = "user" | "department"

interface SubjectProfile {
	key: string
	type: AssignableSubjectType
	id: string
	name: string
}

interface GroupedPermissionTag {
	key: string
	label: string
}

interface GroupedPermissionRow {
	key: string
	subjectType: AssignableSubjectType
	subjectId: string
	name: string
	tags: GroupedPermissionTag[]
}

function matchesSubject(permission: { subject_type: string }) {
	return permission.subject_type === "user" || permission.subject_type === "department"
}

function getAvatarText(name: string, fallback: string): string {
	const text = (name || fallback || "").trim()
	return Array.from(text).slice(-2).join("").toUpperCase() || "-"
}

function addUniqueTag(tags: GroupedPermissionTag[], tag: GroupedPermissionTag | false | undefined) {
	if (!tag || tags.some((item) => item.key === tag.key)) return
	tags.push(tag)
}

function StaticPermissionPanel({ permissions, loading, columns }: PermissionPanelProps) {
	const { t } = useTranslation("super")
	const [subjectProfiles, setSubjectProfiles] = useState<Record<string, SubjectProfile>>({})
	const dynamicColumns = useMemo(
		() => columns.filter((column) => column.source !== "system" && column.id),
		[columns],
	)

	const subjectLookup = useMemo(() => {
		const users = new Set<string>()
		const departments = new Set<string>()
		const collect = (permission: { subject_type: string; subject_id: string }) => {
			if (!matchesSubject(permission) || !permission.subject_id) return
			if (permission.subject_type === "user") users.add(permission.subject_id)
			if (permission.subject_type === "department") departments.add(permission.subject_id)
		}

		;(permissions?.table_permissions || []).forEach(collect)
		;(permissions?.column_permissions || []).forEach(collect)
		;(permissions?.row_permissions || []).forEach(collect)

		const userIds = Array.from(users).sort()
		const departmentIds = Array.from(departments).sort()
		return {
			key: [
				...userIds.map((id) => `user:${id}`),
				...departmentIds.map((id) => `department:${id}`),
			].join("|"),
			users: userIds,
			departments: departmentIds,
		}
	}, [permissions])

	useEffect(() => {
		if (!subjectLookup.key) {
			setSubjectProfiles({})
			return
		}

		let cancelled = false

		const loadSubjectProfiles = async () => {
			const nextProfiles: Record<string, SubjectProfile> = {}

			if (subjectLookup.users.length) {
				try {
					const userResult = await ContactApi.getUsersInfo({
						user_ids: subjectLookup.users,
						query_type: 2,
					})
					;(userResult.items || []).forEach((user) => {
						const id = user.user_id
						if (!id) return
						nextProfiles[`user:${id}`] = {
							key: `user:${id}`,
							type: "user",
							id,
							name: user.real_name || user.nickname || id,
						}
					})
				} catch (error) {
					console.error("Failed to load MagicBase permission users", error)
				}
			}

			if (subjectLookup.departments.length) {
				const departmentResults = await Promise.allSettled(
					subjectLookup.departments.map((departmentId) =>
						ContactApi.getDepartmentInfo({ department_id: departmentId }),
					),
				)
				departmentResults.forEach((result, index) => {
					const id = subjectLookup.departments[index]
					if (result.status !== "fulfilled") return
					nextProfiles[`department:${id}`] = {
						key: `department:${id}`,
						type: "department",
						id,
						name: result.value.name || result.value.i18n_name || id,
					}
				})
			}

			if (!cancelled) {
				setSubjectProfiles(nextProfiles)
			}
		}

		void loadSubjectProfiles()

		return () => {
			cancelled = true
		}
	}, [subjectLookup])

	const permissionRows = useMemo<GroupedPermissionRow[]>(() => {
		const groupMap = new Map<string, GroupedPermissionRow>()

		const getGroup = (subjectType: AssignableSubjectType, subjectId: string) => {
			const key = `${subjectType}:${subjectId}`
			const profile = subjectProfiles[key]
			const existing = groupMap.get(key)
			if (existing) return existing

			const group: GroupedPermissionRow = {
				key,
				subjectType,
				subjectId,
				name:
					profile?.name ||
					t(
						subjectType === "user"
							? "microAppPage.databasePanel.permissionUnknownUser"
							: "microAppPage.databasePanel.permissionUnknownDepartment",
					),
				tags: [],
			}
			groupMap.set(key, group)
			return group
		}

		;(permissions?.table_permissions || []).filter(matchesSubject).forEach((permission) => {
			const group = getGroup(
				permission.subject_type as AssignableSubjectType,
				permission.subject_id,
			)
			addUniqueTag(group.tags, {
				key: `table:${permission.permission_level}`,
				label: `${t("microAppPage.databasePanel.permissionType.table")} · ${t(
					`microAppPage.databasePanel.permissionLevel.${permission.permission_level}`,
				)}`,
			})
		})
		;(permissions?.column_permissions || []).filter(matchesSubject).forEach((permission) => {
			const column = dynamicColumns.find((item) => item.id === permission.column_id)
			const columnName = column?.column_name || column?.column_key || ""
			const group = getGroup(
				permission.subject_type as AssignableSubjectType,
				permission.subject_id,
			)
			addUniqueTag(
				group.tags,
				permission.can_read && {
					key: `column:${permission.column_id}:read`,
					label: [
						t("microAppPage.databasePanel.permissionType.column"),
						columnName,
						t("microAppPage.databasePanel.permissionAction.read"),
					]
						.filter(Boolean)
						.join(" · "),
				},
			)
			addUniqueTag(
				group.tags,
				permission.can_edit && {
					key: `column:${permission.column_id}:edit`,
					label: [
						t("microAppPage.databasePanel.permissionType.column"),
						columnName,
						t("microAppPage.databasePanel.permissionAction.edit"),
					]
						.filter(Boolean)
						.join(" · "),
				},
			)
		})
		;(permissions?.row_permissions || []).filter(matchesSubject).forEach((permission) => {
			const group = getGroup(
				permission.subject_type as AssignableSubjectType,
				permission.subject_id,
			)
			addUniqueTag(
				group.tags,
				permission.can_read && {
					key: "row:read",
					label: `${t("microAppPage.databasePanel.permissionType.row")} · ${t(
						"microAppPage.databasePanel.permissionAction.read",
					)}`,
				},
			)
			addUniqueTag(
				group.tags,
				permission.can_edit && {
					key: "row:edit",
					label: `${t("microAppPage.databasePanel.permissionType.row")} · ${t(
						"microAppPage.databasePanel.permissionAction.edit",
					)}`,
				},
			)
			addUniqueTag(
				group.tags,
				permission.can_delete && {
					key: "row:delete",
					label: `${t("microAppPage.databasePanel.permissionType.row")} · ${t(
						"microAppPage.databasePanel.permissionAction.delete",
					)}`,
				},
			)
		})

		return Array.from(groupMap.values()).sort((a, b) => {
			if (a.subjectType !== b.subjectType) return a.subjectType === "user" ? -1 : 1
			return a.name.localeCompare(b.name)
		})
	}, [dynamicColumns, permissions, subjectProfiles, t])

	const renderSubjectAvatar = (row: GroupedPermissionRow) => (
		<MagicAvatar
			size={32}
			radius={6}
			className={cn(
				"shrink-0",
				row.subjectType === "department" && "ring-1 ring-emerald-500/20",
			)}
		>
			{getAvatarText(row.name, row.subjectId)}
		</MagicAvatar>
	)

	const renderPermissionRow = (row: GroupedPermissionRow) => {
		return (
			<div
				key={row.key}
				className="grid grid-cols-[minmax(180px,240px)_1fr] items-center gap-3 border-b border-border px-3 py-2 text-xs"
			>
				<div className="flex min-w-0 items-center gap-3">
					{renderSubjectAvatar(row)}
					<div className="min-w-0">
						<div className="truncate text-sm text-foreground">{row.name}</div>
						<div className="mt-0.5 text-xs text-muted-foreground">
							{t(`microAppPage.databasePanel.subjectType.${row.subjectType}`)}
						</div>
					</div>
				</div>
				<div className="flex min-w-0 flex-wrap gap-1.5">
					{row.tags.map((tag) => (
						<Badge
							key={tag.key}
							variant="outline"
							className="max-w-full rounded-md font-normal"
						>
							<span className="truncate">{tag.label}</span>
						</Badge>
					))}
				</div>
			</div>
		)
	}

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex items-center justify-between border-b border-border px-4 py-2">
				<span className="text-xs text-muted-foreground">
					{t("microAppPage.databasePanel.permissionExisting")}
				</span>
			</div>

			<ScrollArea className="min-h-0 flex-1">
				{loading ? (
					<div className="flex h-32 items-center justify-center gap-2 text-xs text-muted-foreground">
						<Loader2 className="size-3.5 animate-spin" />
						{t("microAppPage.databasePanel.loading")}
					</div>
				) : (
					<div>
						{permissionRows.map(renderPermissionRow)}
						{permissionRows.length === 0 ? (
							<div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
								{t("microAppPage.databasePanel.permissionEmptyList")}
							</div>
						) : null}
					</div>
				)}
				<ScrollBar orientation="horizontal" />
			</ScrollArea>
		</div>
	)
}

export default function PermissionPanel(props: PermissionPanelProps) {
	const { t } = useTranslation("super")
	const [view, setView] = useState<"dynamic" | "static">("dynamic")

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
				<div className="inline-flex h-8 items-center rounded-md bg-muted p-[3px]">
					<button
						type="button"
						className={cn(
							"inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-xs text-muted-foreground transition-colors",
							view === "dynamic" && "bg-background text-foreground shadow-sm",
						)}
						onClick={() => setView("dynamic")}
					>
						<Settings2 className="size-3.5" />
						{t("microAppPage.databasePanel.dynamicPermissions")}
					</button>
					{STATIC_DATABASE_PERMISSIONS_ENABLED ? (
						<button
							type="button"
							className={cn(
								"inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-xs text-muted-foreground transition-colors",
								view === "static" && "bg-background text-foreground shadow-sm",
							)}
							onClick={() => setView("static")}
						>
							<UsersRound className="size-3.5" />
							{t("microAppPage.databasePanel.staticPermissions")}
						</button>
					) : null}
				</div>
				<span className="text-xs text-muted-foreground">
					{view === "dynamic"
						? t("microAppPage.databasePanel.dynamicPermissionsHint")
						: t("microAppPage.databasePanel.staticPermissionsHint")}
				</span>
			</div>

			<div className="min-h-0 flex-1">
				{view === "dynamic" || !STATIC_DATABASE_PERMISSIONS_ENABLED ? (
					<DynamicPermissionPanel
						projectId={props.projectId}
						table={props.table}
						columns={props.columns}
						canManagePermissions={props.canManagePermissions ?? true}
						onUpdated={props.onRefreshTable}
						onDirtyChange={props.onDirtyChange}
					/>
				) : (
					<StaticPermissionPanel {...props} />
				)}
			</div>
		</div>
	)
}
