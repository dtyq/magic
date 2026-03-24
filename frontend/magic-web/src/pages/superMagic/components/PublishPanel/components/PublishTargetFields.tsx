import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { usePublishPanelStore } from "../context"
import { getPublishToCopyKeys, getPublishToUiKey } from "../publishCopy"
import type { PublishTo } from "../types"
import PublishInternalTargetSection from "./PublishInternalTargetSection"

const publishToOrder: PublishTo[] = ["INTERNAL", "MARKET"]

interface PublishTargetFieldsProps {
	disabled?: boolean
}

export default observer(function PublishTargetFields({
	disabled = false,
}: PublishTargetFieldsProps) {
	const { t } = useTranslation("crew/market")
	const store = usePublishPanelStore()
	const availablePublishTo = publishToOrder.filter((item) =>
		store.availablePublishTo.includes(item),
	)

	return (
		<div className="flex flex-col gap-4" data-testid="skill-publish-target-fields">
			<div className="flex items-center justify-between gap-3">
				<p className="flex items-center gap-1 text-base font-medium text-foreground">
					{t("skillEditPage.publishPanel.create.fields.target.label")}
					<span className="text-destructive" aria-hidden="true">
						*
					</span>
				</p>
				<p className="text-xs leading-4 text-muted-foreground">
					{t("skillEditPage.publishPanel.create.fields.target.helper")}
				</p>
			</div>

			<div className="grid gap-5 md:grid-cols-2">
				{availablePublishTo.map((publishTo) => (
					<PublishToCard
						key={publishTo}
						publishTo={publishTo}
						selected={store.isPublishToSelected(publishTo)}
						onSelect={store.selectPublishTo}
						disabled={disabled}
					/>
				))}
			</div>

			{store.draft.publishTo === "INTERNAL" ? (
				<PublishInternalTargetSection disabled={disabled} />
			) : (
				<PublishingProcess />
			)}
		</div>
	)
})

function PublishToCard({
	publishTo,
	selected,
	onSelect,
	disabled = false,
}: {
	publishTo: PublishTo
	selected: boolean
	onSelect: (publishTo: PublishTo) => void
	disabled?: boolean
}) {
	const { t } = useTranslation("crew/market")
	const store = usePublishPanelStore()
	const copy = getPublishToCopyKeys({
		publishTo,
		marketCopy: store.marketCopy,
	})
	const publishToUiKey = getPublishToUiKey(publishTo)

	return (
		<button
			type="button"
			className={cn(
				"flex w-full items-start gap-3 rounded-lg border bg-card p-3 text-left transition-colors",
				selected ? "border-foreground" : "border-border",
			)}
			onClick={() => onSelect(publishTo)}
			disabled={disabled}
			data-testid={`skill-publish-to-${publishToUiKey}`}
		>
			<div
				className={cn(
					"mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
					selected ? "border-primary bg-primary" : "border-input bg-background",
				)}
				aria-hidden="true"
			>
				<div
					className={cn(
						"size-2 rounded-full",
						selected ? "bg-primary-foreground" : "bg-transparent",
					)}
				/>
			</div>
			<div className="min-w-0 flex-1">
				<p className="text-sm font-medium leading-none text-foreground">
					{t(copy.labelKey)}
				</p>
				<p className="mt-1.5 text-sm leading-5 text-muted-foreground">
					{t(copy.descriptionKey)}
				</p>
			</div>
		</button>
	)
}

function PublishingProcess() {
	const { t } = useTranslation("crew/market")
	const steps = [
		t("skillEditPage.publishPanel.create.fields.target.skillsLibrary.steps.submit"),
		t("skillEditPage.publishPanel.create.fields.target.skillsLibrary.steps.review"),
		t("skillEditPage.publishPanel.create.fields.target.skillsLibrary.steps.published"),
	]

	return (
		<div className="flex flex-col gap-2" data-testid="skill-publish-process-section">
			<p className="text-base font-medium text-foreground">
				{t("skillEditPage.publishPanel.create.fields.publishingProcess.label")}
			</p>
			<div
				className="flex flex-wrap items-center justify-center gap-8 rounded-md border border-border bg-card px-3 py-6"
				data-testid="skill-publish-process-card"
			>
				{steps.map((step, index) => (
					<div key={step} className="flex items-center gap-3">
						<div
							className={cn(
								"flex size-8 items-center justify-center rounded-full border text-sm font-semibold leading-none",
								index === 0
									? "border-primary bg-primary text-primary-foreground"
									: "border-border bg-background text-muted-foreground",
							)}
						>
							{index + 1}
						</div>
						<p
							className={cn(
								"text-sm leading-none",
								index === 0 ? "text-foreground" : "text-muted-foreground",
							)}
						>
							{step}
						</p>
					</div>
				))}
			</div>
		</div>
	)
}
