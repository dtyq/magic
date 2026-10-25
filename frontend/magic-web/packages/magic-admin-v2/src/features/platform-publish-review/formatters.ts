import { Language } from "@magic-admin-v2/i18n/resources"
import type {
	NameI18n,
	PublishReviewPublisherType,
	PublishReviewTargetValue,
	RoleI18n,
} from "@magic-admin-v2/features/platform-publish-review/types"

export type ReviewRecordBase = {
	created_at: string
	id: string
	publish_status: string
	publish_target_type: string
	publish_target_value?: PublishReviewTargetValue | null
	publisher?: { nickname?: string }
	review_status: string
	version: string
}

export type ReviewDialogState<TRecord extends ReviewRecordBase> = {
	action: "APPROVED" | "REJECTED"
	record: TRecord
} | null

const officialOrganizationCode = "TGosRaFhvb"

export function canReviewRecord(record: ReviewRecordBase) {
	return record.publish_status === "UNPUBLISHED" && record.review_status === "UNDER_REVIEW"
}

export function getDefaultPublisherType(organizationCode: string): PublishReviewPublisherType {
	return organizationCode === officialOrganizationCode ? "OFFICIAL" : "USER"
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

export function getPublisher(record: { publisher?: { nickname?: string } }) {
	return record.publisher?.nickname || "-"
}

type Translate = (key: string) => string

export function getReviewStatusLabel(value: string, t: Translate) {
	const keyMap: Record<string, string> = {
		APPROVED: "publishReview.reviewStatus.approved",
		INVALIDATED: "publishReview.reviewStatus.invalidated",
		PENDING: "publishReview.reviewStatus.pending",
		REJECTED: "publishReview.reviewStatus.rejected",
		UNDER_REVIEW: "publishReview.reviewStatus.underReview",
	}
	return keyMap[value] ? t(keyMap[value]) : value || "-"
}

export function getPublishStatusLabel(value: string, t: Translate) {
	const keyMap: Record<string, string> = {
		OFFLINE: "publishReview.publishStatus.offline",
		PUBLISHED: "publishReview.publishStatus.published",
		PUBLISHING: "publishReview.publishStatus.publishing",
		UNPUBLISHED: "publishReview.publishStatus.unpublished",
	}
	return keyMap[value] ? t(keyMap[value]) : value || "-"
}

export function getPublishTargetTypeLabel(value: string, t: Translate) {
	const keyMap: Record<string, string> = {
		MARKET: "publishReview.targetType.market",
		MEMBER: "publishReview.targetType.member",
		ORGANIZATION: "publishReview.targetType.organization",
		PRIVATE: "publishReview.targetType.private",
	}
	return keyMap[value] ? t(keyMap[value]) : value || "-"
}

export type StatusTone = "blue" | "green" | "red" | "yellow" | "gray"

export function getReviewStatusTone(value: string): StatusTone {
	const toneMap: Record<string, StatusTone> = {
		APPROVED: "green",
		INVALIDATED: "gray",
		PENDING: "yellow",
		REJECTED: "red",
		UNDER_REVIEW: "blue",
	}
	return toneMap[value] ?? "gray"
}

export function getPublishStatusTone(value: string): StatusTone {
	const toneMap: Record<string, StatusTone> = {
		OFFLINE: "red",
		PUBLISHED: "green",
		PUBLISHING: "blue",
		UNPUBLISHED: "gray",
	}
	return toneMap[value] ?? "gray"
}

export function getErrorMessage(error: unknown, fallback: string) {
	if (error && typeof error === "object" && "message" in error) {
		const message = (error as { message?: unknown }).message
		if (typeof message === "string" && message.trim()) return message
	}
	return fallback
}

export function formatTemplate(template: string, values: Record<string, string>) {
	return Object.entries(values).reduce(
		(result, [key, value]) => result.split(`{{${key}}}`).join(value),
		template,
	)
}
