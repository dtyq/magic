import { useMemo, useRef, useState } from "react"
import { createStyles } from "antd-style"
import { debounce } from "lodash-es"
import { IconReload } from "@tabler/icons-react"
import type { SearchItem, TableButton } from "@admin-components"
import {
	HistoryMode,
	SearchItemType,
	StatusTag,
	TableWithFilters,
	TimeFilterTab,
	type TimeRangeValue,
} from "@admin-components"
import { useMemoizedFn, useMount, useRequest } from "ahooks"
import { useTranslation } from "react-i18next"
import { Button, Flex, Input, Modal, Tooltip, message, type TableProps } from "antd"
import { usePagination } from "@admin/hooks/usePagination"
import { useApis } from "@admin/apis"
import type { AiManage } from "@admin/types/aiManage"
import type { PlatformPackage } from "@admin/types/platformPackage"
import useRights from "@admin/hooks/useRights"
import { PERMISSION_KEY_MAP } from "@admin/const/common"

type DataType = AiManage.OrganizationSkillVersionReview
type ParamsType = AiManage.GetOrganizationSkillVersionReviewListParams

const useStyles = createStyles(({ token }) => ({
	container: {
		backgroundColor: token.magicColorUsages.bg[0],
	},
	desc: {
		fontSize: 12,
		color: token.magicColorUsages.text[3],
	},
}))

function AISkillReviewPage() {
	const { t } = useTranslation("admin/platform/skill")
	const { t: tCommon } = useTranslation("admin/common")
	const { styles } = useStyles()
	const { AIManageApi } = useApis()
	const hasEditRight = useRights(PERMISSION_KEY_MAP.SKILL_REVIEW_EDIT)

	const [data, setData] = useState<DataType[]>([])
	const [total, setTotal] = useState(0)
	const [rejectModalOpen, setRejectModalOpen] = useState(false)
	const [currentRejectRecord, setCurrentRejectRecord] = useState<DataType | null>(null)
	const [rejectReason, setRejectReason] = useState("")
	const [reviewingId, setReviewingId] = useState<string>("")
	const [reviewingAction, setReviewingAction] = useState<AiManage.ReviewAction>()
	const [searchFormKey, setSearchFormKey] = useState(0)
	const [lastTimeFilterValue, setLastTimeFilterValue] = useState<TimeRangeValue | null>(null)
	const [params, setParams] = useState<ParamsType>({
		page: 1,
		page_size: 20,
		order_by: "desc",
	})

	const { run, loading } = useRequest(
		(arg: ParamsType) => AIManageApi.getOrganizationSkillVersionReviewList(arg),
		{
			manual: true,
			onSuccess: (res) => {
				setData(res.list)
				setTotal(res.total)
			},
		},
	)

	const { runAsync: reviewSkillVersion, loading: reviewLoading } = useRequest(
		(id: string, data: AiManage.ReviewOrganizationVersionParams) =>
			AIManageApi.reviewOrganizationSkillVersion(id, data),
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
			UNDER_REVIEW: { text: t("under_review"), color: "processing" },
			APPROVED: { text: t("approved"), color: "success" },
			REJECTED: { text: t("rejected"), color: "error" },
		}),
		[t],
	)
	const publishStatusMap = useMemo(
		() => ({
			UNPUBLISHED: { text: t("unpublished"), color: "default" },
			PUBLISHED: { text: t("published"), color: "success" },
		}),
		[t],
	)

	const publishTargetTypeMap = useMemo<Record<string, string>>(
		() => ({
			MEMBER: t("member"),
			ORGANIZATION: t("organization"),
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

	const getLocalizedText = useMemoizedFn(
		(value?: PlatformPackage.NameI18N) => value?.zh_CN || value?.en_US || value?.default || "-",
	)

	const renderDescriptionText = useMemoizedFn((value: PlatformPackage.NameI18N) => {
		const text = getLocalizedText(value)
		if (text === "-") return text

		return (
			<Tooltip title={text}>
				<div
					style={{
						maxHeight: 88,
						lineHeight: "22px",
						overflow: "hidden",
						textOverflow: "ellipsis",
						display: "-webkit-box",
						WebkitLineClamp: 4,
						WebkitBoxOrient: "vertical",
						whiteSpace: "normal",
					}}
				>
					{text}
				</div>
			</Tooltip>
		)
	})

	const canReview = useMemoizedFn(
		(record: DataType) =>
			hasEditRight &&
			record.publish_status === "UNPUBLISHED" &&
			record.review_status === "UNDER_REVIEW",
	)

	const refreshCurrentList = useMemoizedFn(() => {
		run(params)
	})

	const handleReset = useMemoizedFn(() => {
		setSearchFormKey((prev) => prev + 1)
		setLastTimeFilterValue(null)
		updateParams({
			package_name: undefined,
			skill_name: undefined,
			review_status: undefined,
			publish_status: undefined,
			publish_target_type: undefined,
			source_type: undefined,
			version: undefined,
			order_by: "desc",
			start_time: undefined,
			end_time: undefined,
		})
	})

	const handleRefresh = useMemoizedFn(() => {
		refreshCurrentList()
	})

	const openRejectModal = useMemoizedFn((record: DataType) => {
		if (!canReview(record)) return
		setCurrentRejectRecord(record)
		setRejectReason("")
		setRejectModalOpen(true)
	})

	const closeRejectModal = useMemoizedFn(() => {
		setRejectModalOpen(false)
		setCurrentRejectRecord(null)
		setRejectReason("")
	})

	const handleRejectConfirm = useMemoizedFn(async () => {
		if (!currentRejectRecord) return
		const reason = rejectReason.trim()
		setReviewingId(currentRejectRecord.id)
		setReviewingAction("REJECTED")
		try {
			await reviewSkillVersion(currentRejectRecord.id, {
				action: "REJECTED",
				review_remark: reason || null,
			})
			message.success(tCommon("message.actionSuccess"))
			closeRejectModal()
			refreshCurrentList()
		} finally {
			setReviewingId("")
			setReviewingAction(undefined)
		}
	})

	const handleApprove = useMemoizedFn(async (record: DataType) => {
		if (!canReview(record)) return
		setReviewingId(record.id)
		setReviewingAction("APPROVED")
		try {
			await reviewSkillVersion(record.id, {
				action: "APPROVED",
			})
			message.success(tCommon("message.actionSuccess"))
			refreshCurrentList()
		} finally {
			setReviewingId("")
			setReviewingAction(undefined)
		}
	})

	const columns: TableProps<DataType>["columns"] = useMemo(
		() => [
			{
				title: t("skillName"),
				dataIndex: "name_i18n",
				key: "name_i18n",
				width: 200,
				render: (value: PlatformPackage.NameI18N) => getLocalizedText(value),
			},
			{
				title: t("packageName"),
				dataIndex: "package_name",
				key: "package_name",
				width: 200,
				render: (value?: string) => value || "-",
			},
			{
				title: t("organization"),
				dataIndex: "organization",
				key: "organization",
				width: 220,
				render: (value: DataType["organization"]) => (
					<Flex vertical gap={4}>
						<span>{value?.name || "-"}</span>
						<span className={styles.desc}>{value?.code || "-"}</span>
					</Flex>
				),
			},
			{
				title: t("description"),
				dataIndex: "description_i18n",
				key: "description_i18n",
				width: 260,
				render: (value: PlatformPackage.NameI18N) => renderDescriptionText(value),
			},
			{
				title: t("version"),
				dataIndex: "version",
				key: "version",
				width: 120,
				render: (value: string) => {
					if (!value) return "-"
					return (
						<Tooltip title={value}>
							<div
								style={{
									maxWidth: 88,
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
								}}
							>
								{value}
							</div>
						</Tooltip>
					)
				},
			},
			{
				title: t("publishStatus"),
				dataIndex: "publish_status",
				key: "publish_status",
				width: 120,
				render: (value: string) => renderStatus(value, publishStatusMap),
			},
			{
				title: t("publishTargetType"),
				dataIndex: "publish_target_type",
				key: "publish_target_type",
				width: 140,
				render: (value: string) => publishTargetTypeMap[value] || value || "-",
			},
			{
				title: t("reviewStatus"),
				dataIndex: "review_status",
				key: "review_status",
				width: 120,
				render: (value: string) => renderStatus(value, reviewStatusMap),
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
								onClick={() => handleApprove(record)}
							>
								{t("approve")}
							</Button>
							<span>|</span>
							<Button
								type="link"
								danger
								disabled={disabled || rowLoading}
								loading={rowLoading && reviewingAction === "REJECTED"}
								onClick={() => openRejectModal(record)}
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
			reviewStatusMap,
			publishStatusMap,
			renderStatus,
			getLocalizedText,
			renderDescriptionText,
			styles.desc,
			publishTargetTypeMap,
			canReview,
			handleApprove,
			openRejectModal,
			reviewLoading,
			reviewingId,
			reviewingAction,
		],
	)

	const timeFilterValue = useMemo((): TimeRangeValue | null => {
		return lastTimeFilterValue
			? lastTimeFilterValue
			: params.start_time && params.end_time
				? {
						startDate: params.start_time,
						endDate: params.end_time,
						label: `${params.start_time} ~ ${params.end_time}`,
						tab: TimeFilterTab.relative,
						mode: HistoryMode.relative,
					}
				: null
	}, [lastTimeFilterValue, params.end_time, params.start_time])

	const searchItems: SearchItem[] = useMemo(
		() => [
			{
				type: SearchItemType.TEXT,
				field: "skill_name",
				addonBefore: t("skillName"),
				allowClear: true,
				onChange: (e) =>
					debouncedSearch({ skill_name: e.target.value.trim() || undefined }),
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
					{ label: t("published"), value: "PUBLISHED" },
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
					{ label: t("member"), value: "MEMBER" },
					{ label: t("organization"), value: "ORGANIZATION" },
				],
				defaultValue: "all",
				onChange: (value) => {
					updateParams({ publish_target_type: value === "all" ? undefined : value })
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
		[t, tCommon, timeFilterValue, updateParams, debouncedSearch],
	)

	const buttons: TableButton[] = useMemo(
		() => [
			{
				text: tCommon("button.reset"),
				type: "default",
				onClick: handleReset,
			},
			{
				text: tCommon("button.reload"),
				type: "default",
				icon: <IconReload size={16} />,
				onClick: handleRefresh,
			},
		],
		[handleRefresh, handleReset, tCommon],
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
				key={searchFormKey}
				search={searchItems}
				buttons={buttons}
				columns={columns}
				dataSource={data}
				rowKey="id"
				extraHeight={116}
				loading={loading}
				pagination={paginationConfig}
			/>
			<Modal
				title={t("rejectModalTitle")}
				open={rejectModalOpen}
				onCancel={closeRejectModal}
				onOk={handleRejectConfirm}
				confirmLoading={reviewLoading && reviewingAction === "REJECTED"}
				okText={tCommon("button.confirm")}
				cancelText={tCommon("button.cancel")}
			>
				<Flex vertical gap={8}>
					<div>{t("rejectReason")}</div>
					<Input.TextArea
						value={rejectReason}
						placeholder={t("rejectReasonPlaceholder")}
						maxLength={1000}
						showCount
						rows={4}
						onChange={(event) => setRejectReason(event.target.value)}
					/>
				</Flex>
			</Modal>
		</div>
	)
}

export default AISkillReviewPage
