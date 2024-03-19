import { useState, useMemo, useRef } from "react"
import { Button, Space, message, Flex } from "antd"
import type { TableColumnsType } from "antd"
import { createStyles } from "antd-style"
import { useMemoizedFn, useMount } from "ahooks"
import type { SearchItem, TableButton } from "components"
import { SearchItemType, TableWithFilters, StatusTag, MobileList } from "components"
import { useTranslation } from "react-i18next"
import { debounce } from "lodash-es"
import { IconReload } from "@tabler/icons-react"
import { useApis } from "@/apis"
import type { AiAuditRequest, AiAuditStatus, UsageData } from "@/types/aiAudit"
import { usePagination } from "@/hooks/usePagination"
import { PERMISSION_KEY_MAP } from "@/const/common"
import useRights from "@/hooks/useRights"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useOpenModal } from "@/hooks/useOpenModal"
import { StatusOptions, RiskOptions, STATUS_MAP } from "./constant"
import ViewRiskReasonModal from "./components/ViewRiskReasonModal"
import RiskMarkModal from "./components/RiskMarkModal"
import AuditCard from "./components/AuditCard"

const useStyles = createStyles(({ token }) => ({
	container: {
		backgroundColor: token.magicColorUsages.bg[0],
		height: "100%",
	},
	desc: {
		fontSize: 12,
		color: token.magicColorUsages.text[3],
	},
}))

export default function AIAuditPage() {
	const { t } = useTranslation("admin/platform/audit")
	const { t: tCommon } = useTranslation("admin/common")
	const { styles } = useStyles()
	const openModal = useOpenModal()

	const { AiAuditApi } = useApis()
	const isMobile = useIsMobile()

	const [data, setData] = useState<UsageData[]>([])
	const [loading, setLoading] = useState(false)

	// 搜索和筛选状态
	const [total, setTotal] = useState(0)
	const [params, setParams] = useState<AiAuditRequest>({
		page: 1,
		page_size: 20,
	})

	// 本地输入状态（立即响应）
	const [localInputs, setLocalInputs] = useState({
		user_name: "",
		topic_name: "",
		topic_id: "",
		organization_code: "",
	})

	// 查看详情权限
	const hasCheckDetailRight = useRights(PERMISSION_KEY_MAP.AIAUDIT_DETAIL)
	// 标记风险权限
	const hasMarkRiskRight = useRights(PERMISSION_KEY_MAP.AIAUDIT_MARK_RISK)

	// 获取数据
	const fetchData = useMemoizedFn(async (p: AiAuditRequest) => {
		setLoading(true)
		try {
			const response = await AiAuditApi.getAiAuditList(p)

			const response_data = response
			const { list, total: totalResponse } = response_data
			if (Array.isArray(list)) {
				const formattedData: UsageData[] = list.map((item: AiAuditRequest) => {
					const typedItem = item
					return {
						key:
							(typedItem?.topic_id as string) ||
							(typedItem?.id as string) ||
							Math.random().toString(36),
						user_name: (typedItem?.user_name as string) || "",
						user_id: (typedItem?.user_id as string) || "",
						user_phone: (typedItem?.user_phone as string) || "",
						organization_code: (typedItem?.organization_code as string) || "",
						organization_name: (typedItem?.organization_name as string) || "",
						topic_name: (typedItem?.topic_name as string) || "",
						topic_id: (typedItem?.topic_id as string) || "",
						topic_status: (typedItem?.topic_status as AiAuditStatus) || "",
						create_time: (typedItem?.create_time as string) || "",
						last_update_time: (typedItem?.last_update_time as string) || "",
						sandbox_id: (typedItem?.sandbox_id as string) || "",
						project_id: (typedItem?.project_id as string) || "",
						task_rounds: (typedItem?.task_rounds as number) || 0,
						last_task_start_time: (typedItem?.last_task_start_time as string) || "",
						last_message_send_timestamp:
							(typedItem?.last_message_send_timestamp as string) || "",
						last_message_content: (typedItem?.last_message_content as string) || "",
						limit_times: (typedItem?.limit_times as number) || 0,
						cost: (typedItem?.cost as number) || 0,
						risk_info: (typedItem?.risk_info as { has_risk: boolean }) || {
							has_risk: false,
						},
						...typedItem,
					}
				})
				setData(formattedData)
				setTotal(totalResponse || 0)
			}
		} catch (error) {
			console.error("Error fetching usage data:", error)
			message.error(t("getListError"))
			setData([])
		} finally {
			setLoading(false)
		}
	})

	useMount(() => {
		fetchData(params)
	})

	const updateParams = useMemoizedFn((newParams: Partial<AiAuditRequest>) => {
		const p = {
			...params,
			...newParams,
			page: 1,
		}
		setParams(p)
		fetchData(p)
	})

	const debouncedSearch = useRef(
		debounce((value: Partial<typeof localInputs>) => {
			updateParams(value)
		}, 500),
	).current

	// 处理输入变化（立即更新本地状态，防抖提交搜索）
	const handleInputChange = useMemoizedFn((field: keyof typeof localInputs, value: string) => {
		setLocalInputs((prev) => ({ ...prev, [field]: value }))
		debouncedSearch({ [field]: value })
	})

	// 重置搜索
	const handleReset = useMemoizedFn(() => {
		setLocalInputs({
			user_name: "",
			topic_name: "",
			topic_id: "",
			organization_code: "",
		})
		updateParams({
			topic_name: undefined,
			user_name: undefined,
			topic_id: undefined,
			organization_code: undefined,
			topic_status: undefined,
			has_risk: undefined,
		})
	})

	// 刷新数据
	const handleRefresh = useMemoizedFn(() => {
		fetchData(params)
	})

	// 标记为风险内容 - 打开 Modal
	const handleMarkAsRisk = useMemoizedFn((record: UsageData) => {
		openModal(RiskMarkModal, {
			info: record,
			onFetchData: () => fetchData(params),
		})
	})

	// 查看风险原因
	const handleViewRiskReason = useMemoizedFn((record: UsageData) => {
		openModal(ViewRiskReasonModal, {
			info: record,
			onFetchData: () => fetchData(params),
		})
	})

	const getButtons = useMemoizedFn((record: UsageData) => {
		const hasRisk = record.risk_info?.has_risk
		return (
			<Space size="small" wrap>
				<Button
					type="link"
					href={`/magic-share/${record.project_id}/${record.topic_id}`}
					target="_blank"
					size="small"
					disabled={!hasCheckDetailRight}
				>
					{t("reviewContent")}
				</Button>
				{!hasRisk ? (
					<Button
						type="link"
						size="small"
						danger
						onClick={() => handleMarkAsRisk(record)}
						disabled={!hasMarkRiskRight}
					>
						{t("markAsRisk")}
					</Button>
				) : (
					<Button
						type="link"
						size="small"
						onClick={() => handleViewRiskReason(record)}
						disabled={!hasMarkRiskRight || !hasCheckDetailRight}
					>
						{t("viewRiskReason")}
					</Button>
				)}
			</Space>
		)
	})

	// 表格列配置
	const columns: TableColumnsType<UsageData> = useMemo(
		() => [
			{
				title: t("topicName"),
				dataIndex: "topic_id",
				key: "topic_id",
				width: 200,
				ellipsis: true,
				fixed: "left" as const,
				render: (text: string, { topic_name }: UsageData) => {
					return (
						<Flex vertical gap={2}>
							<span>{topic_name || "-"}</span>
							<span className={styles.desc}>ID:{text || "-"}</span>
						</Flex>
					)
				},
			},
			{
				title: t("userName"),
				dataIndex: "user_id",
				key: "user_id",
				width: 100,
				render: (text: string, { user_name, user_phone }: UsageData) => (
					<Flex vertical gap={4}>
						<span>{user_name || "-"}</span>
						<span className={styles.desc}>ID:{text || "-"}</span>
						<span className={styles.desc}>
							{t("phone")}:{user_phone || "-"}
						</span>
					</Flex>
				),
			},
			{
				title: t("organization"),
				dataIndex: "organization_code",
				key: "organization_code",
				width: 120,
				ellipsis: true,
				render: (text: string, { organization_name }: UsageData) => (
					<Flex vertical gap={2}>
						<span>{organization_name || "-"}</span>
						<span className={styles.desc}>ID:{text || "-"}</span>
					</Flex>
				),
			},
			{
				title: t("taskRounds"),
				dataIndex: "task_rounds",
				key: "task_rounds",
				width: 90,
				align: "center" as const,
				render: (value: number) => value || 0,
			},
			{
				title: t("cost"),
				dataIndex: "cost",
				key: "cost",
				width: 80,
				align: "right" as const,
				render: (value: number) => {
					if (value === 0 || value === null || value === undefined) return "0.00"
					return `${value.toFixed(2)}`
				},
			},
			{
				title: t("createTime"),
				dataIndex: "create_time",
				key: "create_time",
				width: 160,
				render: (text: string) => {
					if (!text) return "-"
					return text.replace("T", " ").split(".")[0]
				},
			},
			{
				title: tCommon("status"),
				dataIndex: "topic_status",
				key: "topic_status",
				width: 100,
				render: (status: AiAuditStatus) => (
					<StatusTag color={STATUS_MAP[status].color} bordered={false}>
						{STATUS_MAP[status].text}
					</StatusTag>
				),
			},
			{
				title: t("lastTime"),
				dataIndex: "last_update_time",
				key: "last_update_time",
				width: 160,
				render: (text: string) => {
					if (!text) return "-"
					return text.replace("T", " ").split(".")[0]
				},
			},

			{
				title: tCommon("operate"),
				fixed: "right" as const,
				key: "actions",
				width: 210,
				render: (_, record) => getButtons(record),
			},
		],
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[getButtons, t, tCommon],
	)

	const searchItems: SearchItem[] = useMemo(
		() => [
			{
				type: SearchItemType.TEXT,
				field: "user_name",
				addonBefore: t("userName"),
				placeholder: t("searchUserName"),
				allowClear: true,
				value: localInputs.user_name,
				onChange: (e) => handleInputChange("user_name", e.target.value),
			},
			{
				type: SearchItemType.TEXT,
				field: "topicName",
				addonBefore: t("topicName"),
				placeholder: t("searchTopicName"),
				allowClear: true,
				value: localInputs.topic_name,
				onChange: (e) => handleInputChange("topic_name", e.target.value),
			},
			{
				type: SearchItemType.TEXT,
				field: "topicId",
				addonBefore: t("topicId"),
				placeholder: t("searchTopicId"),
				allowClear: true,
				value: localInputs.topic_id,
				onChange: (e) => handleInputChange("topic_id", e.target.value),
			},
			{
				type: SearchItemType.TEXT,
				field: "organization",
				addonBefore: t("organization"),
				placeholder: t("searchOrganizationCode"),
				allowClear: true,
				value: localInputs.organization_code,
				onChange: (e) => handleInputChange("organization_code", e.target.value),
			},
			{
				type: SearchItemType.SELECT,
				field: "status",
				prefix: tCommon("status"),
				placeholder: tCommon("all"),
				allowClear: true,
				options: StatusOptions,
				value: params.topic_status,
				onChange: (value: string) => {
					if (value.includes("all")) {
						updateParams({ topic_status: undefined })
					} else {
						updateParams({ topic_status: value as AiAuditStatus })
					}
				},
			},
			{
				type: SearchItemType.SELECT,
				field: "risk",
				prefix: t("risk"),
				allowClear: true,
				placeholder: t("riskFilter"),
				options: RiskOptions,
				value: params.has_risk,
				onChange: (value: number) => updateParams({ has_risk: value }),
			},
		],
		[localInputs, handleInputChange, params, t, tCommon, updateParams],
	)

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
		fetchData,
		data,
		total,
	})

	return isMobile ? (
		<MobileList<AiAuditRequest, UsageData>
			data={data}
			loading={loading}
			total={total}
			currentFilters={params}
			search={searchItems}
			CardComponent={<AuditCard getButtons={getButtons} />}
			paginationConfig={paginationConfig}
			handleReset={handleReset}
			showDetail={false}
		/>
	) : (
		<div className={styles.container}>
			<TableWithFilters<UsageData>
				search={searchItems}
				buttons={buttons}
				columns={columns}
				dataSource={data}
				rowKey="id"
				extraHeight={110}
				loading={loading}
				pagination={paginationConfig}
			/>
		</div>
	)
}
