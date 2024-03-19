import { useContext, useState, useEffect } from "react"
import { reaction } from "mobx"
import { ClusterContext } from "../ClusterProvider"
import { configStore } from "@/opensource/models/config"

export function useClusterCode() {
	const store = useContext(ClusterContext) || configStore.cluster
	// 当前集群配置
	const [clusterCode, setClusterConfig] = useState(store.clusterCode)

	useEffect(() => {
		const disposer = reaction(
			() => store.clusterCode,
			(code) => setClusterConfig(code),
		)

		return () => disposer()
	}, [store])

	return {
		clusterCode,
		setClusterCode: store.setClusterCode,
	}
}
