import type { ColumnDef } from "@tanstack/react-table"
import { Sparkles } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { useI18n } from "@magic-admin-v2/i18n/use-i18n"
import type { ApiError } from "@magic-admin-v2/api/types"
import { useReviewSkillVersionMutation } from "@magic-admin-v2/features/platform-publish-review/mutations"
import { useSkillReviewListQuery } from "@magic-admin-v2/features/platform-publish-review/queries"
import {
	type PublishReviewFilterDraft,
	type PublishReviewAction,
	type PublishReviewPublisherType,
	type PublishReviewVariant,
	type SkillVersionReviewItem,
} from "@magic-admin-v2/features/platform-publish-review/types"
import { useRights } from "@magic-admin-v2/hooks/use-rights"
import {
	canReviewRecord,
	getLocalizedText,
	type ReviewDialogState,
} from "@magic-admin-v2/features/platform-publish-review/formatters"
import { createReviewPayload } from "@magic-admin-v2/features/platform-publish-review/params"
import type { ListQueryParamsState } from "@magic-admin-v2/hooks/use-list-query-params"
import type { SkillReviewListParams } from "@magic-admin-v2/features/platform-publish-review/types"
import {
	createReviewActionColumn,
	createReviewVersionColumn,
	createSharedReviewColumns,
} from "@magic-admin-v2/features/platform-publish-review/components/review-columns"
import {
	ClampedText,
	NameCell,
	OrganizationCell,
} from "@magic-admin-v2/features/platform-publish-review/components/review-cells"
import { ReviewActionDialogs } from "@magic-admin-v2/features/platform-publish-review/components/review-action-dialogs"
import { ReviewListPanel } from "@magic-admin-v2/features/platform-publish-review/components/review-list-panel"
import { PERMISSION_KEY_MAP } from "@magic-admin-v2/constants/permissions"
import { useInternalSkillReviewEditRight } from "@magic-admin-v2/features/platform-publish-review/internal-review-rights"

export function SkillReviewPanel({
	isActive,
	onFetchingChange,
	queryState,
	onMobileFilterOpenChange,
	mobileFilterOpen,
	refreshToken,
	variant,
}: {
	isActive: boolean
	onFetchingChange: (isFetching: boolean) => void
	queryState: ListQueryParamsState<PublishReviewFilterDraft, SkillReviewListParams>
	onMobileFilterOpenChange: (open: boolean) => void
	mobileFilterOpen: boolean
	refreshToken: number
	variant: PublishReviewVariant
}) {
	const { t } = useTranslation()
	const { language } = useI18n()
	const hasPlatformEditRight = useRights(PERMISSION_KEY_MAP.PLATFORM_SKILL_REVIEW_EDIT)
	const hasInternalEditRight = useInternalSkillReviewEditRight()
	const hasEditRight = variant === "platform" ? hasPlatformEditRight : hasInternalEditRight
	const { filterDraft, page, pageSize, params, setFilterDraft, setPage, setPageSize } = queryState
	const [reviewDialog, setReviewDialog] =
		useState<ReviewDialogState<SkillVersionReviewItem>>(null)
	const query = useSkillReviewListQuery(params, isActive, variant)
	const { refetch } = query
	const mutation = useReviewSkillVersionMutation(variant)

	useEffect(() => {
		if (isActive) onFetchingChange(query.isFetching)
	}, [isActive, onFetchingChange, query.isFetching])

	useEffect(() => {
		if (isActive && refreshToken > 0) void refetch()
	}, [isActive, refetch, refreshToken])

	const columns = useMemo<Array<ColumnDef<SkillVersionReviewItem>>>(
		() => [
			{
				id: "name",
				size: 280,
				header: t("publishReview.column.skillName"),
				cell: ({ row }) => (
					<NameCell
						fallbackIcon={<Sparkles className="size-4" aria-hidden="true" />}
						name={getLocalizedText(row.original.name_i18n, language)}
						secondary={`${t("publishReview.column.packageName")}: ${row.original.package_name || t("common.emptyValue")}`}
						secondaryCopyValue={row.original.package_name || undefined}
					/>
				),
			},
			{
				id: "organization",
				size: 240,
				header: t("publishReview.column.organization"),
				cell: ({ row }) => (
					<OrganizationCell
						code={row.original.organization?.code || row.original.organization_code}
						name={row.original.organization?.name}
					/>
				),
			},
			{
				id: "description",
				size: 280,
				header: t("publishReview.column.description"),
				cell: ({ row }) => (
					<ClampedText
						value={getLocalizedText(row.original.description_i18n, language)}
					/>
				),
			},
			createReviewVersionColumn<SkillVersionReviewItem>({ t }),
			...createSharedReviewColumns<SkillVersionReviewItem>({
				includePublishTargetType: variant === "internal",
				t,
			}),
			createReviewActionColumn<SkillVersionReviewItem>({
				canReview: (record) => hasEditRight && canReviewRecord(record),
				onReview: (record, action) => setReviewDialog({ action, record }),
				pendingId: mutation.isPending ? reviewDialog?.record.id : undefined,
				t,
			}),
		],
		[hasEditRight, language, mutation.isPending, reviewDialog?.record.id, t, variant],
	)

	async function handleReview(values: {
		action: PublishReviewAction
		publisherType?: PublishReviewPublisherType
		reviewRemark?: string
		record: SkillVersionReviewItem
	}) {
		if (!hasEditRight || !canReviewRecord(values.record)) return
		await mutation.mutateAsync({
			id: values.record.id,
			values: createReviewPayload(values, variant),
		})
		toast.success(t("publishReview.message.reviewSuccess"))
	}

	return (
		<>
			<ReviewListPanel
				columns={columns}
				data={query.data?.list ?? []}
				emptyDescription={t("publishReview.empty.skillDescription")}
				emptyIcon={Sparkles}
				emptyTitle={t("publishReview.empty.skillTitle")}
				filterDraft={filterDraft}
				isFetching={query.isFetching}
				kind="skill"
				minWidth={1640}
				onDraftChange={setFilterDraft}
				onMobileFilterOpenChange={onMobileFilterOpenChange}
				mobileFilterOpen={isActive && mobileFilterOpen}
				onPageChange={setPage}
				onPageSizeChange={setPageSize}
				page={page}
				pageSize={pageSize}
				queryError={query.error as ApiError | null}
				total={query.data?.total ?? 0}
				variant={variant}
			/>
			<ReviewActionDialogs
				dialogState={reviewDialog}
				isPending={mutation.isPending}
				onClose={() => setReviewDialog(null)}
				onConfirm={handleReview}
				variant={variant}
			/>
		</>
	)
}
