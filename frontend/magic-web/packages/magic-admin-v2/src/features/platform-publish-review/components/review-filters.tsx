import { useTranslation } from "react-i18next"
import { FilterControlField } from "@magic-admin-v2/components/filter-control-field"
import { FilterSearchInput } from "@magic-admin-v2/components/filter-search-input"
import type { ListFilterPanelFieldsProps } from "@magic-admin-v2/components/list-filter-panel"
import { relativeUnit, TimeFilterPanel } from "@magic-admin-v2/components/time-filter-panel"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@magic-admin-v2/components/ui/select"
import {
	publishReviewPublishStatus,
	publishReviewSelectAllValue,
	publishReviewStatus,
	publishReviewTargetType,
	type PublishReviewFilterDraft,
	type PublishReviewKind,
	type PublishReviewOrderBy,
	type PublishReviewVariant,
} from "@magic-admin-v2/features/platform-publish-review/types"
import {
	getPublishStatusLabel,
	getPublishTargetTypeLabel,
	getReviewStatusLabel,
} from "@magic-admin-v2/features/platform-publish-review/formatters"

const dayOnlyRelativeUnits = [relativeUnit.day] as const

export function AdvancedFilterControls({
	kind,
	onChange,
	value,
	variant,
}: ListFilterPanelFieldsProps<PublishReviewFilterDraft> & {
	kind: PublishReviewKind
	variant: PublishReviewVariant
}) {
	const { t } = useTranslation()

	return (
		<>
			{kind === "employee" ? (
				<>
					<SearchInput
						label={t("publishReview.filter.employeeName")}
						onChange={(name_i18n) => onChange({ name_i18n })}
						placeholder={t("publishReview.placeholder.employeeName")}
						value={value.name_i18n}
					/>
					{variant === "platform" ? (
						<SearchInput
							label={t("publishReview.filter.organizationCode")}
							onChange={(organization_code) => onChange({ organization_code })}
							placeholder={t("publishReview.placeholder.organizationCode")}
							value={value.organization_code}
						/>
					) : null}
				</>
			) : variant === "internal" ? (
				<SearchInput
					label={t("publishReview.filter.skillName")}
					onChange={(skill_name) => onChange({ skill_name })}
					placeholder={t("publishReview.placeholder.skillName")}
					value={value.skill_name}
				/>
			) : (
				<SearchInput
					label={t("publishReview.filter.packageName")}
					onChange={(package_name) => onChange({ package_name })}
					placeholder={t("publishReview.placeholder.packageName")}
					value={value.package_name}
				/>
			)}
			<SearchInput
				label={t("publishReview.filter.version")}
				onChange={(version) => onChange({ version })}
				placeholder={t("publishReview.placeholder.version")}
				value={value.version}
			/>
			<ReviewStatusSelect
				className="w-full"
				triggerClassName="w-full"
				label={t("publishReview.filter.reviewStatus")}
				onChange={(review_status) => onChange({ review_status })}
				value={value.review_status}
				variant={variant}
			/>
			<PublishStatusSelect
				className="w-full"
				triggerClassName="w-full"
				label={t("publishReview.filter.publishStatus")}
				onChange={(publish_status) => onChange({ publish_status })}
				value={value.publish_status}
				variant={variant}
			/>
			<PublishTargetTypeSelect
				className="w-full"
				triggerClassName="w-full"
				label={t("publishReview.filter.publishTargetType")}
				onChange={(publish_target_type) => onChange({ publish_target_type })}
				value={value.publish_target_type}
				variant={variant}
			/>
			<FilterControlField className="w-full" label={t("publishReview.filter.orderBy")}>
				<Select
					value={value.order_by}
					onValueChange={(order_by) =>
						onChange({ order_by: order_by as PublishReviewOrderBy })
					}
				>
					<SelectTrigger className="w-full" data-testid="platform-publish-review-select-trigger">
						<SelectValue />
					</SelectTrigger>
					<SelectContent data-testid="platform-publish-review-select-content">
						<SelectItem data-testid="platform-publish-review-option" value="desc">
							{t("publishReview.order.desc")}
						</SelectItem>
						<SelectItem data-testid="platform-publish-review-option" value="asc">
							{t("publishReview.order.asc")}
						</SelectItem>
					</SelectContent>
				</Select>
			</FilterControlField>
			<FilterControlField className="w-full" label={t("publishReview.filter.createdAt")}>
				<TimeFilterPanel
					className="w-full"
					testIdPrefix="platform-publish-review-time-filter"
					onChange={(timeRange) =>
						onChange({
							end_time: timeRange?.endDate.slice(0, 10) ?? "",
							start_time: timeRange?.startDate.slice(0, 10) ?? "",
							time_range: timeRange,
						})
					}
					presentation="popover"
					supportedRelativeUnits={dayOnlyRelativeUnits}
					timePrecision="day"
					value={value.time_range}
				/>
			</FilterControlField>
		</>
	)
}

export function SearchInput({
	label,
	onChange,
	placeholder,
	value,
}: {
	label: string
	onChange: (value: string) => void
	placeholder: string
	value: string
}) {
	const { t } = useTranslation()

	return (
		<FilterControlField className="w-full" label={label}>
			<FilterSearchInput
				aria-label={label}
				clearButtonTestId="platform-publish-review-search-clear-button"
				clearLabel={t("common.clear")}
				containerClassName="min-w-0"
				inputTestId="platform-publish-review-search-input"
				onValueChange={onChange}
				placeholder={placeholder}
				value={value}
			/>
		</FilterControlField>
	)
}

export function ReviewStatusSelect({
	className,
	label,
	onChange,
	triggerClassName = "w-fit max-w-full",
	value,
	variant = "platform",
}: {
	className?: string
	label: string
	onChange: (value: string) => void
	triggerClassName?: string
	value: string
	variant?: PublishReviewVariant
}) {
	const { t } = useTranslation()
	const statuses =
		variant === "internal"
			? [
					publishReviewStatus.pending,
					publishReviewStatus.underReview,
					publishReviewStatus.approved,
					publishReviewStatus.rejected,
				]
			: Object.values(publishReviewStatus)

	return (
		<FilterControlField className={className} label={label}>
			<Select value={value} onValueChange={onChange}>
				<SelectTrigger
					className={triggerClassName}
					data-testid="platform-publish-review-select-trigger"
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent data-testid="platform-publish-review-select-content">
					<SelectItem
						data-testid="platform-publish-review-option"
						value={publishReviewSelectAllValue}
					>
						{t("publishReview.filter.all")}
					</SelectItem>
					{statuses.map((status) => (
						<SelectItem
							data-testid="platform-publish-review-option"
							key={status}
							value={status}
						>
							{getReviewStatusLabel(status, t)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</FilterControlField>
	)
}

export function PublishStatusSelect({
	className,
	label,
	onChange,
	triggerClassName = "w-fit max-w-full",
	value,
	variant = "platform",
}: {
	className?: string
	label: string
	onChange: (value: string) => void
	triggerClassName?: string
	value: string
	variant?: PublishReviewVariant
}) {
	const { t } = useTranslation()
	const statuses =
		variant === "internal"
			? [
					publishReviewPublishStatus.unpublished,
					publishReviewPublishStatus.publishing,
					publishReviewPublishStatus.published,
				]
			: Object.values(publishReviewPublishStatus)

	return (
		<FilterControlField className={className} label={label}>
			<Select value={value} onValueChange={onChange}>
				<SelectTrigger
					className={triggerClassName}
					data-testid="platform-publish-review-select-trigger"
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent data-testid="platform-publish-review-select-content">
					<SelectItem
						data-testid="platform-publish-review-option"
						value={publishReviewSelectAllValue}
					>
						{t("publishReview.filter.all")}
					</SelectItem>
					{statuses.map((status) => (
						<SelectItem
							data-testid="platform-publish-review-option"
							key={status}
							value={status}
						>
							{getPublishStatusLabel(status, t)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</FilterControlField>
	)
}

export function PublishTargetTypeSelect({
	className,
	label,
	onChange,
	triggerClassName = "w-fit max-w-full",
	value,
	variant = "platform",
}: {
	className?: string
	label: string
	onChange: (value: string) => void
	triggerClassName?: string
	value: string
	variant?: PublishReviewVariant
}) {
	const { t } = useTranslation()
	const targetTypes =
		variant === "internal"
			? [publishReviewTargetType.member, publishReviewTargetType.organization]
			: Object.values(publishReviewTargetType)

	return (
		<FilterControlField className={className} label={label}>
			<Select value={value} onValueChange={onChange}>
				<SelectTrigger
					className={triggerClassName}
					data-testid="platform-publish-review-select-trigger"
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent data-testid="platform-publish-review-select-content">
					<SelectItem
						data-testid="platform-publish-review-option"
						value={publishReviewSelectAllValue}
					>
						{t("publishReview.filter.all")}
					</SelectItem>
					{targetTypes.map((type) => (
						<SelectItem
							data-testid="platform-publish-review-option"
							key={type}
							value={type}
						>
							{getPublishTargetTypeLabel(type, t)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</FilterControlField>
	)
}
