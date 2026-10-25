import { MoreHorizontal, Pencil, Plus, Tags, Trash2 } from "lucide-react"
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@magic-admin-v2/components/data-table"
import { EmptyState } from "@magic-admin-v2/components/empty-state"
import { FilterControlField } from "@magic-admin-v2/components/filter-control-field"
import { ListFilterPanel } from "@magic-admin-v2/components/list-filter-panel"
import { ListPagination } from "@magic-admin-v2/components/list-pagination"
import { Badge } from "@magic-admin-v2/components/ui/badge"
import { Button } from "@magic-admin-v2/components/ui/button"
import { Card, CardContent } from "@magic-admin-v2/components/ui/card"
import { FilterSearchInput } from "@magic-admin-v2/components/filter-search-input"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuSeparator,
} from "@magic-admin-v2/components/ui/dropdown-menu"
import { Input } from "@magic-admin-v2/components/ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@magic-admin-v2/components/ui/select"
import { Switch } from "@magic-admin-v2/components/ui/switch"
import { useRuntime } from "@magic-admin-v2/runtime/context"
import type { ListQueryParamsState } from "@magic-admin-v2/hooks/use-list-query-params"
import { useSlidesTemplateTagMutations } from "@magic-admin-v2/features/platform-slides-template/mutations"
import { useRowPendingIds } from "@magic-admin-v2/features/platform-slides-template/hooks"
import {
	useSlidesTemplateTagsQuery,
	useSlidesTemplateTagTreeQuery,
} from "@magic-admin-v2/features/platform-slides-template/queries"
import {
	slidesTemplateStatus,
	type SlidesTemplateTag,
	type SlidesTemplateTagQueryParams,
} from "@magic-admin-v2/features/platform-slides-template/types"
import {
	formatDateTime,
	isSystemSlidesTemplateTagGroup,
	resolveSlidesTemplateTagName,
	toStatus,
} from "@magic-admin-v2/features/platform-slides-template/utils"
import { CopyableCode } from "@magic-admin-v2/features/platform-slides-template/components/copyable-code"
import { TagDialog } from "@magic-admin-v2/features/platform-slides-template/components/tag-dialog"
import { MobileTagGroupSelector } from "@magic-admin-v2/features/platform-slides-template/components/mobile-tag-group-selector"
import { MobileTagList } from "@magic-admin-v2/features/platform-slides-template/components/mobile-tag-list"
import { cn } from "@magic-admin-v2/utils/cn"

import {
	createDefaultTagFilterDraft,
	emptySlidesTemplateStatus,
	type TagFilterDraft,
} from "@magic-admin-v2/features/platform-slides-template/list-params"

type TagManagerProps = {
	canEdit: boolean
	mobileFilterOpen: boolean
	onCreateAvailabilityChange: (available: boolean) => void
	onDelete: (record: SlidesTemplateTag) => void
	queryState: ListQueryParamsState<TagFilterDraft, SlidesTemplateTagQueryParams>
	selectedGroupId: string | null
	onSelectedGroupIdChange: (groupId: string | null) => void
	onMobileFilterOpenChange: (open: boolean) => void
}

export type TagManagerHandle = {
	create: () => void
	reset: () => void
}

export const TagManager = forwardRef<TagManagerHandle, TagManagerProps>(function TagManager(
	{
		canEdit,
		mobileFilterOpen,
		onCreateAvailabilityChange,
		onDelete,
		onMobileFilterOpenChange,
		onSelectedGroupIdChange,
		queryState,
		selectedGroupId,
	},
	ref,
) {
	const { t } = useTranslation()
	const { language } = useRuntime()
	const [selectedTagId, setSelectedTagId] = useState<string | null>(null)
	const {
		filterDraft: filters,
		page,
		pageSize,
		params,
		setDebouncedField,
		setFilterDraft,
		setPage,
		setPageSize,
	} = queryState
	const [groupDialogOpen, setGroupDialogOpen] = useState(false)
	const [tagDialogOpen, setTagDialogOpen] = useState(false)
	const [editing, setEditing] = useState<SlidesTemplateTag | null>(null)
	const tree = useSlidesTemplateTagTreeQuery(true)
	const groups = useMemo(
		() => (tree.data ?? []).filter((node) => node.node_type === "group"),
		[tree.data],
	)
	const selectedGroup = groups.find((group) => String(group.id) === selectedGroupId) ?? null
	const canCreateTag = canEdit && groups.length > 0

	useEffect(() => {
		onCreateAvailabilityChange(canCreateTag)
	}, [canCreateTag, onCreateAvailabilityChange])

	useEffect(() => {
		if (!selectedGroupId || tree.isFetching) return
		if (!groups.some((group) => String(group.id) === selectedGroupId)) {
			onSelectedGroupIdChange(null)
			setSelectedTagId(null)
		}
	}, [groups, onSelectedGroupIdChange, selectedGroupId, tree.isFetching])

	const query = useSlidesTemplateTagsQuery(params)
	const mutations = useSlidesTemplateTagMutations()
	const { pendingIds: statusPendingIds, run: runStatusPending } = useRowPendingIds()
	const { pendingIds: sortPendingIds, run: runSortPending } = useRowPendingIds()
	const groupNames = useMemo(
		() =>
			new Map(groups.map((group) => [String(group.id), resolveSlidesTemplateTagName(group)])),
		[groups],
	)

	const openGroup = (record?: SlidesTemplateTag) => {
		setEditing(record ?? null)
		setGroupDialogOpen(true)
	}
	const openTag = useCallback(
		(record?: SlidesTemplateTag) => {
			if (!canEdit || groups.length === 0) return
			setEditing(record ?? null)
			setTagDialogOpen(true)
		},
		[canEdit, groups.length],
	)
	const reset = useCallback(() => {
		setFilterDraft(createDefaultTagFilterDraft())
		setSelectedTagId(null)
	}, [setFilterDraft])

	const selectGroup = useCallback(
		(groupId: string | null) => {
			onSelectedGroupIdChange(groupId)
			setSelectedTagId(null)
		},
		[onSelectedGroupIdChange],
	)
	const updateRecordStatus = useCallback(
		async (record: SlidesTemplateTag, enabled: boolean) => {
			try {
				await runStatusPending(record.id, () =>
					mutations.updateStatus.mutateAsync({
						id: record.id,
						status: toStatus(enabled),
					}),
				)
			} catch (error) {
				toast.error((error as { message?: string }).message || t("common.requestFailed"))
			}
		},
		[mutations.updateStatus, runStatusPending, t],
	)

	useImperativeHandle(ref, () => ({ create: () => openTag(), reset }), [openTag, reset])
	const groupColumns = useMemo<Array<ColumnDef<SlidesTemplateTag>>>(
		() => [
			{
				accessorKey: "name",
				header: t("slidesTemplate.tagName"),
				cell: ({ row }) => resolveSlidesTemplateTagName(row.original),
			},
			{
				accessorKey: "code",
				header: t("slidesTemplate.tagCode"),
				cell: ({ row }) => <CopyableCode value={row.original.code} />,
			},
			{
				id: "parent_id",
				accessorKey: "parent_id",
				header: t("slidesTemplate.parentGroup"),
				cell: ({ row }) => groupNames.get(String(row.original.parent_id)) ?? "-",
			},
			{ accessorKey: "template_count", header: t("slidesTemplate.categoryCount") },
			{
				accessorKey: "status",
				header: t("slidesTemplate.status"),
				meta: { mobile: { kind: "control" } },
				cell: ({ row }) => (
					<Switch
						checked={row.original.status === slidesTemplateStatus.enabled}
						disabled={!canEdit}
						loading={statusPendingIds.has(row.original.id)}
						onCheckedChange={async (checked) => {
							try {
								await runStatusPending(row.original.id, () =>
									mutations.updateStatus.mutateAsync({
										id: row.original.id,
										status: toStatus(checked),
									}),
								)
							} catch (error) {
								toast.error(
									(error as { message?: string }).message ||
										t("common.requestFailed"),
								)
							}
						}}
						data-testid="platform-slides-template-switch"
					/>
				),
			},
			{
				accessorKey: "sort",
				header: t("slidesTemplate.sort"),
				cell: ({ row }) => (
					<Input
						className="h-8 w-24"
						defaultValue={row.original.sort}
						disabled={!canEdit || sortPendingIds.has(row.original.id)}
						key={`${row.original.id}-${row.original.sort}`}
						onBlur={async (event) => {
							const sort = Number(event.target.value)
							if (!Number.isFinite(sort) || sort === row.original.sort) return
							try {
								await runSortPending(row.original.id, () =>
									mutations.updateSort.mutateAsync({
										id: row.original.id,
										sort,
									}),
								)
							} catch (error) {
								toast.error(
									(error as { message?: string }).message ||
										t("common.requestFailed"),
								)
							}
						}}
						onKeyDown={(event) => {
							if (event.key === "Enter") event.currentTarget.blur()
						}}
						type="number"
						data-testid="platform-slides-template-input"
					/>
				),
			},
			{
				accessorKey: "updated_at",
				header: t("slidesTemplate.updatedAt"),
				cell: ({ row }) =>
					formatDateTime(
						row.original.updated_at,
						language === "en_US" ? "en-US" : "zh-CN",
					),
			},
			{
				id: "actions",
				header: () => (
					<span className="block text-center">{t("slidesTemplate.actions")}</span>
				),
				enableSorting: false,
				meta: { fitContent: true },
				cell: ({ row }) => (
					<div className="flex justify-center">
						<DropdownMenu>
							<DropdownMenuTrigger
								asChild
								data-testid="platform-slides-template-menu-trigger"
							>
								<Button
									aria-label={t("slidesTemplate.actions")}
									size="icon"
									variant="ghost"
									data-testid="platform-slides-template-edit-button"
								>
									<MoreHorizontal className="size-4" aria-hidden="true" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="end"
								data-testid="platform-slides-template-action-button"
							>
								<DropdownMenuItem
									disabled={!canEdit}
									onSelect={() => openTag(row.original)}
									data-testid="platform-slides-template-menu-item"
								>
									<Pencil className="mr-2 size-4" aria-hidden="true" />
									{t("common.edit")}
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									className="text-destructive"
									disabled={!canEdit}
									onSelect={() => onDelete(row.original)}
									data-testid="platform-slides-template-menu-item"
								>
									<Trash2 className="mr-2 size-4" aria-hidden="true" />
									{t("slidesTemplate.delete")}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				),
			},
		],
		[
			canEdit,
			groupNames,
			language,
			mutations,
			onDelete,
			openTag,
			runSortPending,
			runStatusPending,
			sortPendingIds,
			statusPendingIds,
			t,
		],
	)

	return (
		<div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
			<MobileTagGroupSelector
				canEdit={canEdit}
				groups={groups}
				onAdd={() => openGroup()}
				onDelete={onDelete}
				onEdit={openGroup}
				onSelect={selectGroup}
				onStatusChange={(group, enabled) => void updateRecordStatus(group, enabled)}
				selectedGroup={selectedGroup}
				selectedGroupId={selectedGroupId}
				statusPendingIds={statusPendingIds}
				total={query.data?.total ?? 0}
			/>
			<Card className="hidden h-full p-0 md:block">
				<CardContent className="space-y-3 p-4">
					<div className="flex items-center justify-between">
						<h3 className="font-semibold">{t("slidesTemplate.tagGroupTitle")}</h3>
						<Button
							disabled={!canEdit}
							onClick={() => openGroup()}
							size="sm"
							variant="outline"
							data-testid="platform-slides-template-create-button"
						>
							<Plus className="mr-1 size-4" />
							{t("slidesTemplate.createTagGroup")}
						</Button>
					</div>
					<button
						data-testid="platform-slides-template-tag-action-button"
						className={cn(
							"w-full rounded-md px-3 py-2 text-left text-sm",
							selectedGroupId === null
								? "bg-primary/10 font-medium"
								: "hover:bg-muted",
						)}
						onClick={() => {
							onSelectedGroupIdChange(null)
							setSelectedTagId(null)
						}}
						type="button"
					>
						{t("slidesTemplate.allTags")}
					</button>
					<div className="space-y-1">
						{groups.map((group) => (
							<div
								className={cn(
									"rounded-md p-2",
									selectedGroupId === String(group.id)
										? "bg-primary/10"
										: "hover:bg-muted",
								)}
								key={group.id}
							>
								<button
									data-testid="platform-slides-template-tag-action-button"
									className="flex w-full items-center justify-between gap-2 text-left"
									onClick={() => {
										onSelectedGroupIdChange(String(group.id))
										setSelectedTagId(null)
									}}
									type="button"
								>
									<span className="min-w-0 flex-1">
										<span className="block truncate text-sm">
											{resolveSlidesTemplateTagName(group)}
										</span>
										<span
											className="mt-0.5 block truncate text-xs text-muted-foreground"
											title={group.code}
										>
											{group.code}
										</span>
									</span>
									{isSystemSlidesTemplateTagGroup(group) ? (
										<Badge variant="outline">
											{t("slidesTemplate.systemBuiltIn")}
										</Badge>
									) : null}
								</button>
								<div className="mt-2 flex items-center justify-between gap-2">
									<div className="flex items-center gap-2">
										<Switch
											checked={group.status === slidesTemplateStatus.enabled}
											disabled={!canEdit}
											loading={statusPendingIds.has(group.id)}
											onCheckedChange={async (checked) => {
												try {
													await runStatusPending(group.id, () =>
														mutations.updateStatus.mutateAsync({
															id: group.id,
															status: toStatus(checked),
														}),
													)
												} catch (error) {
													toast.error(
														(error as { message?: string }).message ||
															t("common.requestFailed"),
													)
												}
											}}
											data-testid="platform-slides-template-switch"
										/>
										<Input
											className="h-7 w-24"
											defaultValue={group.sort}
											disabled={!canEdit || sortPendingIds.has(group.id)}
											key={`${group.id}-${group.sort}`}
											onBlur={(event) => {
												const sort = Number(event.target.value)
												if (!Number.isFinite(sort) || sort === group.sort)
													return
												void runSortPending(group.id, () =>
													mutations.updateSort.mutateAsync({
														id: group.id,
														sort,
													}),
												).catch((error) => {
													toast.error(
														(error as { message?: string }).message ||
															t("common.requestFailed"),
													)
												})
											}}
											onKeyDown={(event) => {
												if (event.key === "Enter")
													event.currentTarget.blur()
											}}
											type="number"
											data-testid="platform-slides-template-input"
										/>
									</div>
									<div className="flex gap-1">
										<Button
											aria-label={t("slidesTemplate.aria.editTagGroup", {
												name: resolveSlidesTemplateTagName(group),
											})}
											disabled={!canEdit}
											onClick={() => openGroup(group)}
											size="icon-sm"
											variant="outline"
											data-testid="platform-slides-template-delete-button"
										>
											<Pencil className="size-3.5" />
										</Button>
										<Button
											aria-label={t("slidesTemplate.aria.deleteTagGroup", {
												name: resolveSlidesTemplateTagName(group),
											})}
											disabled={
												!canEdit || isSystemSlidesTemplateTagGroup(group)
											}
											onClick={() => onDelete(group)}
											size="icon-sm"
											variant="outline"
											data-testid="platform-slides-template-delete-button"
										>
											<Trash2 className="size-3.5 text-destructive" />
										</Button>
									</div>
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
			<section className="min-w-0 overflow-visible bg-transparent md:overflow-hidden md:rounded-lg md:border md:bg-card">
				<div className="hidden border-b p-4 md:block">
					<h3 className="min-w-0 truncate font-semibold">
						{selectedGroup
							? resolveSlidesTemplateTagName(selectedGroup)
							: t("slidesTemplate.allTags")}
					</h3>
				</div>
				<ListFilterPanel
					applyLabel={t("slidesTemplate.applyFilters")}
					mobileApplyTestId="platform-slides-template-apply-button"
					mobileBodyTestId="platform-slides-template-filter-body"
					mobileCloseButtonTestId="platform-slides-template-tag-filter-close-button"
					mobileContentTestId="platform-slides-template-filter-sheet"
					mobileResetTestId="platform-slides-template-reset-button"
					className="mb-3 md:mb-0 md:p-4"
					createDefaultValue={createDefaultTagFilterDraft}
					mobileOpen={mobileFilterOpen}
					onMobileOpenChange={onMobileFilterOpenChange}
					showMobileTrigger={false}
					onApply={(draft) => {
						setFilterDraft(draft)
						setSelectedTagId(null)
					}}
					onChange={(patch) => {
						if (patch.keyword !== undefined) setDebouncedField("keyword", patch.keyword)
						if (patch.code !== undefined) setDebouncedField("code", patch.code)
						if (patch.status !== undefined)
							setFilterDraft((previous) => ({ ...previous, status: patch.status! }))
						setSelectedTagId(null)
					}}
					onReset={reset}
					renderFields={({ layout, onChange, value }) => (
						<>
							<FilterControlField label={t("slidesTemplate.tagName")}>
								<FilterSearchInput
									clearButtonTestId={
										layout === "sheet"
											? "platform-slides-template-advanced-search-clear-button"
											: "platform-slides-template-secondary-clear-button"
									}
									clearLabel={t("common.clear")}
									inputTestId={
										layout === "sheet"
											? "platform-slides-template-advanced-search-input"
											: "platform-slides-template-secondary-search-input"
									}
									onValueChange={(keyword) =>
										layout === "grid"
											? setDebouncedField("keyword", keyword)
											: onChange({ keyword })
									}
									placeholder={t("slidesTemplate.tagName")}
									value={value.keyword}
								/>
							</FilterControlField>
							<FilterControlField label={t("slidesTemplate.tagCode")}>
								<FilterSearchInput
									clearButtonTestId={
										layout === "sheet"
											? "platform-slides-template-advanced-search-clear-button"
											: "platform-slides-template-tertiary-clear-button"
									}
									clearLabel={t("common.clear")}
									inputTestId={
										layout === "sheet"
											? "platform-slides-template-advanced-search-input"
											: "platform-slides-template-tertiary-search-input"
									}
									onValueChange={(code) =>
										layout === "grid"
											? setDebouncedField("code", code)
											: onChange({ code })
									}
									placeholder={t("slidesTemplate.tagCode")}
									value={value.code}
								/>
							</FilterControlField>
							<FilterControlField label={t("slidesTemplate.status")}>
								<Select
									value={value.status}
									onValueChange={(status) => onChange({ status })}
								>
									<SelectTrigger
										className="w-full"
										data-testid="platform-slides-template-select-trigger"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent data-testid="platform-slides-template-select-content">
										<SelectItem
											data-testid="platform-slides-template-option"
											value={emptySlidesTemplateStatus}
										>
											{t("slidesTemplate.all")}
										</SelectItem>
										<SelectItem
											data-testid="platform-slides-template-option"
											value="1"
										>
											{t("slidesTemplate.enabled")}
										</SelectItem>
										<SelectItem
											data-testid="platform-slides-template-option"
											value="0"
										>
											{t("slidesTemplate.disabled")}
										</SelectItem>
									</SelectContent>
								</Select>
							</FilterControlField>
						</>
					)}
					resetLabel={t("slidesTemplate.reset")}
					title={t("slidesTemplate.filterTitle")}
					value={filters}
				/>

				<div>
					<MobileTagList
						canEdit={canEdit}
						groupNames={groupNames}
						isLoading={query.isLoading}
						language={language}
						onDelete={onDelete}
						onEdit={openTag}
						onStatusChange={(tag, enabled) => void updateRecordStatus(tag, enabled)}
						selectedGroupId={selectedGroupId}
						statusPendingIds={statusPendingIds}
						tags={query.data?.list ?? []}
					/>
					<div className="hidden md:block">
						<DataTable
							columns={
								selectedGroupId === null
									? groupColumns
									: groupColumns.filter((column) => column.id !== "parent_id")
							}
							data={query.data?.list ?? []}
							emptyState={
								<EmptyState
									icon={Tags}
									title={t("slidesTemplate.emptyTags")}
									testId="platform-slides-template-empty"
								/>
							}
							getRowId={(row) => row.id}
							isLoading={query.isLoading}
							minWidth={selectedGroupId === null ? 1000 : 850}
							selectedRowId={selectedTagId ?? undefined}
							stickyRightColumnId="actions"
							containerTestId="platform-slides-template-list"
							loadingTestId="platform-slides-template-loading"
							rowTestId="platform-slides-template-row"
						/>
					</div>
					<ListPagination
						previousButtonTestId="slides-template-tag-previous-button"
						nextButtonTestId="slides-template-tag-next-button"
						pageSizeTriggerTestId="slides-template-tag-page-size-trigger"
						pageSizeOptionTestId="slides-template-tag-page-size-option"
						jumpInputTestId="slides-template-tag-jump-input"
						testId="slides-template-tag-pagination"
						showQuickJumper
						loading={query.isFetching}
						onPageChange={(value) => {
							setPage(value)
							setSelectedTagId(null)
						}}
						onPageSizeChange={(value) => {
							setPageSize(value)
							setSelectedTagId(null)
						}}
						page={page}
						pageSize={pageSize}
						total={query.data?.total ?? 0}
					/>
				</div>
			</section>
			<TagDialog
				editing={editing}
				groups={groups}
				mode="group"
				mutations={mutations}
				onCreated={(group) => {
					onSelectedGroupIdChange(String(group.id))
					setSelectedTagId(null)
				}}
				onOpenChange={setGroupDialogOpen}
				open={groupDialogOpen}
			/>
			<TagDialog
				defaultParentId={selectedGroupId}
				editing={editing}
				groups={groups}
				mode="tag"
				mutations={mutations}
				onCreated={(tag) => {
					onSelectedGroupIdChange(String(tag.parent_id))
					setSelectedTagId(String(tag.id))
					setFilterDraft(createDefaultTagFilterDraft())
				}}
				onOpenChange={setTagDialogOpen}
				open={tagDialogOpen}
			/>
		</div>
	)
})
