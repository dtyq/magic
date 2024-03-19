import { GlobalBaseRepository } from "@/opensource/models/repository/GlobalBaseRepository"
import type { Common } from "@/opensource/types/common"
import { Storage } from "../../repository/Cache"
import { logger } from "../../repository/logger"

export class ClusterRepository extends GlobalBaseRepository<Common.PrivateConfig> {
	static readonly tableName = "cluster"

	static readonly version = 1

	constructor() {
		super(ClusterRepository.tableName)
	}

	public async setClustersConfig(clustersConfig: Array<Common.PrivateConfig>): Promise<void> {
		try {
			clustersConfig.map((config) =>
				this.put({ ...config, deployCode: config?.deployCode ?? "" }),
			)
		} catch (error) {
			logger.error("setClustersConfigError", ClusterRepository.tableName, error)
		} finally {
			clustersConfig.map((config) =>
				Storage.set(`${ClusterRepository.tableName}:${config?.deployCode ?? ""}`, {
					...config,
					deployCode: config?.deployCode ?? "",
				}),
			)
		}
	}

	public async setClusterConfig(clustersConfig: Common.PrivateConfig) {
		try {
			return await this.put(clustersConfig)
		} catch (error) {
			logger.error("setClusterConfigError", ClusterRepository.tableName, error)
			return Storage.set(
				`${ClusterRepository.tableName}:${clustersConfig?.deployCode ?? ""}`,
				clustersConfig,
			)
		}
	}

	public async getClustersConfig(): Promise<Array<Common.PrivateConfig>> {
		try {
			return await this.getAll()
		} catch (error) {
			logger.error("getClustersConfigError", ClusterRepository.tableName, error)
			return Storage.getAll<Common.PrivateConfig>(`${ClusterRepository.tableName}:`)
		}
	}
}
