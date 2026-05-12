import { useMemoizedFn, useRequest } from "ahooks"
import type { Flow } from "@/types/flow"
import { FlowApi } from "@/apis"
import { Modal } from "antd"
import { openAgentCommonModal } from "@/components/Agent/AgentCommonModal"
import { MCPForm } from "@/components/Agent/MCP"
import { IconExclamationCircleFilled } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import { useState } from "react"

interface UseMCPCardProps {
	onDeletedCallback?: (id: string) => void
}

export function useMCPCard(props: UseMCPCardProps) {
	const { onDeletedCallback } = props
	const { t } = useTranslation("agent")

	const [page, setPage] = useState(1)
	const [allMcpList, setAllMcpList] = useState<Flow.Mcp.ListItem[]>([])
	const [total, setTotal] = useState(0)
	const [currentParams, setCurrentParams] = useState<Flow.Mcp.GetListParams>({
		page: 1,
		pageSize: 12,
		name: "",
	})

	const { run, loading } = useRequest(
		(params: Flow.Mcp.GetListParams) => {
			setCurrentParams(params)
			return FlowApi.getMcpList(params)
		},
		{
			manual: true,
			onSuccess: (response, [params]) => {
				if (params.page === 1) {
					setAllMcpList(response.list)
				} else {
					setAllMcpList((prev) => [...prev, ...response.list])
				}
				setTotal(response.total)
			},
		},
	)

	const onStatusChange = useMemoizedFn(async (item: Flow.Mcp.ListItem) => {
		await FlowApi.saveMcp({
			...item,
			enabled: !item.enabled,
		})
		magicToast.success(
			t(item?.enabled ? "mcp.page.switch.disable" : "mcp.page.switch.enable", {
				name: item.name,
			}),
		)
		// 更新列表中的状态
		setAllMcpList((prev) =>
			prev.map((mcp) => (mcp.id === item.id ? { ...mcp, enabled: !item.enabled } : mcp)),
		)
	})

	const refreshList = useMemoizedFn((name?: string) => {
		setPage(1)
		setAllMcpList([])
		run({ page: 1, pageSize: 12, name: name || "" })
	})

	const onEdit = useMemoizedFn((item: Flow.Mcp.ListItem) => {
		openAgentCommonModal({
			width: 600,
			footer: null,
			closable: false,
			children: (
				<MCPForm id={item?.id} onSuccessCallback={() => refreshList(currentParams.name)} />
			),
		})
	})

	const onDelete = useMemoizedFn((item: Flow.Mcp.ListItem) => {
		Modal.confirm({
			title: t("mcp.page.delete.title"),
			icon: <IconExclamationCircleFilled size={24} style={{ marginRight: 8 }} />,
			content: t("mcp.page.delete.content", { name: item?.name }),
			okText: t("mcp.page.delete.confirm"),
			okType: "danger",
			cancelText: t("mcp.page.delete.cancel"),
			okButtonProps: {
				type: "primary",
			},
			onOk: async () => {
				try {
					await FlowApi.deleteMcp(item?.id)
					magicToast.success(t("mcp.page.delete.success"))
					onDeletedCallback?.(item?.id)
					// 从列表中移除已删除的项
					setAllMcpList((prev) => prev.filter((mcp) => mcp.id !== item.id))
					setTotal((prev) => prev - 1)
				} catch (error) {
					console.error(error)
					magicToast.success(t("mcp.page.delete.fail"))
				}
			},
		})
	})

	const loadMoreData = useMemoizedFn((name?: string) => {
		const nextPage = page + 1
		setPage(nextPage)
		run({ page: nextPage, pageSize: 12, name: name || "" })
	})

	const hasMore = allMcpList.length < total

	return {
		mcpList: allMcpList,
		loading,
		getMcpList: run,
		mcpListRefresh: refreshList,
		onStatusChange,
		onEdit,
		onDelete,
		loadMoreData,
		hasMore,
		total,
	}
}
