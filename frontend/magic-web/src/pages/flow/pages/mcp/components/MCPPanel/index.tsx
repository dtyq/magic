import { Flex } from "antd"
import { useStyles } from "./styles"
import { IconMCP } from "@/enhance/tabler/icons-react"
import MagicSpin from "@/components/base/MagicSpin"
import MagicImage from "@/components/base/MagicImage"
import { useDeepCompareEffect, useRequest } from "ahooks"
import { FlowApi } from "@/apis"
import { forwardRef, useImperativeHandle } from "react"
import { useTranslation } from "react-i18next"
import { MCPType } from "@/components/Agent/MCP"
import { SSEPanel } from "./SSEPanel"
import { HTTPPanel } from "./HTTPPanel"

interface MCPPanelProps {
	id?: string
	open?: boolean
	onSuccessCallback?: () => void
}

export interface MCPPanelRef {
	getMCP: (id: string) => void
}

const MCPPanel = forwardRef<MCPPanelRef, MCPPanelProps>((props, ref) => {
	const { id, open } = props
	const { styles, cx } = useStyles(open)
	const { t } = useTranslation("agent")

	const { run, loading, data } = useRequest((id: string) => FlowApi.getMcp(id), {
		manual: true,
	})

	useDeepCompareEffect(() => {
		if (id) {
			run(id)
		}
	}, [id])

	useImperativeHandle(ref, () => {
		return {
			getMCP: (id: string) => {
				run(id)
			},
		}
	}, [run])

	return (
		<MagicSpin spinning={loading} size="small" className={styles.loading}>
			<div className={cx(styles.layout)}>
				<Flex align="center" gap={8} className={styles.container}>
					<MagicImage
						className={styles.icon}
						src={data?.icon}
						alt={data?.name}
						fallback={
							<div className={styles.fallback}>
								<IconMCP size="100%" />
							</div>
						}
					/>
					<div className={styles.title}>{data?.name}</div>
				</Flex>
				<div className={cx(styles.desc, styles.container)}>
					{data?.description || t("mcp.card.desc")}
				</div>

				{data?.type === MCPType.Tool && <SSEPanel key={data?.id} details={data} />}

				{[MCPType.SSE, MCPType.HTTP, MCPType.STDIO].includes(data?.type as MCPType) && (
					<HTTPPanel
						key={data?.id}
						details={data}
						onSuccessCallback={props?.onSuccessCallback}
					/>
				)}
			</div>
		</MagicSpin>
	)
})

export default MCPPanel
