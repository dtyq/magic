export enum FilterTargetTypes {
	Username = "username",
	WorkNumber = "work_number",
	Position = "position",
	Phone = "phone",
	DepartmentName = "department_name",
	GroupName = "group_name",
}

export const filterTargetOptions = [
	{
		label: "用户姓名",
		value: FilterTargetTypes.Username,
	},
	{
		label: "用户工号",
		value: FilterTargetTypes.WorkNumber,
	},
	{
		label: "用户岗位",
		value: FilterTargetTypes.Position,
	},
	{
		label: "用户手机号",
		value: FilterTargetTypes.Phone,
	},
	{
		label: "部门名称",
		value: FilterTargetTypes.DepartmentName,
	},
	{
		label: "群聊名称",
		value: FilterTargetTypes.GroupName,
	},
]

export const operatorMap = {
	[FilterTargetTypes.Username]: ["equals", "no_equals", "contains", "no_contains"],
	[FilterTargetTypes.WorkNumber]: [
		"equals",
		"no_equals",
		"contains",
		"no_contains",
		"empty",
		"not_empty",
	],
	[FilterTargetTypes.Position]: [
		"equals",
		"no_equals",
		"contains",
		"no_contains",
		"empty",
		"not_empty",
	],
	[FilterTargetTypes.Phone]: ["equals", "no_equals", "contains", "no_contains"],
	[FilterTargetTypes.DepartmentName]: ["equals", "no_equals", "contains", "no_contains"],
	[FilterTargetTypes.GroupName]: ["equals", "no_equals", "contains", "no_contains"],
}

// 值映射
export const operator2Label: Record<string, string> = {
	equals: "等于",
	no_equals: "不等于",
	contains: "包含",
	no_contains: "不包含",
	empty: "为空",
	not_empty: "不为空",
}
