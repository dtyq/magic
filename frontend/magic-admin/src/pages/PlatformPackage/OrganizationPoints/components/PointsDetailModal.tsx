import type { MagicModalProps } from "components"
import { MagicModal, MagicTable } from "components"
import { useTranslation } from "react-i18next"
import { useMemo, useState } from "react"
import { isEmpty } from "lodash-es"
import { useMount, useRequest } from "ahooks"
import type { TablePaginationConfig } from "antd/lib"
import { useApis } from "@/apis"
import type { PageParams } from "@/types/common"
import type { PlatformPackage } from "@/types/platformPackage"
import type { OpenableProps } from "@/hooks/useOpenModal"
import { usePagination } from "@/hooks/usePagination"

interface PointsDetailModalProps extends OpenableProps<MagicModalProps> {
	selectedOrganization: PlatformPackage.OrgPointsList | null
}

const PointsDetailModal = ({ selectedOrganization, onClose, ...props }: PointsDetailModalProps) => {
	const { t } = useTranslation("admin/platform/points")

	const { PlatformPackageApi } = useApis()
	const [open, setOpen] = useState(true)

	const [params, setParams] = useState<PageParams>({
		page: 1,
		page_size: 10,
	})

	const {
		run: fetchDetailData,
		loading,
		data: detailData,
	} = useRequest(PlatformPackageApi.getOrgPointsDetail, {
		manual: true,
	})

	useMount(() => {
		if (selectedOrganization) {
			fetchDetailData({
				organization_code: selectedOrganization.organization_code,
				...params,
			})
		}
	})

	// 处理积分明细表格变化
	const handleDetailTableChange = (paginationInfo: TablePaginationConfig) => {
		const { current, pageSize } = paginationInfo
		if (selectedOrganization) {
			fetchDetailData({
				organization_code: selectedOrganization.organization_code,
				page: current ?? 1,
				page_size: pageSize ?? 10,
			})
			setParams({
				page: current ?? 1,
				page_size: pageSize ?? 10,
			})
		}
	}

	// 积分明细表格列定义
	const detailColumns = useMemo(
		() => [
			{
				title: t("organizationPointsPage.detailModal.columns.operationTime"),
				dataIndex: "created_at",
				key: "created_at",
				width: 150,
				render: (text: string) => (isEmpty(text) ? "-" : text),
			},
			{
				title: t("organizationPointsPage.detailModal.columns.pointsChange"),
				dataIndex: "amount",
				key: "amount",
				width: 120,
				render: (value: number) => {
					if (value === undefined || value === null) return "-"
					const color = value > 0 ? "#52c41a" : "#ff4d4f"
					const prefix = value > 0 ? "+" : ""
					return (
						<span style={{ color, fontWeight: "bold" }}>
							{prefix}
							{value.toLocaleString()}
						</span>
					)
				},
			},

			{
				title: t("organizationPointsPage.detailModal.columns.topicId"),
				dataIndex: "topic_id",
				key: "topic_id",
				width: 150,
				render: (text: string | null) => text || "-",
			},
			{
				title: t("organizationPointsPage.detailModal.columns.operationDescription"),
				dataIndex: "i18n_description",
				key: "i18n_description",
				width: 200,
				render: (i18nDesc: { en_US: string; zh_CN: string }) => {
					if (!i18nDesc) return "-"
					// 优先显示中文描述，如果没有则显示英文
					return i18nDesc.zh_CN || i18nDesc.en_US || "-"
				},
			},
			{
				title: t("organizationPointsPage.detailModal.columns.userId"),
				dataIndex: "user_id",
				key: "user_id",
				width: 120,
				render: (text: string | null) => text || "-",
			},
			// {
			// 	title: "业务参数",
			// 	dataIndex: "business_param",
			// 	key: "business_param",
			// 	width: 120,
			// 	render: (text: string) => (isEmpty(text) ? "-" : text),
			// },
		],
		[t],
	)

	const onCancel = () => {
		setOpen(false)
		onClose?.()
	}

	const { paginationConfig } = usePagination({
		params,
		data: detailData?.list || [],
		total: detailData?.total || 0,
	})

	return (
		<MagicModal
			centered
			title={t("organizationPointsPage.detailModal.title")}
			footer={null}
			width={800}
			open={open}
			onCancel={onCancel}
			{...props}
		>
			{selectedOrganization && (
				<div style={{ marginBottom: 16 }}>
					<p>
						<strong>
							{t("organizationPointsPage.detailModal.organizationNameLabel")}
						</strong>
						{selectedOrganization.organization_name}
					</p>
					<p>
						<strong>
							{t("organizationPointsPage.detailModal.organizationCodeLabel")}
						</strong>
						{selectedOrganization.organization_code}
					</p>
					<p>
						<strong>
							{t("organizationPointsPage.detailModal.currentBalanceLabel")}
						</strong>
						{selectedOrganization.balance.toLocaleString()}
					</p>
				</div>
			)}

			<MagicTable
				columns={detailColumns}
				dataSource={detailData?.list}
				rowKey="id"
				loading={loading}
				// pagination={{
				// 	current: params.page,
				// 	pageSize: params.page_size,
				// 	total: detailData?.total,
				// 	position: ["bottomRight"],
				// 	showSizeChanger: true,
				// 	showTotal: (total) =>
				// 		t("organizationPointsPage.detailModal.pagination.total", { total }),
				// 	pageSizeOptions: ["10", "20", "50"],
				// }}
				pagination={paginationConfig}
				bordered
				size="small"
				onChange={handleDetailTableChange}
				scroll={{ x: 900 }}
			/>
		</MagicModal>
	)
}

export default PointsDetailModal
