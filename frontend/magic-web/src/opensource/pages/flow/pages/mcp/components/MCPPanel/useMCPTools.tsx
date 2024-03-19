import { Modal } from "antd"
import { useMemoizedFn, useRequest } from "ahooks"
import { FlowApi } from "@/opensource/apis"
import { useTranslation } from "react-i18next"
import { openAgentCommonModal } from "@/opensource/components/Agent/AgentCommonModal"
import type { Flow } from "@/opensource/types/flow"
import { IconExclamationCircleFilled } from "@tabler/icons-react"
import AgentToolForm from "@/opensource/components/Agent/AgentTools/AgentToolForm"
import { pick } from "lodash-es"
import { useEffect } from "react"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

/**
 * @description MCP 子工具管理
 * @param id
 */
export default function useMCPTools(id?: string) {
	const { t } = useTranslation("agent")

	const { run, data: tools, refresh } = useRequest((code: string) => FlowApi.getMcpToolList(code))

	useEffect(() => {
		if (id) {
			run(id)
		}
	}, [id])

	const onStatusChange = useMemoizedFn(async (item: Flow.Mcp.ListItem) => {
		await FlowApi.saveMcpTool(
			{
				description: item?.description,
				enabled: !item?.enabled,
				id: item?.id,
				name: item?.name,
				rel_code: item?.rel_code,
				source: item?.source,
			},
			id || "",
		)
		magicToast.success(
			t(item?.enabled ? "mcp.page.switch.disable" : "mcp.page.switch.enable", {
				name: item.name,
			}),
		)
		refresh()
	})

	const onVersionUpdate = useMemoizedFn(async (tool: Flow.Mcp.ListItem) => {
		const mcpTool = pick(tool, [
			"id",
			"source",
			"name",
			"description",
			"icon",
			"rel_code",
			"enabled",
		])
		Modal.confirm({
			title: t("mcp.page.update.title", {
				name: tool?.name,
			}),
			icon: <IconExclamationCircleFilled size={24} style={{ marginRight: 8 }} />,
			content: t("mcp.page.update.confirm", {
				version: tool?.version,
				latestVersion: tool?.source_version?.latest_version_name,
			}),
			okText: t("mcp.page.update.confirm"),
			okType: "danger",
			cancelText: t("mcp.page.delete.cancel"),
			okButtonProps: {
				type: "primary",
			},
			onOk: async () => {
				await FlowApi.saveMcpTool(
					{ ...mcpTool, rel_version_code: tool.source_version?.latest_version_code },
					tool.mcp_server_code,
				)
				refresh()
				magicToast.success(t("mcp.page.update.success"))
			},
		})
	})

	const onEdit = useMemoizedFn((item: Flow.Mcp.ListItem) => {
		openAgentCommonModal({
			width: 520,
			footer: null,
			closable: false,
			children: <AgentToolForm id={item?.id} mcpId={id || ""} onSuccessCallback={refresh} />,
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
					await FlowApi.deleteMcpTool(item?.id, id || "")
					magicToast.success(t("mcp.page.delete.success"))
					refresh()
				} catch (error) {
					console.error(error)
					magicToast.success(t("mcp.page.delete.fail"))
				}
			},
		})
	})

	return {
		tools,
		refresh,
		onStatusChange,
		onVersionUpdate,
		onEdit,
		onDelete,
	}
}
