import { lazy, useEffect, useMemo, useRef, useState } from "react"
import { createStyles } from "antd-style"
import { debounce } from "lodash-es"
import {
	getSyncedTimeFilterValue,
	SearchItemType,
	StatusTag,
	TableWithFilters,
	MobileList,
} from "@admin-components"
import type { SearchItem, TableButton, TimeRangeValue } from "@admin-components"
import { useMemoizedFn, useMount, useRequest } from "ahooks"
import { useTranslation } from "react-i18next"
import { Flex, InputNumber, Select, Switch, Tag, Tooltip, message, type TableProps } from "antd"
import { IconCategory, IconUpload } from "@tabler/icons-react"
import { usePagination } from "@admin/hooks/usePagination"
import { useApis } from "@admin/apis"
import type { PlatformPackage } from "@admin/types/platformPackage"
import { useIsMobile } from "@admin/hooks/useIsMobile"
import useRights from "@admin/hooks/useRights"
import { PERMISSION_KEY_MAP } from "@admin/const/common"
import { SkillMarketCategoryModal } from "./components/SkillMarketCategoryModal"
import OfficialSkillImportDialog from "./components/OfficialSkillImportDialog"
import { resolveSkillCategoryName } from "./utils"

const SkillMarketCard = lazy(() => import("./SkillMarketCard"))

type DataType = PlatformPackage.SkillMarketItem
type ParamsType = PlatformPackage.GetSkillMarketListParams
const MAX_VISIBLE_CATEGORY_TAGS = 2
const CATEGORY_SELECT_WIDTH = 220

function getSkillMarketCategoryIds(record: DataType) {
	return Array.from(new Set((record.category_ids ?? []).filter(Boolean)))
}

const useStyles = createStyles(({ token }) => ({
	container: {
		backgroundColor: token.magicColorUsages.bg[0],
	},
	desc: {
		fontSize: 12,
		color: token.magicColorUsages.text[3],
	},
}))

function SkillMarketPage() {
	const { t } = useTranslation("admin/platform/skillMarket")
	const { t: tCommon } = useTranslation("admin/common")
	const { styles } = useStyles()
	const { PlatformPackageApi } = useApis()

	const [data, setData] = useState<DataType[]>([])
	const [total, setTotal] = useState(0)
	const [sortOrderDraftMap, setSortOrderDraftMap] = useState<Record<string, number | undefined>>(
		{},
	)
	const [sortSavingIds, setSortSavingIds] = useState<Set<string>>(new Set())
	const [featuredSavingIds, setFeaturedSavingIds] = useState<Set<string>>(new Set())
	const [hiddenSavingIds, setHiddenSavingIds] = useState<Set<string>>(new Set())
	const [categorySavingIds, setCategorySavingIds] = useState<Set<string>>(new Set())
	const [categoryOpen, setCategoryOpen] = useState(false)
	const [categories, setCategories] = useState<PlatformPackage.SkillMarketCategoryItem[]>([])
	const [officialImportOpen, setOfficialImportOpen] = useState(false)
	const [lastTimeFilterValue, setLastTimeFilterValue] = useState<TimeRangeValue | null>(null)
	const [params, setParams] = useState<ParamsType>({
		page: 1,
		page_size: 20,
		order_by: "desc",
		publish_status: "PUBLISHED",
	})

	const { run, loading } = useRequest(
		(arg: ParamsType) => PlatformPackageApi.getSkillMarketList(arg),
		{
			manual: true,
			onSuccess: (res) => {
				setData(res.list)
				setTotal(res.total)
			},
		},
	)
	const { runAsync: updateSkillMarketInfo } = useRequest(
		(id: string, data: PlatformPackage.UpdateSkillMarketInfoParams) =>
			PlatformPackageApi.updateSkillMarketInfo(id, data),
		{
			manual: true,
		},
	)
	const { run: runCategories, loading: categoriesLoading } = useRequest(
		() => PlatformPackageApi.getSkillMarketCategoryList({}),
		{
			manual: true,
			onSuccess: (res) => {
				setCategories(res.list)
			},
		},
	)

	useMount(() => {
		run(params)
		runCategories()
	})

	const hasEditRight = useRights(PERMISSION_KEY_MAP.PLATFORM_SKILL_MARKET_EDIT)

	const updateParams = useMemoizedFn((newParams: Partial<ParamsType>) => {
		const nextParams: ParamsType = {
			...params,
			...newParams,
			page: 1,
		}
		setParams(nextParams)
		run(nextParams)
	})

	const debouncedSearch = useRef(
		debounce((value: Partial<ParamsType>) => {
			updateParams(value)
		}, 500),
	).current

	useEffect(() => {
		return () => debouncedSearch.cancel()
	}, [debouncedSearch])

	const publishStatusMap = useMemo(
		() => ({
			UNPUBLISHED: { text: t("unpublished"), color: "default" },
			PUBLISHING: { text: t("publishing"), color: "processing" },
			PUBLISHED: { text: t("published"), color: "success" },
			OFFLINE: { text: t("offline"), color: "error" },
		}),
		[t],
	)

	const publisherTypeMap = useMemo<Record<string, string>>(
		() => ({
			USER: t("publisherTypeUser"),
			OFFICIAL: t("publisherTypeOfficial"),
			OFFICIAL_BUILTIN: t("publisherTypeOfficialBuiltin"),
		}),
		[t],
	)

	const renderStatus = useMemoizedFn(
		(value: string, map: Record<string, { text: string; color: string }>) => {
			const info = map[value]
			if (!info) {
				return <StatusTag bordered={false}>{value || "-"}</StatusTag>
			}
			return (
				<StatusTag color={info.color} bordered={false}>
					{info.text}
				</StatusTag>
			)
		},
	)

	const getLocalizedText = useMemoizedFn((value?: PlatformPackage.NameI18N | string) => {
		if (!value) return "-"
		if (typeof value === "string") return value
		return value.zh_CN || value.en_US || value.default || "-"
	})

	// The market API returns category IDs; resolve them against the flat admin category list.
	const categoryMap = useMemo(
		() =>
			new Map(
				categories.map((category) => [category.id, resolveSkillCategoryName(category)]),
			),
		[categories],
	)

	const categoryOptions = useMemo(
		() =>
			categories.map((category) => ({
				label: resolveSkillCategoryName(category),
				value: category.id,
			})),
		[categories],
	)

	const getCategoryNames = useMemoizedFn((record: DataType) => {
		const categoryIds = getSkillMarketCategoryIds(record)
		if (!categoryIds.length) return []
		return categoryIds.map((categoryId) => categoryMap.get(categoryId) ?? categoryId)
	})

	const renderCategoryNames = useMemoizedFn((record: DataType) => {
		const categoryNames = getCategoryNames(record)
		if (!categoryNames.length) return <span>{t("category.uncategorized")}</span>
		const visibleCategoryNames = categoryNames.slice(0, MAX_VISIBLE_CATEGORY_TAGS)
		const hiddenCategoryNames = categoryNames.slice(MAX_VISIBLE_CATEGORY_TAGS)

		return (
			<Flex wrap gap={4} style={{ minWidth: 0 }}>
				{visibleCategoryNames.map((categoryName, index) => (
					<Tag
						key={`${categoryName}-${index}`}
						bordered={false}
						style={{ marginInlineEnd: 0 }}
					>
						{categoryName}
					</Tag>
				))}
				{hiddenCategoryNames.length > 0 && (
					<Tooltip title={hiddenCategoryNames.join(" / ")}>
						<Tag bordered={false} style={{ marginInlineEnd: 0 }}>
							+{hiddenCategoryNames.length}
						</Tag>
					</Tooltip>
				)}
			</Flex>
		)
	})

	const renderDescriptionText = useMemoizedFn((value?: PlatformPackage.NameI18N) => {
		const text = getLocalizedText(value)
		if (text === "-") return text
		return (
			<Tooltip title={text}>
				<div
					style={{
						maxHeight: 66,
						lineHeight: "22px",
						overflow: "hidden",
						textOverflow: "ellipsis",
						display: "-webkit-box",
						WebkitLineClamp: 3,
						WebkitBoxOrient: "vertical",
						whiteSpace: "normal",
					}}
				>
					{text}
				</div>
			</Tooltip>
		)
	})

	const handleChangeCategory = useMemoizedFn(
		async (record: DataType, nextCategoryIds?: string[]) => {
			const categoryIds = Array.from(new Set((nextCategoryIds ?? []).filter(Boolean)))
			const currentCategoryIds = getSkillMarketCategoryIds(record)
			if (
				currentCategoryIds.length === categoryIds.length &&
				currentCategoryIds.every((id) => categoryIds.includes(id))
			)
				return

			setCategorySavingIds((prev) => new Set([...prev, record.id]))
			try {
				await PlatformPackageApi.updateSkillMarketCategoryRelation(record.id, categoryIds)
				setData((prev) =>
					prev.map((item) =>
						item.id === record.id
							? {
									...item,
									category_ids: categoryIds,
								}
							: item,
					),
				)
			} catch {
				message.error(tCommon("message.updateFailed"))
			} finally {
				setCategorySavingIds((prev) => {
					const next = new Set(prev)
					next.delete(record.id)
					return next
				})
			}
		},
	)

	const getSortOrderInputValue = useMemoizedFn((record: DataType) => {
		if (Object.prototype.hasOwnProperty.call(sortOrderDraftMap, record.id)) {
			return sortOrderDraftMap[record.id]
		}
		return record.sort_order
	})

	const updateSortOrderDraft = useMemoizedFn((id: string, value: number | null) => {
		setSortOrderDraftMap((prev) => ({
			...prev,
			[id]: value === null ? undefined : value,
		}))
	})

	const debouncedAutoSaveSortOrder = useRef(
		debounce(async (recordId: string, sortOrder: number, previousSortOrder?: number) => {
			setSortSavingIds((prev) => new Set([...prev, recordId]))
			try {
				await updateSkillMarketInfo(recordId, { sort_order: sortOrder })
				setData((prev) =>
					prev.map((item) =>
						item.id === recordId ? { ...item, sort_order: sortOrder } : item,
					),
				)
			} catch {
				setSortOrderDraftMap((prev) => ({
					...prev,
					[recordId]: previousSortOrder,
				}))
				message.error(tCommon("message.updateFailed"))
			} finally {
				setSortSavingIds((prev) => {
					const next = new Set(prev)
					next.delete(recordId)
					return next
				})
			}
		}, 1000),
	).current

	useEffect(
		() => () => {
			debouncedAutoSaveSortOrder.cancel()
		},
		[debouncedAutoSaveSortOrder],
	)

	const handleChangeFeatured = useMemoizedFn(async (record: DataType, nextFeatured: boolean) => {
		setFeaturedSavingIds((prev) => new Set([...prev, record.id]))
		try {
			await updateSkillMarketInfo(record.id, { is_featured: nextFeatured })
			setData((prev) =>
				prev.map((item) =>
					item.id === record.id ? { ...item, is_featured: nextFeatured } : item,
				),
			)
		} catch {
			message.error(tCommon("message.updateFailed"))
		} finally {
			setFeaturedSavingIds((prev) => {
				const next = new Set(prev)
				next.delete(record.id)
				return next
			})
		}
	})

	const handleChangeHidden = useMemoizedFn(async (record: DataType, nextHidden: boolean) => {
		setHiddenSavingIds((prev) => new Set([...prev, record.id]))
		try {
			await updateSkillMarketInfo(record.id, { is_hidden: nextHidden })
			setData((prev) =>
				prev.map((item) =>
					item.id === record.id ? { ...item, is_hidden: nextHidden } : item,
				),
			)
		} catch {
			message.error(tCommon("message.updateFailed"))
		} finally {
			setHiddenSavingIds((prev) => {
				const next = new Set(prev)
				next.delete(record.id)
				return next
			})
		}
	})

	const columns: TableProps<DataType>["columns"] = useMemo(
		() => [
			{
				title: t("skillCode"),
				dataIndex: "skill_code",
				key: "skill_code",
				width: 180,
				render: (value: string) => value || "-",
			},
			{
				title: t("packageName"),
				dataIndex: "package_name",
				key: "package_name",
				width: 220,
				render: (value?: string) => value || "-",
			},
			{
				title: t("skillName"),
				dataIndex: "name_i18n",
				key: "name_i18n",
				width: 180,
				render: (value: PlatformPackage.NameI18N) => getLocalizedText(value),
			},
			{
				title: t("organization"),
				dataIndex: "organization",
				key: "organization",
				width: 220,
				render: (value: DataType["organization"], record) => (
					<Flex vertical gap={4}>
						<span>{value?.name || "-"}</span>
						<span className={styles.desc}>
							{t("organizationCode")}:{record.organization_code || "-"}
						</span>
					</Flex>
				),
			},
			{
				title: t("description"),
				dataIndex: "description_i18n",
				key: "description_i18n",
				width: 220,
				render: (value: PlatformPackage.NameI18N) => renderDescriptionText(value),
			},
			{
				title: t("publisherType"),
				dataIndex: "publisher_type",
				key: "publisher_type",
				width: 120,
				render: (value: string) => publisherTypeMap[value] || value || "-",
			},
			{
				title: t("publishStatus"),
				dataIndex: "publish_status",
				key: "publish_status",
				width: 120,
				render: (value: string) => renderStatus(value, publishStatusMap),
			},
			{
				title: t("category.label"),
				dataIndex: "category_ids",
				key: "category_ids",
				width: 240,
				render: (_, record) => {
					const saving = categorySavingIds.has(record.id)
					if (!categories.length) return renderCategoryNames(record)
					const categoryIds = getSkillMarketCategoryIds(record)

					return (
						<Select
							allowClear
							showSearch
							mode="multiple"
							maxTagCount="responsive"
							optionFilterProp="label"
							style={{ width: CATEGORY_SELECT_WIDTH }}
							value={categoryIds.length ? categoryIds : undefined}
							placeholder={t("category.uncategorized")}
							options={categoryOptions}
							loading={categoriesLoading}
							disabled={saving || !hasEditRight}
							dropdownStyle={{ maxHeight: 320, overflowY: "auto" }}
							onChange={(value) => handleChangeCategory(record, value)}
						/>
					)
				},
			},
			{
				title: t("isFeatured"),
				dataIndex: "is_featured",
				key: "is_featured",
				width: 130,
				render: (value: boolean | undefined, record) => {
					const saving = featuredSavingIds.has(record.id)
					return (
						<Switch
							size="small"
							checked={Boolean(value)}
							loading={saving}
							disabled={saving || !hasEditRight}
							onChange={(nextFeatured) => {
								if (nextFeatured === Boolean(value)) return
								handleChangeFeatured(record, nextFeatured)
							}}
						/>
					)
				},
			},
			{
				title: t("isHidden"),
				dataIndex: "is_hidden",
				key: "is_hidden",
				width: 130,
				render: (value: boolean | undefined, record) => {
					const saving = hiddenSavingIds.has(record.id)
					return (
						<Switch
							size="small"
							checked={Boolean(value)}
							loading={saving}
							disabled={saving || !hasEditRight}
							onChange={(nextHidden) => {
								if (nextHidden === Boolean(value)) return
								handleChangeHidden(record, nextHidden)
							}}
						/>
					)
				},
			},
			{
				title: t("installCount"),
				dataIndex: "install_count",
				key: "install_count",
				width: 120,
				render: (value: number) => value ?? "-",
			},
			{
				title: tCommon("sortOrder"),
				dataIndex: "sort_order",
				key: "sort_order",
				width: 180,
				render: (_, record) => (
					<InputNumber
						min={0}
						precision={0}
						style={{ width: 110 }}
						value={getSortOrderInputValue(record)}
						disabled={sortSavingIds.has(record.id) || !hasEditRight}
						onChange={(value) => {
							updateSortOrderDraft(record.id, value)
							if (typeof value !== "number" || Number.isNaN(value)) return
							if (value === (record.sort_order ?? 0)) return
							debouncedAutoSaveSortOrder(record.id, value, record.sort_order)
						}}
					/>
				),
			},
			{
				title: t("publisher"),
				dataIndex: "publisher",
				key: "publisher",
				width: 150,
				render: (value: DataType["publisher"]) => value?.nickname || "-",
			},
			{
				title: t("createdAt"),
				dataIndex: "created_at",
				key: "created_at",
				width: 180,
				render: (value: string) => value || "-",
			},
			{
				title: t("updatedAt"),
				dataIndex: "updated_at",
				key: "updated_at",
				width: 180,
				render: (value: string) => value || "-",
			},
		],
		[
			t,
			tCommon,
			getLocalizedText,
			renderDescriptionText,
			renderCategoryNames,
			categoryOptions,
			categories,
			categoriesLoading,
			categorySavingIds,
			handleChangeCategory,
			styles.desc,
			publisherTypeMap,
			renderStatus,
			publishStatusMap,
			getSortOrderInputValue,
			updateSortOrderDraft,
			sortSavingIds,
			featuredSavingIds,
			hiddenSavingIds,
			handleChangeFeatured,
			handleChangeHidden,
			debouncedAutoSaveSortOrder,
			hasEditRight,
		],
	)

	const timeFilterValue = useMemo(
		(): TimeRangeValue | null =>
			getSyncedTimeFilterValue(lastTimeFilterValue, params.start_time, params.end_time),
		[lastTimeFilterValue, params.end_time, params.start_time],
	)

	const searchItems: SearchItem[] = useMemo(
		() => [
			{
				type: SearchItemType.TEXT,
				field: "package_name",
				addonBefore: t("packageName"),
				allowClear: true,
				onChange: (e) =>
					debouncedSearch({ package_name: e.target.value.trim() || undefined }),
			},
			{
				type: SearchItemType.TEXT,
				field: "name_i18n",
				addonBefore: t("skillName"),
				allowClear: true,
				onChange: (e) => debouncedSearch({ name_i18n: e.target.value.trim() || undefined }),
			},
			{
				type: SearchItemType.TEXT,
				field: "skill_code",
				addonBefore: t("skillCode"),
				allowClear: true,
				onChange: (e) =>
					debouncedSearch({ skill_code: e.target.value.trim() || undefined }),
			},
			{
				type: SearchItemType.TEXT,
				field: "organization_code",
				addonBefore: t("organizationCode"),
				allowClear: true,
				onChange: (e) =>
					debouncedSearch({ organization_code: e.target.value.trim() || undefined }),
			},
			{
				type: SearchItemType.SELECT,
				field: "publish_status",
				prefix: t("publishStatus"),
				placeholder: tCommon("all"),
				value: params.publish_status ?? "all",
				options: [
					{ label: tCommon("all"), value: "all" },
					{ label: t("unpublished"), value: "UNPUBLISHED" },
					{ label: t("publishing"), value: "PUBLISHING" },
					{ label: t("published"), value: "PUBLISHED" },
					{ label: t("offline"), value: "OFFLINE" },
				],
				onChange: (value) => {
					updateParams({ publish_status: value === "all" ? undefined : value })
				},
			},
			{
				type: SearchItemType.SELECT,
				field: "publisher_type",
				prefix: t("publisherType"),
				placeholder: tCommon("all"),
				options: [
					{ label: tCommon("all"), value: "all" },
					{ label: t("publisherTypeUser"), value: "USER" },
					{ label: t("publisherTypeOfficial"), value: "OFFICIAL" },
					{ label: t("publisherTypeOfficialBuiltin"), value: "OFFICIAL_BUILTIN" },
				],
				defaultValue: "all",
				onChange: (value) => {
					updateParams({ publisher_type: value === "all" ? undefined : value })
				},
			},
			{
				type: SearchItemType.SELECT,
				field: "order_by",
				prefix: t("orderBy"),
				placeholder: t("desc"),
				options: [
					{ label: t("asc"), value: "asc" },
					{ label: t("desc"), value: "desc" },
				],
				defaultValue: "desc",
				onChange: (value: "asc" | "desc") => {
					updateParams({ order_by: value })
				},
			},
			{
				type: SearchItemType.TIME_FILTER_PANEL,
				field: "created_at",
				prefix: t("createdAt"),
				value: timeFilterValue,
				onChange: (value) => {
					setLastTimeFilterValue(value)
					updateParams({
						start_time: value?.startDate || undefined,
						end_time: value?.endDate || undefined,
					})
				},
			},
		],
		[t, tCommon, timeFilterValue, updateParams, debouncedSearch, params.publish_status],
	)

	const buttons: TableButton[] = useMemo(() => {
		const nextButtons: TableButton[] = [
			{
				text: t("category.manageButton"),
				icon: <IconCategory size={16} />,
				onClick: () => setCategoryOpen(true),
			},
		]

		if (hasEditRight) {
			nextButtons.push({
				text: t("officialSkillImport.openButton"),
				icon: <IconUpload size={16} />,
				type: "primary",
				onClick: () => setOfficialImportOpen(true),
			})
		}

		return nextButtons
	}, [hasEditRight, t])

	const refreshAfterCategoryChange = useMemoizedFn(() => {
		runCategories()
		run(params)
	})

	const handleOfficialImportSuccess = useMemoizedFn(
		(_result: PlatformPackage.ImportOfficialSkillResponse) => {
			const nextParams: ParamsType = {
				...params,
				page: 1,
				publish_status: "PUBLISHED",
			}
			setParams(nextParams)
			run(nextParams)
		},
	)

	const isMobile = useIsMobile()

	const { paginationConfig } = usePagination({
		params,
		setParams,
		fetchData: run,
		data,
		total,
	})

	if (isMobile) {
		return (
			<>
				<MobileList<ParamsType, DataType>
					data={data}
					loading={loading}
					total={total}
					currentFilters={params}
					search={searchItems}
					buttons={buttons}
					CardComponent={
						<SkillMarketCard
							publishStatusMap={publishStatusMap}
							publisherTypeMap={publisherTypeMap}
							featuredSavingIds={featuredSavingIds}
							hiddenSavingIds={hiddenSavingIds}
							sortSavingIds={sortSavingIds}
							getSortOrderInputValue={getSortOrderInputValue}
							updateSortOrderDraft={updateSortOrderDraft}
							debouncedAutoSaveSortOrder={debouncedAutoSaveSortOrder}
							handleChangeFeatured={handleChangeFeatured}
							handleChangeHidden={handleChangeHidden}
							getLocalizedText={getLocalizedText}
							renderCategoryNames={renderCategoryNames}
							categoryOptions={categoryOptions}
							categorySavingIds={categorySavingIds}
							handleChangeCategory={handleChangeCategory}
							hasEditRight={hasEditRight}
						/>
					}
					paginationConfig={paginationConfig}
					showDetail={false}
				/>
				{categoryOpen && (
					<SkillMarketCategoryModal
						open={categoryOpen}
						hasEditRight={hasEditRight}
						onCancel={() => setCategoryOpen(false)}
						onSuccess={refreshAfterCategoryChange}
					/>
				)}
				{officialImportOpen && (
					<OfficialSkillImportDialog
						open={officialImportOpen}
						onCancel={() => setOfficialImportOpen(false)}
						onSuccess={handleOfficialImportSuccess}
					/>
				)}
			</>
		)
	}

	return (
		<>
			<div className={styles.container}>
				<TableWithFilters<DataType>
					search={searchItems}
					buttons={buttons}
					columns={columns}
					dataSource={data}
					rowKey="id"
					extraHeight={116}
					loading={loading}
					pagination={paginationConfig}
				/>
			</div>
			{categoryOpen && (
				<SkillMarketCategoryModal
					open={categoryOpen}
					hasEditRight={hasEditRight}
					onCancel={() => setCategoryOpen(false)}
					onSuccess={refreshAfterCategoryChange}
				/>
			)}
			{officialImportOpen && (
				<OfficialSkillImportDialog
					open={officialImportOpen}
					onCancel={() => setOfficialImportOpen(false)}
					onSuccess={handleOfficialImportSuccess}
				/>
			)}
		</>
	)
}

export default SkillMarketPage
