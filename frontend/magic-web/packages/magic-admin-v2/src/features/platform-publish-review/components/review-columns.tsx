import type { ColumnDef } from "@tanstack/react-table"
import { Check, Loader2, XCircle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@magic-admin-v2/components/ui/button"
import {
	canReviewRecord,
	getPublishStatusLabel,
	getPublishStatusTone,
	getPublisher,
	getReviewStatusLabel,
	getReviewStatusTone,
	type ReviewRecordBase,
} from "@magic-admin-v2/features/platform-publish-review/formatters"
import type { PublishReviewAction } from "@magic-admin-v2/features/platform-publish-review/types"
import {
	CopyableTableText,
	PublishTargetCell,
	StatusBadge,
} from "@magic-admin-v2/features/platform-publish-review/components/review-cells"

export function createReviewVersionColumn<TRecord extends ReviewRecordBase>({
	t,
}: {
	t: ReturnType<typeof useTranslation>["t"]
}): ColumnDef<TRecord> {
	return {
		id: "version",
		size: 120,
		header: t("publishReview.column.version"),
		cell: ({ row }) => <CopyableTableText value={row.original.version} />,
	}
}

export function createSharedReviewColumns<TRecord extends ReviewRecordBase>({
	includePublishTargetType = false,
	t,
}: {
	includePublishTargetType?: boolean
	t: ReturnType<typeof useTranslation>["t"]
}): Array<ColumnDef<TRecord>> {
	return [
		{
			id: "publish_status",
			size: 120,
			header: t("publishReview.column.publishStatus"),
			cell: ({ row }) => (
				<StatusBadge
					label={getPublishStatusLabel(row.original.publish_status, t)}
					tone={getPublishStatusTone(row.original.publish_status)}
				/>
			),
		},
		...(includePublishTargetType
			? [
					{
						id: "publish_target_type",
						size: 140,
						header: t("publishReview.column.publishTargetType"),
						cell: ({ row }: { row: { original: TRecord } }) => (
							<PublishTargetCell
								targetType={row.original.publish_target_type}
								targetValue={row.original.publish_target_value}
							/>
						),
					},
				]
			: []),
		{
			id: "review_status",
			size: 120,
			header: t("publishReview.column.reviewStatus"),
			cell: ({ row }) => (
				<StatusBadge
					label={getReviewStatusLabel(row.original.review_status, t)}
					tone={getReviewStatusTone(row.original.review_status)}
				/>
			),
		},
		{
			id: "publisher",
			size: 150,
			header: t("publishReview.column.publisher"),
			cell: ({ row }) => <span className="truncate">{getPublisher(row.original)}</span>,
		},
		{
			id: "created_at",
			size: 180,
			header: t("publishReview.column.createdAt"),
			cell: ({ row }) => (
				<span className="whitespace-nowrap text-muted-foreground">
					{row.original.created_at || "-"}
				</span>
			),
		},
	]
}

export function createReviewActionColumn<TRecord extends ReviewRecordBase>({
	canReview: canReviewOverride,
	onReview,
	pendingId,
	t,
}: {
	canReview?: (record: TRecord) => boolean
	onReview: (record: TRecord, action: PublishReviewAction) => void
	pendingId?: string
	t: ReturnType<typeof useTranslation>["t"]
}): ColumnDef<TRecord> {
	return {
		id: "actions",
		size: 190,
		header: t("publishReview.column.actions"),
		cell: ({ row }) => {
			const canReview = canReviewOverride?.(row.original) ?? canReviewRecord(row.original)
			const rowPending = pendingId === row.original.id

			return (
				<div className="flex items-center gap-2">
					<Button
						data-testid="platform-publish-review-view-button"
						disabled={!canReview || rowPending}
						onClick={() => onReview(row.original, "APPROVED")}
						size="icon-sm"
						className="md:w-auto md:gap-1.5 md:px-2.5"
						variant="outline"
					>
						{rowPending ? (
							<Loader2 className="size-4 animate-spin" aria-hidden="true" />
						) : (
							<Check className="size-4" aria-hidden="true" />
						)}
						<span className="hidden md:inline">
							{t("publishReview.action.approve")}
						</span>
					</Button>
					<Button
						className="text-destructive hover:text-destructive md:w-auto md:gap-1.5 md:px-2.5"
						data-testid="platform-publish-review-view-button"
						disabled={!canReview || rowPending}
						onClick={() => onReview(row.original, "REJECTED")}
						size="icon-sm"
						variant="outline"
					>
						<XCircle className="size-4" aria-hidden="true" />
						<span className="hidden md:inline">{t("publishReview.action.reject")}</span>
					</Button>
				</div>
			)
		},
	}
}
