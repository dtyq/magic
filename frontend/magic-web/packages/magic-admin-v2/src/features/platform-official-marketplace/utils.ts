import type { TFunction } from "i18next"
import type { FieldSearchOption } from "@magic-admin-v2/components/field-search-control"
import { PERMISSION_KEY_MAP } from "@magic-admin-v2/constants/permissions"
import { Language } from "@magic-admin-v2/i18n/resources"
import { allowMagic } from "@magic-admin-v2/routes/access"
import type { AccessContext } from "@magic-admin-v2/runtime/types"
import {
	agentMarketCategoryStatus,
	marketDefaultPublishStatus,
	marketPageSize,
	marketPublishStatus,
	marketPublisherType,
	marketSelectAllValue,
	type AgentMarketCategoryFormValues,
	type AgentMarketCategoryItem,
	type AgentMarketItem,
	type AgentMarketListParams,
	type MarketCategoryOption,
	type MarketFilterDraft,
	type MarketKind,
	type MarketPublisherType,
	type MarketSearchField,
	type NameI18n,
	type OfficialMarketplacePermissions,
	type RoleI18n,
	type SkillMarketCategoryFormValues,
	type SkillMarketCategoryItem,
	type SkillMarketCategoryStatus,
	type SkillMarketItem,
	type SaveSkillMarketCategoryParams,
	type SaveAgentMarketCategoryParams,
	type SkillMarketListParams,
} from "@magic-admin-v2/features/platform-official-marketplace/types"

export const agentMarketCategoryNameMaxLength = 100

// Filter and request parameter helpers.

export function createDefaultFilterDraft(): MarketFilterDraft {
	return {
		category_ids: [],
		code: "",
		end_time: "",
		name_i18n: "",
		order_by: "desc",
		organization_code: "",
		package_name: "",
		publish_status: marketDefaultPublishStatus,
		publisher_type: marketSelectAllValue,
		search_field: "code",
		search_value: "",
		start_time: "",
		time_range: null,
	}
}

export function countActiveMarketFilters(draft: MarketFilterDraft): number {
	return [
		draft.category_ids.length > 0,
		draft.code.trim().length > 0,
		draft.name_i18n.trim().length > 0,
		draft.package_name.trim().length > 0,
		draft.organization_code.trim().length > 0,
		draft.publish_status !== marketDefaultPublishStatus,
		draft.publisher_type !== marketSelectAllValue,
		Boolean(draft.start_time || draft.end_time || draft.time_range),
	].filter(Boolean).length
}

export function getMarketSearchParams(
	draft: MarketFilterDraft,
	kind: MarketKind,
): Partial<AgentMarketListParams & SkillMarketListParams> {
	const searchValue = draft.search_value.trim()

	if (!searchValue) {
		return {}
	}

	if (draft.search_field === "code") {
		return kind === "employee" ? { agent_code: searchValue } : { skill_code: searchValue }
	}

	if (draft.search_field === "package_name") {
		return kind === "skill" ? { package_name: searchValue } : {}
	}

	return { [draft.search_field]: searchValue }
}

export function toAgentMarketParams(
	draft: MarketFilterDraft,
	page: number,
	pageSize: number = marketPageSize,
): AgentMarketListParams {
	return removeEmptyParams({
		page,
		page_size: pageSize,
		agent_code: draft.code.trim(),
		category_ids: draft.category_ids.length ? draft.category_ids : undefined,
		end_time: draft.end_time,
		name_i18n: draft.name_i18n.trim(),
		order_by: draft.order_by,
		organization_code: draft.organization_code.trim(),
		publish_status:
			draft.publish_status === marketSelectAllValue ? undefined : draft.publish_status,
		publisher_type:
			draft.publisher_type === marketSelectAllValue ? undefined : draft.publisher_type,
		start_time: draft.start_time,
		...getMarketSearchParams(draft, "employee"),
	})
}

export function toSkillMarketParams(
	draft: MarketFilterDraft,
	page: number,
	pageSize: number = marketPageSize,
): SkillMarketListParams {
	return removeEmptyParams({
		page,
		page_size: pageSize,
		category_ids: draft.category_ids.length ? draft.category_ids : undefined,
		end_time: draft.end_time,
		name_i18n: draft.name_i18n.trim(),
		order_by: draft.order_by,
		organization_code: draft.organization_code.trim(),
		package_name: draft.package_name.trim(),
		publish_status:
			draft.publish_status === marketSelectAllValue ? undefined : draft.publish_status,
		publisher_type:
			draft.publisher_type === marketSelectAllValue ? undefined : draft.publisher_type,
		skill_code: draft.code.trim(),
		start_time: draft.start_time,
		...getMarketSearchParams(draft, "skill"),
	})
}

export function removeEmptyParams<T extends Record<string, unknown>>(params: T): T {
	return Object.entries(params).reduce<Record<string, unknown>>((acc, [key, value]) => {
		if (value === "" || value === undefined || value === null) {
			return acc
		}
		acc[key] = value
		return acc
	}, {}) as T
}

// Employee-market category helpers.

export function normalizeCategoryIds(categoryIds?: string[] | null) {
	return Array.from(new Set((categoryIds ?? []).filter(Boolean)))
}

export function getAgentMarketCategoryIds(record: AgentMarketItem) {
	if (Array.isArray(record.category_ids)) {
		return normalizeCategoryIds(record.category_ids)
	}

	return record.category_id ? [record.category_id] : []
}

export function areSameCategoryIds(left: string[], right: string[]) {
	const normalizedLeft = normalizeCategoryIds(left).sort()
	const normalizedRight = normalizeCategoryIds(right).sort()

	return (
		normalizedLeft.length === normalizedRight.length &&
		normalizedLeft.every((categoryId, index) => categoryId === normalizedRight[index])
	)
}

export function getAgentMarketCategoryLabels(
	record: AgentMarketItem,
	options: MarketCategoryOption[],
	language: string,
) {
	if (record.categories?.length) {
		return record.categories.map((category) => getLocalizedText(category.name_i18n, language))
	}

	const categoryIds = getAgentMarketCategoryIds(record)
	if (categoryIds.length) {
		const labelMap = new Map(options.map((option) => [option.value, option.label]))
		return categoryIds.map((categoryId) => labelMap.get(categoryId) ?? categoryId)
	}

	return record.category ? [getLocalizedText(record.category.name_i18n, language)] : []
}

export function resolveAgentMarketCategoryName(
	record: AgentMarketCategoryItem | null | undefined,
	language = "zh_CN",
) {
	if (!record) return "-"

	return language === "en_US"
		? record.name_i18n?.en_US || record.name_i18n?.zh_CN || record.name_i18n?.default || "-"
		: record.name_i18n?.zh_CN || record.name_i18n?.en_US || record.name_i18n?.default || "-"
}

export function buildAgentMarketCategorySaveParams(
	values: AgentMarketCategoryFormValues,
): SaveAgentMarketCategoryParams {
	return {
		name_i18n: {
			en_US: values.nameEn.trim(),
			zh_CN: values.nameZh.trim(),
		},
		sort_order: normalizeAgentMarketCategorySortOrder(values.sortOrder),
		status: values.visible
			? agentMarketCategoryStatus.visible
			: agentMarketCategoryStatus.hidden,
	}
}

export function normalizeAgentMarketCategorySortOrder(value: number) {
	return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0
}

export const skillMarketCategoryStatus = {
	hidden: 0,
	visible: 1,
} as const satisfies Record<string, SkillMarketCategoryStatus>

export const skillMarketCategoryNameMaxLength = 100

export function buildSkillMarketCategorySaveParams(
	values: SkillMarketCategoryFormValues,
): SaveSkillMarketCategoryParams {
	return {
		name_i18n: {
			en_US: values.nameEn.trim(),
			zh_CN: values.nameZh.trim(),
		},
		sort_order: normalizeAgentMarketCategorySortOrder(values.sortOrder),
		status: values.visible
			? skillMarketCategoryStatus.visible
			: skillMarketCategoryStatus.hidden,
	}
}

export function resolveSkillMarketCategoryName(
	record: SkillMarketCategoryItem | null | undefined,
	language = "zh_CN",
) {
	if (!record) return "-"

	return language === "en_US"
		? record.name_i18n?.en_US ||
				record.name_i18n?.zh_CN ||
				record.name_i18n?.default ||
				record.name ||
				"-"
		: record.name_i18n?.zh_CN ||
				record.name_i18n?.en_US ||
				record.name_i18n?.default ||
				record.name ||
				"-"
}

export function getSkillMarketCategoryIds(record: SkillMarketItem) {
	if (Array.isArray(record.category_ids)) {
		return normalizeCategoryIds(record.category_ids)
	}

	return record.category_id ? [record.category_id] : []
}

export function getSkillMarketCategoryLabels(
	record: SkillMarketItem,
	options: MarketCategoryOption[],
	language: string,
) {
	if (record.categories?.length) {
		return record.categories.map((category) =>
			resolveSkillMarketCategoryName(category, language),
		)
	}

	const categoryIds = getSkillMarketCategoryIds(record)
	if (!categoryIds.length) return []

	const labelMap = new Map(options.map((option) => [option.value, option.label]))
	return categoryIds.map((categoryId) => labelMap.get(categoryId) ?? categoryId)
}

export function formatAgentMarketCategoryDateTime(value: string | undefined, locale: string) {
	if (!value) return "-"

	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return value

	return new Intl.DateTimeFormat(locale, {
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		month: "2-digit",
		year: "numeric",
	}).format(date)
}

// Permission helpers. Administrator bypass remains centralized in allowMagic.

export function getOfficialMarketplacePermissions(
	access?: AccessContext | null,
): OfficialMarketplacePermissions {
	if (!access) {
		return {
			availableTabs: [],
			canEditEmployee: false,
			canEditSkill: false,
			canViewEmployee: false,
			canViewSkill: false,
		}
	}

	const canEditEmployee = allowMagic(PERMISSION_KEY_MAP.PLATFORM_EMPLOYEE_MARKET_EDIT)(access)
	const canEditSkill = allowMagic(PERMISSION_KEY_MAP.PLATFORM_SKILL_MARKET_EDIT)(access)
	const canViewEmployee = allowMagic(
		PERMISSION_KEY_MAP.PLATFORM_EMPLOYEE_MARKET_QUERY,
		PERMISSION_KEY_MAP.PLATFORM_EMPLOYEE_MARKET_EDIT,
	)(access)
	const canViewSkill = allowMagic(
		PERMISSION_KEY_MAP.PLATFORM_SKILL_MARKET_QUERY,
		PERMISSION_KEY_MAP.PLATFORM_SKILL_MARKET_EDIT,
	)(access)
	const availableTabs: MarketKind[] = []

	if (canViewEmployee) availableTabs.push("employee")
	if (canViewSkill) availableTabs.push("skill")

	return {
		availableTabs,
		canEditEmployee,
		canEditSkill,
		canViewEmployee,
		canViewSkill,
	}
}

export function resolveOfficialMarketplaceTab(
	selectedTab: MarketKind,
	availableTabs: MarketKind[],
): MarketKind | null {
	return availableTabs.includes(selectedTab) ? selectedTab : (availableTabs[0] ?? null)
}

// Localized labels and table display helpers.

export function getPublishStatusLabel(value: string | undefined, t: TFunction) {
	if (value === marketPublishStatus.unpublished)
		return t("officialMarketplace.status.unpublished")
	if (value === marketPublishStatus.publishing) return t("officialMarketplace.status.publishing")
	if (value === marketPublishStatus.published) return t("officialMarketplace.status.published")
	if (value === marketPublishStatus.offline) return t("officialMarketplace.status.offline")
	return value || "-"
}

export function getPublisherTypeLabel(
	value: MarketPublisherType | string | undefined,
	t: TFunction,
) {
	if (value === marketPublisherType.user) return t("officialMarketplace.publisher.user")
	if (value === marketPublisherType.official) return t("officialMarketplace.publisher.official")
	if (value === marketPublisherType.officialBuiltin) {
		return t("officialMarketplace.publisher.officialBuiltin")
	}
	return value || "-"
}

export function getLocalizedText(value: NameI18n | string | undefined, language: string) {
	if (!value) return "-"
	if (typeof value === "string") return value || "-"
	return language === Language.EnUS
		? value.en_US || value.zh_CN || value.default || "-"
		: value.zh_CN || value.en_US || value.default || "-"
}

export function getLocalizedRoles(value: RoleI18n | undefined, language: string) {
	const roles =
		language === Language.EnUS ? value?.en_US || value?.zh_CN : value?.zh_CN || value?.en_US
	if (!roles || roles.length === 0) return "-"
	return Array.isArray(roles) ? roles.join(" / ") : roles
}

export function getMarketSearchFieldOptions(
	kind: MarketKind,
	t: TFunction,
): Array<FieldSearchOption<MarketSearchField>> {
	const options: Array<FieldSearchOption<MarketSearchField>> = [
		{
			value: "code",
			label:
				kind === "employee"
					? t("officialMarketplace.filter.employeeCode")
					: t("officialMarketplace.filter.skillCode"),
		},
		{ value: "name_i18n", label: t("officialMarketplace.filter.name") },
		{ value: "organization_code", label: t("officialMarketplace.filter.organizationCode") },
	]

	if (kind === "skill") {
		options.splice(2, 0, {
			value: "package_name",
			label: t("officialMarketplace.filter.packageName"),
		})
	}

	return options
}

export function getMarketSearchFieldPlaceholder(
	field: MarketSearchField,
	kind: MarketKind,
	t: TFunction,
) {
	const placeholderMap: Record<MarketSearchField, string> = {
		code:
			kind === "employee"
				? t("officialMarketplace.placeholder.employeeCode")
				: t("officialMarketplace.placeholder.skillCode"),
		name_i18n: t("officialMarketplace.placeholder.name"),
		organization_code: t("officialMarketplace.placeholder.organizationCode"),
		package_name: t("officialMarketplace.placeholder.packageName"),
	}

	return placeholderMap[field]
}

// Small comparison and error helpers shared by hooks and panels.

export function areSortDraftMapsEqual(left: Record<string, string>, right: Record<string, string>) {
	const leftKeys = Object.keys(left)
	const rightKeys = Object.keys(right)

	if (leftKeys.length !== rightKeys.length) {
		return false
	}

	return leftKeys.every((key) => left[key] === right[key])
}

export function getApiErrorMessage(error: unknown, fallback: string) {
	if (typeof error === "object" && error !== null && "message" in error) {
		const message = (error as { message?: unknown }).message
		if (typeof message === "string" && message.trim()) {
			return message
		}
	}

	return fallback
}
