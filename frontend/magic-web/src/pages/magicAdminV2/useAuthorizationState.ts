import { useEffect, useState } from "react"
import type { AuthState } from "@dtyq/magic-admin-v2"
import { loadAuthorization } from "@/pages/magicAdminV2/edition"

type AuthorizationStateOptions = {
	authorization: string | null
	isPersonalOrganization: boolean
	organizationCode: string
	userId?: string
}

type LoadedAuthorization = {
	key: string
	state: AuthState
}

const loadingState: AuthState = { status: "loading" }
const unauthenticatedState: AuthState = { status: "unauthenticated" }

export function useAuthorizationState({
	authorization,
	isPersonalOrganization,
	organizationCode,
	userId,
}: AuthorizationStateOptions): AuthState {
	const [loaded, setLoaded] = useState<LoadedAuthorization | null>(null)
	const requestKey = [
		authorization,
		organizationCode,
		userId,
		String(isPersonalOrganization),
	].join("\u0000")

	useEffect(() => {
		if (!authorization || !organizationCode || !userId) return

		let active = true
		void loadAuthorization({
			organizationCode,
			isPersonalOrganization,
		}).then(
			(snapshot) => {
				if (!active) return
				setLoaded({
					key: requestKey,
					state: {
						status: "authenticated",
						authorization: snapshot,
					},
				})
			},
			(error: unknown) => {
				if (!active) return
				setLoaded({
					key: requestKey,
					state: {
						status: "error",
						error: error instanceof Error ? error : new Error(String(error)),
					},
				})
			},
		)

		return () => {
			active = false
		}
	}, [authorization, isPersonalOrganization, organizationCode, requestKey, userId])

	if (!authorization) return unauthenticatedState
	if (!organizationCode || !userId || loaded?.key !== requestKey) return loadingState
	return loaded.state
}
