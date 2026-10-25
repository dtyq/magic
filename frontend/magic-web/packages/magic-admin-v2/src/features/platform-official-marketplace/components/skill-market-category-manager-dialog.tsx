import type { ColumnDef } from "@tanstack/react-table"
import { AlertCircle, Pencil, Plus, RefreshCw, RotateCcw, Tags, Trash2 } from "lucide-react"
import { useDebounce } from "ahooks"
import { useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { DataTable } from "@magic-admin-v2/components/data-table"
import { DeleteConfirmDialog } from "@magic-admin-v2/components/delete-confirm-dialog"
import { EmptyState } from "@magic-admin-v2/components/empty-state"
import { FilterControlField } from "@magic-admin-v2/components/filter-control-field"
import { FilterSearchInput } from "@magic-admin-v2/components/filter-search-input"
import { Button } from "@magic-admin-v2/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@magic-admin-v2/components/ui/dialog"
import { Input } from "@magic-admin-v2/components/ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@magic-admin-v2/components/ui/select"
import { Switch } from "@magic-admin-v2/components/ui/switch"
import { TEXT_FILTER_DEBOUNCE_MS } from "@magic-admin-v2/constants/filters"
import { SkillMarketCategoryFormDialog } from "@magic-admin-v2/features/platform-official-marketplace/components/skill-market-category-form-dialog"
import { useSkillMarketCategoryMutations } from "@magic-admin-v2/features/platform-official-marketplace/mutations"
import { useSkillMarketCategoryListQuery } from "@magic-admin-v2/features/platform-official-marketplace/queries"
import type {
	SkillMarketCategoryFormValues,
	SkillMarketCategoryItem,
	SkillMarketCategoryListParams,
} from "@magic-admin-v2/features/platform-official-marketplace/types"
import {
	buildSkillMarketCategorySaveParams,
	formatAgentMarketCategoryDateTime,
	normalizeAgentMarketCategorySortOrder,
	resolveSkillMarketCategoryName,
	skillMarketCategoryStatus,
} from "@magic-admin-v2/features/platform-official-marketplace/utils"
import { useI18n } from "@magic-admin-v2/i18n/use-i18n"

const allStatusValue = "all"
const emptyFilters = { keyword: "", status: allStatusValue }

type SkillMarketCategoryManagerDialogProps = {
	canEdit: boolean
	onOpenChange: (open: boolean) => void
	open: boolean
}

export function SkillMarketCategoryManagerDialog({
	canEdit,
	onOpenChange,
	open,
}: SkillMarketCategoryManagerDialogProps) {
	const { t } = useTranslation()
	const { language } = useI18n()
	const [filterDraft, setFilterDraft] = useState(emptyFilters)
	const debouncedKeyword = useDebounce(filterDraft.keyword, { wait: TEXT_FILTER_DEBOUNCE_MS })
	const filters = useMemo<SkillMarketCategoryListParams>(
		() => ({
			keyword: (filterDraft.keyword ? debouncedKeyword : "").trim() || undefined,
			status:
				filterDraft.status === allStatusValue
					? null
					: (Number(filterDraft.status) as 0 | 1),
		}),
		[debouncedKeyword, filterDraft.keyword, filterDraft.status],
	)
	const [editing, setEditing] = useState<SkillMarketCategoryItem | null>(null)
	const [formOpen, setFormOpen] = useState(false)
	const [formSaving, setFormSaving] = useState(false)
	const [deleteTarget, setDeleteTarget] = useState<SkillMarketCategoryItem | null>(null)
	const [statusPendingIds, setStatusPendingIds] = useState<Set<string>>(new Set())
	const [sortPendingIds, setSortPendingIds] = useState<Set<string>>(new Set())
	const query = useSkillMarketCategoryListQuery(filters, open)
	const mutations = useSkillMarketCategoryMutations()
	const categories = query.data?.list ?? []

	const updateStatus = useCallback(
		async (record: SkillMarketCategoryItem, checked: boolean) => {
			if (!canEdit) return
			setStatusPendingIds((previous) => new Set(previous).add(record.id))
			try {
				await mutations.update.mutateAsync({
					id: record.id,
					values: {
						status: checked
							? skillMarketCategoryStatus.visible
							: skillMarketCategoryStatus.hidden,
					},
				})
				toast.success(t("officialMarketplace.skillCategory.message.updateSuccess"))
			} catch (error) {
				toast.error(
					getErrorMessage(
						error,
						t("officialMarketplace.skillCategory.message.updateFailed"),
					),
				)
			} finally {
				setStatusPendingIds((previous) => removePendingId(previous, record.id))
			}
		},
		[canEdit, mutations.update, t],
	)

	const updateSortOrder = useCallback(
		async (record: SkillMarketCategoryItem, value: number) => {
			if (!canEdit) return
			const sortOrder = normalizeAgentMarketCategorySortOrder(value)
			if (sortOrder === (record.sort_order ?? 0)) return
			setSortPendingIds((previous) => new Set(previous).add(record.id))
			try {
				await mutations.update.mutateAsync({
					id: record.id,
					values: { sort_order: sortOrder },
				})
				toast.success(t("officialMarketplace.skillCategory.message.updateSuccess"))
			} catch (error) {
				toast.error(
					getErrorMessage(
						error,
						t("officialMarketplace.skillCategory.message.updateFailed"),
					),
				)
			} finally {
				setSortPendingIds((previous) => removePendingId(previous, record.id))
			}
		},
		[canEdit, mutations.update, t],
	)

	async function saveCategory(values: SkillMarketCategoryFormValues) {
		setFormSaving(true)
		try {
			const payload = buildSkillMarketCategorySaveParams(values)
			if (editing) {
				await mutations.update.mutateAsync({ id: editing.id, values: payload })
				toast.success(t("officialMarketplace.skillCategory.message.updateSuccess"))
			} else {
				await mutations.create.mutateAsync(payload)
				toast.success(t("officialMarketplace.skillCategory.message.createSuccess"))
			}
			setFormOpen(false)
		} catch (error) {
			toast.error(
				getErrorMessage(error, t("officialMarketplace.skillCategory.message.saveFailed")),
			)
			throw error
		} finally {
			setFormSaving(false)
		}
	}

	async function deleteCategory() {
		if (!deleteTarget || !canEdit) return
		try {
			await mutations.delete.mutateAsync(deleteTarget.id)
			toast.success(t("officialMarketplace.skillCategory.message.deleteSuccess"))
			setDeleteTarget(null)
		} catch (error) {
			toast.error(
				getErrorMessage(error, t("officialMarketplace.skillCategory.message.deleteFailed")),
			)
		}
	}

	const columns = useMemo<Array<ColumnDef<SkillMarketCategoryItem>>>(
		() => [
			{
				id: "name",
				size: 220,
				header: t("officialMarketplace.skillCategory.column.name"),
				cell: ({ row }) => (
					<span className="block truncate font-medium">
						{resolveSkillMarketCategoryName(row.original, language)}
					</span>
				),
			},
			{
				id: "status",
				size: 140,
				header: t("officialMarketplace.skillCategory.column.status"),
				cell: ({ row }) => {
					const visible =
						(row.original.status ?? skillMarketCategoryStatus.visible) ===
						skillMarketCategoryStatus.visible
					const pending = statusPendingIds.has(row.original.id)
					return (
						<div className="flex items-center gap-2 whitespace-nowrap">
							<Switch
								aria-label={t("officialMarketplace.skillCategory.column.status")}
								checked={visible}
								disabled={!canEdit}
								loading={pending}
								onCheckedChange={(checked) =>
									void updateStatus(row.original, checked)
								}
								data-testid="platform-official-marketplace-switch"
							/>
							<span className="text-xs text-muted-foreground">
								{visible
									? t("officialMarketplace.skillCategory.status.visible")
									: t("officialMarketplace.skillCategory.status.hidden")}
							</span>
						</div>
					)
				},
			},
			{
				id: "skill_count",
				size: 110,
				header: t("officialMarketplace.skillCategory.column.skillCount"),
				cell: ({ row }) => row.original.skill_count ?? 0,
			},
			{
				id: "sort_order",
				size: 120,
				header: t("officialMarketplace.skillCategory.column.sortOrder"),
				cell: ({ row }) => (
					<Input
						aria-label={t("officialMarketplace.skillCategory.column.sortOrder")}
						className="h-8 w-24"
						defaultValue={row.original.sort_order ?? 0}
						disabled={!canEdit || sortPendingIds.has(row.original.id)}
						key={`${row.original.id}-${row.original.sort_order ?? 0}`}
						min={0}
						onBlur={(event) =>
							void updateSortOrder(row.original, Number(event.target.value || 0))
						}
						onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
						type="number"
						data-testid="platform-official-marketplace-input"
					/>
				),
			},
			{
				id: "updated_at",
				size: 180,
				header: t("officialMarketplace.skillCategory.column.updatedAt"),
				cell: ({ row }) => (
					<span className="whitespace-nowrap text-muted-foreground">
						{formatAgentMarketCategoryDateTime(
							row.original.updated_at,
							language === "en_US" ? "en-US" : "zh-CN",
						)}
					</span>
				),
			},
			{
				id: "actions",
				size: 110,
				header: t("officialMarketplace.skillCategory.column.actions"),
				cell: ({ row }) => (
					<div className="flex items-center gap-1">
						<Button
							aria-label={t("officialMarketplace.skillCategory.action.editAria", {
								name: resolveSkillMarketCategoryName(row.original, language),
							})}
							disabled={!canEdit}
							onClick={() => {
								setEditing(row.original)
								setFormOpen(true)
							}}
							size="icon-sm"
							variant="outline"
							data-testid="platform-official-marketplace-delete-button"
						>
							<Pencil className="size-4" aria-hidden="true" />
						</Button>
						<Button
							aria-label={t("officialMarketplace.skillCategory.action.deleteAria", {
								name: resolveSkillMarketCategoryName(row.original, language),
							})}
							disabled={!canEdit}
							onClick={() => setDeleteTarget(row.original)}
							size="icon-sm"
							variant="outline"
							data-testid="platform-official-marketplace-delete-button"
						>
							<Trash2 className="size-4 text-destructive" aria-hidden="true" />
						</Button>
					</div>
				),
			},
		],
		[canEdit, language, sortPendingIds, statusPendingIds, t, updateSortOrder, updateStatus],
	)

	return (
		<>
			<Dialog
				onOpenChange={(nextOpen) => {
					if (!nextOpen && (formOpen || Boolean(deleteTarget))) return
					onOpenChange(nextOpen)
				}}
				open={open}
			>
				<DialogContent
					className="flex max-h-[calc(100vh-2rem)] min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-[960px]"
					data-testid="platform-official-marketplace-dialog-content"
					closeButtonTestId="skill-market-category-manager-dialog-close-button"
				>
					<DialogHeader className="border-b px-5 py-4 pr-12">
						<DialogTitle>
							{t("officialMarketplace.skillCategory.manageTitle")}
						</DialogTitle>
						<DialogDescription>
							{t("officialMarketplace.skillCategory.manageDescription")}
						</DialogDescription>
					</DialogHeader>

					<div className="min-h-0 flex-1 overflow-y-auto">
						<div className="flex min-w-0 flex-wrap items-end gap-2 px-5 pt-5">
							{/* Keep the two filters side by side on narrow screens; actions can wrap below them. */}
							<div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:contents">
								<FilterControlField
									className="w-full min-w-0 sm:w-[260px]"
									label={t("officialMarketplace.skillCategory.filter.keyword")}
								>
									<FilterSearchInput
										aria-label={t(
											"officialMarketplace.skillCategory.filter.keyword",
										)}
										clearLabel={t("common.clear")}
										clearButtonTestId="platform-official-marketplace-dialog-clear-button"
										onValueChange={(keyword) =>
											setFilterDraft((previous) => ({ ...previous, keyword }))
										}
										placeholder={t(
											"officialMarketplace.skillCategory.filter.keywordPlaceholder",
										)}
										value={filterDraft.keyword}
										inputTestId="platform-official-marketplace-search-input"
									/>
								</FilterControlField>
								<FilterControlField
									className="w-full sm:w-auto"
									label={t("officialMarketplace.skillCategory.filter.status")}
								>
									<Select
										onValueChange={(status) =>
											setFilterDraft((previous) => ({ ...previous, status }))
										}
										value={filterDraft.status}
									>
										<SelectTrigger
											className="w-full sm:w-36"
											data-testid="platform-official-marketplace-select-trigger"
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent data-testid="platform-official-marketplace-select-content">
											<SelectItem
												value={allStatusValue}
												data-testid="platform-official-marketplace-option"
											>
												{t(
													"officialMarketplace.skillCategory.filter.allStatus",
												)}
											</SelectItem>
											<SelectItem
												value={String(skillMarketCategoryStatus.visible)}
												data-testid="platform-official-marketplace-option"
											>
												{t("officialMarketplace.skillCategory.status.visible")}
											</SelectItem>
											<SelectItem
												value={String(skillMarketCategoryStatus.hidden)}
												data-testid="platform-official-marketplace-option"
											>
												{t("officialMarketplace.skillCategory.status.hidden")}
											</SelectItem>
										</SelectContent>
									</Select>
								</FilterControlField>
							</div>
							<Button
								onClick={() => setFilterDraft(emptyFilters)}
								variant="outline"
								data-testid="platform-official-marketplace-refresh-button"
							>
								<RotateCcw className="size-4" aria-hidden="true" />
								{t("officialMarketplace.skillCategory.action.reset")}
							</Button>
							<Button
								disabled={query.isFetching}
								onClick={() => void query.refetch()}
								variant="outline"
								data-testid="platform-official-marketplace-refresh-button"
							>
								<RefreshCw
									className={query.isFetching ? "size-4 animate-spin" : "size-4"}
									aria-hidden="true"
								/>
								{t("officialMarketplace.skillCategory.action.refresh")}
							</Button>
							<Button
								className="sm:ml-auto"
								disabled={!canEdit}
								onClick={() => {
									setEditing(null)
									setFormOpen(true)
								}}
								data-testid="platform-official-marketplace-create-button"
							>
								<Plus className="size-4" aria-hidden="true" />
								{t("officialMarketplace.skillCategory.action.create")}
							</Button>
						</div>

						{query.error ? (
							<div className="mx-5 mb-5 mt-4 p-5">
								<EmptyState
									icon={AlertCircle}
									title={t("officialMarketplace.skillCategory.error.loadTitle")}
									description={getErrorMessage(
										query.error,
										t("officialMarketplace.skillCategory.error.loadFailed"),
									)}
									testId="platform-official-marketplace-error"
								/>
							</div>
						) : (
							<DataTable
								containerClassName="mx-5 mb-5 mt-4"
								columns={columns}
								data={categories}
								emptyState={
									<div className="p-5">
										<EmptyState
											icon={Tags}
											title={t(
												"officialMarketplace.skillCategory.emptyTitle",
											)}
											description={t(
												"officialMarketplace.skillCategory.emptyDescription",
											)}
											testId="platform-official-marketplace-empty"
										/>
									</div>
								}
								getRowId={(record) => record.id}
								isLoading={query.isLoading}
								minWidth={900}
								stickyRightColumnId="actions"
								containerTestId="platform-official-marketplace-list"
								loadingTestId="platform-official-marketplace-loading"
								rowTestId="platform-official-marketplace-row"
							/>
						)}
					</div>
				</DialogContent>
			</Dialog>

			<SkillMarketCategoryFormDialog
				editing={editing}
				isPending={formSaving}
				onOpenChange={setFormOpen}
				onSubmit={saveCategory}
				open={formOpen}
			/>
			<DeleteConfirmDialog
				contentTestId="skill-market-category-delete-dialog-content"
				cancelButtonTestId="skill-market-category-delete-cancel-button"
				confirmButtonTestId="skill-market-category-delete-confirm-button"
				description={t("officialMarketplace.skillCategory.deleteDescription", {
					name: resolveSkillMarketCategoryName(deleteTarget, language),
				})}
				isPending={mutations.delete.isPending}
				onConfirm={deleteCategory}
				onOpenChange={(nextOpen) => !nextOpen && setDeleteTarget(null)}
				open={Boolean(deleteTarget)}
				title={t("officialMarketplace.skillCategory.deleteTitle")}
			/>
		</>
	)
}

function removePendingId(previous: Set<string>, id: string) {
	const next = new Set(previous)
	next.delete(id)
	return next
}

function getErrorMessage(error: unknown, fallback: string) {
	return (error as { message?: string } | null)?.message || fallback
}
