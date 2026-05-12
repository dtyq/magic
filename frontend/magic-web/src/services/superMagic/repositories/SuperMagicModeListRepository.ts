import { GlobalBaseRepository } from "@/models/repository/GlobalBaseRepository"
import type { ModeItem } from "@/pages/superMagic/pages/Workspace/types"
import { platformKey } from "@/utils/storage"

// Prefix of legacy localStorage keys used before IDB migration
export const LEGACY_MODE_LIST_LS_PREFIX = platformKey("super_magic/mode_list/")

/** Persisted record for Super Magic mode list cache in `magic-global` */
export interface SuperMagicModeListRecord {
	key: string
	data: ModeItem[]
	updatedAt: number
}

export class SuperMagicModeListRepository extends GlobalBaseRepository<SuperMagicModeListRecord> {
	static readonly tableName = "super-magic-mode-list"

	constructor() {
		super(SuperMagicModeListRepository.tableName)
	}

	/** Read cached mode list by composed storage key */
	public async getByKey(key: string): Promise<ModeItem[] | undefined> {
		const record = await this.get(key)
		return record?.data
	}

	/** Upsert cached mode list, stripping non-serializable fields */
	public async saveByKey(key: string, data: ModeItem[]): Promise<void> {
		await this.put({
			key,
			data: this.sanitize(data),
			updatedAt: Date.now(),
		})
	}

	/** Strip MobX proxies / functions so IDB structured-clone can persist it */
	private sanitize(data: ModeItem[]): ModeItem[] {
		try {
			return JSON.parse(JSON.stringify(data))
		} catch {
			return data
		}
	}
}

const superMagicModeListRepository = new SuperMagicModeListRepository()
export default superMagicModeListRepository
