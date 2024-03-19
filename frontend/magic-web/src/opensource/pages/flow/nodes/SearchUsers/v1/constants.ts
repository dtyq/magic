import i18next from "i18next"

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
		label: i18next.t("searchMembers.userName", { ns: "flow" }),
		value: FilterTargetTypes.Username,
	},
	{
		label: i18next.t("searchMembers.userWorkNumber", { ns: "flow" }),
		value: FilterTargetTypes.WorkNumber,
	},
	{
		label: i18next.t("searchMembers.userPosition", { ns: "flow" }),
		value: FilterTargetTypes.Position,
	},
	{
		label: i18next.t("searchMembers.userPhone", { ns: "flow" }),
		value: FilterTargetTypes.Phone,
	},
	{
		label: i18next.t("searchMembers.departmentName", { ns: "flow" }),
		value: FilterTargetTypes.DepartmentName,
	},
	{
		label: i18next.t("searchMembers.groupName", { ns: "flow" }),
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
	equals: i18next.t("common.equals", { ns: "flow" }),
	no_equals: i18next.t("common.notEquals", { ns: "flow" }),
	contains: i18next.t("common.contains", { ns: "flow" }),
	no_contains: i18next.t("common.notContains", { ns: "flow" }),
	empty: i18next.t("common.empty", { ns: "flow" }),
	not_empty: i18next.t("common.notEmpty", { ns: "flow" }),
}
