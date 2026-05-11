import { useEffect } from "react"
import { RouteName } from "@/routes/constants"
import useNavigate from "@/routes/hooks/useNavigate"
import type { ClawPlaygroundRootStore } from "../store/root-store"

/**
 * When init fails, replace to MagiClaw list. Reads store.error for MobX observer.
 */
export function useClawPlaygroundInitErrorRedirect(store: ClawPlaygroundRootStore) {
	const navigate = useNavigate()
	const initError = store.error

	useEffect(() => {
		if (initError !== "fetch-failed") return
		navigate({ name: RouteName.MagiClaw, replace: true })
	}, [initError, navigate])
}
