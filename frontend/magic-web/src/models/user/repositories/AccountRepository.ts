import { GlobalBaseRepository } from "@/models/repository/GlobalBaseRepository"
import type { User } from "@/types/user"
import { Storage } from "../../repository/Cache"
import { logger } from "../../repository/logger"
import type { UpdateSpec } from "dexie"

export class AccountRepository extends GlobalBaseRepository<User.UserAccount> {
	static tableName = "account"

	constructor() {
		super(AccountRepository.tableName)
	}

	// 查询单个账号、移除单个帐号
	async getAllAccounts(): Promise<Array<User.UserAccount>> {
		try {
			return await this.getAll()
		} catch (error) {
			logger.error("getAllAccountsError", AccountRepository.tableName, error)
			return Storage.getAll<User.UserAccount>(`${AccountRepository.tableName}:`)
		}
	}

	async addAccount(account: User.UserAccount) {
		try {
			await this.put(account)
		} catch (error) {
			logger.error("setClusterConfigError", AccountRepository.tableName, error)
			return Storage.set(`${AccountRepository.tableName}:${account?.magic_id ?? ""}`, account)
		}
	}

	async deleteAccount(magicId: string) {
		try {
			await this.delete(magicId)
		} catch (error) {
			logger.error("setClusterConfigError", AccountRepository.tableName, error)
			return Storage.remove(`${AccountRepository.tableName}:${magicId}`)
		}
	}

	async updateAccount(magicId: string, account: UpdateSpec<User.UserAccount>) {
		try {
			await this.update(magicId, account)
		} catch (error) {
			logger.error("setClusterConfigError", AccountRepository.tableName, error)
			const cache = Storage.get(`${AccountRepository.tableName}:${magicId}`)
			return Storage.set(`${AccountRepository.tableName}:${magicId}`, {
				...cache,
				...account,
			})
		}
	}

	async clearAccount() {
		try {
			await this.clear()
		} catch (error) {
			logger.error("setClusterConfigError", AccountRepository.tableName, error)
			return Storage.clearById(`${AccountRepository.tableName}:`)
		}
	}
}
