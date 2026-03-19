import type { NodeProps } from "../../../types"
import { Flex } from "antd"
import { memo, useMemo } from "react"
import { MonitorPlay } from "lucide-react"
import { useStyle } from "./styles"
import { observer } from "mobx-react-lite"
import { superMagicStore } from "@/pages/superMagic/stores"
import { isEmpty } from "lodash-es"
import { ToolIconBadge } from "@/pages/superMagic/components/MessageList/components/shared/ToolIconConfig"
import { VerticalLine } from "@/components/base"
import MagicEllipseWithTooltip from "@/components/base/MagicEllipseWithTooltip/MagicEllipseWithTooltip"

function WebSearch(props: NodeProps) {
	const { onMouseEnter, onMouseLeave } = props
	const node = superMagicStore.getMessageNode(props?.node?.app_message_id)
	const tool = node?.tool
	const { data } = tool?.detail || {}
	const tabs = data?.groups || []

	const { styles, cx } = useStyle()

	const keywordsText = useMemo(() => {
		if (tabs.length > 0) {
			return tabs.map((o: any) => o.keyword).join(", ")
		}
		return ""
	}, [tabs])

	const onClick = () => {
		if (tool.status !== "error") {
			props?.onClick?.()
		}
	}

	const showSuffix = tool.status !== "error" && !isEmpty(tool?.detail)

	return (
		<div className={styles.node} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
			<div className={styles.container}>
				<div className={styles.nodeHeader}>
					<Flex
						className={cx(
							styles.tag,
							{ [styles.tagDisabled]: isEmpty(tool?.detail) },
							{ "pr-[6px] rounded-r-none": showSuffix },
						)}
						onClick={onClick}
					>
						<ToolIconBadge toolName={tool?.name} />
						<span className={cx(styles.tagLabel, "text-foreground")}>
							{tool?.action}
						</span>
						<MagicEllipseWithTooltip
							className={cx(styles.remark, "text-muted-foreground")}
							text={keywordsText}
						/>
					</Flex>
					{showSuffix && (
						<>
							<VerticalLine height={28} className="text-input" />
							<div className={cx(styles.button)} onClick={onClick}>
								<MonitorPlay size={16} className="text-foreground" />
							</div>
						</>
					)}
				</div>
			</div>
		</div>
	)
}

export default memo(observer(WebSearch))
