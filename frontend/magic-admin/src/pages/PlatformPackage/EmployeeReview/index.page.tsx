import { useMemo, useRef, useState } from "react"
import { createStyles } from "antd-style"
import { debounce } from "lodash-es"
import type { SearchItem } from "components"
import { SearchItemType, StatusTag, TableWithFilters } from "components"
import { useMemoizedFn, useMount, useRequest } from "ahooks"
import { useTranslation } from "react-i18next"
import { Button, Flex, Modal, Select, message, type TableProps } from "antd"
import { usePagination } from "@/hooks/usePagination"
import { useApis } from "@/apis"
import { useAdmin } from "@/provider/AdminProvider"
import { useAdminStore } from "@/stores/admin"
import type { PlatformPackage } from "@/types/platformPackage"

type DataType = PlatformPackage.AgentVersionReview
type ParamsType = PlatformPackage.GetAgentVersionReviewListParams

const useStyles = createStyles(({ token }) => ({
	container: {
		backgroundColor: token.magicColorUsages.bg[0],
	},
	desc: {
		fontSize: 12,
		color: token.magicColorUsages.text[3],
	},
}))

function EmployeeReviewPage() {
	const OFFICIAL_ORG_CODE = "TGosRaFhvb"
	const { t } = useTranslation("admin/platform/employeeReview")
	const { t: tCommon } = useTranslation("admin/common")
	const { styles } = useStyles()
	const { PlatformPackageApi } = useApis()
	const { organization } = useAdmin()
	const { isOfficialOrg } = useAdminStore()
	const isOfficialOrganization =
		isOfficialOrg || organization?.organizationCode === OFFICIAL_ORG_CODE

	const [data, setData] = useState<DataType[]>([])
	const [total, setTotal] = useState(0)
	const [approveModalOpen, setApproveModalOpen] = useState(false)
	const [currentReviewRecord, setCurrentReviewRecord] = useState<DataType | null>(null)
	const [publisherType, setPublisherType] = useState<PlatformPackage.SkillPublisherType>()
	const [reviewingId, setReviewingId] = useState<string>("")
	const [reviewingAction, setReviewingAction] = useState<PlatformPackage.ReviewSkillAction>()
	const [params, setParams] = useState<ParamsType>({
		page: 1,
		page_size: 20,
		order_by: "desc",
	})

	const { run, loading } = useRequest(
		(arg: ParamsType) => PlatformPackageApi.getAgentVersionReviewList(arg),
		{
			manual: true,
			onSuccess: (res) => {
				setData(res.list)
				setTotal(res.total)
			},
		},
	)

	const { runAsync: reviewAgentVersion, loading: reviewLoading } = useRequest(
		(id: string, data: PlatformPackage.ReviewSkillVersionParams) =>
			PlatformPackageApi.reviewAgentVersion(id, data),
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

	const reviewStatusMap = useMemo(
		() => ({
			PENDING: { text: t("pending"), color: "warning" },
			UNDER_REVIEW: { text: t("under_review"), color: "processing" },
			APPROVED: { text: t("approved"), color: "success" },
			REJECTED: { text: t("rejected"), color: "error" },
		}),
		[t],
	)

	const publishStatusMap = useMemo(
		() => ({
			UNPUBLISHED: { text: t("unpublished"), color: "default" },
			PUBLISHING: { text: t("publishing"), color: "processing" },
			PUBLISHED: { text: t("published"), color: "success" },
			OFFLINE: { text: t("offline"), color: "error" },
		}),
		[t],
	)

	const publishTargetTypeMap = useMemo<Record<string, string>>(
		() => ({
			PRIVATE: t("private"),
			MEMBER: t("member"),
			ORGANIZATION: t("organization"),
			MARKET: t("market"),
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

	const getLocalizedRoles = useMemoizedFn((value?: PlatformPackage.RoleI18N) => {
		const roles = value?.zh_CN?.length ? value.zh_CN : value?.en_US
		if (!roles?.length) return "-"
		return roles.join(" / ")
	})

	const canReview = useMemoizedFn(
		(record: DataType) =>
			record.publish_status === "UNPUBLISHED" && record.review_status === "UNDER_REVIEW",
	)

	const refreshCurrentList = useMemoizedFn(() => {
		run(params)
	})

	const openApproveModal = useMemoizedFn((record: DataType) => {
		setCurrentReviewRecord(record)
		setPublisherType(isOfficialOrganization ? "OFFICIAL" : "USER")
		setApproveModalOpen(true)
	})

	const handleReject = useMemoizedFn(async (record: DataType) => {
		if (!canReview(record)) return
		setReviewingId(record.id)
		setReviewingAction("REJECTED")
		try {
			await reviewAgentVersion(record.id, { action: "REJECTED" })
			message.success(tCommon("message.actionSuccess"))
			refreshCurrentList()
		} finally {
			setReviewingId("")
			setReviewingAction(undefined)
		}
	})

	const handleApproveConfirm = useMemoizedFn(async () => {
		if (!currentReviewRecord) return
		if (!publisherType) {
			message.warning(t("selectPublisherType"))
			return
		}
		setReviewingId(currentReviewRecord.id)
		setReviewingAction("APPROVED")
		try {
			await reviewAgentVersion(currentReviewRecord.id, {
				action: "APPROVED",
				publisher_type: publisherType,
			})
			message.success(tCommon("message.actionSuccess"))
			setApproveModalOpen(false)
			setCurrentReviewRecord(null)
			setPublisherType(undefined)
			refreshCurrentList()
		} finally {
			setReviewingId("")
			setReviewingAction(undefined)
		}
	})

	const columns: TableProps<DataType>["columns"] = useMemo(
		() => [
			{
				title: t("employeeName"),
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
				title: t("role"),
				dataIndex: "role_i18n",
				key: "role_i18n",
				width: 220,
				render: (value: PlatformPackage.RoleI18N) => getLocalizedRoles(value),
			},
			{
				title: t("version"),
				dataIndex: "version",
				key: "version",
				width: 120,
				render: (value: string) => value || "-",
			},
			{
				title: t("publishStatus"),
				dataIndex: "publish_status",
				key: "publish_status",
				width: 120,
				render: (value: string) => renderStatus(value, publishStatusMap),
			},
			{
				title: t("reviewStatus"),
				dataIndex: "review_status",
				key: "review_status",
				width: 120,
				render: (value: string) => renderStatus(value, reviewStatusMap),
			},
			{
				title: t("publishTargetType"),
				dataIndex: "publish_target_type",
				key: "publish_target_type",
				width: 140,
				render: (value: string) => publishTargetTypeMap[value] || value || "-",
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
				title: t("publishedAt"),
				dataIndex: "published_at",
				key: "published_at",
				width: 180,
				render: (value: string) => value || "-",
			},
			{
				title: tCommon("operate"),
				key: "action",
				width: 180,
				fixed: "right",
				render: (_, record) => {
					const disabled = !canReview(record)
					const rowLoading = reviewLoading && reviewingId === record.id
					return (
						<Flex align="center" gap={8}>
							<Button
								type="link"
								disabled={disabled || rowLoading}
								loading={rowLoading && reviewingAction === "APPROVED"}
								onClick={() => openApproveModal(record)}
							>
								{t("approve")}
							</Button>
							<span>|</span>
							<Button
								type="link"
								danger
								disabled={disabled || rowLoading}
								loading={rowLoading && reviewingAction === "REJECTED"}
								onClick={() => handleReject(record)}
							>
								{t("reject")}
							</Button>
						</Flex>
					)
				},
			},
		],
		[
			t,
			tCommon,
			styles.desc,
			getLocalizedText,
			getLocalizedRoles,
			renderStatus,
			publishStatusMap,
			reviewStatusMap,
			publishTargetTypeMap,
			canReview,
			openApproveModal,
			handleReject,
			reviewLoading,
			reviewingId,
			reviewingAction,
		],
	)

	const searchItems: SearchItem[] = useMemo(
		() => [
			{
				type: SearchItemType.TEXT,
				field: "name_i18n",
				addonBefore: t("employeeName"),
				allowClear: true,
				onChange: (e) => debouncedSearch({ name_i18n: e.target.value.trim() || undefined }),
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
				type: SearchItemType.TEXT,
				field: "version",
				addonBefore: t("version"),
				allowClear: true,
				onChange: (e) => debouncedSearch({ version: e.target.value.trim() || undefined }),
			},
			{
				type: SearchItemType.SELECT,
				field: "review_status",
				prefix: t("reviewStatus"),
				placeholder: tCommon("all"),
				options: [
					{ label: tCommon("all"), value: "all" },
					{ label: t("pending"), value: "PENDING" },
					{ label: t("under_review"), value: "UNDER_REVIEW" },
					{ label: t("approved"), value: "APPROVED" },
					{ label: t("rejected"), value: "REJECTED" },
				],
				defaultValue: "all",
				onChange: (value) => {
					updateParams({ review_status: value === "all" ? undefined : value })
				},
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
				field: "publish_target_type",
				prefix: t("publishTargetType"),
				placeholder: tCommon("all"),
				options: [
					{ label: tCommon("all"), value: "all" },
					{ label: t("private"), value: "PRIVATE" },
					{ label: t("member"), value: "MEMBER" },
					{ label: t("organization"), value: "ORGANIZATION" },
					{ label: t("market"), value: "MARKET" },
				],
				defaultValue: "all",
				onChange: (value) => {
					updateParams({ publish_target_type: value === "all" ? undefined : value })
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
			<Modal
				title={t("approveModalTitle")}
				open={approveModalOpen}
				onCancel={() => {
					setApproveModalOpen(false)
					setCurrentReviewRecord(null)
					setPublisherType(undefined)
				}}
				onOk={handleApproveConfirm}
				confirmLoading={reviewLoading && reviewingAction === "APPROVED"}
				okText={tCommon("button.confirm")}
				cancelText={tCommon("button.cancel")}
			>
				<Flex vertical gap={8}>
					<div>{t("publisherType")}</div>
					<Select
						value={publisherType}
						placeholder={tCommon("pleaseSelectPlaceholder", {
							name: t("publisherType"),
						})}
						options={[
							{ label: t("publisherTypeUser"), value: "USER" },
							{ label: t("publisherTypeOfficial"), value: "OFFICIAL" },
						]}
						onChange={(value: PlatformPackage.SkillPublisherType) =>
							setPublisherType(value)
						}
					/>
				</Flex>
			</Modal>
		</div>
	)
}

export default EmployeeReviewPage
