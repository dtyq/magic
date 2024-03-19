import i18next from "i18next"
import { PlatformPackage } from "@/types/platformPackage"
import type { DefaultOptionType } from "antd/es/select"

/* 订单状态映射 */
export const ORDER_STATUS_MAP: Record<
	PlatformPackage.OrderStatus,
	{ text: string; color: string }
> = {
	[PlatformPackage.OrderStatus.Pending]: {
		text: i18next.t("pending", { ns: "admin/platform/order" }),
		color: "warning",
	},
	[PlatformPackage.OrderStatus.Paid]: {
		text: i18next.t("paid", { ns: "admin/platform/order" }),
		color: "processing",
	},
	[PlatformPackage.OrderStatus.Refunded]: {
		text: i18next.t("refunded", { ns: "admin/platform/order" }),
		color: "warning",
	},
	[PlatformPackage.OrderStatus.Expired]: {
		text: i18next.t("expired", { ns: "admin/platform/order" }),
		color: "default",
	},
	[PlatformPackage.OrderStatus.Closed]: {
		text: i18next.t("closed", { ns: "admin/platform/order" }),
		color: "error",
	},
	[PlatformPackage.OrderStatus.Finished]: {
		text: i18next.t("finished", { ns: "admin/platform/order" }),
		color: "success",
	},
}

export const StatusOptions: DefaultOptionType[] = [
	{
		label: i18next.t("all", { ns: "admin/common" }),
		value: "all",
	},
	...Object.values(PlatformPackage.OrderStatus).map((item) => ({
		label: i18next.t(item.toLocaleLowerCase(), { ns: "admin/platform/order" }),
		value: item,
	})),
]

export const PaymentPlatformOptions: DefaultOptionType[] = [
	{
		label: i18next.t("all", { ns: "admin/common" }),
		value: "all",
	},
	...Object.values(PlatformPackage.PaymentPlatform).map((item) => ({
		label: i18next.t(item.toLocaleLowerCase(), { ns: "admin/platform/order" }),
		value: item,
	})),
]
