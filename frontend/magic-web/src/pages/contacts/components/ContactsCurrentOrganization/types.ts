import { StructureUserItem } from "@/types/organization"

export interface PathNodeData {
	id: string
	name: string
	departmentPath: string
	departmentPathName: string
	pathNodes: {
		id: string
		name: string
	}[]
}

export interface UseCurrentOrganizationDataReturn {
	userInfo: StructureUserItem | null
	isLoading: boolean
	pathNodesState: PathNodeData[] | undefined
}
