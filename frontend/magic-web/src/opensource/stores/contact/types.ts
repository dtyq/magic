import type {
	OrganizationData,
	StructureItemOnCache,
	StructureUserItem,
} from "@/opensource/types/organization"

export interface ContactState {
	organizations: Map<string, OrganizationData>
	departmentInfos: Map<string, StructureItemOnCache>
	userInfos: Map<string, StructureUserItem>
}
