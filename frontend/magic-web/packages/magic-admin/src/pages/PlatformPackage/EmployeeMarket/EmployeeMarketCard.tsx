import { memo } from "react"
import { Flex, Switch, InputNumber } from "antd"
import { useTranslation } from "react-i18next"
import { MobileCard, StatusTag } from "@admin-components"
import type { PlatformPackage } from "@admin/types/platformPackage"

interface EmployeeMarketCardProps {
	data?: PlatformPackage.AgentMarketItem
	onClick?: (data: PlatformPackage.AgentMarketItem) => void
	publishStatusMap: Record<string, { text: string; color: string }>
	publisherTypeMap: Record<string, string>
	featuredSavingIds: Set<string>
	hiddenSavingIds: Set<string>
	sortSavingIds: Set<string>
	sortOrderMap: Record<string, number>
	setSortOrderMap: React.Dispatch<React.SetStateAction<Record<string, number>>>
	debouncedAutoSaveSortOrder: (id: string, sortOrder: number, previousSortOrder?: number) => void
	handleChangeFeatured: (record: PlatformPackage.AgentMarketItem, nextFeatured: boolean) => void
	handleChangeHidden: (record: PlatformPackage.AgentMarketItem, nextHidden: boolean) => void
	getLocalizedText: (value?: PlatformPackage.NameI18N | string) => string
}

function EmployeeMarketCard({
	data,
	onClick,
	publishStatusMap,
	publisherTypeMap,
	featuredSavingIds,
	hiddenSavingIds,
	sortSavingIds,
	sortOrderMap,
	setSortOrderMap,
	debouncedAutoSaveSortOrder,
	handleChangeFeatured,
	handleChangeHidden,
	getLocalizedText,
}: EmployeeMarketCardProps) {
	const { t } = useTranslation("admin/platform/employeeMarket")

	if (!data) return null

	const publishInfo = publishStatusMap[data.publish_status]

	return (
		<MobileCard title={getLocalizedText(data.name_i18n)} onClick={() => onClick?.(data)}>
			<Flex vertical gap={6}>
				<span>
					{t("employeeCode")}: {data.agent_code || "-"}
				</span>
				<span>
					{t("publisherType")}:{" "}
					{publisherTypeMap[data.publisher_type || ""] || data.publisher_type || "-"}
				</span>
				<span>
					{t("installCount")}: {data.install_count ?? "-"}
				</span>
				<span>
					{t("publisher")}: {data.publisher?.nickname || "-"}
				</span>
				<span>
					{t("createdAt")}: {data.created_at || "-"}
				</span>
				{publishInfo && (
					<StatusTag color={publishInfo.color} bordered={false}>
						{publishInfo.text}
					</StatusTag>
				)}
				<Flex align="center" gap={16} wrap="wrap">
					<Flex align="center" gap={6}>
						<span>{t("isFeatured")}:</span>
						<Switch
							size="small"
							checked={Boolean(data.is_featured)}
							loading={featuredSavingIds.has(data.id)}
							disabled={featuredSavingIds.has(data.id)}
							onChange={(next) => {
								if (next === Boolean(data.is_featured)) return
								handleChangeFeatured(data, next)
							}}
						/>
					</Flex>
					<Flex align="center" gap={6}>
						<span>{t("isHidden")}:</span>
						<Switch
							size="small"
							checked={Boolean(data.is_hidden)}
							loading={hiddenSavingIds.has(data.id)}
							disabled={hiddenSavingIds.has(data.id)}
							onChange={(next) => {
								if (next === Boolean(data.is_hidden)) return
								handleChangeHidden(data, next)
							}}
						/>
					</Flex>
				</Flex>
				<Flex align="center" gap={6}>
					<span>{t("sortOrder")}:</span>
					<InputNumber
						min={0}
						precision={0}
						style={{ width: 100 }}
						value={sortOrderMap[data.id]}
						disabled={sortSavingIds.has(data.id)}
						onChange={(value) => {
							const nextSortOrder = Number(value ?? 0)
							setSortOrderMap((prev) => ({ ...prev, [data.id]: nextSortOrder }))
							if (nextSortOrder === (data.sort_order ?? 0)) return
							debouncedAutoSaveSortOrder(data.id, nextSortOrder, data.sort_order)
						}}
					/>
				</Flex>
			</Flex>
		</MobileCard>
	)
}

export default memo(EmployeeMarketCard)
