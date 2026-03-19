import { Flex, Button } from "antd"
import { useStyles } from "./styles"
import { useMemoizedFn } from "ahooks"
import MagicScrollBar from "@/components/base/MagicScrollBar"
import { useTranslation } from "react-i18next"
import { openAgentCommonModal } from "@/components/Agent/AgentCommonModal"
import AgentTools from "@/components/Agent/AgentTools/AgentTools"
import type { Flow } from "@/types/flow"
import ToolItem from "./ToolItem"
import {
	hasEditRight,
	hasAdminRight,
	ResourceTypes,
} from "@/pages/flow/components/AuthControlButton/types"
import AgentAuthorizationTools from "@/components/Agent/AgentTools/AgentAuthorizationTools"
import AuthControlButton from "@/pages/flow/components/AuthControlButton/AuthControlButton"
import useMCPTools from "./useMCPTools"

export function SSEPanel(props: { details?: Flow.Mcp.Detail }) {
	const { details } = props
	const { styles } = useStyles(open)
	const { t } = useTranslation("agent")

	const { tools, refresh, onEdit, onDelete, onStatusChange, onVersionUpdate } = useMCPTools(
		details?.id,
	)

	/** 设置 MCP 权限 */
	const triggerAgentAuthorizationTools = useMemoizedFn(() => {
		openAgentCommonModal({
			width: 880,
			footer: null,
			closable: false,
			children: <AgentAuthorizationTools id={details?.id} />,
		})
	})

	/** 工具导入 */
	const onToolsOpen = useMemoizedFn(() => {
		openAgentCommonModal({
			width: 800,
			footer: null,
			closable: false,
			children: <AgentTools id={details?.id} onSuccessCallback={refresh} />,
		})
	})

	return (
		<>
			{details && hasEditRight(details?.user_operation) && (
				<div className={styles.container}>
					<Button type="primary" block onClick={onToolsOpen} className={styles.container}>
						{t("mcp.panel.tool")}
					</Button>
				</div>
			)}
			{details && hasEditRight(details?.user_operation) && (
				<>
					<Flex gap={8} className={styles.container}>
						<Button
							block
							type="text"
							className={styles.button}
							onClick={triggerAgentAuthorizationTools}
						>
							{t("mcp.panel.auth")}
						</Button>
						<AuthControlButton
							className={styles.button}
							resourceType={ResourceTypes.Mcp}
							resourceId={details?.id ?? ""}
						/>
					</Flex>
					<div className={styles.wrapper}>
						<div className={styles.wrapperHeader}>
							{t("mcp.card.toolsCount", {
								count: tools?.list?.length || 0,
							})}
						</div>
						<MagicScrollBar className={styles.scroll} autoHide={false}>
							{tools?.list?.map((item) => (
								<ToolItem
									key={item.id}
									item={item}
									role={{
										edit: true,
										delete: hasAdminRight(details?.user_operation),
									}}
									onEdit={onEdit}
									onDelete={onDelete}
									onStatusChange={onStatusChange}
									onVersionUpdate={onVersionUpdate}
								/>
							))}
						</MagicScrollBar>
					</div>
				</>
			)}
		</>
	)
}
