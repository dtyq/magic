import { useState, useMemo, useRef } from "react"
import { Flex, Space } from "antd"
import { createStyles } from "antd-style"
import type { SearchItem, TableButton } from "components"
import {
	SearchItemType,
	TableWithFilters,
	StatusTag,
	MobileList,
	MagicAvatar,
	MagicButton,
} from "components"
import { useTranslation } from "react-i18next"
import { useMemoizedFn, useMount, useRequest } from "ahooks"
import { PlatformPackage } from "@/types/platformPackage"
import { useApis } from "@/apis"
import { usePagination } from "@/hooks/usePagination"
import type { TableProps } from "antd/lib"
import { debounce } from "lodash-es"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useOpenModal } from "@/hooks/useOpenModal"
import OrgCard from "./OrgCard"
import CreateOrganizationModal from "./CreateOrganizationModal"

type DataType = PlatformPackage.Organization

export const SYNC_STATUS_MAP = {
	[PlatformPackage.SyncStatus.NotSynced]: {
		label: "notSynced",
		color: "warning",
	},
	[PlatformPackage.SyncStatus.Synced]: {
		label: "synced",
		color: "success",
	},
	[PlatformPackage.SyncStatus.SyncFailed]: {
		label: "syncFailed",
		color: "error",
	},
	[PlatformPackage.SyncStatus.Syncing]: {
		label: "syncing",
		color: "processing",
	},
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

export default function OrganizationList() {
	const { t } = useTranslation("admin/platform/organization")
	const { styles } = useStyles()

	const isMobile = useIsMobile()
	const openModal = useOpenModal()

	const { PlatformPackageApi } = useApis()

	const [data, setData] = useState<DataType[]>([])
	const [total, setTotal] = useState(0)
	const [params, setParams] = useState<PlatformPackage.GetOrgListParams>({
		page: 1,
		page_size: 20,
	})

	const { run, loading } = useRequest(
		(arg: PlatformPackage.GetOrgListParams) => PlatformPackageApi.getOrgList(arg),
		{
			manual: true,
			onSuccess: (res) => {
				setData(res.list)
				setTotal(res.total)
			},
		},
	)

	useMount(() => {
		run(params)
	})

	const handleOpenModal = useMemoizedFn(async (code?: string) => {
		let info: PlatformPackage.OrganizationInfo | null = null
		if (code) {
			info = await PlatformPackageApi.getOrganizationInfo(code)
		}
		openModal(CreateOrganizationModal, {
			info,
			afterClose: () => run(params),
		})
	})

	const columns: TableProps<DataType>["columns"] = useMemo(
		() => [
			{
				title: t("organization"),
				dataIndex: "magic_organization_code",
				key: "magic_organization_code",
				width: "20%",
				render: (text, { name }) => {
					return (
						<Flex vertical gap={4}>
							<span>{name || "-"}</span>
							<span className={styles.desc}>
								{t("organizationCode")}:{text || "-"}
							</span>
						</Flex>
					)
				},
			},
			{
				title: t("organizationCreator"),
				dataIndex: "creator",
				key: "creator",
				width: "15%",
				render: (creator) =>
					creator ? (
						<Space size="small">
							<MagicAvatar size={32} shape="square" src={creator?.avatar}>
								{creator?.name}
							</MagicAvatar>
							<Flex vertical gap={4}>
								<span>{creator.name || "-"}</span>
								<span className={styles.desc}>
									MagicID:{creator.magic_id || "-"}
								</span>
							</Flex>
						</Space>
					) : (
						"-"
					),
			},
			{
				title: t("organizationType"),
				key: "type",
				dataIndex: "type",
				width: "10%",
				render: (text) => {
					return text === PlatformPackage.OrganizationType.Enterprise
						? t("enterpriseOrg")
						: t("personalOrg")
				},
			},

			{
				title: t("status"),
				key: "status",
				dataIndex: "status",
				width: "6%",
				render: (text) => {
					return (
						<StatusTag
							color={
								text === PlatformPackage.OrganizationStatus.Disabled
									? "warning"
									: "success"
							}
							bordered={false}
						>
							{text === PlatformPackage.OrganizationStatus.Disabled
								? t("disabled")
								: t("enable")}
						</StatusTag>
					)
				},
			},
			{
				title: t("seats"),
				key: "seats",
				dataIndex: "seats",
				width: "10%",
			},
			{
				title: t("syncStatus"),
				key: "sync_status",
				dataIndex: "sync_status",
				width: "10%",
				render: (text: PlatformPackage.SyncStatus) => {
					return (
						<StatusTag color={SYNC_STATUS_MAP[text].color} bordered={false}>
							{t(SYNC_STATUS_MAP[text].label)}
						</StatusTag>
					)
				},
			},
			{
				title: t("syncTime"),
				key: "sync_time",
				dataIndex: "sync_time",
				width: "15%",
			},
			{
				title: t("createdAt"),
				key: "created_at",
				dataIndex: "created_at",
				width: "15%",
			},
			{
				title: t("operation"),
				key: "operation",
				fixed: "right",
				width: "10%",
				render: (_, record) => {
					return (
						<MagicButton
							type="link"
							onClick={() => handleOpenModal(record.magic_organization_code)}
						>
							{t("edit")}
						</MagicButton>
					)
				},
			},
		],
		[handleOpenModal, styles.desc, t],
	)

	const typeOptions = useMemo(
		() => [
			{
				label: t("enterpriseOrg"),
				value: PlatformPackage.OrganizationType.Enterprise,
			},
			{
				label: t("personalOrg"),
				value: PlatformPackage.OrganizationType.Person,
			},
		],
		[t],
	)

	// 定义通用的 params 更新函数
	const updateParams = useMemoizedFn((newParams: Partial<PlatformPackage.GetOrgListParams>) => {
		const p = {
			...params,
			...newParams,
			page: 1,
		}
		setParams(p)
		run(p)
	})

	const debouncedSearch = useRef(
		debounce((value: Partial<PlatformPackage.GetOrgListParams>) => {
			updateParams(value)
		}, 500),
	).current

	const searchItems: SearchItem[] = useMemo(
		() => [
			{
				type: SearchItemType.TEXT,
				field: "name",
				addonBefore: t("organizationName"),
				placeholder: t("searchOrganizationName"),
				allowClear: true,
				onChange: (e) => debouncedSearch({ name: e.target.value }),
			},
			{
				type: SearchItemType.TEXT,
				field: "name",
				addonBefore: t("organizationCode"),
				placeholder: t("searchOrganizationCode"),
				allowClear: true,
				onChange: (e) => debouncedSearch({ magic_organization_code: e.target.value }),
			},
			{
				type: SearchItemType.SELECT,
				field: "type",
				prefix: t("organizationType"),
				options: typeOptions,
				allowClear: true,
				onChange: (value) => {
					updateParams({ type: value })
				},
			},
			{
				type: SearchItemType.DATE_RANGE,
				field: "createdAtStart",
				prefix: t("createdAt"),
				onChange: (dates) => {
					const start_date = dates?.[0]?.format("YYYY-MM-DD")
					const end_date = dates?.[1]?.format("YYYY-MM-DD")
					updateParams({ created_at_start: start_date, created_at_end: end_date })
				},
			},
		],
		[debouncedSearch, t, typeOptions, updateParams],
	)

	const buttons: TableButton[] = useMemo(
		() => [
			{
				text: t("createOrganization"),
				type: "primary",
				onClick: () => handleOpenModal(),
			},
		],
		[t, handleOpenModal],
	)

	const { paginationConfig } = usePagination({
		params,
		setParams,
		fetchData: run,
		data,
		total,
	})

	if (isMobile) {
		return (
			<MobileList<PlatformPackage.GetOrgListParams, DataType>
				data={data}
				loading={loading}
				total={total}
				currentFilters={params}
				search={searchItems}
				buttons={buttons}
				CardComponent={<OrgCard handleOpenModal={handleOpenModal} />}
				paginationConfig={paginationConfig}
				showDetail={false}
			/>
		)
	}

	return (
		<div className={styles.container}>
			<TableWithFilters<DataType>
				search={searchItems}
				columns={columns}
				buttons={buttons}
				dataSource={data}
				rowKey="id"
				extraHeight={116}
				loading={loading}
				pagination={paginationConfig}
			/>
		</div>
	)
}
