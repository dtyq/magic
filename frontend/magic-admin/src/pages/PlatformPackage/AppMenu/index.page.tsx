import { useState, useMemo } from "react"
import { Flex, Switch, Button, message } from "antd"
import { createStyles } from "antd-style"
import type { TableButton } from "components"
import { TableWithFilters, WarningModal } from "components"
import { useTranslation } from "react-i18next"
import { useDebounceFn, useMemoizedFn, useMount, useRequest } from "ahooks"
import { usePagination } from "@/hooks/usePagination"
import type { TableProps } from "antd/lib"
import { useOpenModal } from "@/hooks/useOpenModal"
import { useApis } from "@/apis"
import { AppMenu } from "@/types/appMenu"
import useRights from "@/hooks/useRights"
import { PERMISSION_KEY_MAP } from "@/const/common"
import { AppMenuModal } from "./components/AppMenuModal"

type DataType = AppMenu.MenuItem
type ParamsType = AppMenu.GetListParams

const useStyles = createStyles(({ token }) => ({
	container: {
		backgroundColor: token.magicColorUsages.bg[0],
	},
	editBtn: {
		padding: 0,
	},
	deleteBtn: {
		padding: 0,
	},
}))

export default function AppMenuPage() {
	const { t } = useTranslation("admin/common")
	const { styles } = useStyles()
	const { AppMenuApi } = useApis()
	const openModal = useOpenModal()

	const [open, setOpen] = useState(false)
	const [selectedRow, setSelectedRow] = useState<DataType | null>(null)
	const [data, setData] = useState<DataType[]>([])
	const [total, setTotal] = useState(0)
	const [params, setParams] = useState<ParamsType>({
		page: 1,
		page_size: 20,
	})

	const { run, loading } = useRequest((arg: ParamsType) => AppMenuApi.getAppMenuList(arg), {
		manual: true,
		onSuccess: (res) => {
			setData(res.list)
			setTotal(res.total)
		},
	})

	useMount(() => {
		run(params)
	})

	const hasEditRight = useRights(PERMISSION_KEY_MAP.APP_MENU_EDIT)

	const [statusLoadingIds, setStatusLoadingIds] = useState<Set<string>>(new Set())

	const handleDelete = useMemoizedFn((record: DataType) => {
		openModal(WarningModal, {
			open: true,
			content: record.name_i18n?.zh_CN || record.name_i18n?.en_US,
			onOk: () => {
				AppMenuApi.deleteAppMenu(record.id).then(() => {
					message.success(t("message.deleteSuccess"))
					run(params)
				})
			},
		})
	})

	const { run: runUpdateStatus } = useDebounceFn(
		(record: DataType, newStatus: AppMenu.Status) => {
			setStatusLoadingIds((prev) => new Set([...prev, record.id]))
			AppMenuApi.updateAppMenuStatus(record.id, newStatus)
				.then(() => {
					message.success(t("message.updateSuccess"))
					run(params)
				})
				.finally(() => {
					setStatusLoadingIds((prev) => {
						const next = new Set(prev)
						next.delete(record.id)
						return next
					})
				})
		},
		{ wait: 300 },
	)

	const handleStatusChange = useMemoizedFn((record: DataType, checked: boolean) => {
		const newStatus = checked ? AppMenu.StatusMap.enabled : AppMenu.StatusMap.disabled
		runUpdateStatus(record, newStatus)
	})

	const openMethodLabel = useMemoizedFn((value: AppMenu.OpenMethod) => {
		const map: Record<AppMenu.OpenMethod, string> = {
			[AppMenu.OpenMethodMap.self]: t("appMenu.openMethod.self"),
			[AppMenu.OpenMethodMap.blank]: t("appMenu.openMethod.blank"),
		}
		return map[value] ?? value
	})

	const columns: TableProps<DataType>["columns"] = useMemo(
		() => [
			{
				title: t("appMenu.columns.name"),
				dataIndex: "name",
				key: "name",
				ellipsis: true,
				render: (_: string, record) => record.name_i18n?.zh_CN || record.name_i18n?.en_US,
			},
			{
				title: t("appMenu.columns.path"),
				dataIndex: "path",
				key: "path",
				ellipsis: true,
			},
			{
				title: t("appMenu.columns.openMethod"),
				dataIndex: "open_method",
				key: "open_method",
				width: 200,
				render: (value: AppMenu.OpenMethod) => openMethodLabel(value),
			},
			{
				title: t("appMenu.columns.sortOrder"),
				dataIndex: "sort_order",
				key: "sort_order",
				width: 100,
			},
			{
				title: t("appMenu.columns.status"),
				dataIndex: "status",
				key: "status",
				width: 120,
				render: (value: AppMenu.Status, record) => (
					<Switch
						checked={value === AppMenu.StatusMap.enabled}
						loading={statusLoadingIds.has(record.id)}
						disabled={!hasEditRight || statusLoadingIds.has(record.id)}
						onChange={(checked) => handleStatusChange(record, checked)}
					/>
				),
			},
			{
				title: t("operate"),
				key: "action",
				dataIndex: "action",
				width: 140,
				render: (_, record) => (
					<Flex align="center" gap={8}>
						<Button
							type="link"
							className={styles.editBtn}
							disabled={!hasEditRight}
							onClick={() => {
								setSelectedRow(record)
								setOpen(true)
							}}
						>
							{t("button.edit")}
						</Button>
						<Button
							type="link"
							danger
							className={styles.deleteBtn}
							disabled={!hasEditRight}
							onClick={() => handleDelete(record)}
						>
							{t("button.delete")}
						</Button>
					</Flex>
				),
			},
		],
		[
			t,
			hasEditRight,
			handleDelete,
			handleStatusChange,
			openMethodLabel,
			statusLoadingIds,
			styles,
		],
	)

	const buttons: TableButton[] = useMemo(
		() => [
			{
				text: t("appMenu.addMenu"),
				type: "primary",
				disabled: !hasEditRight,
				onClick: () => {
					setSelectedRow(null)
					setOpen(true)
				},
			},
		],
		[hasEditRight, t],
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
				columns={columns}
				buttons={buttons}
				dataSource={data}
				rowKey="id"
				extraHeight={116}
				loading={loading}
				pagination={paginationConfig}
			/>
			<AppMenuModal
				open={open}
				info={selectedRow}
				onCancel={() => setOpen(false)}
				onOk={() => setOpen(false)}
				onSuccess={() => run(params)}
			/>
		</div>
	)
}
