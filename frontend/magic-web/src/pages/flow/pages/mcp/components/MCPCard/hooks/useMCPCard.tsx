import { useMemoizedFn, useRequest } from "ahooks"
import type { Flow } from "@/types/flow"
import { FlowApi } from "@/apis"
import { Modal } from "antd"
import { openAgentCommonModal } from "@/components/Agent/AgentCommonModal"
import { MCPForm } from "@/components/Agent/MCP"
import { IconExclamationCircleFilled } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"

interface UseMCPCardProps {
	onDeletedCallback?: (id: string) => void
}

export function useMCPCard(props: UseMCPCardProps) {
	const { onDeletedCallback } = props
	const { t } = useTranslation("agent")

	const { run, loading, refresh, data } = useRequest(
		(params: Flow.Mcp.GetListParams) => FlowApi.getMcpList(params),
		{
			manual: true,
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
		refresh()
	})

	const onEdit = useMemoizedFn((item: Flow.Mcp.ListItem) => {
		openAgentCommonModal({
			width: 600,
			footer: null,
			closable: false,
			children: <MCPForm id={item?.id} onSuccessCallback={refresh} />,
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
					refresh()
				} catch (error) {
					console.error(error)
					magicToast.success(t("mcp.page.delete.fail"))
				}
			},
		})
	})

	return {
		mcpList: data?.list || [],
		loading,
		getMcpList: run,
		mcpListRefresh: refresh,
		onStatusChange,
		onEdit,
		onDelete,
	}
}
