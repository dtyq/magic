import { useEffect } from "react"
import magicToast from "@/components/base/MagicToaster/utils"
import type { CrewIdentityStore } from "../store/identity-store"
import type { CrewPlaybookStore } from "../store/playbook-store"
import type { CrewEditAsyncError } from "../store/shared"

/**
 * React to store error states and show magicToast. Keeps toast logic in UI layer
 * instead of coupling it to the store. Call from a MobX observer component.
 */
export function useCrewEditErrorToasts({
	initError,
	identity,
	playbook,
}: {
	initError: CrewEditAsyncError | null
	identity: CrewIdentityStore
	playbook: CrewPlaybookStore
}): void {
	useEffect(() => {
		if (initError?.message) magicToast.error(initError.message)
	}, [initError])

	useEffect(() => {
		if (identity.crewSaveError) magicToast.error(identity.crewSaveError)
	}, [identity.crewSaveError])

	useEffect(() => {
		if (playbook.scenesError) magicToast.error(playbook.scenesError)
	}, [playbook.scenesError])
}
