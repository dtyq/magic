import type { TableColumnType } from "antd"
import { Flex } from "antd"
import { useState, useRef, useMemo } from "react"
import { isEmpty, debounce } from "lodash-es"
import { useTranslation } from "react-i18next"
import type { SearchItem } from "components"
import { SearchItemType, TableWithFilters, MobileList, MagicButton, StatusTag } from "components"
import { useMemoizedFn, useMount, useRequest } from "ahooks"
import { useApis } from "@/apis"
import { useIsMobile } from "@/hooks/useIsMobile"
import useRights from "@/hooks/useRights"
import { PERMISSION_KEY_MAP } from "@/const/common"
import { usePagination } from "@/hooks/usePagination"
import { PlatformPackage } from "@/types/platformPackage"
import type { WithPage } from "@/types/common"
import { useOpenModal } from "@/hooks/useOpenModal"
import useStyles from "./styles"
import PointsCard from "./components/PointsCard"
import PointsDetailModal from "./components/PointsDetailModal"
import AddPointsModal from "./components/AddPointsModal"
import BindPackageModal from "./components/BindPackageModal"

type DataType = PlatformPackage.OrgPointsList
export default function OrganizationPoints() {
	const { t } = useTranslation("admin/platform/points")
	const { styles } = useStyles()

	const { PlatformPackageApi } = useApis()
	const openModal = useOpenModal()

	const isMobile = useIsMobile()

	const [data, setData] = useState<WithPage<DataType>>({ list: [], total: 0 })
	const [params, setParams] = useState<PlatformPackage.GetOrgPointsListParams>({
		page: 1,
		page_size: 10,
	})

	const hasAddPointsRight = useRights(PERMISSION_KEY_MAP.ORIENTATION_POINTS_ADD_POINTS)
	const hasCheckDetailRight = useRights(PERMISSION_KEY_MAP.ORIENTATION_POINTS_DETAIL)

	const { run: fetchData, loading } = useRequest(PlatformPackageApi.getOrgPointsList, {
		manual: true,
		onSuccess: (res) => {
			setData(res)
		},
	})

	// 初始化数据获取
	useMount(() => {
		fetchData(params)
	})

	const updateParams = useMemoizedFn(
		(newParams: Partial<PlatformPackage.GetOrgPointsListParams>) => {
			const p = {
				...params,
				...newParams,
				page: 1,
			}
			setParams(p)
			fetchData(p)
		},
	)

	const debouncedSearch = useRef(
		debounce((value: Partial<PlatformPackage.GetOrgPointsListParams>) => {
			updateParams(value)
		}, 500),
	).current

	const handleAddPoints = (record: DataType) => {
		openModal(AddPointsModal, {
			selectedOrganization: record,
			afterClose: () => {
				fetchData(params)
			},
		})
	}

	const handleCheckPointsDetail = (record: DataType) => {
		openModal(PointsDetailModal, {
			selectedOrganization: record,
		})
	}

	const handleBindPackage = (record: DataType) => {
		openModal(BindPackageModal, {
			selectedOrganization: record,
			afterClose: () => {
				fetchData(params)
			},
		})
	}

	const getButtons = useMemoizedFn((record: DataType) => (
		<>
			<MagicButton
				type="link"
				size="small"
				onClick={(e) => {
					e.stopPropagation()
					handleAddPoints(record)
				}}
				disabled={!hasAddPointsRight}
			>
				{t("organizationPointsPage.actions.operationPoints")}
			</MagicButton>
			<MagicButton
				type="link"
				size="small"
				onClick={(e) => {
					e.stopPropagation()
					handleCheckPointsDetail(record)
				}}
				disabled={!hasCheckDetailRight}
			>
				{t("organizationPointsPage.actions.viewPointsDetail")}
			</MagicButton>
			<MagicButton
				type="link"
				size="small"
				onClick={(e) => {
					e.stopPropagation()
					handleBindPackage(record)
				}}
			>
				{t("organizationPointsPage.actions.bindPackage")}
			</MagicButton>
		</>
	))

	const columns: TableColumnType<DataType>[] = [
		{
			title: t("organizationPointsPage.columns.organizationName"),
			dataIndex: "organization_code",
			key: "organization_code",
			width: "15%",
			render: (text: string, { organization_name, type }) => (
				<Flex vertical gap={6}>
					<span>{organization_name || "-"}</span>
					<span className={styles.desc}>
						{t("organizationPointsPage.columns.organizationCode")}:{text || "-"}
					</span>
					<StatusTag
						color={
							type === PlatformPackage.OrganizationType.Enterprise
								? "processing"
								: "success"
						}
						className={styles.typeTag}
					>
						{type === PlatformPackage.OrganizationType.Enterprise
							? t("organizationPointsPage.columns.enterpriseVersion")
							: t("organizationPointsPage.columns.personalVersion")}
					</StatusTag>
				</Flex>
			),
		},
		{
			title: t("organizationPointsPage.columns.creator"),
			dataIndex: "creator_name",
			key: "creator_name",
			width: "15%",
			render: (text: string, { creator_phone }) => (
				<Flex vertical gap={4}>
					<span>{text || "-"}</span>
					<span className={styles.desc}>
						{t("organizationPointsPage.columns.creatorPhone")}:{creator_phone || "-"}
					</span>
				</Flex>
			),
		},
		{
			title: t("organizationPointsPage.columns.currentPlan"),
			dataIndex: "current_plan",
			key: "current_plan",
			width: "10%",
			render: (text, record) =>
				isEmpty(text) ? (
					"-"
				) : (
					<Flex vertical gap={4}>
						<span>{record.current_plan_product_name.zh_CN}</span>
						<span>{text}</span>
					</Flex>
				),
		},
		{
			title: t("organizationPointsPage.columns.balance"),
			dataIndex: "balance",
			key: "balance",
			width: "10%",
			render: (value: number) => {
				return value === undefined || value === null ? "-" : value.toLocaleString()
			},
		},
		{
			title: t("organizationPointsPage.columns.usedPoints"),
			dataIndex: "used_points",
			key: "used_points",
			width: "10%",
			render: (value: number) =>
				value === undefined || value === null ? "-" : value.toLocaleString(),
		},

		{
			title: t("organizationPointsPage.columns.invitationCode"),
			dataIndex: "invitation_code",
			key: "invitation_code",
			width: "10%",
			render: (text: string) => (isEmpty(text) ? "-" : text),
		},
		{
			title: t("organizationPointsPage.columns.createdTime"),
			dataIndex: "created_time",
			key: "created_time",
			width: "15%",
			render: (text: string) => (isEmpty(text) ? "-" : text),
		},
		{
			title: t("organizationPointsPage.columns.action"),
			key: "action",
			width: "10%",
			fixed: "right" as const,
			render: (_: unknown, record) => getButtons(record),
		},
	]

	const searchItems: SearchItem[] = useMemo(
		() => [
			{
				type: SearchItemType.TEXT,
				field: "name",
				placeholder: t("organizationPointsPage.search.placeholder"),
				allowClear: true,
				addonBefore: t("organizationPointsPage.columns.organizationName"),
				onChange: (e) => debouncedSearch({ organization_name: e.target.value }),
			},
			{
				type: SearchItemType.TEXT,
				field: "magic_id",
				placeholder: t("organizationPointsPage.search.magicIdPlaceholder"),
				allowClear: true,
				addonBefore: "MagicID",
				onChange: (e) => debouncedSearch({ magic_id: e.target.value }),
			},
			{
				type: SearchItemType.TEXT,
				field: "phone",
				placeholder: t("organizationPointsPage.search.phonePlaceholder"),
				allowClear: true,
				addonBefore: t("organizationPointsPage.columns.creatorPhone"),
				onChange: (e) => debouncedSearch({ phone: e.target.value }),
			},
		],
		[debouncedSearch, t],
	)

	const { paginationConfig } = usePagination({
		params,
		setParams,
		fetchData,
		data: data.list,
		total: data.total,
	})

	return (
		<Flex vertical gap="large" className={styles.container}>
			{isMobile ? (
				<MobileList<PlatformPackage.GetOrgPointsListParams, DataType>
					data={data.list}
					loading={loading}
					total={data.total || 0}
					currentFilters={params}
					search={searchItems}
					CardComponent={<PointsCard getButtons={getButtons} />}
					paginationConfig={paginationConfig}
					showDetail={false}
				/>
			) : (
				<TableWithFilters
					search={searchItems}
					columns={columns}
					dataSource={data.list}
					rowKey="organization_code"
					loading={loading}
					extraHeight={116}
					pagination={paginationConfig}
				/>
			)}
		</Flex>
	)
}
