import { memo, type ReactNode } from "react"
import { Flex, InputNumber, Select, Switch } from "antd"
import { useTranslation } from "react-i18next"
import { MobileCard, StatusTag } from "@admin-components"
import type { PlatformPackage } from "@admin/types/platformPackage"

interface SkillMarketCardProps {
	data?: PlatformPackage.SkillMarketItem
	onClick?: (data: PlatformPackage.SkillMarketItem) => void
	publishStatusMap: Record<string, { text: string; color: string }>
	publisherTypeMap: Record<string, string>
	featuredSavingIds: Set<string>
	hiddenSavingIds: Set<string>
	sortSavingIds: Set<string>
	getSortOrderInputValue: (record: PlatformPackage.SkillMarketItem) => number | undefined
	updateSortOrderDraft: (id: string, value: number | null) => void
	debouncedAutoSaveSortOrder: (id: string, sortOrder: number, previousSortOrder?: number) => void
	handleChangeFeatured: (record: PlatformPackage.SkillMarketItem, nextFeatured: boolean) => void
	handleChangeHidden: (record: PlatformPackage.SkillMarketItem, nextHidden: boolean) => void
	getLocalizedText: (value?: PlatformPackage.NameI18N | string) => string
	renderCategoryNames: (record: PlatformPackage.SkillMarketItem) => ReactNode
	categoryOptions: Array<{ label: string; value: string }>
	categorySavingIds: Set<string>
	handleChangeCategory: (
		record: PlatformPackage.SkillMarketItem,
		nextCategoryIds?: string[],
	) => void
	hasEditRight: boolean
}

function SkillMarketCard({
	data,
	onClick,
	publishStatusMap,
	publisherTypeMap,
	featuredSavingIds,
	hiddenSavingIds,
	sortSavingIds,
	getSortOrderInputValue,
	updateSortOrderDraft,
	debouncedAutoSaveSortOrder,
	handleChangeFeatured,
	handleChangeHidden,
	getLocalizedText,
	renderCategoryNames,
	categoryOptions,
	categorySavingIds,
	handleChangeCategory,
	hasEditRight,
}: SkillMarketCardProps) {
	const { t } = useTranslation("admin/platform/skillMarket")
	const { t: tCommon } = useTranslation("admin/common")

	if (!data) return null

	const publishInfo = publishStatusMap[data.publish_status]
	const categoryIds = Array.from(new Set((data.category_ids ?? []).filter(Boolean)))
	return (
		<MobileCard title={getLocalizedText(data.name_i18n)} onClick={() => onClick?.(data)}>
			<Flex vertical gap={6}>
				<span>
					{t("packageName")}: {data.package_name || "-"}
				</span>
				<span>
					{t("skillCode")}: {data.skill_code || "-"}
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
				<Flex align="flex-start" gap={6}>
					<span>{t("category.label")}:</span>
					{categoryOptions.length ? (
						<Select
							allowClear
							showSearch
							mode="multiple"
							maxTagCount="responsive"
							optionFilterProp="label"
							style={{ minWidth: 220, flex: 1 }}
							value={categoryIds.length ? categoryIds : undefined}
							placeholder={t("category.uncategorized")}
							options={categoryOptions}
							disabled={categorySavingIds.has(data.id) || !hasEditRight}
							dropdownStyle={{ maxHeight: 320, overflowY: "auto" }}
							onChange={(value) => handleChangeCategory(data, value)}
						/>
					) : (
						renderCategoryNames(data)
					)}
				</Flex>
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
							disabled={featuredSavingIds.has(data.id) || !hasEditRight}
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
							disabled={hiddenSavingIds.has(data.id) || !hasEditRight}
							onChange={(next) => {
								if (next === Boolean(data.is_hidden)) return
								handleChangeHidden(data, next)
							}}
						/>
					</Flex>
				</Flex>
				<Flex align="center" gap={6}>
					<span>{tCommon("sortOrder")}:</span>
					<InputNumber
						min={0}
						precision={0}
						style={{ width: 100 }}
						value={getSortOrderInputValue(data)}
						disabled={sortSavingIds.has(data.id) || !hasEditRight}
						onChange={(value) => {
							updateSortOrderDraft(data.id, value)
							if (typeof value !== "number" || Number.isNaN(value)) return
							if (value === (data.sort_order ?? 0)) return
							debouncedAutoSaveSortOrder(data.id, value, data.sort_order)
						}}
					/>
				</Flex>
			</Flex>
		</MobileCard>
	)
}

export default memo(SkillMarketCard)
