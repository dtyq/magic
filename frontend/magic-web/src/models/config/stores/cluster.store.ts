import { makeAutoObservable } from "mobx"
import type { Common } from "@/types/common"

/**
 * @description 部署配置Store，负责内存状态管理
 */
export class ClusterStore {
	// 当前环境
	clusterCode: string = ""

	// 缓存中的环境
	clusterCodeCache: string = ""

	// 保存deploy配置
	private config: Map<string, Common.PrivateConfig> = new Map()

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	get clusterConfig() {
		return Object.fromEntries(this.config)
	}

	get cluster() {
		return this.config.get(this.clusterCode)
	}

	setClusterCodeCache(clusterCode: string) {
		this.clusterCodeCache = clusterCode
	}

	setClusterCode(clusterCode: string) {
		this.clusterCode = clusterCode
	}

	setClusterConfig(clusterCode: string, clusterConfig: Common.PrivateConfig) {
		return this.config.set(clusterCode || "", clusterConfig)
	}

	setClustersConfig(clusterConfig: Array<Common.PrivateConfig>) {
		clusterConfig.map((config) => this.config.set(config.deployCode ?? "", config))
	}

	deleteClusterConfig(clusterCode: string) {
		return this.config.delete(clusterCode)
	}
}

export const clusterStore = new ClusterStore()
