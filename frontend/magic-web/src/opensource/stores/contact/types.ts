import type {
	OrganizationData,
	StructureItemOnCache,
	StructureUserItem,
} from "@/types/organization"

export interface ContactState {
	organizations: Map<string, OrganizationData>
	departmentInfos: Map<string, StructureItemOnCache>
	userInfos: Map<string, StructureUserItem>
}
