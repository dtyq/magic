import { GlobalBaseRepository } from "@/models/repository/GlobalBaseRepository"
import type { UserFileManagerSnapshot } from "@/models/config/repositories/SuperProjectStateTypes"

export interface CachedUserFileTab {
	type?: "file"
	fileId: string
	title: string
	order: number
	activeAt: number
}

export interface CachedUserFileManagerTab {
	type: "file_manager"
	id: string
	title: string
	order: number
	activeAt: number
}

export type CachedUserTab = CachedUserFileTab | CachedUserFileManagerTab

export interface UserFileTabsRecord {
	/** 使用文件引用 resolver 的集群、组织、用户身份键，不依附任何项目。 */
	id: string
	tabs: CachedUserTab[]
	activeTabId?: string
	fileManagerState?: UserFileManagerSnapshot
}

export class UserFileTabsRepository extends GlobalBaseRepository<UserFileTabsRecord> {
	static readonly tableName = "super-user-file-tabs"

	constructor() {
		super(UserFileTabsRepository.tableName)
	}
}
