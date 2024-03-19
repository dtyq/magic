import type { ClusterLoginAdapter, ClusterLoginOpenParams, ClusterLoginSession } from "./types"

interface CreateClusterLoginAdapterParams {
	openModal: (params: ClusterLoginOpenParams) => ClusterLoginSession | void
}

export function createClusterLoginAdapter(
	params: CreateClusterLoginAdapterParams,
): ClusterLoginAdapter {
	const { openModal } = params
	return {
		open(openParams) {
			return openModal(openParams)
		},
	}
}
