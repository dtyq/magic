import i18next from "i18next"
import type { DefaultOptionType } from "antd/es/select"
import { AiAuditStatus } from "@/types/aiAudit"

/* 订单状态映射 */
export const STATUS_MAP: Record<AiAuditStatus, { text: string; color: string }> = {
	[AiAuditStatus.Finished]: {
		text: i18next.t("finished", { ns: "admin/platform/audit" }),
		color: "success",
	},
	[AiAuditStatus.Waiting]: {
		text: i18next.t("waiting", { ns: "admin/platform/audit" }),
		color: "processing",
	},
	[AiAuditStatus.Running]: {
		text: i18next.t("running", { ns: "admin/platform/audit" }),
		color: "processing",
	},
	[AiAuditStatus.Error]: {
		text: i18next.t("error", { ns: "admin/platform/audit" }),
		color: "error",
	},
	[AiAuditStatus.Suspended]: {
		text: i18next.t("suspended", { ns: "admin/platform/audit" }),
		color: "default",
	},
}

export const StatusOptions: DefaultOptionType[] = [
	{
		label: i18next.t("all", { ns: "admin/common" }),
		value: "",
	},
	...Object.values(AiAuditStatus).map((item) => ({
		label: i18next.t(item.toLocaleLowerCase(), { ns: "admin/platform/audit" }),
		value: item,
	})),
]

export const RiskOptions: DefaultOptionType[] = [
	{
		label: i18next.t("haveRisk", { ns: "admin/platform/audit" }),
		value: 1,
	},
	{
		label: i18next.t("noRisk", { ns: "admin/platform/audit" }),
		value: 0,
	},
]
