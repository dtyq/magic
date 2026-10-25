import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@magic-admin-v2/components/confirm-dialog"
import { FilterControlField } from "@magic-admin-v2/components/filter-control-field"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@magic-admin-v2/components/ui/select"
import { Textarea } from "@magic-admin-v2/components/ui/textarea"
import {
	getDefaultPublisherType,
	getErrorMessage,
	type ReviewDialogState,
	type ReviewRecordBase,
} from "@magic-admin-v2/features/platform-publish-review/formatters"
import type {
	PublishReviewAction,
	PublishReviewPublisherType,
	PublishReviewVariant,
} from "@magic-admin-v2/features/platform-publish-review/types"
import { useRuntime } from "@magic-admin-v2/runtime/context"

export function ReviewActionDialogs<TRecord extends ReviewRecordBase>({
	dialogState,
	isPending,
	onClose,
	onConfirm,
	variant,
}: {
	dialogState: ReviewDialogState<TRecord>
	isPending: boolean
	onClose: () => void
	onConfirm: (values: {
		action: PublishReviewAction
		publisherType?: PublishReviewPublisherType
		reviewRemark?: string
		record: TRecord
	}) => Promise<void>
	variant: PublishReviewVariant
}) {
	const { t } = useTranslation()
	const { organization } = useRuntime()
	const defaultPublisherType = getDefaultPublisherType(organization.current.organizationCode)
	const [publisherType, setPublisherType] =
		useState<PublishReviewPublisherType>(defaultPublisherType)
	const [reviewRemark, setReviewRemark] = useState("")

	useEffect(() => {
		if (dialogState?.action === "APPROVED") setPublisherType(defaultPublisherType)
		if (dialogState?.action === "REJECTED") setReviewRemark("")
	}, [defaultPublisherType, dialogState])

	async function handleApprove() {
		if (!dialogState) return
		try {
			await onConfirm({
				action: "APPROVED",
				publisherType: variant === "platform" ? publisherType : undefined,
				record: dialogState.record,
			})
			onClose()
		} catch (error) {
			toast.error(getErrorMessage(error, t("publishReview.error.reviewFailed")))
		}
	}

	async function handleReject() {
		if (!dialogState) return
		try {
			await onConfirm({
				action: "REJECTED",
				record: dialogState.record,
				reviewRemark: variant === "internal" ? reviewRemark : undefined,
			})
			onClose()
		} catch (error) {
			toast.error(getErrorMessage(error, t("publishReview.error.reviewFailed")))
		}
	}

	return (
		<>
			<ConfirmDialog
				open={dialogState?.action === "APPROVED"}
				title={t("publishReview.dialog.approveTitle")}
				description={t(
					variant === "internal"
						? "publishReview.dialog.internalApproveDescription"
						: "publishReview.dialog.approveDescription",
				)}
				confirmLabel={t("publishReview.action.confirmApprove")}
				isPending={isPending}
				onOpenChange={(open) => {
					if (!open) onClose()
				}}
				onConfirm={handleApprove}
			 contentTestId="platform-publish-review-confirm-dialog-content" cancelButtonTestId="platform-publish-review-confirm-dialog-cancel-button" confirmButtonTestId="platform-publish-review-confirm-dialog-confirm-button">
				{variant === "platform" ? (
					<FilterControlField label={t("publishReview.field.publisherType")}>
						<Select
							disabled={isPending}
							value={publisherType}
							onValueChange={(value) =>
								setPublisherType(value as PublishReviewPublisherType)
							}
						>
							<SelectTrigger data-testid="platform-publish-review-select-trigger">
								<SelectValue />
							</SelectTrigger>
							<SelectContent data-testid="platform-publish-review-select-content">
								<SelectItem value="USER" data-testid="platform-publish-review-option">
									{t("publishReview.publisherType.user")}
								</SelectItem>
								<SelectItem value="OFFICIAL" data-testid="platform-publish-review-option">
									{t("publishReview.publisherType.official")}
								</SelectItem>
							</SelectContent>
						</Select>
					</FilterControlField>
				) : null}
			</ConfirmDialog>

			<ConfirmDialog
				open={dialogState?.action === "REJECTED"}
				title={t("publishReview.dialog.rejectTitle")}
				description={t("publishReview.dialog.rejectDescription")}
				variant="danger"
				confirmLabel={t("publishReview.action.confirmReject")}
				isPending={isPending}
				onOpenChange={(open) => {
					if (!open) onClose()
				}}
				onConfirm={handleReject}
			 contentTestId="platform-publish-review-secondary-confirm-dialog-content" cancelButtonTestId="platform-publish-review-secondary-confirm-dialog-cancel-button" confirmButtonTestId="platform-publish-review-secondary-confirm-dialog-confirm-button">
				{variant === "internal" ? (
					<FilterControlField label={t("publishReview.field.reviewRemark")}>
						<Textarea
							disabled={isPending}
							maxLength={1000}
							onChange={(event) => setReviewRemark(event.target.value)}
							placeholder={t("publishReview.placeholder.reviewRemark")}
							value={reviewRemark}
						 data-testid="platform-publish-review-textarea-input"/>
					</FilterControlField>
				) : null}
			</ConfirmDialog>
		</>
	)
}
