import type { PublishDraft, PublishInternalTarget, PublishTo } from "./types"

export type DetailPublishType = "INTERNAL" | "MARKET" | null | undefined
export type DetailAllowedPublishTargetType = "PRIVATE" | "MEMBER" | "ORGANIZATION"

export interface PublishAvailability {
	availablePublishTo: PublishTo[]
	availableInternalTargets: PublishInternalTarget[]
}

interface ResolvePublishAvailabilityParams {
	publishType: DetailPublishType
	allowedPublishTargetTypes?: DetailAllowedPublishTargetType[] | null
	fallbackPublishTo: PublishTo[]
	fallbackInternalTargets: PublishInternalTarget[]
	canPublishPrivate?: boolean
	canPublishTeam?: boolean
}

interface NormalizeDraftForAvailabilityParams extends PublishAvailability {
	draft: PublishDraft
}

const internalTargetOrder: PublishInternalTarget[] = ["PRIVATE", "MEMBER", "ORGANIZATION"]

export function resolvePublishAvailability({
	publishType,
	allowedPublishTargetTypes,
	fallbackPublishTo,
	fallbackInternalTargets,
	canPublishPrivate = true,
	canPublishTeam = true,
}: ResolvePublishAvailabilityParams): PublishAvailability {
	if (publishType === "MARKET") {
		return {
			availablePublishTo: ["MARKET"],
			availableInternalTargets: [],
		}
	}

	if (publishType === "INTERNAL") {
		const resolvedInternalTargets = resolveInternalTargets(allowedPublishTargetTypes)
		const availableInternalTargets = filterInternalTargetsByPermission(
			resolvedInternalTargets.length > 0
				? resolvedInternalTargets
				: [...fallbackInternalTargets],
			{ canPublishPrivate, canPublishTeam },
		)

		return {
			availablePublishTo: availableInternalTargets.length > 0 ? ["INTERNAL"] : [],
			availableInternalTargets,
		}
	}

	const availableInternalTargets = filterInternalTargetsByPermission(
		[...fallbackInternalTargets],
		{
			canPublishPrivate,
			canPublishTeam,
		},
	)

	return {
		availablePublishTo: fallbackPublishTo.filter(
			(publishTo) => publishTo !== "INTERNAL" || availableInternalTargets.length > 0,
		),
		availableInternalTargets,
	}
}

export function createDraftForAvailability({
	availablePublishTo,
	availableInternalTargets,
}: PublishAvailability): PublishDraft {
	return {
		version: "",
		details: "",
		publishTo: availablePublishTo[0] ?? "INTERNAL",
		internalTarget: availableInternalTargets[0] ?? "PRIVATE",
		specificMembers: [],
	}
}

export function normalizeDraftForAvailability({
	draft,
	availablePublishTo,
	availableInternalTargets,
}: NormalizeDraftForAvailabilityParams): PublishDraft {
	const publishTo = availablePublishTo.includes(draft.publishTo)
		? draft.publishTo
		: (availablePublishTo[0] ?? "INTERNAL")
	const internalTarget =
		publishTo === "INTERNAL" && !availableInternalTargets.includes(draft.internalTarget)
			? (availableInternalTargets[0] ?? "PRIVATE")
			: draft.internalTarget

	return {
		...draft,
		publishTo,
		internalTarget,
		specificMembers: [...draft.specificMembers],
	}
}

export function sanitizeDraftForSubmission(draft: PublishDraft): PublishDraft {
	if (draft.publishTo === "INTERNAL" && draft.internalTarget === "MEMBER") {
		return {
			...draft,
			specificMembers: [...draft.specificMembers],
		}
	}

	return {
		...draft,
		specificMembers: [],
	}
}

function resolveInternalTargets(
	allowedPublishTargetTypes?: DetailAllowedPublishTargetType[] | null,
): PublishInternalTarget[] {
	const mappedTargets = new Set(allowedPublishTargetTypes ?? [])

	return internalTargetOrder.filter((target) => mappedTargets.has(target))
}

function filterInternalTargetsByPermission(
	targets: PublishInternalTarget[],
	{
		canPublishPrivate,
		canPublishTeam,
	}: {
		canPublishPrivate: boolean
		canPublishTeam: boolean
	},
): PublishInternalTarget[] {
	return targets.filter((target) => {
		if (target === "PRIVATE") return canPublishPrivate
		return canPublishTeam
	})
}
