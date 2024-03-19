import { memo } from "react"
import { Descriptions, Flex } from "antd"
import { useTranslation } from "react-i18next"
import { MobileCard } from "components"
import { PlatformPackage } from "@/types/platformPackage"

interface DataCardProps {
	data?: PlatformPackage.ProxyServer
	onClick?: (data: PlatformPackage.ProxyServer) => void
	getButtons: (data: PlatformPackage.ProxyServer) => React.ReactNode
}

function DataCard({ data, onClick, getButtons }: DataCardProps) {
	const { t } = useTranslation("admin/platform/proxy")

	if (!data) return null

	return (
		<MobileCard title={data.name} onClick={() => onClick?.(data)}>
			<Flex vertical gap={6}>
				<Descriptions
					column={1}
					items={[
						{
							key: "type",
							label: t("type"),
							children:
								data.type === PlatformPackage.ProxyServerType.ProxyServer
									? t("proxyServer")
									: t("subscriptionSource"),
						},
						{
							key: "proxyUrl",
							label: t("serverAndSource"),
							children: data.proxyUrl || "-",
						},
						{
							key: "username",
							label: t("username"),
							children: data.username || "-",
						},
						{
							key: "password",
							label: t("password"),
							children: data.password || "-",
						},
						{
							key: "remark",
							label: t("remark"),
							children: data.remark || "-",
						},
					]}
				/>
				<Flex gap={2} align="flex-end">
					{getButtons(data)}
				</Flex>
			</Flex>
		</MobileCard>
	)
}

export default memo(DataCard)
