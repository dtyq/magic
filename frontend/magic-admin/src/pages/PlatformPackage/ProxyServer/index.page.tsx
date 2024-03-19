import { useState, useMemo } from "react"
import { Flex, message } from "antd"
import { createStyles } from "antd-style"
import type { TableButton } from "components"
import { TableWithFilters, MobileList, MagicButton, WarningModal } from "components"
import { useTranslation } from "react-i18next"
import { useMemoizedFn, useMount, useRequest } from "ahooks"
import { usePagination } from "@/hooks/usePagination"
import type { TableProps } from "antd/lib"
import { useIsMobile } from "@/hooks/useIsMobile"
import { IconPencil, IconPlayerPlay, IconTrash } from "@tabler/icons-react"
import { useOpenModal } from "@/hooks/useOpenModal"
import { useApis } from "@/apis"
import { PlatformPackage } from "@/types/platformPackage"
import useRights from "@/hooks/useRights"
import { PERMISSION_KEY_MAP } from "@/const/common"
import { TestConnectionModal } from "./components/TestConnectionModal"
import { AddProxyServerModal } from "./components/AddProxyServerModal"
import DataCard from "./components/DataCard"

type DataType = PlatformPackage.ProxyServer
type ParamsType = PlatformPackage.GetProxyServerListParams

const useStyles = createStyles(({ token }) => ({
	container: {
		backgroundColor: token.magicColorUsages.bg[0],
	},
	desc: {
		fontSize: 12,
		color: token.magicColorUsages.text[3],
	},
}))

export default function ProxyServerPage() {
	const { t } = useTranslation("admin/platform/proxy")
	const { t: tCommon } = useTranslation("admin/common")
	const { styles } = useStyles()
	const openModal = useOpenModal()

	const { PlatformPackageApi } = useApis()

	const isMobile = useIsMobile()

	const [data, setData] = useState<DataType[]>([])
	const [total, setTotal] = useState(0)
	const [params, setParams] = useState<ParamsType>({
		page: 1,
		page_size: 20,
	})

	const { run, loading } = useRequest(
		(arg: ParamsType) => PlatformPackageApi.getProxyServerList(arg),
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

	const hasEditRight = useRights(PERMISSION_KEY_MAP.PROXY_SERVER_EDIT)

	const onDelete = useMemoizedFn((record: DataType) => {
		openModal(WarningModal, {
			open: true,
			content: record.name,
			onOk: () => {
				PlatformPackageApi.deleteProxy(record.id).then(() => {
					message.success(tCommon("message.deleteSuccess"))
					run(params)
				})
			},
		})
	})

	const addOrEditProxyServerModal = useMemoizedFn((record?: DataType) => {
		openModal(AddProxyServerModal, {
			info: record,
			onOk: () => {
				run(params)
			},
		})
	})

	const testConnection = useMemoizedFn((record: DataType) => {
		openModal(TestConnectionModal, {
			info: record,
		})
	})

	const getButtons = useMemoizedFn((record: DataType) => {
		return (
			<Flex align="center">
				<MagicButton
					type="text"
					icon={<IconPlayerPlay size={20} />}
					disabled={!hasEditRight}
					onClick={() => testConnection(record)}
				/>
				<MagicButton
					type="text"
					icon={<IconPencil size={20} />}
					disabled={!hasEditRight}
					onClick={() => addOrEditProxyServerModal(record)}
				/>
				<MagicButton
					type="text"
					icon={<IconTrash size={20} />}
					disabled={!hasEditRight}
					danger
					onClick={() => onDelete(record)}
				/>
			</Flex>
		)
	})

	const columns: TableProps<DataType>["columns"] = useMemo(
		() => [
			{
				title: t("type"),
				dataIndex: "type",
				key: "type",
				width: "20%",
				render: (text) => {
					return text === PlatformPackage.ProxyServerType.ProxyServer
						? t("proxyServer")
						: t("subscriptionSource")
				},
			},
			{
				title: t("name"),
				dataIndex: "name",
				key: "name",
				width: "20%",
			},
			{
				title: t("serverAndSource"),
				dataIndex: "proxyUrl",
				key: "proxyUrl",
				width: "20%",
				render: (text, { type, platform }) => {
					if (type === PlatformPackage.ProxyServerType.ProxyServer) {
						return text || "-"
					}
					return platform || "-"
				},
			},
			{
				title: t("passwordApiKey"),
				key: "password",
				dataIndex: "password",
				width: "20%",
				render: (text, { type, username, authConfig }) => {
					if (type === PlatformPackage.ProxyServerType.ProxyServer) {
						return `${username ? `${username}:` : ""}${text ?? ""}` || "-"
					}
					return authConfig?.authKey || "-"
				},
			},
			{
				title: t("remark"),
				key: "remark",
				dataIndex: "remark",
				width: "20%",
			},
			{
				title: t("action"),
				key: "action",
				dataIndex: "action",
				width: "15%",
				render: (_, record) => getButtons(record),
			},
		],
		[getButtons, t],
	)

	// const typeOptions = useMemo(
	// 	() => [
	// 		{
	// 			label: tCommon("all"),
	// 			value: "",
	// 		},
	// 		{
	// 			label: t("proxyServer"),
	// 			value: PlatformPackage.ProxyServerType.ProxyServer,
	// 		},
	// 		{
	// 			label: t("subscriptionSource"),
	// 			value: PlatformPackage.ProxyServerType.Subscription,
	// 		},
	// 	],
	// 	[t, tCommon],
	// )

	// 定义通用的 params 更新函数
	// const updateParams = useMemoizedFn((newParams) => {
	// 	const p = {
	// 		...params,
	// 		...newParams,
	// 		page: 1,
	// 	}
	// 	setParams(p)
	// 	run(p)
	// })

	// const debouncedSearch = useRef(
	// 	debounce((value: any) => {
	// 		updateParams(value)
	// 	}, 500),
	// ).current

	// const searchItems: SearchItem[] = useMemo(
	// 	() => [
	// 		{
	// 			type: SearchItemType.SELECT,
	// 			field: "type",
	// 			prefix: t("type"),
	// 			options: typeOptions,
	// 			allowClear: true,
	// 			onChange: (value) => {
	// 				updateParams({ type: value })
	// 			},
	// 		},
	// 		{
	// 			type: SearchItemType.TEXT,
	// 			field: "proxyUrl",
	// 			addonBefore: t("server"),
	// 			placeholder: t("searchServer"),
	// 			allowClear: true,
	// 			onChange: (e) => debouncedSearch({ server: e.target.value }),
	// 		},
	// 		{
	// 			type: SearchItemType.TEXT,
	// 			field: "name",
	// 			addonBefore: t("name"),
	// 			placeholder: t("searchName"),
	// 			allowClear: true,
	// 			onChange: (e) => debouncedSearch({ name: e.target.value }),
	// 		},
	// 		{
	// 			type: SearchItemType.TEXT,
	// 			field: "port",
	// 			addonBefore: t("port"),
	// 			placeholder: t("searchPort"),
	// 			allowClear: true,
	// 			onChange: (e) => debouncedSearch({ port: e.target.value }),
	// 		},
	// 		{
	// 			type: SearchItemType.TEXT,
	// 			field: "remark",
	// 			addonBefore: t("remark"),
	// 			placeholder: t("searchRemark"),
	// 			allowClear: true,
	// 			onChange: (e) => debouncedSearch({ remark: e.target.value }),
	// 		},
	// 	],
	// 	[debouncedSearch, t, typeOptions, updateParams],
	// )

	const buttons: TableButton[] = useMemo(
		() => [
			{
				text: t("addProxy"),
				type: "primary",
				disabled: !hasEditRight,
				onClick: () => addOrEditProxyServerModal(),
			},
		],
		[hasEditRight, t, addOrEditProxyServerModal],
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
			{isMobile ? (
				<MobileList<ParamsType, DataType>
					data={data}
					loading={loading}
					total={total}
					currentFilters={params}
					// search={searchItems}
					buttons={buttons}
					CardComponent={<DataCard getButtons={getButtons} />}
					paginationConfig={paginationConfig}
					showDetail={false}
				/>
			) : (
				<TableWithFilters<DataType>
					// search={searchItems}
					columns={columns}
					buttons={buttons}
					dataSource={data}
					rowKey="id"
					extraHeight={116}
					loading={loading}
					pagination={paginationConfig}
				/>
			)}
		</div>
	)
}
