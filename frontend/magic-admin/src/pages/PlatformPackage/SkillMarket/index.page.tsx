import { useEffect, useMemo, useRef, useState } from "react"
import { createStyles } from "antd-style"
import { debounce } from "lodash-es"
import type { SearchItem } from "components"
import { SearchItemType, StatusTag, TableWithFilters } from "components"
import { useMemoizedFn, useMount, useRequest } from "ahooks"
import { useTranslation } from "react-i18next"
import { Flex, InputNumber, Select, Tooltip, message, type TableProps } from "antd"
import { usePagination } from "@/hooks/usePagination"
import { useApis } from "@/apis"
import type { PlatformPackage } from "@/types/platformPackage"

type DataType = PlatformPackage.SkillMarketItem
type ParamsType = PlatformPackage.GetSkillMarketListParams

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
	const [params, setParams] = useState<ParamsType>({
		page: 1,
		page_size: 20,
		order_by: "desc",
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

	useMount(() => {
		run(params)
	})

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
		debounce(
			async (
				recordId: string,
				sortOrder: number,
				currentParams: ParamsType,
				previousSortOrder?: number,
			) => {
				setSortSavingIds((prev) => new Set([...prev, recordId]))
				try {
					await updateSkillMarketInfo(recordId, { sort_order: sortOrder })
					setData((prev) =>
						prev.map((item) =>
							item.id === recordId ? { ...item, sort_order: sortOrder } : item,
						),
					)
					run(currentParams)
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
			},
			1000,
		),
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
			run(params)
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
				title: t("isFeatured"),
				dataIndex: "is_featured",
				key: "is_featured",
				width: 130,
				render: (value: boolean | undefined, record) => {
					const saving = featuredSavingIds.has(record.id)
					return (
						<Select
							size="small"
							style={{ width: 88 }}
							value={value ? "true" : "false"}
							loading={saving}
							disabled={saving}
							options={[
								{ label: t("yes"), value: "true" },
								{ label: t("no"), value: "false" },
							]}
							onChange={(nextValue) => {
								const nextFeatured = nextValue === "true"
								if (nextFeatured === Boolean(value)) return
								handleChangeFeatured(record, nextFeatured)
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
				title: t("sortOrder"),
				dataIndex: "sort_order",
				key: "sort_order",
				width: 180,
				render: (_, record) => (
					<InputNumber
						min={0}
						precision={0}
						style={{ width: 110 }}
						value={getSortOrderInputValue(record)}
						disabled={sortSavingIds.has(record.id)}
						onChange={(value) => {
							updateSortOrderDraft(record.id, value)
							if (typeof value !== "number" || Number.isNaN(value)) return
							if (value === (record.sort_order ?? 0)) return
							debouncedAutoSaveSortOrder(record.id, value, params, record.sort_order)
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
			getLocalizedText,
			renderDescriptionText,
			styles.desc,
			publisherTypeMap,
			renderStatus,
			publishStatusMap,
			getSortOrderInputValue,
			updateSortOrderDraft,
			sortSavingIds,
			featuredSavingIds,
			handleChangeFeatured,
			debouncedAutoSaveSortOrder,
		],
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
				options: [
					{ label: tCommon("all"), value: "all" },
					{ label: t("unpublished"), value: "UNPUBLISHED" },
					{ label: t("publishing"), value: "PUBLISHING" },
					{ label: t("published"), value: "PUBLISHED" },
					{ label: t("offline"), value: "OFFLINE" },
				],
				defaultValue: "all",
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
				type: SearchItemType.DATE_RANGE,
				field: "created_at",
				prefix: t("createdAt"),
				onChange: (dates) => {
					const start_time = dates?.[0]?.format("YYYY-MM-DD HH:mm:ss")
					const end_time = dates?.[1]?.format("YYYY-MM-DD HH:mm:ss")
					updateParams({ start_time, end_time })
				},
			},
		],
		[t, tCommon, updateParams, debouncedSearch],
	)

	const { paginationConfig } = usePagination({
		params,
		setParams,
		fetchData: run,
		data,
		total,
	})

	return (
		<div className={styles.container}>
			<TableWithFilters<DataType>
				search={searchItems}
				columns={columns}
				dataSource={data}
				rowKey="id"
				extraHeight={116}
				loading={loading}
				pagination={paginationConfig}
			/>
		</div>
	)
}

export default SkillMarketPage
