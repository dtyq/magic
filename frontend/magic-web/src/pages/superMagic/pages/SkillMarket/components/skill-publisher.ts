import type { SkillPublisherType } from "@/apis/modules/skills"

interface ResolveStoreSkillPublisherLabelArgs {
	authorName?: string
	publisherType?: SkillPublisherType | null
	t: (key: string, options?: Record<string, unknown>) => string
	fallbackLabel: string
}

export function isOfficialStoreSkillPublisher(publisherType?: SkillPublisherType | null) {
	return publisherType === "OFFICIAL" || publisherType === "OFFICIAL_BUILTIN"
}

export function resolveStoreSkillPublisherLabel({
	authorName,
	publisherType,
	t,
	fallbackLabel,
}: ResolveStoreSkillPublisherLabelArgs) {
	if (publisherType === "OFFICIAL_BUILTIN") return t("employeeCard.officialBuiltin")
	if (publisherType === "OFFICIAL") return t("skillsLibrary.official")
	if (publisherType === "VERIFIED_CREATOR") return t("employeeCard.publisherVerified")
	if (publisherType === "PARTNER") return t("employeeCard.publisherPartner")

	const normalizedAuthorName = authorName?.trim()
	if (normalizedAuthorName) return normalizedAuthorName

	return fallbackLabel
}
