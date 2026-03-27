import { useMemo, useRef, useState } from "react"
import { Button, Descriptions, Flex, Modal, Tag, Tooltip, type TableProps } from "antd"
import { createStyles } from "antd-style"
import { debounce } from "lodash-es"
import { useMemoizedFn, useMount, useRequest } from "ahooks"
import { IconReload } from "@tabler/icons-react"
import type { SearchItem, TableButton } from "components"
import { SearchItemType, TableWithFilters } from "components"
import { useTranslation } from "react-i18next"
import dayjs from "dayjs"
import { useApis } from "@/apis"
import { usePagination } from "@/hooks/usePagination"
import { useAdminStore } from "@/stores/admin"
import type { ModelAudit } from "@/types/modelAudit"

const useStyles = createStyles(({ token }) => ({
	container: {
		backgroundColor: token.magicColorUsages.bg[0],
	},
	desc: {
		fontSize: 12,
		color: token.magicColorUsages.text[3],
	},
	jsonBlock: {
		margin: 0,
		fontFamily: "monospace",
		whiteSpace: "pre-wrap",
		wordBreak: "break-word",
	},
}))

const STATUS_COLOR_MAP: Record<string, string> = {
	SUCCESS: "success",
	FAILED: "error",
	ERROR: "error",
	RUNNING: "processing",
	PENDING: "warning",
}

const formatTimestamp = (value?: number) => {
	if (!value) return "-"
	return dayjs(value).format("YYYY-MM-DD HH:mm:ss")
}

const formatJsonText = (value: unknown) => {
	if (value === null || value === undefined) return "-"
	if (typeof value === "string") {
		try {
			return JSON.stringify(JSON.parse(value), null, 2)
		} catch {
			return value
		}
	}
	try {
		return JSON.stringify(value, null, 2)
	} catch {
		return String(value)
	}
}

const getPreviewText = (value: unknown) => {
	if (value === null || value === undefined) return "-"
	const text = formatJsonText(value).replace(/\s+/g, " ").trim()
	if (!text) return "-"
	return text.length > 80 ? `${text.slice(0, 80)}...` : text
}

function ModelAuditLogPage() {
	const { t } = useTranslation("admin/platform/modelAuditLog")
	const { t: tCommon } = useTranslation("admin/common")
	const { styles } = useStyles()
	const { ModelAuditApi } = useApis()
	const { isOfficialOrg } = useAdminStore()

	const [data, setData] = useState<ModelAudit.ModelAuditLogItem[]>([])
	const [total, setTotal] = useState(0)
	const [detailOpen, setDetailOpen] = useState(false)
	const [detailRecord, setDetailRecord] = useState<ModelAudit.ModelAuditLogItem | null>(null)
	const [params, setParams] = useState<ModelAudit.ModelAuditLogParams>({
		page: 1,
		page_size: 20,
	})
	const [localInputs, setLocalInputs] = useState({
		product_code: "",
		organization_code: "",
		magic_topic_id: "",
	})

	const { run, loading } = useRequest(
		(arg: ModelAudit.ModelAuditLogParams) => ModelAuditApi.getModelAuditLogList(arg),
		{
			manual: true,
			onSuccess: (res) => {
				setData(res.list || [])
				setTotal(res.total || 0)
			},
			onError: () => {
				setData([])
				setTotal(0)
			},
		},
	)

	useMount(() => {
		run(params)
	})

	const updateParams = useMemoizedFn((newParams: Partial<ModelAudit.ModelAuditLogParams>) => {
		const nextParams = {
			...params,
			...newParams,
			page: 1,
		}
		setParams(nextParams)
		run(nextParams)
	})

	const debouncedSearch = useRef(
		debounce((value: Partial<typeof localInputs>) => {
			const normalizedValue = Object.fromEntries(
				Object.entries(value).map(([key, item]) => [key, item?.trim() || undefined]),
			)
			updateParams(normalizedValue)
		}, 500),
	).current

	const handleInputChange = useMemoizedFn((field: keyof typeof localInputs, value: string) => {
		setLocalInputs((prev) => ({ ...prev, [field]: value }))
		debouncedSearch({ [field]: value })
	})

	const handleReset = useMemoizedFn(() => {
		setLocalInputs({
			product_code: "",
			organization_code: "",
			magic_topic_id: "",
		})
		updateParams({
			start_date: undefined,
			end_date: undefined,
			product_code: undefined,
			organization_code: undefined,
			access_scope: undefined,
			magic_topic_id: undefined,
		})
	})

	const handleRefresh = useMemoizedFn(() => {
		run(params)
	})

	const openDetail = useMemoizedFn((record: ModelAudit.ModelAuditLogItem) => {
		setDetailRecord(record)
		setDetailOpen(true)
	})

	const formatAccessScope = useMemoizedFn((value?: string) => {
		if (!value) return "-"
		if (value === "api_platform") return t("accessScopeApiPlatform")
		if (value === "magic") return t("accessScopeMagic")
		return value
	})

	const columns: TableProps<ModelAudit.ModelAuditLogItem>["columns"] = useMemo(
		() => [
			{
				title: t("recordId"),
				dataIndex: "id",
				key: "id",
				width: 190,
				ellipsis: true,
				render: (text: string) => (
					<span style={{ fontFamily: "monospace" }}>{text || "-"}</span>
				),
			},
			{
				title: t("userInfo"),
				key: "user_info",
				width: 220,
				render: (_, record) => (
					<Flex vertical gap={2}>
						<span>{record.user_info?.user_name || "-"}</span>
						<span className={styles.desc}>
							ID: {record.user_info?.user_id || record.user_id || "-"}
						</span>
						<span className={styles.desc}>
							{t("phone")}: {record.user_info?.phone || "-"}
						</span>
					</Flex>
				),
			},
			{
				title: t("organizationCode"),
				dataIndex: "organization_code",
				key: "organization_code",
				width: 170,
				ellipsis: true,
				render: (text: string) => (
					<span style={{ fontFamily: "monospace" }}>{text || "-"}</span>
				),
			},
			{
				title: t("productCode"),
				dataIndex: "product_code",
				key: "product_code",
				width: 160,
				ellipsis: true,
			},
			{
				title: t("accessScope"),
				dataIndex: "access_scope",
				key: "access_scope",
				width: 140,
				render: (value?: string) => formatAccessScope(value),
			},
			{
				title: t("magicTopicId"),
				dataIndex: "magic_topic_id",
				key: "magic_topic_id",
				width: 180,
				ellipsis: true,
				render: (value?: string) => (
					<span style={{ fontFamily: "monospace" }}>{value || "-"}</span>
				),
			},
			{
				title: t("points"),
				dataIndex: "points",
				key: "points",
				width: 100,
				align: "right",
				render: (value?: number) => value ?? "-",
			},
			{
				title: t("callType"),
				dataIndex: "type",
				key: "type",
				width: 100,
				render: (text: string) => <Tag bordered={false}>{text || "-"}</Tag>,
			},
			{
				title: t("callStatus"),
				dataIndex: "status",
				key: "status",
				width: 120,
				render: (text: string) => (
					<Tag color={STATUS_COLOR_MAP[text] || "default"} bordered={false}>
						{text || "-"}
					</Tag>
				),
			},
			{
				title: t("accessKey"),
				dataIndex: "ak",
				key: "ak",
				width: 150,
				ellipsis: true,
				render: (text: string) => (
					<span style={{ fontFamily: "monospace" }}>{text || "-"}</span>
				),
			},
			{
				title: t("operationTime"),
				dataIndex: "operation_time",
				key: "operation_time",
				width: 180,
				render: (value: number) => formatTimestamp(value),
			},
			{
				title: t("latency"),
				dataIndex: "all_latency",
				key: "all_latency",
				width: 120,
				align: "right",
				render: (value: number) => `${value ?? 0} ms`,
			},
			{
				title: t("usage"),
				dataIndex: "usage",
				key: "usage",
				width: 220,
				ellipsis: true,
				render: (value: unknown) => {
					const preview = getPreviewText(value)
					return (
						<Tooltip title={preview === "-" ? undefined : formatJsonText(value)}>
							<span>{preview}</span>
						</Tooltip>
					)
				},
			},
			{
				title: tCommon("detail"),
				key: "detail",
				fixed: "right",
				width: 90,
				render: (_, record) => (
					<Button type="link" size="small" onClick={() => openDetail(record)}>
						{t("viewDetail")}
					</Button>
				),
			},
		],
		[formatAccessScope, openDetail, styles.desc, t, tCommon],
	)

	const searchItems: SearchItem[] = useMemo(() => {
		const items: SearchItem[] = [
			{
				type: SearchItemType.DATE_RANGE,
				field: "operation_time",
				prefix: t("operationTime"),
				onChange: (dates) => {
					updateParams({
						start_date: dates?.[0]?.format("YYYY-MM-DD"),
						end_date: dates?.[1]?.format("YYYY-MM-DD"),
					})
				},
			},
			{
				type: SearchItemType.TEXT,
				field: "product_code",
				addonBefore: t("productCode"),
				placeholder: t("searchProductCode"),
				allowClear: true,
				value: localInputs.product_code,
				onChange: (e) => handleInputChange("product_code", e.target.value),
			},
			{
				type: SearchItemType.SELECT,
				field: "access_scope",
				prefix: t("accessScope"),
				placeholder: tCommon("all"),
				allowClear: true,
				value: params.access_scope,
				options: [
					{ label: t("accessScopeApiPlatform"), value: "api_platform" },
					{ label: t("accessScopeMagic"), value: "magic" },
				],
				onChange: (value?: string) => {
					updateParams({ access_scope: value || undefined })
				},
			},
			{
				type: SearchItemType.TEXT,
				field: "magic_topic_id",
				addonBefore: t("magicTopicId"),
				placeholder: t("searchMagicTopicId"),
				allowClear: true,
				value: localInputs.magic_topic_id,
				onChange: (e) => handleInputChange("magic_topic_id", e.target.value),
			},
		]

		if (isOfficialOrg) {
			items.push({
				type: SearchItemType.TEXT,
				field: "organization_code",
				addonBefore: t("organizationCode"),
				placeholder: t("searchOrganizationCode"),
				allowClear: true,
				value: localInputs.organization_code,
				onChange: (e) => handleInputChange("organization_code", e.target.value),
			})
		}

		return items
	}, [handleInputChange, isOfficialOrg, localInputs, t, updateParams])

	const buttons: TableButton[] = useMemo(
		() => [
			{
				text: t("reset"),
				type: "default",
				onClick: handleReset,
			},
			{
				text: t("refresh"),
				type: "default",
				icon: <IconReload size={16} />,
				onClick: handleRefresh,
			},
		],
		[handleRefresh, handleReset, t],
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
			<Modal
				open={detailOpen}
				title={t("detailTitle")}
				onCancel={() => {
					setDetailOpen(false)
					setDetailRecord(null)
				}}
				footer={null}
				width={820}
				centered
				styles={{ body: { maxHeight: 600, overflowY: "auto" } }}
			>
				<Descriptions column={1} bordered size="small">
					<Descriptions.Item label={t("recordId")}>
						{detailRecord?.id || "-"}
					</Descriptions.Item>
					<Descriptions.Item label={t("userId")}>
						{detailRecord?.user_info?.user_id || detailRecord?.user_id || "-"}
					</Descriptions.Item>
					<Descriptions.Item label={t("userName")}>
						{detailRecord?.user_info?.user_name || "-"}
					</Descriptions.Item>
					<Descriptions.Item label={t("organizationCode")}>
						{detailRecord?.organization_code || "-"}
					</Descriptions.Item>
					<Descriptions.Item label={t("phone")}>
						{detailRecord?.user_info?.phone || "-"}
					</Descriptions.Item>
					<Descriptions.Item label={t("callType")}>
						{detailRecord?.type || "-"}
					</Descriptions.Item>
					<Descriptions.Item label={t("productCode")}>
						{detailRecord?.product_code || "-"}
					</Descriptions.Item>
					<Descriptions.Item label={t("accessScope")}>
						{formatAccessScope(detailRecord?.access_scope)}
					</Descriptions.Item>
					<Descriptions.Item label={t("magicTopicId")}>
						{detailRecord?.magic_topic_id || "-"}
					</Descriptions.Item>
					<Descriptions.Item label={t("points")}>
						{detailRecord?.points ?? "-"}
					</Descriptions.Item>
					<Descriptions.Item label={t("callStatus")}>
						{detailRecord?.status || "-"}
					</Descriptions.Item>
					<Descriptions.Item label={t("accessKey")}>
						{detailRecord?.ak || "-"}
					</Descriptions.Item>
					<Descriptions.Item label={t("operationTime")}>
						{formatTimestamp(detailRecord?.operation_time)}
					</Descriptions.Item>
					<Descriptions.Item label={t("latency")}>
						{detailRecord?.all_latency ?? 0} ms
					</Descriptions.Item>
					<Descriptions.Item label={t("usage")}>
						<pre className={styles.jsonBlock}>
							{formatJsonText(detailRecord?.usage ?? {})}
						</pre>
					</Descriptions.Item>
					<Descriptions.Item label={t("detailInfo")}>
						<pre className={styles.jsonBlock}>
							{formatJsonText(detailRecord?.detail_info)}
						</pre>
					</Descriptions.Item>
					<Descriptions.Item label={t("userInfoRaw")}>
						<pre className={styles.jsonBlock}>
							{formatJsonText(detailRecord?.user_info ?? {})}
						</pre>
					</Descriptions.Item>
				</Descriptions>
			</Modal>
			<TableWithFilters<ModelAudit.ModelAuditLogItem>
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
	)
}

export default ModelAuditLogPage
