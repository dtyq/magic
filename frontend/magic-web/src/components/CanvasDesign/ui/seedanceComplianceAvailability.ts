import { useMagic } from "../app/providers/MagicProvider"
import type { AiAbilityAvailability } from "../public/magic-types"

/** Seedance compliance follows `volcengine_ark_assets` from `/api/v1/ai-abilities/availability`. */
export function isSeedanceComplianceAvailable(
	availability: AiAbilityAvailability | null | undefined,
): boolean {
	return availability?.abilities.volcengine_ark_assets?.enabled === true
}

export function useSeedanceComplianceAvailable(): boolean {
	const {
		aiAbilityAvailability,
		hasAiAbilityAvailabilityProvider,
		isAiAbilityAvailabilityReady,
	} = useMagic()
	// Hide the action until the availability request settles, including when it fails.
	if (!hasAiAbilityAvailabilityProvider || !isAiAbilityAvailabilityReady) return false
	return isSeedanceComplianceAvailable(aiAbilityAvailability)
}
