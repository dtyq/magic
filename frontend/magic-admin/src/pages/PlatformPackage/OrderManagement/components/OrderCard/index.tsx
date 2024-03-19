import { memo } from "react"
import { Flex, Tag } from "antd"
import type { PlatformPackage } from "@/types/platformPackage"
import { MobileCard, StatusTag } from "components"
import { useTranslation } from "react-i18next"
import { useStyles } from "./styles"
import { ORDER_STATUS_MAP, PaymentPlatformOptions } from "../../constant"

interface OrderCardProps {
	data?: PlatformPackage.OrderList
	onClick?: (data: PlatformPackage.OrderList) => void
}

function OrderCard({ data, onClick }: OrderCardProps) {
	const { styles } = useStyles()
	const { t } = useTranslation("admin/platform/order")

	const paymentPlatformLabel =
		PaymentPlatformOptions.find((item) => item.value === data?.payment_platform)?.label || "-"

	if (!data) return null

	return (
		<MobileCard onClick={() => onClick?.(data)}>
			<Flex vertical gap={6}>
				<Flex vertical gap={4}>
					<div className={styles.productName}>{data.product_name}</div>
					<div className={styles.desc}>#{data.id}</div>
				</Flex>

				{/* 用户信息 */}
				<Flex vertical gap={4}>
					<span>
						{t("name")}:{data.nick_name || "-"}
					</span>
					<span className={styles.desc}>MagicID: {data.magic_id || "-"}</span>
				</Flex>

				{/* 组织信息 */}
				{data.organization_name && (
					<Flex vertical gap={4}>
						<span>
							{t("organization")}:{data.organization_name}
						</span>
						<span className={styles.desc}>
							{t("organizationCode")}: {data.organization_code || "-"}
						</span>
					</Flex>
				)}

				{/* 金额和支付平台 */}
				<Flex justify="space-between" align="flex-end">
					<Flex vertical gap={4}>
						<span className={styles.desc}>
							{t("paidAt")}: {data.paid_at || "-"}
						</span>
						<Flex gap={8} align="center">
							<span>{t("amount")}:</span>
							<span className={styles.amount}>
								{data.currency === "CNY" ? "¥" : "$"}
								{data.amount}
							</span>
						</Flex>
					</Flex>
					<Flex gap={2} align="center">
						<Tag>{paymentPlatformLabel}</Tag>
						<StatusTag color={ORDER_STATUS_MAP[data.status].color} bordered={false}>
							{ORDER_STATUS_MAP[data.status].text}
						</StatusTag>
					</Flex>
				</Flex>
			</Flex>
		</MobileCard>
	)
}

export default memo(OrderCard)
