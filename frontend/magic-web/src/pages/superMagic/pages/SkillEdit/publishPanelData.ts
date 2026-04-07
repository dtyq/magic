import type { TFunction } from "i18next"
import i18n from "i18next"
import type {
	PublishSkillParams,
	PublishSkillPrefillResponse,
	PublishSkillTargetValue,
	SkillVersionItem,
} from "@/apis/modules/skills"
import type { LocaleText } from "@/pages/superMagic/components/MainInputContainer/panels/types"
import { DEFAULT_LOCALE_KEY } from "@/pages/superMagic/components/MainInputContainer/panels/types"
import { localeTextToDisplayString } from "@/pages/superMagic/components/MainInputContainer/panels/utils"
import type {
	PublishDraft,
	PublishHistoryRecord,
	PublishInternalTarget,
	PublishPanelData,
	PublishRecordStatus,
	PublishReviewProgress,
	PublishSpecificMember,
} from "@/pages/superMagic/components/PublishPanel/types"
import { createPublishPrefillDraft } from "@/pages/superMagic/components/PublishPanel/publishPrefill"
import {
	createDraftForAvailability,
	resolvePublishAvailability,
	sanitizeDraftForSubmission,
} from "@/pages/superMagic/components/PublishPanel/publishAvailability"
import type { SkillEditSkillInfo } from "./store/types"

const defaultSkillPublishTo = ["INTERNAL", "MARKET"] as const
const defaultSkillInternalTargets = ["PRIVATE"] as const

export function createSkillEditPublishPanelData({
	skill,
	versions,
	currentPublisherName,
	t,
}: {
	skill: SkillEditSkillInfo | null
	versions: SkillVersionItem[]
	currentPublisherName: string
	t: TFunction<"crew/market">
}): PublishPanelData {
	const historyRecords = versions.map((item) => mapVersionToHistoryRecord(item, t))
	const emptyLabel = t("skillEditPage.publishPanel.emptyValue")
	const availability = resolvePublishAvailability({
		publishType: skill?.publishType,
		allowedPublishTargetTypes: skill?.allowedPublishTargetTypes,
		fallbackPublishTo: [...defaultSkillPublishTo],
		fallbackInternalTargets: [...defaultSkillInternalTargets],
	})

	return {
		hasUnpublishedChanges: skill?.publishStatus === "draft",
		currentPublisherName: currentPublisherName.trim() || emptyLabel,
		historyRecords,
		draft: createEmptyDraft(availability),
		marketCopy: {
			publishToLabelKey: "skillEditPage.publishPanel.publishToOptions.skills_library.label",
			publishToDescriptionKey:
				"skillEditPage.publishPanel.publishToOptions.skills_library.description",
			targetLabelKey: "skillEditPage.publishPanel.targets.skills_library.label",
			targetDescriptionKey: "skillEditPage.publishPanel.targets.skills_library.description",
		},
		availablePublishTo: availability.availablePublishTo,
		availableInternalTargets: availability.availableInternalTargets,
	}
}

export function buildPublishParamsFromDraft(draft: PublishDraft): PublishSkillParams {
	const submissionDraft = sanitizeDraftForSubmission(draft)

	return {
		version: normalizePublishVersion(submissionDraft.version),
		version_description_i18n: localeTextToPublishDescriptionI18n(submissionDraft.details),
		publish_target_type: mapPanelTargetToApi(submissionDraft),
		publish_target_value: buildPublishTargetValue(submissionDraft),
	}
}

export function createSkillEditPublishPrefillDraft({
	prefill,
	versions,
	fallbackDraft,
}: {
	prefill: PublishSkillPrefillResponse
	versions: SkillVersionItem[]
	fallbackDraft: PublishDraft
}): PublishDraft {
	return createPublishPrefillDraft({
		prefill,
		versions,
		fallbackDraft,
	})
}

function createEmptyDraft({
	availablePublishTo,
	availableInternalTargets,
}: {
	availablePublishTo: PublishPanelData["availablePublishTo"]
	availableInternalTargets: PublishPanelData["availableInternalTargets"]
}): PublishDraft {
	return createDraftForAvailability({
		availablePublishTo,
		availableInternalTargets,
	})
}

function buildPublishTargetValue(draft: PublishDraft): PublishSkillTargetValue | null {
	if (draft.publishTo !== "INTERNAL" || draft.internalTarget !== "MEMBER") return null

	const userIds = draft.specificMembers
		.filter((item) => item.type === "user")
		.map((item) => item.id)
	const departmentIds = draft.specificMembers
		.filter((item) => item.type === "department")
		.map((item) => item.id)

	if (userIds.length === 0 && departmentIds.length === 0) {
		throw new Error("Specific member publishing requires selected targets")
	}

	return {
		user_ids: userIds.length > 0 ? userIds : undefined,
		department_ids: departmentIds.length > 0 ? departmentIds : undefined,
	}
}

function normalizePublishVersion(raw: string) {
	const trimmed = raw.trim()
	return trimmed.replace(/^v+/i, "")
}

function localeTextToPublishDescriptionI18n(
	details: LocaleText,
): PublishSkillParams["version_description_i18n"] {
	if (typeof details === "string") {
		const value = details.trim()
		return { zh_CN: value, en_US: value }
	}

	const fallback = localeTextToDisplayString(details).trim()
	const zh = (details.zh_CN ?? details[DEFAULT_LOCALE_KEY] ?? fallback).trim()
	const en = (details.en_US ?? details[DEFAULT_LOCALE_KEY] ?? fallback).trim()

	return {
		zh_CN: zh,
		en_US: en,
	}
}

function mapPanelTargetToApi(draft: PublishDraft): PublishSkillParams["publish_target_type"] {
	if (draft.publishTo === "MARKET") return "MARKET"

	switch (draft.internalTarget) {
		case "ORGANIZATION":
			return "ORGANIZATION"
		case "MEMBER":
			return "MEMBER"
		default:
			return "PRIVATE"
	}
}

function mapVersionToHistoryRecord(
	item: SkillVersionItem,
	t: TFunction<"crew/market">,
): PublishHistoryRecord {
	const emptyLabel = t("skillEditPage.publishPanel.emptyValue")
	const versionLabel = formatVersionLabel(item.version)
	const details = pickVersionDescription(item.version_description_i18n)
	const publisherName = item.publisher?.name?.trim() || emptyLabel
	const publishedAt = item.published_at?.trim() || emptyLabel

	return {
		id: item.id,
		version: versionLabel,
		versionDetails: details || emptyLabel,
		status: mapApiToRecordStatus(item.review_status, item.publish_status),
		publishTo: mapApiTargetToPublishTo(item.publish_target_type),
		internalTarget: mapApiTargetToInternalTarget(item.publish_target_type),
		publisherName,
		publishedAt,
		specificMembers: mapPublishTargetValueToMembers(item.publish_target_value),
		skillsLibraryReview: deriveMarketReviewProgress(item),
	}
}

function mapPublishTargetValueToMembers(
	value: SkillVersionItem["publish_target_value"],
): PublishSpecificMember[] | undefined {
	if (!value) return undefined

	const users = value.users.map((member) => ({
		id: member.id,
		name: member.name,
		type: "user" as const,
	}))
	const departments = value.departments.map((member) => ({
		id: member.id,
		name: member.name,
		type: "department" as const,
	}))
	const members = [...users, ...departments]

	return members.length > 0 ? members : undefined
}

function deriveMarketReviewProgress(item: SkillVersionItem): PublishReviewProgress | undefined {
	if (item.publish_target_type !== "MARKET") return undefined

	const rs = item.review_status
	const ps = item.publish_status

	if (rs === "REJECTED") {
		return {
			submit: "done",
			review: "done",
			published: "failed",
			failureReason: undefined,
		}
	}

	if (rs === "PENDING" || rs === "UNDER_REVIEW") {
		return {
			submit: "done",
			review: "current",
			published: "pending",
		}
	}

	if (rs === "APPROVED" && ps === "PUBLISHED") {
		return {
			submit: "done",
			review: "done",
			published: "done",
		}
	}

	if (ps === "PUBLISHED") {
		return {
			submit: "done",
			review: "done",
			published: "done",
		}
	}

	return {
		submit: "done",
		review: "current",
		published: "pending",
	}
}

function mapApiToRecordStatus(reviewStatus: string, publishStatus: string): PublishRecordStatus {
	if (reviewStatus === "REJECTED") return "rejected"
	if (reviewStatus === "PENDING" || reviewStatus === "UNDER_REVIEW") return "under_review"
	if (publishStatus === "PUBLISHED" || reviewStatus === "APPROVED") return "published"
	return "under_review"
}

function mapApiTargetToPublishTo(apiTarget: SkillVersionItem["publish_target_type"]) {
	if (apiTarget === "MARKET") return "MARKET" as const
	return "INTERNAL" as const
}

function mapApiTargetToInternalTarget(
	apiTarget: SkillVersionItem["publish_target_type"],
): PublishInternalTarget | undefined {
	if (apiTarget === "MARKET") return undefined
	if (apiTarget === "MEMBER") return "MEMBER"
	if (apiTarget === "ORGANIZATION") return "ORGANIZATION"
	return "PRIVATE"
}

function pickVersionDescription(text: SkillVersionItem["version_description_i18n"]): string {
	if (!text) return ""
	const i18nMap = text as Record<string, string>
	const language = i18n.language?.toLowerCase() ?? "en"
	const preferredKeys = language.startsWith("zh")
		? ["zh_CN", "zh", "en_US", "en"]
		: ["en_US", "en", "zh_CN", "zh"]

	for (const key of preferredKeys) {
		const value = i18nMap[key]
		if (value) return value
	}

	return Object.values(i18nMap).find(Boolean) ?? ""
}

export function formatVersionLabel(version: string) {
	if (!version) return ""
	const trimmed = version.trim()
	return trimmed.toUpperCase().startsWith("V") ? trimmed : `V${trimmed}`
}
