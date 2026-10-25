import { ChevronDown, Loader2, RefreshCw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { cn } from "@/utils/cn"
import type { MetricsFormValues } from "./SelfMediaOpsMetricsDialog.helpers"
import { METRIC_FIELDS } from "./SelfMediaOpsMetricsDialog.helpers"

type FieldChangeHandler = (field: keyof MetricsFormValues, value: string) => void

export function OpsMetricsSourceSection({
	values,
	sourceStatusLabelKey,
	saving,
	fetching,
	loading,
	canPersist,
	canUsePublishedUrl,
	canFetchPublishedData,
	onFieldChange,
	onFetchPublishedData,
}: {
	values: MetricsFormValues
	sourceStatusLabelKey: string
	saving: boolean
	fetching: boolean
	loading: boolean
	canPersist: boolean
	canUsePublishedUrl: boolean
	canFetchPublishedData: boolean
	onFieldChange: FieldChangeHandler
	onFetchPublishedData: () => void
}) {
	const { t } = useTranslation("super")

	return (
		<section className="space-y-3 rounded-lg border bg-card p-3">
			<h3 className="text-sm font-medium text-foreground">
				{t("detail.selfMedia.opsMetrics.sections.source")}
			</h3>
			<label className="space-y-1.5" data-testid="self-media-ops-metrics-dialog-parts-label">
				<span className="text-xs font-medium text-foreground">
					{t("detail.selfMedia.opsMetrics.fields.sourceUrl")}
				</span>
				<Input
					value={values.sourceUrl}
					onChange={(event) => onFieldChange("sourceUrl", event.target.value)}
					placeholder={t("detail.selfMedia.opsMetrics.sourceUrlPlaceholder")}
					aria-required="true"
					disabled={saving || fetching}
					data-testid="self-media-ops-source-url"
				/>
			</label>
			<div
				className={cn(
					"rounded border px-3 py-2 text-xs leading-relaxed",
					values.sourceFetchStatus === "fetched"
						? "border-primary/20 bg-primary/10 text-primary"
						: values.sourceFetchStatus === "failed"
							? "border-destructive/20 bg-destructive/10 text-destructive"
							: "border-border bg-muted/40 text-muted-foreground",
				)}
				data-testid="self-media-ops-source-status"
			>
				<div className="font-medium">{t(sourceStatusLabelKey)}</div>
				{values.sourceLastFetchedAt ? (
					<div>
						{t("detail.selfMedia.opsMetrics.sourceLastFetched", {
							time: values.sourceLastFetchedAt,
						})}
					</div>
				) : null}
				{values.sourceFailureReason ? (
					<div>
						{t("detail.selfMedia.opsMetrics.sourceFailureReason", {
							reason: values.sourceFailureReason,
						})}
					</div>
				) : null}
			</div>
			<div className="flex justify-end">
				<Button
					type="button"
					onClick={onFetchPublishedData}
					disabled={
						!canPersist ||
						loading ||
						saving ||
						fetching ||
						!canUsePublishedUrl ||
						!canFetchPublishedData
					}
					data-testid="self-media-ops-fetch-published-data"
				>
					{fetching ? (
						<Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" />
					) : (
						<RefreshCw className="mr-1.5 size-4" aria-hidden="true" />
					)}
					{fetching
						? t("detail.selfMedia.opsMetrics.fetchingPublishedData")
						: t("detail.selfMedia.opsMetrics.fetchPublishedData")}
				</Button>
			</div>
		</section>
	)
}

export function OpsMetricsManualDataSection({
	values,
	filledMetricCount,
	manualDataOpen,
	saving,
	fetching,
	onToggleManualData,
	onFieldChange,
}: {
	values: MetricsFormValues
	filledMetricCount: number
	manualDataOpen: boolean
	saving: boolean
	fetching: boolean
	onToggleManualData: () => void
	onFieldChange: FieldChangeHandler
}) {
	const { t } = useTranslation("super")

	return (
		<section className="rounded-lg border bg-card">
			<button
				type="button"
				className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-medium text-foreground"
				onClick={onToggleManualData}
				aria-expanded={manualDataOpen}
				data-testid="self-media-ops-optional-toggle"
			>
				<span>{t("detail.selfMedia.opsMetrics.optionalToggle")}</span>
				<ChevronDown
					className={cn(
						"size-4 text-muted-foreground transition-transform",
						manualDataOpen ? "rotate-180" : "",
					)}
					aria-hidden="true"
				/>
			</button>
			{manualDataOpen ? (
				<div className="space-y-4 border-t p-3">
					<div className="rounded border bg-muted/30 p-3 text-xs text-muted-foreground">
						{t("detail.selfMedia.opsMetrics.summary", {
							count: filledMetricCount,
						})}
					</div>
					<section className="space-y-3">
						<h3 className="text-sm font-medium text-foreground">
							{t("detail.selfMedia.opsMetrics.sections.metrics")}
						</h3>
						<div className="grid gap-3 sm:grid-cols-2">
							{METRIC_FIELDS.map(({ key, labelKey }) => (
								<label key={key} className="space-y-1.5" data-testid="self-media-ops-metrics-dialog-parts-label-2">
									<span className="text-xs font-medium text-foreground">
										{t(labelKey)}
									</span>
									<Input
										value={values[key]}
										onChange={(event) => onFieldChange(key, event.target.value)}
										placeholder={t(
											"detail.selfMedia.opsMetrics.metricPlaceholder",
										)}
										disabled={saving || fetching}
										data-testid={`self-media-ops-metrics-${key}`}
									/>
								</label>
							))}
						</div>
						<label className="block space-y-1.5" data-testid="self-media-ops-metrics-dialog-parts-label-3">
							<span className="text-xs font-medium text-foreground">
								{t("detail.selfMedia.opsMetrics.fields.notes")}
							</span>
							<textarea
								value={values.notes}
								onChange={(event) => onFieldChange("notes", event.target.value)}
								placeholder={t("detail.selfMedia.opsMetrics.notesPlaceholder")}
								disabled={saving || fetching}
								rows={3}
								className="flex w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
								data-testid="self-media-ops-metrics-notes"
							/>
						</label>
					</section>
					<section className="space-y-3">
						<h3 className="text-sm font-medium text-foreground">
							{t("detail.selfMedia.opsMetrics.sections.feedback")}
						</h3>
						<label className="block space-y-1.5" data-testid="self-media-ops-metrics-dialog-parts-label-4">
							<span className="text-xs font-medium text-foreground">
								{t("detail.selfMedia.opsMetrics.fields.feedbackSummary")}
							</span>
							<textarea
								value={values.feedbackSummary}
								onChange={(event) =>
									onFieldChange("feedbackSummary", event.target.value)
								}
								placeholder={t(
									"detail.selfMedia.opsMetrics.commentsSummaryPlaceholder",
								)}
								disabled={saving || fetching}
								rows={3}
								className="flex w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
								data-testid="self-media-ops-comments-summary"
							/>
						</label>
						<label className="block space-y-1.5" data-testid="self-media-ops-metrics-dialog-parts-label-5">
							<span className="text-xs font-medium text-foreground">
								{t("detail.selfMedia.opsMetrics.fields.commentSamples")}
							</span>
							<textarea
								value={values.commentsRaw}
								onChange={(event) =>
									onFieldChange("commentsRaw", event.target.value)
								}
								placeholder={t(
									"detail.selfMedia.opsMetrics.commentsRawPlaceholder",
								)}
								disabled={saving || fetching}
								rows={4}
								className="flex w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
								data-testid="self-media-ops-comments-raw"
							/>
						</label>
					</section>
					<section className="space-y-3">
						<h3 className="text-sm font-medium text-foreground">
							{t("detail.selfMedia.opsMetrics.sections.review")}
						</h3>
						<label className="block space-y-1.5" data-testid="self-media-ops-metrics-dialog-parts-label-6">
							<span className="text-xs font-medium text-foreground">
								{t("detail.selfMedia.opsMetrics.fields.review")}
							</span>
							<textarea
								value={values.reviewContent}
								onChange={(event) =>
									onFieldChange("reviewContent", event.target.value)
								}
								placeholder={t("detail.selfMedia.opsMetrics.reviewPlaceholder")}
								disabled={saving || fetching}
								rows={5}
								className="flex w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
								data-testid="self-media-ops-review-content"
							/>
						</label>
					</section>
				</div>
			) : null}
		</section>
	)
}
