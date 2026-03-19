import { StructureUserItem, GroupInfo } from "@/types/organization"
import Dexie, { EntityTable } from "dexie"

export type DataContextDb = Dexie & {
	user_info: EntityTable<
		StructureUserItem,
		"user_id" // primary key "id" (for the typings only)
	>
	group_info: EntityTable<
		GroupInfo,
		"id" // primary key "id" (for the typings only)
	>
}
