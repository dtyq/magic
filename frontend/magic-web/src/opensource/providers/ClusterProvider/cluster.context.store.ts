import { makeAutoObservable } from "mobx"

export class ClusterProviderStore {
	clusterCode: string = ""

	constructor() {
		makeAutoObservable(this)
	}

	setClusterCode = (clusterCode: string) => {
		this.clusterCode = clusterCode
	}
}
