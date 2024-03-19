import { GlobalBaseRepository } from "@/opensource/models/repository/GlobalBaseRepository"
import type { User } from "@/opensource/types/user"
import type { OrganizationResponse } from "@/opensource/services/user/UserService"
import { Storage } from "../../repository/Cache"
import { logger } from "../../repository/logger"

interface UserSchema {
	id?: string
	key: string
	value:
		| string
		| User.UserInfo
		| OrganizationResponse
		| null
		| Array<User.UserOrganization>
		| Record<string, User.MagicOrganization>
	enabled?: boolean
	createdAt?: number
	updatedAt?: number
}

export class UserRepository extends GlobalBaseRepository<UserSchema> {
	static tableName = "user"

	constructor() {
		super(UserRepository.tableName)
	}

	/**
	 * @description 获取 Authorization，支持多种存储方式的容错
	 */
	async getAuthorization(): Promise<string | null> {
		try {
			// 并发获取数据，提供容错机制
			const [config, cache] = await Promise.allSettled([
				this.get("authorization"),
				Storage.get(`${UserRepository.tableName}:authorization`),
			])

			// 优先使用 IndexedDB 结果（数据更新、完整）
			const configValue = config.status === "fulfilled" ? config.value?.value : null
			const cacheValue = cache.status === "fulfilled" ? cache.value?.value : null

			return (configValue || cacheValue) as string | null
		} catch (error) {
			logger.error("getAuthorizationError", UserRepository.tableName, error)
			// 最后的保险：直接读取 localStorage 缓存
			return Storage.get(`${UserRepository.tableName}:authorization`)?.value
		}
	}

	async setAuthorization(token: string): Promise<void> {
		try {
			this.put({
				key: "authorization",
				value: token,
			})
		} catch (error) {
			logger.error("setAuthorizationError", UserRepository.tableName, error)
		} finally {
			Storage.set(`${UserRepository.tableName}:authorization`, {
				key: "authorization",
				value: token,
			})
		}
	}

	async getUserInfo(): Promise<User.UserInfo | null> {
		try {
			const config = await this.get("userInfo")
			return config?.value as User.UserInfo
		} catch (error) {
			logger.error("getUserInfoError", UserRepository.tableName, error)
			return Storage.get(`${UserRepository.tableName}:userInfo`)?.value
		}
	}

	async setUserInfo(info: User.UserInfo | null): Promise<void> {
		try {
			this.put({
				key: "userInfo",
				value: info,
			})
		} catch (error) {
			logger.error("setUserInfoError", UserRepository.tableName, error)
		} finally {
			Storage.set(`${UserRepository.tableName}:userInfo`, {
				key: "userInfo",
				value: info,
			})
		}
	}

	async setOrganization(org: OrganizationResponse | null): Promise<void> {
		try {
			this.put({
				key: "organization",
				value: org,
			})
		} catch (error) {
			logger.error("setOrganizationError", UserRepository.tableName, error)
		} finally {
			Storage.set(`${UserRepository.tableName}:organization`, {
				key: "organization",
				value: org,
			})
		}
	}

	async getOrganizations(): Promise<Record<string, User.MagicOrganization> | null> {
		try {
			const config = await this.get("organizations")
			return config?.value as Record<string, User.MagicOrganization>
		} catch (error) {
			logger.error("getOrganizationsError", UserRepository.tableName, error)
			return Storage.get(`${UserRepository.tableName}:organizations`)?.value
		}
	}

	async setOrganizations(org: Record<string, User.MagicOrganization> | null): Promise<void> {
		try {
			this.put({
				key: "organizations",
				value: org,
			})
		} catch (error) {
			logger.error("setOrganizationsError", UserRepository.tableName, error)
		} finally {
			Storage.set(`${UserRepository.tableName}:organizations`, {
				key: "organizations",
				value: org,
			})
		}
	}

	async getTeamshareOrganizations(): Promise<Array<User.UserOrganization> | null> {
		try {
			const config = await this.get("teamshareOrganizations")
			return config?.value as Array<User.UserOrganization>
		} catch (error) {
			logger.error("getTeamshareOrganizationsError", UserRepository.tableName, error)
			return Storage.get(`${UserRepository.tableName}:teamshareOrganizations`)?.value
		}
	}

	async setTeamshareOrganizations(org: Array<User.UserOrganization> | null): Promise<void> {
		try {
			this.put({
				key: "teamshareOrganizations",
				value: org,
			})
		} catch (error) {
			logger.error("setTeamshareOrganizationsError", UserRepository.tableName, error)
		} finally {
			Storage.set(`${UserRepository.tableName}:teamshareOrganizations`, {
				key: "teamshareOrganizations",
				value: org,
			})
		}
	}

	async getOrganizationCode(): Promise<string | null> {
		try {
			const config = await this.get("organizationCode")
			return config?.value as string
		} catch (error) {
			logger.error("getOrganizationCodeError", UserRepository.tableName, error)
			return Storage.get(`${UserRepository.tableName}:organizationCode`)?.value
		}
	}

	async setOrganizationCode(org: string | null): Promise<void> {
		try {
			this.put({
				key: "organizationCode",
				value: org,
			})
		} catch (error) {
			logger.error("setOrganizationCodeError", UserRepository.tableName, error)
		} finally {
			Storage.set(`${UserRepository.tableName}:organizationCode`, {
				key: "organizationCode",
				value: org,
			})
		}
	}

	async getTeamshareOrganizationCode(): Promise<string | null> {
		try {
			const config = await this.get("teamshareOrganizationCode")
			return config?.value as string
		} catch (error) {
			logger.error("getTeamshareOrganizationCodeError", UserRepository.tableName, error)
			return Storage.get(`${UserRepository.tableName}:teamshareOrganizationCode`)?.value
		}
	}

	async setTeamshareOrganizationCode(org: string | null): Promise<void> {
		try {
			this.put({
				key: "teamshareOrganizationCode",
				value: org,
			})
		} catch (error) {
			logger.error("setTeamshareOrganizationCodeError", UserRepository.tableName, error)
		} finally {
			Storage.set(`${UserRepository.tableName}:teamshareOrganizationCode`, {
				key: "teamshareOrganizationCode",
				value: org,
			})
		}
	}

	/**
	 * @description 批量获取用户相关数据（性能优化）
	 * 通过单次事务批量读取所有用户数据，减少 IndexedDB 操作次数
	 */
	async getBatchUserData(): Promise<{
		authorization: string | null
		userInfo: User.UserInfo | null
		organizations: Record<string, User.MagicOrganization> | null
		organizationCode: string | null
		teamshareOrganizations: Array<User.UserOrganization> | null
		teamshareOrganizationCode: string | null
	}> {
		try {
			const keys = [
				"authorization",
				"userInfo",
				"organizations",
				"organizationCode",
				"teamshareOrganizations",
				"teamshareOrganizationCode",
			]

			// 单次事务批量读取
			const results = await this.bulkGet(keys)

			return {
				authorization: (results[0]?.value as string) ?? null,
				userInfo: (results[1]?.value as User.UserInfo) ?? null,
				organizations:
					(results[2]?.value as Record<string, User.MagicOrganization>) ?? null,
				organizationCode: (results[3]?.value as string) ?? null,
				teamshareOrganizations: (results[4]?.value as Array<User.UserOrganization>) ?? null,
				teamshareOrganizationCode: (results[5]?.value as string) ?? null,
			}
		} catch (error) {
			logger.error("getBatchUserDataError", UserRepository.tableName, error)
			// Fallback: 从 localStorage 读取
			return {
				authorization:
					Storage.get(`${UserRepository.tableName}:authorization`)?.value ?? null,
				userInfo: Storage.get(`${UserRepository.tableName}:userInfo`)?.value ?? null,
				organizations:
					Storage.get(`${UserRepository.tableName}:organizations`)?.value ?? null,
				organizationCode:
					Storage.get(`${UserRepository.tableName}:organizationCode`)?.value ?? null,
				teamshareOrganizations:
					Storage.get(`${UserRepository.tableName}:teamshareOrganizations`)?.value ??
					null,
				teamshareOrganizationCode:
					Storage.get(`${UserRepository.tableName}:teamshareOrganizationCode`)?.value ??
					null,
			}
		}
	}

	/**
	 * @description 批量设置组织相关数据（性能优化）
	 * 通过单次事务批量写入，减少 IndexedDB 操作次数（4次写入 → 1次写入）
	 * @param data 需要批量设置的数据
	 */
	async setBatchOrganizationData(data: {
		organizations?: Record<string, User.MagicOrganization> | null
		organizationCode?: string | null
		teamshareOrganizations?: Array<User.UserOrganization> | null
		teamshareOrganizationCode?: string | null
	}): Promise<void> {
		try {
			const batchData: UserSchema[] = []

			// 构建批量写入数据
			if (data.organizations !== undefined) {
				batchData.push({
					key: "organizations",
					value: data.organizations,
				})
			}
			if (data.organizationCode !== undefined) {
				batchData.push({
					key: "organizationCode",
					value: data.organizationCode,
				})
			}
			if (data.teamshareOrganizations !== undefined) {
				batchData.push({
					key: "teamshareOrganizations",
					value: data.teamshareOrganizations,
				})
			}
			if (data.teamshareOrganizationCode !== undefined) {
				batchData.push({
					key: "teamshareOrganizationCode",
					value: data.teamshareOrganizationCode,
				})
			}

			// 单次事务批量写入 IndexedDB
			if (batchData.length > 0) {
				await this.bulkPut(batchData)
			}
		} catch (error) {
			logger.error("setBatchOrganizationDataError", UserRepository.tableName, error)
		} finally {
			// 同步到 localStorage（批量操作）
			if (data.organizations !== undefined) {
				Storage.set(`${UserRepository.tableName}:organizations`, {
					key: "organizations",
					value: data.organizations,
				})
			}
			if (data.organizationCode !== undefined) {
				Storage.set(`${UserRepository.tableName}:organizationCode`, {
					key: "organizationCode",
					value: data.organizationCode,
				})
			}
			if (data.teamshareOrganizations !== undefined) {
				Storage.set(`${UserRepository.tableName}:teamshareOrganizations`, {
					key: "teamshareOrganizations",
					value: data.teamshareOrganizations,
				})
			}
			if (data.teamshareOrganizationCode !== undefined) {
				Storage.set(`${UserRepository.tableName}:teamshareOrganizationCode`, {
					key: "teamshareOrganizationCode",
					value: data.teamshareOrganizationCode,
				})
			}
		}
	}
}
