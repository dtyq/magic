import i18next from "i18next"

export enum FilterTargetTypes {
	VectorDatabaseId = "vector_database_id",
	VectorDatabaseName = "vector_database_name",
}

export const filterTargetOptions = [
	{
		label: i18next.t("vectorDatabaseMatch.vectorDatabaseId", { ns: "flow" }),
		value: FilterTargetTypes.VectorDatabaseId,
	},
	{
		label: i18next.t("vectorDatabaseMatch.vectorDatabaseName", { ns: "flow" }),
		value: FilterTargetTypes.VectorDatabaseName,
	},
]

export const operatorMap = {
	[FilterTargetTypes.VectorDatabaseId]: ["equals", "no_equals", "contains", "no_contains"],
	[FilterTargetTypes.VectorDatabaseName]: ["equals", "no_equals", "contains", "no_contains"],
}

// 值映射
export const operator2Label: Record<string, string> = {
	equals: i18next.t("common.equals", { ns: "flow" }),
	no_equals: i18next.t("common.notEquals", { ns: "flow" }),
	contains: i18next.t("common.contains", { ns: "flow" }),
	no_contains: i18next.t("common.notContains", { ns: "flow" }),
}
