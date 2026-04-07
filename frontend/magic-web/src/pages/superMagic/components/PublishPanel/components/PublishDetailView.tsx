import type { ComponentType } from "react"
import { BookCheck, Building2, Check, ChevronLeft, X } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Separator } from "@/components/shadcn-ui/separator"
import { cn } from "@/lib/utils"
import { usePublishPanelStore } from "../context"
import { getPublishToCopyKeys, getPublishToUiKey } from "../publishCopy"
import type { PublishHistoryRecord, PublishReviewStepState, PublishTo } from "../types"
import ReadonlyInternalTargetSection from "./ReadonlyInternalTargetSection"

interface PublishDetailViewProps {
	onClose: () => void
}

const publishToIconMap = {
	INTERNAL: Building2,
	MARKET: BookCheck,
} satisfies Record<PublishTo, ComponentType<{ className?: string }>>

export default observer(function PublishDetailView({ onClose }: PublishDetailViewProps) {
	const { t } = useTranslation("crew/market")
	const store = usePublishPanelStore()
	const record = store.selectedHistoryRecord

	if (!record) return null

	return (
		<div
			className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-background"
			data-testid="skill-publish-detail-panel"
		>
			<div className="flex items-center gap-2 px-3.5 pb-3 pt-3.5">
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-8 rounded-md px-2.5"
					onClick={store.openHistoryView}
					data-testid="skill-publish-detail-back-button"
				>
					<ChevronLeft className="size-4" />
					{t("skillEditPage.actions.publish")}
				</Button>
				<h2 className="min-w-0 flex-1 truncate text-base font-medium text-foreground">
					{t("skillEditPage.publishPanel.detail.title", { version: record.version })}
				</h2>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="size-8 rounded-md"
					onClick={onClose}
					data-testid="skill-publish-detail-close-button"
				>
					<X className="size-4" />
				</Button>
			</div>

			<Separator />

			<div className="min-h-0 flex-1 overflow-auto p-4">
				<div className="flex flex-col gap-4" data-testid="skill-publish-detail-form">
					<ReadonlyTextField
						label={t("skillEditPage.publishPanel.create.fields.version.label")}
						value={record.version}
						testId="skill-publish-detail-version-input"
					/>

					<ReadonlyTextField
						label={t("skillEditPage.publishPanel.create.fields.details.label")}
						value={record.versionDetails}
						testId="skill-publish-detail-details-input"
					/>

					<div className="flex flex-col gap-2">
						<div className="flex items-center justify-between gap-3">
							<p className="text-base font-medium text-foreground">
								{t("skillEditPage.publishPanel.create.fields.target.label")}
							</p>
							<p className="text-xs leading-4 text-muted-foreground">
								{t("skillEditPage.publishPanel.create.fields.target.helper")}
							</p>
						</div>
						<ReadonlyPublishToCard publishTo={record.publishTo} />
					</div>

					<div className="flex flex-col gap-2">
						<p className="text-base font-medium text-foreground">
							{t("skillEditPage.publishPanel.create.fields.permissionSettings.label")}
						</p>
						{record.publishTo === "INTERNAL" ? (
							<ReadonlyInternalTargetSection record={record} />
						) : (
							<ReadonlySkillsLibraryCard record={record} />
						)}
					</div>
				</div>
			</div>
		</div>
	)
})

function ReadonlyTextField({
	label,
	value,
	testId,
}: {
	label: string
	value: string
	testId: string
}) {
	const { t } = useTranslation("crew/market")
	const displayValue =
		value.trim().length > 0 ? value : t("skillEditPage.publishPanel.detail.noContent")

	return (
		<div className="flex flex-col gap-1.5">
			<p className="text-base font-medium text-foreground">{label}</p>
			<p className="min-h-9 text-sm leading-5 text-foreground" data-testid={testId}>
				{displayValue}
			</p>
		</div>
	)
}

function ReadonlyPublishToCard({ publishTo }: { publishTo: PublishTo }) {
	const { t } = useTranslation("crew/market")
	const store = usePublishPanelStore()
	const Icon = publishToIconMap[publishTo]
	const copy = getPublishToCopyKeys({
		publishTo,
		marketCopy: store.marketCopy,
	})
	const publishToUiKey = getPublishToUiKey(publishTo)

	return (
		<div
			className="rounded-lg border border-border bg-card p-3"
			data-testid={`skill-publish-detail-publish-to-${publishToUiKey}`}
		>
			<div className="flex items-start gap-3">
				<Icon className="mt-0.5 size-4 shrink-0 text-foreground" />
				<div className="min-w-0 flex-1">
					<p className="text-sm font-medium leading-none text-foreground">
						{t(copy.labelKey)}
					</p>
					<p className="mt-1.5 text-sm leading-5 text-muted-foreground">
						{t(copy.descriptionKey)}
					</p>
				</div>
			</div>
		</div>
	)
}

function ReadonlySkillsLibraryCard({
	record,
}: {
	record: NonNullable<ReturnType<typeof usePublishPanelStore>["selectedHistoryRecord"]>
}) {
	const { t } = useTranslation("crew/market")
	const store = usePublishPanelStore()

	return (
		<div
			className="rounded-md border border-border bg-card p-3"
			data-testid="skill-publish-detail-skills-library-card"
		>
			<div className="flex items-start gap-2.5">
				<BookCheck className="mt-0.5 size-4 shrink-0 text-foreground" />
				<div className="min-w-0 flex-1">
					<p className="text-sm leading-5 text-foreground">
						{t(store.marketCopy.targetLabelKey)}
					</p>
					<p className="mt-1 text-xs leading-4 text-muted-foreground">
						{t(store.marketCopy.targetDescriptionKey)}
					</p>
				</div>
			</div>
			<Separator className="my-3" />
			<SkillsLibraryProgress review={record.skillsLibraryReview} />
		</div>
	)
}

function SkillsLibraryProgress({
	review,
}: {
	review: PublishHistoryRecord["skillsLibraryReview"]
}) {
	const { t } = useTranslation("crew/market")
	const store = usePublishPanelStore()
	if (!review) return null

	const steps = [
		{
			key: "submit",
			label: t("skillEditPage.publishPanel.detail.skillsLibrary.steps.submit"),
			state: review.submit,
		},
		{
			key: "review",
			label: t("skillEditPage.publishPanel.detail.skillsLibrary.steps.review"),
			state: review.review,
		},
		{
			key: "published",
			label:
				review.published === "failed"
					? t("skillEditPage.publishPanel.detail.reviewFailed")
					: t(store.marketCopy.publishToLabelKey),
			state: review.published,
		},
	] as const

	return (
		<div
			className="flex flex-col gap-3.5"
			data-testid="skill-publish-detail-skills-library-progress"
		>
			<div className="flex flex-wrap items-start justify-center gap-8 py-3.5">
				{steps.map((step, index) => (
					<div key={step.key} className="flex items-center gap-3">
						<StepBadge state={step.state} index={index} />
						<p
							className={cn(
								"text-sm leading-none",
								step.state === "pending"
									? "text-muted-foreground"
									: step.state === "failed"
										? "text-destructive"
										: "text-foreground",
							)}
						>
							{step.label}
						</p>
					</div>
				))}
			</div>
			{review.failureReason ? (
				<div
					className="rounded-md bg-secondary p-3"
					data-testid="skill-publish-detail-failure-reason"
				>
					<p className="text-sm font-medium text-foreground">
						{t("skillEditPage.publishPanel.detail.reason")}
					</p>
					<p className="mt-2 text-xs leading-4 text-foreground">{review.failureReason}</p>
				</div>
			) : null}
		</div>
	)
}

function StepBadge({ state, index }: { state: PublishReviewStepState; index: number }) {
	if (state === "done") {
		return (
			<div className="flex size-8 items-center justify-center rounded-full border border-primary bg-background text-foreground">
				<Check className="size-4" />
			</div>
		)
	}

	if (state === "failed") {
		return (
			<div className="flex size-8 items-center justify-center rounded-full border border-destructive bg-background text-destructive">
				<X className="size-4" />
			</div>
		)
	}

	return (
		<div
			className={cn(
				"flex size-8 items-center justify-center rounded-full border text-sm font-semibold leading-none",
				state === "current"
					? "border-primary bg-primary text-primary-foreground"
					: "border-border bg-background text-muted-foreground",
			)}
		>
			{index + 1}
		</div>
	)
}
