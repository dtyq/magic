import {
	publishReviewPageSize,
	publishReviewSelectAllValue,
	type AgentReviewListParams,
	type PublishReviewFilterDraft,
	type PublishReviewKind,
	type PublishReviewSearchField,
	type PublishReviewVariant,
	type ReviewVersionParams,
	type SkillReviewListParams,
	type PublishReviewAction,
	type PublishReviewPublisherType,
} from "@magic-admin-v2/features/platform-publish-review/types"

export type ReviewDraftUpdater =
	PublishReviewFilterDraft | ((previous: PublishReviewFilterDraft) => PublishReviewFilterDraft)

export function createDefaultFilterDraft(
	kind: PublishReviewKind,
	variant: PublishReviewVariant = "platform",
): PublishReviewFilterDraft {
	return {
		end_time: "",
		name_i18n: "",
		order_by: "desc",
		organization_code: "",
		package_name: "",
		publish_status: publishReviewSelectAllValue,
		publish_target_type: publishReviewSelectAllValue,
		review_status: publishReviewSelectAllValue,
		search_field:
			kind === "employee"
				? "name_i18n"
				: variant === "internal"
					? "skill_name"
					: "package_name",
		search_value: "",
		skill_name: "",
		source_type: publishReviewSelectAllValue,
		start_time: "",
		time_range: null,
		version: "",
	}
}

export function countActiveReviewFilters(
	draft: PublishReviewFilterDraft,
	kind: PublishReviewKind,
): number {
	const kindSpecificValues =
		kind === "employee"
			? [draft.name_i18n, draft.organization_code]
			: [
					draft.package_name,
					draft.skill_name,
					draft.source_type === publishReviewSelectAllValue ? "" : draft.source_type,
				]

	return [
		...kindSpecificValues,
		draft.version,
		draft.review_status === publishReviewSelectAllValue ? "" : draft.review_status,
		draft.publish_status === publishReviewSelectAllValue ? "" : draft.publish_status,
		draft.publish_target_type === publishReviewSelectAllValue
			? ""
			: draft.publish_target_type,
		draft.start_time || draft.end_time || draft.time_range ? "active" : "",
	].filter((value) => typeof value === "string" && value.trim().length > 0).length
}

export function toAgentReviewParams(
	draft: PublishReviewFilterDraft,
	page: number,
	pageSize: number = publishReviewPageSize,
): AgentReviewListParams {
	return removeEmptyParams({
		page,
		page_size: pageSize,
		end_time: draft.end_time,
		name_i18n: draft.name_i18n.trim(),
		order_by: draft.order_by,
		organization_code: draft.organization_code.trim(),
		publish_status:
			draft.publish_status === publishReviewSelectAllValue ? undefined : draft.publish_status,
		publish_target_type:
			draft.publish_target_type === publishReviewSelectAllValue
				? undefined
				: draft.publish_target_type,
		review_status:
			draft.review_status === publishReviewSelectAllValue ? undefined : draft.review_status,
		start_time: draft.start_time,
		version: draft.version.trim(),
		...getSearchParams(draft, "employee"),
	})
}

export function toSkillReviewParams(
	draft: PublishReviewFilterDraft,
	page: number,
	pageSize: number = publishReviewPageSize,
): SkillReviewListParams {
	return removeEmptyParams({
		page,
		page_size: pageSize,
		end_time: draft.end_time,
		order_by: draft.order_by,
		package_name: draft.package_name.trim(),
		publish_status:
			draft.publish_status === publishReviewSelectAllValue ? undefined : draft.publish_status,
		publish_target_type:
			draft.publish_target_type === publishReviewSelectAllValue
				? undefined
				: draft.publish_target_type,
		review_status:
			draft.review_status === publishReviewSelectAllValue ? undefined : draft.review_status,
		skill_name: draft.skill_name.trim(),
		source_type:
			draft.source_type === publishReviewSelectAllValue ? undefined : draft.source_type,
		start_time: draft.start_time,
		version: draft.version.trim(),
		...getSearchParams(draft, "skill"),
	})
}

export function getSearchParams(
	draft: PublishReviewFilterDraft,
	kind: PublishReviewKind,
): Partial<AgentReviewListParams & SkillReviewListParams> {
	const searchValue = draft.search_value.trim()
	if (!searchValue) return {}

	if (kind === "employee") {
		if (draft.search_field === "name_i18n") return { name_i18n: searchValue }
		if (draft.search_field === "organization_code") return { organization_code: searchValue }
		if (draft.search_field === "version") return { version: searchValue }
		return {}
	}

	if (draft.search_field === "package_name") return { package_name: searchValue }
	if (draft.search_field === "skill_name") return { skill_name: searchValue }
	if (draft.search_field === "version") return { version: searchValue }
	return {}
}

export function createReviewPayload(
	values: {
		action: PublishReviewAction
		publisherType?: PublishReviewPublisherType
		reviewRemark?: string
	},
	variant: PublishReviewVariant,
): ReviewVersionParams {
	if (variant === "internal") {
		if (values.action === "REJECTED") {
			return {
				action: values.action,
				review_remark: values.reviewRemark?.trim() || null,
			}
		}

		return { action: values.action }
	}

	return removeEmptyParams({
		action: values.action,
		publisher_type: values.publisherType,
	})
}

export function removeEmptyParams<T extends Record<string, unknown>>(params: T): T {
	return Object.entries(params).reduce<Record<string, unknown>>((acc, [key, value]) => {
		if (value === "" || value === undefined || value === null) return acc
		acc[key] = value
		return acc
	}, {}) as T
}

export function getSearchFieldOptions(
	kind: PublishReviewKind,
	t: ReturnType<typeof import("react-i18next").useTranslation>["t"],
	variant: PublishReviewVariant,
): Array<{ value: PublishReviewSearchField; label: string }> {
	if (kind === "employee") {
		const options: Array<{ value: PublishReviewSearchField; label: string }> = [
			{ value: "name_i18n", label: t("publishReview.filter.employeeName") },
			{ value: "version", label: t("publishReview.filter.version") },
		]

		if (variant === "platform") {
			return [
				options[0],
				{ value: "organization_code", label: t("publishReview.filter.organizationCode") },
				options[1],
			]
		}

		return options
	}

	if (variant === "internal") {
		return [
			{ value: "skill_name", label: t("publishReview.filter.skillName") },
			{ value: "version", label: t("publishReview.filter.version") },
		]
	}

	return [
		{ value: "package_name", label: t("publishReview.filter.packageName") },
		{ value: "version", label: t("publishReview.filter.version") },
	]
}

export function getSearchFieldPlaceholder(
	field: PublishReviewSearchField,
	kind: PublishReviewKind,
	t: ReturnType<typeof import("react-i18next").useTranslation>["t"],
) {
	const placeholderMap: Record<PublishReviewSearchField, string> = {
		name_i18n: t("publishReview.placeholder.employeeName"),
		organization_code: t("publishReview.placeholder.organizationCode"),
		package_name: t("publishReview.placeholder.packageName"),
		skill_name: t("publishReview.placeholder.skillName"),
		version: t("publishReview.placeholder.version"),
	}

	if (kind === "employee" && field === "package_name") return placeholderMap.name_i18n
	return placeholderMap[field]
}
