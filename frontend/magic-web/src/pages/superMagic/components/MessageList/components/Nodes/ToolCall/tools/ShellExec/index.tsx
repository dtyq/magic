import type { NodeProps } from "../../../types"
import { useStyle } from "./styles"
import { Flex } from "antd"
import { ChevronUp, ChevronRight } from "lucide-react"
import { memo, useState } from "react"
import TerminalDisplay from "../../../../../../Detail/contents/Terminal/components/TerminalDisplay"
import { observer } from "mobx-react-lite"
import { superMagicStore } from "@/pages/superMagic/stores"
import { defaultOpen } from "../../config"
import { useToolTooltip } from "../../hooks/useToolTooltip"
import { isEmpty } from "lodash-es"
import { ToolIconBadge } from "@/pages/superMagic/components/MessageList/components/shared/ToolIconConfig"

function ShellExec(props: NodeProps) {
	const { onMouseEnter, onMouseLeave } = props
	const node = superMagicStore.getMessageNode(props?.node?.app_message_id)
	const tool = node?.tool
	const { data } = tool?.detail || {}

	const { styles, cx } = useStyle()

	const [open, setOpen] = useState(defaultOpen)

	const { tooltipProps, renderTooltip } = useToolTooltip({
		text: data?.command,
		placement: "top",
		checkOverflow: true,
	})

	const onClick = () => {
		props?.onClick?.()
	}

	return (
		<div className={styles.node} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
			<div className={cx(styles.container, { [styles.containerActive]: open })}>
				<div className={styles.nodeHeader}>
					<Flex
						className={cx(styles.tag, { [styles.tagDisabled]: isEmpty(tool?.detail) })}
						onClick={onClick}
					>
						<ToolIconBadge toolName={tool?.name} />
						<span className={cx(styles.tagLabel, "text-foreground")}>
							{tool?.action}
						</span>
						{!open && (
							<span
								{...tooltipProps}
								className={cx(styles.tip, "text-muted-foreground")}
							>
								{data?.command || ""}
							</span>
						)}
					</Flex>
					<div
						className={cx(styles.button, "mr-[6px]")}
						onClick={() => setOpen((o) => !o)}
					>
						{open ? (
							<ChevronUp
								size={16}
								className={cx(styles.buttonIcon, styles.buttonIconActive)}
							/>
						) : (
							<ChevronRight size={16} className={styles.buttonIcon} />
						)}
					</div>
				</div>
				{open && (
					<div className={styles.cardNode}>
						<TerminalDisplay
							command={data?.command || ""}
							output={data?.output || ""}
							exitCode={data?.exit_code || 0}
							className={styles.terminal}
						/>
					</div>
				)}
			</div>
			{renderTooltip()}
		</div>
	)
}

export default memo(observer(ShellExec))
