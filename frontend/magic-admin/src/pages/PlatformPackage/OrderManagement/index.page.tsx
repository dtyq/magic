import { memo, useMemo, useRef, useState } from "react"
import type { SearchItem } from "components"
import { useMemoizedFn, useMount, useRequest } from "ahooks"
import { useTranslation } from "react-i18next"
import { Flex, message, TreeSelect, type TableProps } from "antd"
import type { DataNode } from "antd/es/tree"
import { debounce } from "lodash-es"
import { createStyles } from "antd-style"
import { usePagination } from "@/hooks/usePagination"
import { useApis } from "@/apis"
import { useIsMobile } from "@/hooks/useIsMobile"
import { TableWithFilters, SearchItemType, StatusTag, MobileList } from "components"
import type { PlatformPackage } from "@/types/platformPackage"
import { StatusOptions, ORDER_STATUS_MAP, PaymentPlatformOptions } from "./constant"
import { PriceRange, PriceRangeSelectName } from "./components/PriceRange"
import OrderCard from "./components/OrderCard"

const useStyles = createStyles(({ token }) => ({
	container: {
		backgroundColor: token.magicColorUsages.bg[0],
	},
	desc: {
		fontSize: 12,
		color: token.magicColorUsages.text[3],
	},
	amount: {
		fontSize: 16,
		fontWeight: 600,
		color: token.colorPrimary,
	},
	tag: {
		backgroundColor: token.magicColorUsages.fill[0],
		display: "flex",
		gap: 4,
		alignItems: "center",
		borderRadius: 4,
	},
}))

type DataType = PlatformPackage.OrderList

const OrderList = memo(() => {
	const { t } = useTranslation("admin/platform/order")
	const { t: tCommon } = useTranslation("admin/common")
	const { styles } = useStyles()
	const isMobile = useIsMobile()

	const { PlatformPackageApi } = useApis()

	const [data, setData] = useState<DataType[]>([])
	const [params, setParams] = useState<PlatformPackage.GetOrderListParams>({
		page_size: 20,
		page: 1,
	})

	const [treeData, setTreeData] = useState<DataNode[]>([])
	const [total, setTotal] = useState(0)
	const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])

	// 价格范围状态
	const priceRange = useRef<[number | null, number | null]>([null, null])
	const rowSelection: TableProps<DataType>["rowSelection"] = {
		selectedRowKeys,
		onChange: (newSelectedRowKeys: React.Key[]) => {
			setSelectedRowKeys(newSelectedRowKeys)
		},
	}

	const { run: trigger, loading } = useRequest(
		(arg: PlatformPackage.GetOrderListParams) => PlatformPackageApi.getOrderList(arg),
		{
			manual: true,
			onSuccess: (res) => {
				setData(res.list)
				setTotal(res.total)
			},
		},
	)

	const { run: getOrderProduct } = useRequest(() => PlatformPackageApi.getOrderProduct(), {
		manual: true,
		onSuccess: (res) => {
			setTreeData(
				res.map((item: PlatformPackage.OrderProduct) => ({
					key: item.spu_id,
					label: item.spu_name,
					value: item.spu_id,
					children: item.skus.map((sku) => ({
						key: sku.sku_id,
						label: sku.sku_name,
						value: sku.sku_id,
					})),
				})),
			)
		},
	})

	useMount(() => {
		trigger(params)
		getOrderProduct()
	})

	// 定义通用的 params 更新函数
	const updateParams = useMemoizedFn((newParams) => {
		const p = {
			...params,
			...newParams,
			page: 1,
		}
		setParams(p)
		trigger(p)
	})

	const columns: TableProps<DataType>["columns"] = useMemo(
		() => [
			{
				title: t("orderId"),
				dataIndex: "id",
				key: "id",
				width: 150,
			},
			{
				title: t("productName"),
				dataIndex: "product_name",
				key: "product_name",
				width: 150,
			},
			{
				title: t("name"),
				key: "magic_id",
				dataIndex: "magic_id",
				width: 150,
				render: (text, { nick_name }) => {
					return (
						<Flex vertical gap={4}>
							<span>{nick_name || "-"}</span>
							<span className={styles.desc}>MagicID:{text || "-"}</span>
						</Flex>
					)
				},
			},
			{
				title: t("amount"),
				key: "amount",
				dataIndex: "amount",
				width: 100,
			},
			{
				title: t("paymentPlatform"),
				key: "payment_platform",
				dataIndex: "payment_platform",
				width: 100,
				render: (text) => {
					return PaymentPlatformOptions.find((item) => item.value === text)?.label || "-"
				},
			},
			{
				title: t("currency"),
				key: "currency",
				dataIndex: "currency",
				width: 100,
				render: (text) => {
					return <span>{text === "CNY" ? t("CNY") : t("USD")}</span>
				},
			},
			{
				title: t("status"),
				key: "status",
				dataIndex: "status",
				width: 100,
				render: (_, record) => {
					const { status } = record
					return (
						<StatusTag color={ORDER_STATUS_MAP[status].color} bordered={false}>
							{ORDER_STATUS_MAP[status].text}
						</StatusTag>
					)
				},
			},
			{
				title: t("mobile"),
				key: "mobile",
				dataIndex: "mobile",
				width: 150,
				render: (text) => text || "-",
			},
			{
				title: t("organization"),
				key: "organization_code",
				dataIndex: "organization_code",
				width: 150,
				render: (text, { organization_name }) => (
					<Flex vertical gap={4}>
						<span>{organization_name || "-"}</span>
						<span className={styles.desc}>
							{t("organizationCode")}:{text || "-"}
						</span>
					</Flex>
				),
			},
			{
				title: t("createdAt"),
				key: "created_at",
				dataIndex: "created_at",
				width: 200,
				render: (text) => {
					return text || "-"
				},
			},
			{
				title: t("paidAt"),
				key: "paid_at",
				dataIndex: "paid_at",
				width: 200,
				render: (text) => {
					return text || "-"
				},
			},
			{
				title: t("cancelledAt"),
				key: "cancelled_at",
				dataIndex: "cancelled_at",
				width: 200,
				render: (text) => {
					return text || "-"
				},
			},
			{
				title: t("refundedAt"),
				key: "refunded_at",
				dataIndex: "refunded_at",
				width: 200,
				render: (text) => {
					return text || "-"
				},
			},
		],
		[t, styles.desc],
	)

	const debouncedSearch = useRef(
		debounce((value: Partial<PlatformPackage.GetOrderListParams>) => {
			updateParams(value)
		}, 500),
	).current

	const searchItems: SearchItem[] = useMemo(
		() => [
			{
				type: SearchItemType.TEXT,
				field: "id",
				addonBefore: t("orderId"),
				allowClear: true,
				onChange: (e) => debouncedSearch({ order_id: e.target.value.trim() }),
			},
			{
				type: SearchItemType.TEXT,
				field: "code",
				addonBefore: t("organizationCode"),
				allowClear: true,
				onChange: (e) => debouncedSearch({ organization_code: e.target.value }),
			},
			{
				type: SearchItemType.TEXT,
				field: "mobile",
				addonBefore: t("mobile"),
				allowClear: true,
				onChange: (e) => debouncedSearch({ mobile: e.target.value.trim() }),
			},
			{
				type: SearchItemType.TEXT,
				field: "user_ids",
				placeholder: t("searchUser"),
				addonBefore: t("user"),
				allowClear: true,
				onChange: (e) => debouncedSearch({ user_name: e.target.value.trim() }),
			},
			{
				type: SearchItemType.TREE_SELECT,
				field: "product_id",
				prefix: t("product"),
				placeholder: tCommon("pleaseSelect"),
				treeData,
				allowClear: true,
				treeCheckable: true,
				showCheckedStrategy: TreeSelect.SHOW_PARENT,
				onChange: (values) => {
					const include_product_ids: string[] = []
					const include_sku_ids: string[] = []
					values.forEach((v: string) => {
						const node = treeData.find((n) => n.key === v)
						if (node) {
							include_product_ids.push(v)
						} else {
							include_sku_ids.push(v)
						}
					})
					updateParams({ include_product_ids, include_sku_ids })
				},
			},
			{
				type: SearchItemType.SELECT,
				field: "status",
				prefix: tCommon("status"),
				placeholder: tCommon("all"),
				options: StatusOptions,
				mode: "multiple",
				allowClear: true,
				onChange: (values: string[]) => {
					if (values.includes("all")) {
						updateParams({ order_status: undefined })
					} else {
						updateParams({ order_status: values })
					}
				},
			},
			{
				type: SearchItemType.SELECT,
				field: "payment_platform",
				prefix: t("paymentPlatform"),
				placeholder: tCommon("all"),
				options: PaymentPlatformOptions,
				mode: "multiple",
				allowClear: true,
				onChange: (values: string[]) => {
					if (values.includes("all")) {
						updateParams({ payment_platforms: undefined })
					} else {
						updateParams({ payment_platforms: values })
					}
				},
			},
			{
				type: SearchItemType.DATE_RANGE,
				field: "created_at",
				prefix: t("createdAt"),
				onChange: (dates) => {
					const start_date = dates?.[0]?.format("YYYY-MM-DD HH:mm:ss")
					const end_date = dates?.[1]?.format("YYYY-MM-DD HH:mm:ss")
					updateParams({ start_date, end_date })
				},
			},
			{
				type: PriceRangeSelectName,
				field: "price_range",
				component: PriceRange,
				placeholder: [t("minAmount"), t("maxAmount")],
				onChange: (type: "min" | "max", val: number | null) => {
					if (type === "min") {
						if (val !== null && priceRange.current[1] && val > priceRange.current[1]) {
							message.error(t("minAmountMustBeLessThanMaxAmount"))
							return
						}
						priceRange.current[0] = val
					} else {
						if (val !== null && priceRange.current[0] && val < priceRange.current[0]) {
							message.error(t("maxAmountMustBeGreaterThanMinAmount"))
							return
						}
						priceRange.current[1] = val
					}

					updateParams({
						min_amount: priceRange.current[0],
						max_amount: priceRange.current[1],
					})
				},
			},
		],
		[debouncedSearch, t, tCommon, treeData, updateParams],
	)

	const { paginationConfig } = usePagination({
		params,
		setParams,
		fetchData: trigger,
		data,
		total,
	})

	const getDetailItems = useMemoizedFn((selectedItem: DataType | null) => {
		if (!selectedItem) return []
		return [
			{
				key: "id",
				label: t("orderId"),
				children: selectedItem?.id,
			},
			{
				key: "product_name",
				label: t("productName"),
				children: selectedItem?.product_name,
			},
			{
				key: "nick_name",
				label: t("name"),
				children: selectedItem?.nick_name,
			},
			{
				key: "magic_id",
				label: t("magicId"),
				children: selectedItem?.magic_id,
			},
			{
				key: "ammount",
				label: t("amount"),
				children: (
					<span className={styles.amount}>
						{selectedItem?.currency === "CNY" ? "¥" : "$"}
						{selectedItem?.amount}
					</span>
				),
			},
			{
				key: "status",
				label: t("status"),
				children: selectedItem?.status ? (
					<StatusTag
						color={ORDER_STATUS_MAP[selectedItem?.status].color}
						bordered={false}
					>
						{ORDER_STATUS_MAP[selectedItem?.status].text}
					</StatusTag>
				) : null,
			},
			{
				key: "payment_platform",
				label: t("paymentPlatform"),
				children:
					PaymentPlatformOptions.find(
						(item) => item.value === selectedItem?.payment_platform,
					)?.label || "-",
			},
			{
				key: "mobile",
				label: t("mobile"),
				children: selectedItem?.mobile,
			},
			{
				key: "organization_name",
				label: t("organization"),
				children: selectedItem?.organization_name,
			},
			{
				key: "organization_code",
				label: t("organizationCode"),
				children: selectedItem?.organization_code,
			},
			{
				key: "created_at",
				label: t("createdAt"),
				children: selectedItem?.created_at,
			},
			{
				key: "paid_at",
				label: t("paidAt"),
				children: selectedItem?.paid_at || "-",
			},
			{
				key: "cancelled_at",
				label: t("cancelledAt"),
				children: selectedItem?.cancelled_at || "-",
			},
			{
				key: "refunded_at",
				label: t("refundedAt"),
				children: selectedItem?.refunded_at || "-",
			},
			{
				key: "expired_at",
				label: t("orderExpiredAt"),
				children: selectedItem?.expired_at || "-",
			},
		]
	})

	// PC端渲染
	return isMobile ? (
		<MobileList<PlatformPackage.GetOrderListParams, DataType>
			data={data}
			loading={loading}
			total={total}
			currentFilters={params}
			search={searchItems}
			CardComponent={<OrderCard />}
			getDetailItems={getDetailItems}
			paginationConfig={paginationConfig}
		/>
	) : (
		<div className={styles.container}>
			<TableWithFilters<DataType>
				search={searchItems}
				columns={columns}
				dataSource={data}
				rowKey={(record: DataType) => record.id}
				rowSelection={rowSelection}
				extraHeight={116}
				loading={loading}
				pagination={paginationConfig}
			/>
		</div>
	)
})

export default OrderList
