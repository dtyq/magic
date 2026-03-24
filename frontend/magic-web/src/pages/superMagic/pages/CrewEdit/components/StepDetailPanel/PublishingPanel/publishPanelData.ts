import type {
	AgentDetailResponse,
	AgentVersionItem,
	CrewI18nText,
	PublishAgentParams,
	PublishAgentPrefillResponse,
	PublishAgentTargetValue,
} from "@/apis/modules/crew"
import type {
	PublishDraft,
	PublishInternalTarget,
	PublishPanelData,
	PublishHistoryRecord,
	PublishRecordStatus,
	PublishReviewProgress,
} from "@/pages/superMagic/components/PublishPanel"
import type { PublishSpecificMember } from "@/pages/superMagic/components/PublishPanel/types"
import {
	createDraftForAvailability,
	resolvePublishAvailability,
	sanitizeDraftForSubmission,
} from "@/pages/superMagic/components/PublishPanel/publishAvailability"
import type { LocaleText } from "@/pages/superMagic/components/MainInputContainer/panels/types"
import { DEFAULT_LOCALE_KEY } from "@/pages/superMagic/components/MainInputContainer/panels/types"
import { localeTextToDisplayString } from "@/pages/superMagic/components/MainInputContainer/panels/utils"
import { createPublishPrefillDraft } from "@/pages/superMagic/components/PublishPanel/publishPrefill"
import { resolveNextCrewPublishVersion } from "../../../utils/publishVersion"
import { hasCrewUnpublishedChanges } from "../../../utils/publish-status"

const defaultCrewPublishTo = ["INTERNAL", "MARKET"] as const
const defaultCrewInternalTargets = ["PRIVATE", "MEMBER", "ORGANIZATION"] as const

export function createInitialCrewEditPublishPanelData(): PublishPanelData {
	const availability = resolvePublishAvailability({
		publishType: null,
		allowedPublishTargetTypes: [],
		fallbackPublishTo: [...defaultCrewPublishTo],
		fallbackInternalTargets: [...defaultCrewInternalTargets],
	})

	return {
		hasUnpublishedChanges: false,
		currentPublisherName: "",
		historyRecords: [],
		draft: createDraftForAvailability(availability),
		marketCopy: {
			publishToLabelKey: "skillEditPage.publishPanel.publishToOptions.crew_market.label",
			publishToDescriptionKey:
				"skillEditPage.publishPanel.publishToOptions.crew_market.description",
			targetLabelKey: "skillEditPage.publishPanel.targets.crew_market.label",
			targetDescriptionKey: "skillEditPage.publishPanel.targets.crew_market.description",
		},
		availablePublishTo: availability.availablePublishTo,
		availableInternalTargets: availability.availableInternalTargets,
	}
}

export function createCrewEditPublishPanelData({
	agentDetail,
	versions,
	locale,
}: {
	agentDetail: AgentDetailResponse
	versions: AgentVersionItem[]
	locale: string
}): PublishPanelData {
	const availability = resolvePublishAvailability({
		publishType: agentDetail.publish_type,
		allowedPublishTargetTypes: agentDetail.allowed_publish_target_types,
		fallbackPublishTo: [...defaultCrewPublishTo],
		fallbackInternalTargets: [...defaultCrewInternalTargets],
	})

	return {
		hasUnpublishedChanges: getHasUnpublishedChanges(agentDetail),
		currentPublisherName:
			versions.find((version) => version.publisher?.name)?.publisher?.name ?? "",
		historyRecords: versions.map((version) => mapAgentVersion(version, locale)),
		draft: {
			...createDraftForAvailability(availability),
			version: resolveInitialPublishVersion({
				versions,
				fallbackVersion: agentDetail.version_code,
			}),
		},
		marketCopy: {
			publishToLabelKey: "skillEditPage.publishPanel.publishToOptions.crew_market.label",
			publishToDescriptionKey:
				"skillEditPage.publishPanel.publishToOptions.crew_market.description",
			targetLabelKey: "skillEditPage.publishPanel.targets.crew_market.label",
			targetDescriptionKey: "skillEditPage.publishPanel.targets.crew_market.description",
		},
		availablePublishTo: availability.availablePublishTo,
		availableInternalTargets: availability.availableInternalTargets,
	}
}

export function buildPublishParamsFromDraft(draft: PublishDraft): PublishAgentParams {
	const submissionDraft = sanitizeDraftForSubmission(draft)

	return {
		version: normalizePublishVersion(submissionDraft.version),
		version_description_i18n: buildPublishDetailsI18nText(submissionDraft.details),
		publish_target_type: mapPanelTargetToApi(submissionDraft),
		publish_target_value: buildPublishTargetValue(submissionDraft),
	}
}

export function createCrewEditPublishPrefillDraft({
	prefill,
	versions,
	fallbackDraft,
}: {
	prefill: PublishAgentPrefillResponse
	versions: AgentVersionItem[]
	fallbackDraft: PublishDraft
}): PublishDraft {
	return createPublishPrefillDraft({
		prefill,
		versions,
		fallbackDraft,
	})
}

function getHasUnpublishedChanges(agentDetail: AgentDetailResponse) {
	return hasCrewUnpublishedChanges({
		latestPublishedAt: agentDetail.latest_published_at,
		updatedAt: agentDetail.updated_at,
	})
}

function resolveInitialPublishVersion({
	versions,
	fallbackVersion,
}: {
	versions: AgentVersionItem[]
	fallbackVersion?: string | null
}) {
	const latestPublishedVersion =
		versions.find((version) => version.is_current_version && isPublishedAgentVersion(version))
			?.version ??
		versions.find(isPublishedAgentVersion)?.version ??
		fallbackVersion
	return resolveNextCrewPublishVersion(latestPublishedVersion)
}

function mapAgentVersion(version: AgentVersionItem, locale: string): PublishHistoryRecord {
	return {
		id: version.id,
		version: version.version,
		versionDetails: resolveCrewI18nText(version.version_description_i18n, locale),
		status: mapAgentVersionStatus(version),
		publishTo: mapApiTargetToPublishTo(version.publish_target_type),
		internalTarget: mapApiTargetToInternalTarget(version.publish_target_type),
		publisherName: version.publisher?.name ?? "",
		publishedAt: version.display_time || version.published_at || "",
		specificMembers: mapPublishTargetValueToMembers(version.publish_target_value),
		skillsLibraryReview: deriveMarketReviewProgress(version),
	}
}

function mapPublishTargetValueToMembers(
	value: AgentVersionItem["publish_target_value"],
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

function resolveCrewI18nText(text: CrewI18nText | null | undefined, locale: string): string {
	if (!text) return ""
	const lang = locale?.toLowerCase() ?? "en"
	const preferredKeys = lang.startsWith("zh")
		? ["zh_CN", "zh", "en_US", "en"]
		: ["en_US", "en", "zh_CN", "zh"]

	for (const key of preferredKeys) {
		const value = text[key]
		if (value) return value
	}

	if (text.default) return text.default

	return Object.values(text).find(Boolean) ?? ""
}

function mapAgentVersionStatus(version: AgentVersionItem): PublishRecordStatus {
	if (version.publish_status === "PUBLISHED") return "published"
	if (version.review_status === "REJECTED") return "rejected"
	return "under_review"
}

function deriveMarketReviewProgress(version: AgentVersionItem): PublishReviewProgress | undefined {
	if (version.publish_target_type !== "MARKET") return undefined

	if (version.review_status === "REJECTED") {
		return {
			submit: "done",
			review: "done",
			published: "failed",
		}
	}

	if (version.review_status === "PENDING" || version.review_status === "UNDER_REVIEW") {
		return {
			submit: "done",
			review: "current",
			published: "pending",
		}
	}

	if (version.publish_status === "PUBLISHED" || version.review_status === "APPROVED") {
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

function isPublishedAgentVersion(version: AgentVersionItem) {
	return version.publish_status === "PUBLISHED" || version.review_status === "APPROVED"
}

function normalizePublishVersion(raw: string) {
	const trimmed = raw.trim()
	return trimmed.replace(/^v+/i, "")
}

function buildPublishDetailsI18nText(
	details: LocaleText,
): PublishAgentParams["version_description_i18n"] {
	if (typeof details === "string") {
		const value = details.trim()
		return {
			zh_CN: value,
			en_US: value,
		}
	}

	const fallback = localeTextToDisplayString(details).trim()
	const zh = (details.zh_CN ?? details[DEFAULT_LOCALE_KEY] ?? fallback).trim()
	const en = (details.en_US ?? details[DEFAULT_LOCALE_KEY] ?? fallback).trim()

	return {
		zh_CN: zh,
		en_US: en,
	}
}

function buildPublishTargetValue(draft: PublishDraft): PublishAgentTargetValue | null {
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

function mapPanelTargetToApi(draft: PublishDraft): PublishAgentParams["publish_target_type"] {
	if (draft.publishTo === "MARKET") return "MARKET"
	if (draft.internalTarget === "ORGANIZATION") return "ORGANIZATION"
	if (draft.internalTarget === "MEMBER") return "MEMBER"
	return "PRIVATE"
}

function mapApiTargetToPublishTo(apiTarget: AgentVersionItem["publish_target_type"]) {
	if (apiTarget === "MARKET") return "MARKET" as const
	return "INTERNAL" as const
}

function mapApiTargetToInternalTarget(
	apiTarget: AgentVersionItem["publish_target_type"],
): PublishInternalTarget | undefined {
	switch (apiTarget) {
		case "MEMBER":
			return "MEMBER"
		case "ORGANIZATION":
			return "ORGANIZATION"
		case "MARKET":
			return undefined
		default:
			return "PRIVATE"
	}
}
