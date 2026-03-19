import type { ResourceTypes } from "../types"

export enum ManagerModalType {
	// 权限管理
	Auth = "auth",
	// 部门选择
	Department = "department",
}

export type AuthExtraData = {
	resourceId: string
	resourceType: ResourceTypes
}
