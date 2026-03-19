import { useEffect, useRef } from "react"
import magicToast from "@/components/base/MagicToaster/utils"
import { superMagicStore } from "@/pages/superMagic/stores"
import { CREW_EDIT_ERROR } from "../constants/errors"
import type { CrewEditRootStore } from "../store/root-store"
import { resolveCrewEditError } from "../store/shared"

interface UseRefreshCrewDetailOnTopicMessageParams {
	store: CrewEditRootStore
}

export function useRefreshCrewDetailOnTopicMessage({
	store,
}: UseRefreshCrewDetailOnTopicMessageParams): void {
	const refreshTaskRef = useRef<null | Promise<void>>(null)

	useEffect(() => {
		if (!store.crewCode) return

		const unregister = superMagicStore.registerDomainEventListener({
			matcher: (payload) =>
				payload.type === "crew_detail_refresh_requested" &&
				payload.crewCode === store.crewCode,
			callback: (payload) => {
				if (payload.type !== "crew_detail_refresh_requested") return

				if (refreshTaskRef.current) return

				refreshTaskRef.current = store
					.refreshAgentDetail()
					.catch((error) => {
						const { message } = resolveCrewEditError({
							error,
							fallbackKey: CREW_EDIT_ERROR.loadAgentFailed,
						})
						magicToast.error(message)
					})
					.finally(() => {
						refreshTaskRef.current = null
					})
			},
		})

		return unregister
	}, [store, store.crewCode])
}
