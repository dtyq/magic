import type { LocaleText } from "@/pages/superMagic/components/MainInputContainer/panels/types"
import { DEFAULT_LOCALE_KEY } from "@/pages/superMagic/components/MainInputContainer/panels/types"
import type { PublishDraft, PublishSpecificMember } from "./types"

export type PublishPrefillTargetType = "PRIVATE" | "MEMBER" | "ORGANIZATION" | "MARKET" | null

export interface PublishPrefillTargetValue {
	user_ids?: string[]
	department_ids?: string[]
}

export interface PublishPrefillResolvedTargetMember {
	id: string
	name: string
}

export interface PublishPrefillResolvedTargetValue {
	users: PublishPrefillResolvedTargetMember[]
	departments: PublishPrefillResolvedTargetMember[]
}

export interface PublishPrefillPayload {
	version: string
	version_description_i18n: Record<string, string> | [] | null
	publish_target_type: PublishPrefillTargetType
	publish_target_value?: PublishPrefillTargetValue | null
}

export interface PublishPrefillVersionReference {
	publish_target_value?: PublishPrefillResolvedTargetValue | null
}

export function createPublishPrefillDraft({
	prefill,
	versions,
	fallbackDraft,
}: {
	prefill: PublishPrefillPayload
	versions: PublishPrefillVersionReference[]
	fallbackDraft: PublishDraft
}): PublishDraft {
	const targetDraft = resolvePrefillTargetDraft({
		publishTargetType: prefill.publish_target_type,
		publishTargetValue: prefill.publish_target_value,
		versions,
		fallbackDraft,
	})

	return {
		...targetDraft,
		version: formatDraftVersion(prefill.version) || fallbackDraft.version,
		details: resolvePrefillDetails(prefill.version_description_i18n),
	}
}

function resolvePrefillTargetDraft({
	publishTargetType,
	publishTargetValue,
	versions,
	fallbackDraft,
}: {
	publishTargetType: PublishPrefillPayload["publish_target_type"]
	publishTargetValue: PublishPrefillPayload["publish_target_value"]
	versions: PublishPrefillVersionReference[]
	fallbackDraft: PublishDraft
}): PublishDraft {
	if (!publishTargetType) return { ...fallbackDraft }
	if (publishTargetType === "MARKET")
		return {
			...fallbackDraft,
			publishTo: "MARKET",
			specificMembers: [],
		}

	if (publishTargetType === "ORGANIZATION")
		return {
			...fallbackDraft,
			publishTo: "INTERNAL",
			internalTarget: "ORGANIZATION",
			specificMembers: [],
		}

	if (publishTargetType === "MEMBER")
		return {
			...fallbackDraft,
			publishTo: "INTERNAL",
			internalTarget: "MEMBER",
			specificMembers: resolvePrefillSpecificMembers({
				publishTargetValue,
				versions,
			}),
		}

	return {
		...fallbackDraft,
		publishTo: "INTERNAL",
		internalTarget: "PRIVATE",
		specificMembers: [],
	}
}

function resolvePrefillSpecificMembers({
	publishTargetValue,
	versions,
}: {
	publishTargetValue: PublishPrefillPayload["publish_target_value"]
	versions: PublishPrefillVersionReference[]
}): PublishSpecificMember[] {
	if (!publishTargetValue) return []

	const latestVersionMembers = versions[0]?.publish_target_value
	const latestUserNames = new Map(
		latestVersionMembers?.users.map((member) => [member.id, member.name]) ?? [],
	)
	const latestDepartmentNames = new Map(
		latestVersionMembers?.departments.map((member) => [member.id, member.name]) ?? [],
	)
	const users = (publishTargetValue.user_ids ?? []).map((id) => ({
		id,
		name: latestUserNames.get(id) ?? id,
		type: "user" as const,
	}))
	const departments = (publishTargetValue.department_ids ?? []).map((id) => ({
		id,
		name: latestDepartmentNames.get(id) ?? id,
		type: "department" as const,
	}))

	return [...users, ...departments]
}

function resolvePrefillDetails(
	value: PublishPrefillPayload["version_description_i18n"],
): LocaleText {
	if (!value || Array.isArray(value)) return ""

	const fallback = Object.values(value)
		.map((item) => item?.trim())
		.find(Boolean)

	return {
		[DEFAULT_LOCALE_KEY]: value.default?.trim?.() ?? fallback ?? "",
		zh_CN: value.zh_CN?.trim() ?? "",
		en_US: value.en_US?.trim() ?? "",
	}
}

function formatDraftVersion(version: string) {
	const trimmed = version.trim()
	if (!trimmed) return ""
	return /^v/i.test(trimmed) ? trimmed : `v${trimmed}`
}
