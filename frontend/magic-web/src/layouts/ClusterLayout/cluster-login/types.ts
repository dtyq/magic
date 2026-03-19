export interface ClusterLoginOpenParams {
	clusterCode?: string
	onClusterChange?: (code: string) => void
	source?: "cluster-layout" | "other"
}

export interface ClusterLoginSession {
	close: () => void
	update?: (params: Partial<ClusterLoginOpenParams>) => void
}

export interface ClusterLoginAdapter {
	open: (params: ClusterLoginOpenParams) => ClusterLoginSession | void
}
