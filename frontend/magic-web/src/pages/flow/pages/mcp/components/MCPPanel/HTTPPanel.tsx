import { Flex, Button, Spin } from "antd"
import { useStyles } from "./styles"
import { useMemoizedFn, useRequest, useThrottleEffect } from "ahooks"
import { FlowApi } from "@/apis"
import { useState } from "react"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { useTranslation } from "react-i18next"
import { IconHelp } from "@tabler/icons-react"
import { openAgentCommonModal } from "@/components/Agent/AgentCommonModal"
import { MCPOAuth, MCPForm } from "@/components/Agent/MCP"
import MagicSpin from "@/components/base/MagicSpin"
import type { Flow } from "@/types/flow"
import { hasEditRight, ResourceTypes } from "@/pages/flow/components/AuthControlButton/types"
import AuthControlButton from "@/pages/flow/components/AuthControlButton/AuthControlButton"
import { generateCallbackUrl } from "@/components/Agent/MCP/helpers"
import { StatusIndicator } from "@/pages/flow/list/components/RightDrawer/components"
import LoadingOutlined from "@/components/icons/LoadingOutlined"
import { colorUsages } from "@/providers/ThemeProvider/colors"
import MCPToolsOptionWrapper from "@/pages/flow/list/components/ToolCard/components/ToolsOptionWrapper"

const enum MCPConnectStatus {
	/** Waiting for a connection. */
	Pending = "pending",
	/** Connection established. */
	Success = "success",
	/** Connection failed. */
	Fail = "fail",
	/** Request in progress. */
	Loading = "loading",
}

const StatusColors = {
	[MCPConnectStatus.Pending]: colorUsages.text[3],
	[MCPConnectStatus.Success]: colorUsages.success.default,
	[MCPConnectStatus.Fail]: colorUsages.danger.default,
}

interface HTTPPanelProps {
	details?: Flow.Mcp.Detail
	onSuccessCallback?: () => void
}

export function HTTPPanel(props: HTTPPanelProps) {
	const { details } = props
	const { styles, cx } = useStyles(open)
	const { t } = useTranslation("agent")

	const [connectStatus, setConnectStatus] = useState<MCPConnectStatus>(MCPConnectStatus.Pending)

	const {
		data: mcpTools,
		run,
		loading,
	} = useRequest((id: string) => FlowApi.getMCPStatus(id, { enableErrorMessagePrompt: false }), {
		manual: true,
		onSuccess(response) {
			if (response?.success) {
				setConnectStatus(MCPConnectStatus.Success)
			}
		},
	})

	useThrottleEffect(
		() => {
			if (details!.id) {
				run(details!.id)
			}
		},
		[details!.id],
		{ wait: 500, leading: false },
	)

	/** Edit the MCP server URL. */
	const triggerMCPUrlForm = useMemoizedFn(() => {
		openAgentCommonModal({
			width: 500,
			footer: null,
			closable: false,
			children: <MCPForm id={details?.id} onSuccessCallback={props?.onSuccessCallback} />,
		})
	})

	const onStatusChack = useMemoizedFn(async () => {
		try {
			if (details?.id) {
				// Fetch settings before checking whether authorization is required.
				const result = await FlowApi.getMCPUserSettings({
					code: details?.id,
					redirectUrl: generateCallbackUrl(),
				})
				// const isAuth = data?.auth_type && !data?.auth_config?.is_authenticated
				if (
					result?.auth_type ||
					(details?.require_fields && details?.require_fields?.length > 0)
				) {
					// The authorization dialog collects required fields and polls for completion.
					openAgentCommonModal({
						width: 560,
						footer: null,
						closable: false,
						children: (
							<MCPOAuth
								id={details?.id}
								onEnable={() => {
									setConnectStatus(MCPConnectStatus.Success)
								}}
							/>
						),
					})
				} else {
					// No authorization is required for this server.
					setConnectStatus(MCPConnectStatus.Success)
				}
			}
		} catch (error) {
			console.error(error)
			setConnectStatus(MCPConnectStatus.Fail)
		}
	})

	return (
		<>
			{hasEditRight(details?.user_operation) && (
				<div className={styles.container}>
					<Button
						type="primary"
						block
						onClick={onStatusChack}
						className={styles.container}
					>
						{connectStatus !== MCPConnectStatus.Loading && (
							<StatusIndicator size={10} color={StatusColors[connectStatus]} />
						)}
						{connectStatus === MCPConnectStatus.Loading && (
							<Spin
								indicator={<LoadingOutlined spin />}
								spinning={true}
								size="small"
								style={{ color: "#fff" }}
							/>
						)}
						{t("mcp.panel.status")}
					</Button>
				</div>
			)}
			{hasEditRight(details?.user_operation) && (
				<>
					<Flex gap={8} className={styles.container}>
						<Button
							block
							type="text"
							className={styles.button}
							onClick={triggerMCPUrlForm}
						>
							{t("mcp.panel.url")}
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
								count: mcpTools?.tools?.length || 0,
							})}
						</div>
						<MagicSpin spinning={loading}>
							<ScrollArea
								className={styles.scroll}
								viewportClassName={styles.scrollViewport}
								type="always"
							>
								{mcpTools?.tools?.map((item) => (
									<div key={item.name} className={styles.item}>
										<div className={styles.itemHeader}>
											<div className={styles.itemTitle}>{item.name}</div>
											<MCPToolsOptionWrapper tool={item}>
												<IconHelp
													size={16}
													style={{ marginRight: "auto", flexShrink: 0 }}
												/>
											</MCPToolsOptionWrapper>
										</div>
										<div className={cx(styles.itemDesc, styles.font)}>
											{item.description}
										</div>
									</div>
								))}
							</ScrollArea>
						</MagicSpin>
					</div>
				</>
			)}
		</>
	)
}
