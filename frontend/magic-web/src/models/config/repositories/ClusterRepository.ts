import { GlobalBaseRepository } from "@/models/repository/GlobalBaseRepository"
import type { Common } from "@/types/common"
import { Storage } from "../../repository/Cache"
import { logger } from "../../repository/logger"

export class ClusterRepository extends GlobalBaseRepository<Common.PrivateConfig> {
	static readonly tableName = "cluster"

	static readonly version = 1

	constructor() {
		super(ClusterRepository.tableName)
	}

	public async setClustersConfig(clustersConfig: Array<Common.PrivateConfig>): Promise<void> {
		// Cache every definition before any database wait; persistence still reports failures below.
		for (const config of clustersConfig) this.cacheClusterConfig(config)

		try {
			// Await every write so a failed put reaches the catch below instead of
			// escaping as an unhandled rejection.
			await Promise.all(
				clustersConfig.map((config) =>
					this.put({ ...config, deployCode: config?.deployCode ?? "" }),
				),
			)
		} catch (error) {
			logger.error({
				eventKey: "set_clusters_config_failed",
				errorKind: "unknown",
				error: error,
				message: "setClustersConfigError",
				context: { tableName: ClusterRepository.tableName },
			})
		}
	}

	public async setClusterConfig(clustersConfig: Common.PrivateConfig) {
		this.cacheClusterConfig(clustersConfig)
		try {
			return await this.put(clustersConfig)
		} catch (error) {
			logger.error({
				eventKey: "set_cluster_config_failed",
				errorKind: "unknown",
				error: error,
				message: "setClusterConfigError",
				context: { tableName: ClusterRepository.tableName },
			})
		}
	}

	public async getClustersConfig(): Promise<Array<Common.PrivateConfig>> {
		try {
			return await this.getAll()
		} catch (error) {
			logger.error({
				eventKey: "get_clusters_config_failed",
				errorKind: "unknown",
				error: error,
				message: "getClustersConfigError",
				context: { tableName: ClusterRepository.tableName },
			})
			return Storage.getAll<Common.PrivateConfig>(`${ClusterRepository.tableName}:`)
		}
	}
	private cacheClusterConfig(config: Common.PrivateConfig): void {
		const deployCode = config?.deployCode ?? ""
		Storage.set(`${ClusterRepository.tableName}:${deployCode}`, { ...config, deployCode })
	}
}
