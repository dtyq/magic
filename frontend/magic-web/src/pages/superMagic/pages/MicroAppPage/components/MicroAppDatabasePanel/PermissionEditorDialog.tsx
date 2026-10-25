import { NodeType, type TreeNode } from "@dtyq/user-selector"
import { Check, Loader2, ShieldCheck, Users, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ContactApi, MagicBaseApi } from "@/apis"
import type {
	MagicBaseColumnPermission,
	MagicBasePermissionSubjectType,
	MagicBasePermissionsResponse,
	MagicBaseRowPermission,
	MagicBaseTable,
	MagicBaseTablePermission,
	MagicBaseTablePermissionLevel,
} from "@/apis/modules/magicBase"
import MemberDepartmentSelector from "@/components/business/MemberDepartmentSelector"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import MagicAvatar from "@/components/base/MagicAvatar"
import { cn } from "@/utils/cn"
import userInfoStore from "@/stores/userInfo"

export type PermissionEditorMode = "table" | "row" | "column"

export interface PermissionEditorTarget {
	mode: PermissionEditorMode
	rowIds?: string[]
	columnIds?: string[]
	columnKeys?: string[]
}

interface PermissionEditorDialogProps {
	open: boolean
	projectId: string
	table?: MagicBaseTable | null
	target: PermissionEditorTarget | null
	permissions?: MagicBasePermissionsResponse
	onOpenChange: (open: boolean) => void
	onSaved: () => void
}

type AssignableSubjectType = Extract<MagicBasePermissionSubjectType, "user" | "department">

const TABLE_LEVELS: MagicBaseTablePermissionLevel[] = ["read", "insert", "manage"]
const ROW_ACTIONS = ["read", "edit", "delete"] as const
const COLUMN_ACTIONS = ["read", "edit"] as const

interface AssignableSubject {
	key: string
	type: AssignableSubjectType
	id: string
	name: string
}

interface PermissionDraft extends AssignableSubject {
	tableLevels: MagicBaseTablePermissionLevel[]
	canRead: boolean
	canEdit: boolean
	canDelete: boolean
}

interface SubjectProfile {
	key: string
	type: AssignableSubjectType
	id: string
	name: string
}

interface SubjectLookup {
	key: string
	users: string[]
	departments: string[]
}

function getNodeId(node: TreeNode, type: AssignableSubjectType): string {
	if (type === "user" && "user_id" in node) {
		return String((node as TreeNode & { user_id?: string }).user_id || node.id || "")
	}
	if (type === "department" && "department_id" in node) {
		return String(
			(node as TreeNode & { department_id?: string }).department_id || node.id || "",
		)
	}
	return String(node.id || "")
}

function isUserNode(node: TreeNode): boolean {
	return (
		node.dataType === NodeType.User ||
		node.type === "User" ||
		"user_id" in node ||
		"magic_user_id" in node
	)
}

function isDepartmentNode(node: TreeNode): boolean {
	return (
		node.dataType === NodeType.Department ||
		node.type === "Department" ||
		"department_id" in node
	)
}

function getNodeSubjectType(node: TreeNode): AssignableSubjectType | null {
	if (isUserNode(node)) return "user"
	if (isDepartmentNode(node)) return "department"
	return null
}

function getNodeName(node: TreeNode): string {
	const namedNode = node as TreeNode & { nickname?: string; real_name?: string }
	return String(node.name || namedNode.nickname || namedNode.real_name || node.id || "")
}

function getAvatarText(name: string, fallback: string): string {
	const text = (name || fallback || "").trim()
	return Array.from(text).slice(-2).join("").toUpperCase() || "-"
}

function toAssignableSubjects(nodes: TreeNode[]): AssignableSubject[] {
	const subjectMap = new Map<string, AssignableSubject>()

	nodes.forEach((node) => {
		const type = getNodeSubjectType(node)
		if (!type) return

		const id = getNodeId(node, type)
		if (!id) return

		const key = `${type}:${id}`
		if (subjectMap.has(key)) return

		subjectMap.set(key, {
			key,
			type,
			id,
			name: getNodeName(node),
		})
	})

	return Array.from(subjectMap.values())
}

function getTargetCount(target: PermissionEditorTarget | null) {
	if (!target) return 0
	if (target.mode === "row") return target.rowIds?.length || 0
	if (target.mode === "column") return target.columnIds?.length || 0
	return 1
}

function getTargetKey(target: PermissionEditorTarget | null): string {
	if (!target) return ""
	if (target.mode === "row") return `row:${(target.rowIds || []).join(",")}`
	if (target.mode === "column") return `column:${(target.columnIds || []).join(",")}`
	return "table"
}

function matchesSubject(permission: { subject_type: string }) {
	return permission.subject_type === "user" || permission.subject_type === "department"
}

function createDefaultDraft(
	subject: AssignableSubject,
	target: PermissionEditorTarget,
): PermissionDraft {
	return {
		...subject,
		tableLevels: target.mode === "table" ? ["read"] : [],
		canRead: target.mode !== "table",
		canEdit: false,
		canDelete: false,
	}
}

function hasDraftPermission(draft: PermissionDraft, target: PermissionEditorTarget): boolean {
	if (target.mode === "table") return draft.tableLevels.length > 0
	if (target.mode === "column") return draft.canRead || draft.canEdit
	return draft.canRead || draft.canEdit || draft.canDelete
}

function sortDrafts(drafts: PermissionDraft[]): PermissionDraft[] {
	return [...drafts].sort((a, b) => {
		if (a.type !== b.type) return a.type === "user" ? -1 : 1
		return a.name.localeCompare(b.name)
	})
}

export default function PermissionEditorDialog({
	open,
	projectId,
	table,
	target,
	permissions,
	onOpenChange,
	onSaved,
}: PermissionEditorDialogProps) {
	const { t } = useTranslation("super")
	const [permissionDrafts, setPermissionDrafts] = useState<PermissionDraft[]>([])
	const [activeDraftKey, setActiveDraftKey] = useState("")
	const [selectorDraftNodes, setSelectorDraftNodes] = useState<TreeNode[]>([])
	const [selectorOpen, setSelectorOpen] = useState(false)
	const [subjectProfiles, setSubjectProfiles] = useState<Record<string, SubjectProfile>>({})
	const [subjectProfileLookupKey, setSubjectProfileLookupKey] = useState("")
	const [profileLoading, setProfileLoading] = useState(false)
	const [saving, setSaving] = useState(false)

	const targetKey = useMemo(() => getTargetKey(target), [target])

	const subjectLookup = useMemo<SubjectLookup>(() => {
		const users = new Set<string>()
		const departments = new Set<string>()

		const collect = (permission: { subject_type: string; subject_id: string }) => {
			if (!matchesSubject(permission) || !permission.subject_id) return
			if (permission.subject_type === "user") users.add(permission.subject_id)
			if (permission.subject_type === "department") departments.add(permission.subject_id)
		}

		if (target?.mode === "table") {
			;(permissions?.table_permissions || []).forEach(collect)
		} else if (target?.mode === "column") {
			const columnIds = new Set(target.columnIds || [])
			;(permissions?.column_permissions || [])
				.filter((permission) => columnIds.has(permission.column_id))
				.forEach(collect)
		} else if (target?.mode === "row") {
			const rowIds = new Set(target.rowIds || [])
			;(permissions?.row_permissions || [])
				.filter((permission) => rowIds.has(permission.record_id))
				.forEach(collect)
		}

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
	}, [permissions, target])

	const subjectProfilesReady = !subjectLookup.key || subjectProfileLookupKey === subjectLookup.key

	useEffect(() => {
		if (!open || !subjectLookup.key) {
			setSubjectProfiles({})
			setSubjectProfileLookupKey("")
			setProfileLoading(false)
			return
		}

		let cancelled = false

		const loadSubjectProfiles = async () => {
			const nextProfiles: Record<string, SubjectProfile> = {}
			setProfileLoading(true)

			const missingUserIds = subjectLookup.users.filter((userId) => {
				const cachedUser = userInfoStore.get(userId)
				if (!cachedUser) return true
				nextProfiles[`user:${userId}`] = {
					key: `user:${userId}`,
					type: "user",
					id: userId,
					name: cachedUser.real_name || cachedUser.nickname || userId,
				}
				return false
			})

			if (missingUserIds.length) {
				try {
					const userResult = await ContactApi.getUsersInfo({
						user_ids: missingUserIds,
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
				setSubjectProfileLookupKey(subjectLookup.key)
				setProfileLoading(false)
			}
		}

		void loadSubjectProfiles()

		return () => {
			cancelled = true
		}
	}, [open, subjectLookup])

	useEffect(() => {
		if (!open || !target) {
			setPermissionDrafts([])
			setActiveDraftKey("")
			setSelectorDraftNodes([])
			return
		}
		if (!subjectProfilesReady) {
			setPermissionDrafts([])
			setActiveDraftKey("")
			setSelectorDraftNodes([])
			return
		}

		const groupMap = new Map<string, PermissionDraft>()
		const getGroup = (subjectType: AssignableSubjectType, subjectId: string) => {
			const key = `${subjectType}:${subjectId}`
			const profile = subjectProfiles[key]
			const existing = groupMap.get(key)
			if (existing) return existing

			const group: PermissionDraft = {
				key,
				type: subjectType,
				id: subjectId,
				name:
					profile?.name ||
					t(
						subjectType === "user"
							? "microAppPage.databasePanel.permissionUnknownUser"
							: "microAppPage.databasePanel.permissionUnknownDepartment",
					),
				tableLevels: [],
				canRead: false,
				canEdit: false,
				canDelete: false,
			}
			groupMap.set(key, group)
			return group
		}

		if (target.mode === "table") {
			;(permissions?.table_permissions || [])
				.filter(matchesSubject)
				.forEach((permission: MagicBaseTablePermission) => {
					const group = getGroup(
						permission.subject_type as AssignableSubjectType,
						permission.subject_id,
					)
					group.tableLevels = [
						...new Set([...group.tableLevels, permission.permission_level]),
					]
				})
		} else if (target.mode === "column") {
			const columnIds = new Set(target.columnIds || [])
			;(permissions?.column_permissions || [])
				.filter(matchesSubject)
				.filter((permission: MagicBaseColumnPermission) =>
					columnIds.has(permission.column_id),
				)
				.forEach((permission: MagicBaseColumnPermission) => {
					const group = getGroup(
						permission.subject_type as AssignableSubjectType,
						permission.subject_id,
					)
					group.canRead = group.canRead || permission.can_read
					group.canEdit = group.canEdit || permission.can_edit
				})
		} else {
			const rowIds = new Set(target.rowIds || [])
			;(permissions?.row_permissions || [])
				.filter(matchesSubject)
				.filter((permission: MagicBaseRowPermission) => rowIds.has(permission.record_id))
				.forEach((permission: MagicBaseRowPermission) => {
					const group = getGroup(
						permission.subject_type as AssignableSubjectType,
						permission.subject_id,
					)
					group.canRead = group.canRead || permission.can_read
					group.canEdit = group.canEdit || permission.can_edit
					group.canDelete = group.canDelete || permission.can_delete
				})
		}

		const nextDrafts = sortDrafts(Array.from(groupMap.values()))
		setPermissionDrafts(nextDrafts)
		setActiveDraftKey(nextDrafts[0]?.key || "")
		setSelectorDraftNodes([])
	}, [open, permissions, subjectProfiles, subjectProfilesReady, target, targetKey, t])

	useEffect(() => {
		if (!open) return
		setPermissionDrafts((current) =>
			current.map((draft) => {
				const profile = subjectProfiles[draft.key]
				return profile ? { ...draft, name: profile.name } : draft
			}),
		)
	}, [open, subjectProfiles])

	const activeDraft = useMemo(
		() => permissionDrafts.find((draft) => draft.key === activeDraftKey) || null,
		[activeDraftKey, permissionDrafts],
	)
	const preparingProfiles =
		open && Boolean(subjectLookup.key) && (profileLoading || !subjectProfilesReady)

	const updateActiveDraft = (updater: (draft: PermissionDraft) => PermissionDraft) => {
		if (!target) return

		setPermissionDrafts((current) => {
			return current.map((draft) => (draft.key === activeDraftKey ? updater(draft) : draft))
		})
	}

	const handleOpenSelector = () => {
		setSelectorDraftNodes([])
		setSelectorOpen(true)
	}

	const handleSelectorOk = (values: TreeNode[]) => {
		if (!target) return
		const subjects = toAssignableSubjects(values)
		if (subjects.length === 0) {
			toast.error(t("microAppPage.databasePanel.permissionSelectSubjectFailed"))
			return
		}

		setPermissionDrafts((current) => {
			const draftMap = new Map(current.map((draft) => [draft.key, draft]))
			subjects.forEach((subject) => {
				const existing = draftMap.get(subject.key)
				draftMap.set(
					subject.key,
					existing
						? { ...existing, name: subject.name || existing.name }
						: createDefaultDraft(subject, target),
				)
			})
			return sortDrafts(Array.from(draftMap.values()))
		})
		setActiveDraftKey(subjects[0].key)
		setSelectorDraftNodes([])
		setSelectorOpen(false)
	}

	const handleSelectorCancel = () => {
		setSelectorDraftNodes([])
		setSelectorOpen(false)
	}

	const handleRemoveDraft = (key: string) => {
		setPermissionDrafts((current) => {
			const nextDrafts = current.filter((draft) => draft.key !== key)
			if (activeDraftKey === key) {
				setActiveDraftKey(nextDrafts[0]?.key || "")
			}
			return nextDrafts
		})
	}

	const toggleTableLevel = (level: MagicBaseTablePermissionLevel) => {
		updateActiveDraft((draft) => ({
			...draft,
			tableLevels: draft.tableLevels.includes(level)
				? draft.tableLevels.filter((item) => item !== level)
				: [...draft.tableLevels, level],
		}))
	}

	const handleSave = async () => {
		if (!table || !target) return
		if (target.mode === "row" && (target.rowIds || []).length === 0) {
			toast.error(t("microAppPage.databasePanel.permissionEmpty"))
			return
		}
		if (target.mode === "column" && (target.columnIds || []).length === 0) {
			toast.error(t("microAppPage.databasePanel.permissionNoDynamicColumns"))
			return
		}

		const draftsToSave = permissionDrafts.filter((draft) => hasDraftPermission(draft, target))
		const targetIds =
			target.mode === "column"
				? target.columnIds || []
				: target.mode === "row"
					? target.rowIds || []
					: undefined

		setSaving(true)
		try {
			await MagicBaseApi.batchSavePermissions(projectId, table.id, {
				target_type: target.mode,
				...(targetIds ? { target_ids: targetIds } : {}),
				permissions: draftsToSave.map((draft) => ({
					subject_type: draft.type,
					subject_id: draft.id,
					target_type: target.mode,
					table_permissions: target.mode === "table" ? draft.tableLevels : [],
					column_permissions:
						target.mode === "column"
							? [
									{
										column_ids: target.columnIds || [],
										can_read: draft.canRead,
										can_edit: draft.canEdit,
									},
								]
							: [],
					row_permissions:
						target.mode === "row"
							? [
									{
										record_ids: target.rowIds || [],
										can_read: draft.canRead,
										can_edit: draft.canEdit,
										can_delete: draft.canDelete,
									},
								]
							: [],
				})),
			})
			toast.success(t("microAppPage.databasePanel.permissionSaveSuccess"))
			onSaved()
			onOpenChange(false)
		} catch (error) {
			toast.error(t("microAppPage.databasePanel.permissionSaveFailed"))
		} finally {
			setSaving(false)
		}
	}

	const targetCount = getTargetCount(target)
	const titleKey = target
		? `microAppPage.databasePanel.editorTitle.${target.mode}`
		: "microAppPage.databasePanel.permissionSave"

	const getDraftTags = (draft: PermissionDraft) => {
		if (!target) return []
		if (target.mode === "table") {
			return draft.tableLevels.map((level) =>
				t(`microAppPage.databasePanel.permissionLevel.${level}`),
			)
		}
		const actions = target.mode === "row" ? ROW_ACTIONS : COLUMN_ACTIONS
		return actions
			.map((action) => {
				const enabled =
					action === "read"
						? draft.canRead
						: action === "edit"
							? draft.canEdit
							: draft.canDelete
				return enabled ? t(`microAppPage.databasePanel.permissionAction.${action}`) : ""
			})
			.filter(Boolean)
	}

	const renderPermissionButton = (
		key: string,
		label: string,
		checked: boolean,
		onToggle: () => void,
	) => (
		<button
			key={key}
			type="button"
			className={cn(
				"flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors",
				checked
					? "border-primary bg-primary/5 text-foreground"
					: "border-border bg-background hover:bg-muted",
			)}
			onClick={onToggle}
		>
			<span>{label}</span>
			{checked ? <Check className="size-4 text-primary" /> : null}
		</button>
	)

	const renderSubjectAvatar = (type: AssignableSubjectType, name: string, id: string) => (
		<MagicAvatar
			size={32}
			radius={6}
			className={cn("shrink-0", type === "department" && "ring-1 ring-emerald-500/20")}
		>
			{getAvatarText(name, id)}
		</MagicAvatar>
	)

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent
					className="gap-0 overflow-hidden p-0 sm:max-w-[900px]"
					style={{ zIndex: 1302 }}
				>
					<DialogHeader className="border-b border-border px-5 py-4">
						<DialogTitle>{t(titleKey)}</DialogTitle>
						<DialogDescription>
							{t("microAppPage.databasePanel.editorTarget", { total: targetCount })}
						</DialogDescription>
					</DialogHeader>

					<div className="grid h-[540px] grid-cols-[minmax(0,1fr)_450px] bg-muted/20">
						<section className="flex min-h-0 min-w-0 flex-col border-r border-border bg-background">
							<div className="flex items-center justify-between border-b border-border px-5 py-3">
								<div>
									<div className="text-sm font-medium text-foreground">
										{t("microAppPage.databasePanel.permissionCurrent")}
									</div>
									<div className="mt-0.5 text-xs text-muted-foreground">
										{target?.mode === "table"
											? table?.table_name || table?.table_key || "-"
											: t("microAppPage.databasePanel.editorTarget", {
													total: targetCount,
												})}
									</div>
								</div>
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="h-8 shrink-0 gap-1.5 text-xs"
									onClick={handleOpenSelector}
								>
									<Users className="size-3.5" />
									{t("microAppPage.databasePanel.permissionAddSubject")}
								</Button>
							</div>

							{/* Keep subject selection independent from the permission editor and fixed controls. */}
							<ScrollArea
								className="grid min-h-0 flex-1"
								viewportClassName="h-auto min-h-0 px-3 py-2 [&>div]:!block [&>div]:h-full"
							>
								{preparingProfiles ? (
									<div className="flex h-full min-h-48 items-center justify-center gap-2 text-xs text-muted-foreground">
										<Loader2 className="size-3.5 animate-spin" />
										{t("microAppPage.databasePanel.loading")}
									</div>
								) : permissionDrafts.length ? (
									permissionDrafts.map((draft) => {
										const tags = getDraftTags(draft)
										const active = draft.key === activeDraftKey
										return (
											<button
												key={draft.key}
												type="button"
												className={cn(
													"flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors",
													active ? "bg-primary/5" : "hover:bg-muted/70",
												)}
												onClick={() => setActiveDraftKey(draft.key)}
											>
												{renderSubjectAvatar(
													draft.type,
													draft.name,
													draft.id,
												)}
												<div className="min-w-0 flex-1">
													<div className="truncate text-sm text-foreground">
														{draft.name}
													</div>
													<div className="mt-0.5 text-xs text-muted-foreground">
														{t(
															`microAppPage.databasePanel.subjectType.${draft.type}`,
														)}
													</div>
												</div>
												<div className="flex max-w-[190px] shrink-0 flex-wrap justify-end gap-1.5">
													{tags.length ? (
														tags.map((tag) => (
															<span
																key={tag}
																className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
															>
																{tag}
															</span>
														))
													) : (
														<span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
															{t(
																"microAppPage.databasePanel.permissionEmpty",
															)}
														</span>
													)}
												</div>
											</button>
										)
									})
								) : (
									<div className="flex h-full min-h-48 flex-col items-center justify-center text-center">
										<div className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
											<ShieldCheck className="size-5" />
										</div>
										<div className="mt-3 text-sm text-muted-foreground">
											{t("microAppPage.databasePanel.permissionCurrentEmpty")}
										</div>
										<Button
											type="button"
											variant="outline"
											size="sm"
											className="mt-4 h-8 gap-1.5 text-xs"
											onClick={handleOpenSelector}
										>
											<Users className="size-3.5" />
											{t("microAppPage.databasePanel.permissionAddSubject")}
										</Button>
									</div>
								)}
							</ScrollArea>
						</section>

						<section className="flex min-h-0 min-w-0 flex-col bg-background">
							<div className="flex items-center justify-between border-b border-border px-5 py-3">
								<div>
									<div className="text-sm font-medium text-foreground">
										{t("microAppPage.databasePanel.permissionGrant")}
									</div>
									<div className="mt-0.5 text-xs text-muted-foreground">
										{activeDraft
											? activeDraft.name
											: t(
													"microAppPage.databasePanel.permissionSubjectEmpty",
												)}
									</div>
								</div>
								{activeDraft ? (
									<button
										type="button"
										className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
										aria-label={t(
											"microAppPage.databasePanel.permissionRemoveSubject",
										)}
										onClick={() => handleRemoveDraft(activeDraft.key)}
									>
										<X className="size-3.5" />
									</button>
								) : null}
							</div>

							{/* The full-height wrapper retains centered states without widening either pane. */}
							<ScrollArea
								className="grid min-h-0 flex-1"
								viewportClassName="h-auto min-h-0 px-5 py-4 [&>div]:!flex [&>div]:h-full [&>div]:flex-col [&>div]:gap-5 [&>div>*]:shrink-0"
							>
								{preparingProfiles ? (
									<div className="flex h-full min-h-48 items-center justify-center gap-2 text-xs text-muted-foreground">
										<Loader2 className="size-3.5 animate-spin" />
										{t("microAppPage.databasePanel.loading")}
									</div>
								) : activeDraft ? (
									<>
										<div className="flex items-center gap-3 rounded-md border border-border bg-muted/20 px-3 py-3">
											{renderSubjectAvatar(
												activeDraft.type,
												activeDraft.name,
												activeDraft.id,
											)}
											<div className="min-w-0 flex-1">
												<div className="truncate text-sm font-medium text-foreground">
													{activeDraft.name}
												</div>
												<div className="mt-0.5 text-xs text-muted-foreground">
													{t(
														`microAppPage.databasePanel.subjectType.${activeDraft.type}`,
													)}
												</div>
											</div>
										</div>

										<div className="space-y-2">
											<div className="text-xs font-medium text-foreground">
												{t("microAppPage.databasePanel.permission")}
											</div>
											{target?.mode === "table" ? (
												<div className="space-y-2">
													{TABLE_LEVELS.map((level) =>
														renderPermissionButton(
															level,
															t(
																`microAppPage.databasePanel.permissionLevel.${level}`,
															),
															activeDraft.tableLevels.includes(level),
															() => toggleTableLevel(level),
														),
													)}
												</div>
											) : (
												<div className="space-y-2">
													{(target?.mode === "row"
														? ROW_ACTIONS
														: COLUMN_ACTIONS
													).map((action) =>
														renderPermissionButton(
															action,
															t(
																`microAppPage.databasePanel.permissionAction.${action}`,
															),
															action === "read"
																? activeDraft.canRead
																: action === "edit"
																	? activeDraft.canEdit
																	: activeDraft.canDelete,
															() => {
																if (action === "read") {
																	updateActiveDraft((draft) => ({
																		...draft,
																		canRead: !draft.canRead,
																	}))
																} else if (action === "edit") {
																	updateActiveDraft((draft) => ({
																		...draft,
																		canEdit: !draft.canEdit,
																	}))
																} else {
																	updateActiveDraft((draft) => ({
																		...draft,
																		canDelete: !draft.canDelete,
																	}))
																}
															},
														),
													)}
												</div>
											)}
										</div>

										{target?.mode === "column" && target.columnKeys?.length ? (
											<div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
												<span className="line-clamp-2">
													{target.columnKeys.join(", ")}
												</span>
											</div>
										) : null}
									</>
								) : (
									<div className="flex h-full min-h-48 flex-col items-center justify-center text-center text-xs text-muted-foreground">
										<Users className="mb-2 size-5" />
										{t("microAppPage.databasePanel.permissionSubjectEmpty")}
									</div>
								)}
							</ScrollArea>
						</section>
					</div>

					<DialogFooter className="border-t border-border px-5 py-3">
						<Button
							type="button"
							variant="outline"
							disabled={saving}
							onClick={() => onOpenChange(false)}
						>
							{t("common.cancel")}
						</Button>
						<Button
							type="button"
							className={cn("min-w-20", saving && "gap-2")}
							disabled={saving}
							onClick={handleSave}
						>
							{saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
							{t("microAppPage.databasePanel.permissionSave")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<MemberDepartmentSelector
				open={selectorOpen}
				filterAgent
				selectedValues={selectorDraftNodes}
				title={t("microAppPage.databasePanel.permissionSelectSubject")}
				onSelectChange={setSelectorDraftNodes}
				onOk={handleSelectorOk}
				onCancel={handleSelectorCancel}
				zIndex={1600}
			/>
		</>
	)
}
