// 权限归属什么资源
export enum ResourceTypes {
	Agent = 1,
	Flow = 2,
	Tools = 3,
	Knowledge = 4,
	Mcp = 5,
}

// 权限成员类型
export enum TargetTypes {
	User = 1,
	Department = 2,
	Group = 3,
}

// 实际的权限枚举
export enum OperationTypes {
	None = 0,
	Owner = 1,
	Admin = 2,
	Read = 3,
	Edit = 4,
}

export const hasViewRight = (operation: OperationTypes) => {
	return [
		OperationTypes.Admin,
		OperationTypes.Edit,
		OperationTypes.Owner,
		OperationTypes.Read,
	].includes(operation)
}

export const hasEditRight = (operation: OperationTypes) => {
	return [OperationTypes.Admin, OperationTypes.Edit, OperationTypes.Owner].includes(operation)
}

export const hasAdminRight = (operation: OperationTypes) => {
	return [OperationTypes.Admin, OperationTypes.Owner].includes(operation)
}

export type AuthMember = {
	target_type: TargetTypes
	target_id: string
	operation: OperationTypes
	target_info?: {
		id: string
		name: string
		description: string
		icon: string
		[key: string]: any
	}
}

export type AuthRequestParams = {
	resource_type: ResourceTypes
	resource_id: string
	targets: AuthMember[]
}
