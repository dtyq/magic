import { useEffect, useRef } from "react"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import type { CrewEditRootStore } from "../store/root-store"

const CREW_NOT_FOUND_ERROR_CODE = 60002

interface UseCrewEditInitializationParams {
	store: CrewEditRootStore
	crewId: string
}

export function useCrewEditInitialization({
	store,
	crewId,
}: UseCrewEditInitializationParams): void {
	const navigate = useNavigate()
	const initializedCrewIdRef = useRef<string | null>(null)

	useEffect(() => {
		const hasMatchingCrewCode = store.crewCode === crewId
		const shouldSkip = initializedCrewIdRef.current === crewId && hasMatchingCrewCode

		if (shouldSkip) return

		initializedCrewIdRef.current = crewId

		void store.initFromCrewCode(crewId).then(() => {
			if (store.initError?.code !== CREW_NOT_FOUND_ERROR_CODE) return

			navigate({ name: RouteName.MyCrew, replace: true })
		})
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [crewId, store])
}
