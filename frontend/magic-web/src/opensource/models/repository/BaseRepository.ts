import type Dexie from "dexie"
import { DatabaseManager } from "./DatabaseManager"
import { AbstractBaseRepository } from "./AbstractBaseRepository"

/**
 * @description 用户相关的repository层基类
 */
export class BaseRepository<T> extends AbstractBaseRepository<T> {
	constructor(
		protected userId: string,
		tableName: string,
	) {
		super(tableName)
	}

	protected async getDB(): Promise<Dexie> {
		return DatabaseManager.getInstance().getDatabase(this.userId)
	}
}
