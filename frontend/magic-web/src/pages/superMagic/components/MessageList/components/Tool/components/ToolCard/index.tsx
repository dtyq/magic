import { memo, useMemo } from "react"
import ToolIcon from "../ToolIcon"
import type { BaseToolProps } from "../../types"
import { useStyles } from "./styles"
import { Flex } from "antd"
import { cx } from "antd-style"
import SuperTooltip from "@/pages/superMagic/components/SuperTooltip"

interface ToolCardProps extends BaseToolProps {
	children?: React.ReactNode
	showRemark?: boolean
	suffix?: React.ReactNode
	onClick?: () => void
	cardClassName?: string
}

function ToolCard({
	identifier,
	action,
	remark,
	children,
	showRemark = true,
	suffix,
	onClick,
	cardClassName,
}: ToolCardProps) {
	const toFilterColor = useMemo(() => {
		switch (identifier) {
			case "after_init":
				return "#ff37001a"
			case "read_file":
				return "#6190E81A"
			case "thinking":
				return "#9D00FF1A"
			case "write_to_file":
				return "#4251FF1A"
			case "web_search":
			case "bing_search":
				return "#4568DC1A"
			case "browser_action":
				return "#00FF041A"
			case "finish_task":
				return "#FF00041A"
			case "python_execute":
				return "#4251FF1A"
			case "replace_in_file":
			case "edit_file":
			case "multi_edit_file":
				return "#02AAB01A"
			case "filebase_search":
				return "#FF00001A"
			case "delete_file":
				return "#FE72741A"
			case "reasoning":
				return "#FF00001A"
			case "list_dir":
				return "#F807591A"
			case "grep_search":
				return "#BC4E9C1A"
			case "shell_execute":
				return "#B06AB31A"
			case "fetch_zhihu_article_detail":
				return "#396AFC1A"
			case "fetch_xhs_note_detail":
				return "#FF416C1A"
			case "wechat_article_search":
				return "#00D1181A"
			case "visual_understanding":
				return "#7F00FF1A"
			case "use_browser":
				return "#FFB3471A"
			case "mcp_tool_call":
				return "#141E301A"
			case "audio_understanding_progress":
			case "audio_understanding":
				return "#FF00001A"
			default:
				return "#4251FF1A"
		}
	}, [identifier])

	const { styles } = useStyles({ toFilterColor })

	const remarkTooltip = useMemo(() => {
		if (typeof remark === "string") {
			return remark
		}
		return ""
	}, [remark])

	const cardContent = (
		<Flex
			className={cx(styles.toolCardWrap, {
				[styles.maxWidth]: !!children,
			})}
			align="center"
			justify="space-between"
			onClick={onClick}
			style={{ cursor: "pointer" }}
		>
			<Flex className={cx(styles.card, cardClassName)}>
				<Flex className={styles.header} align="center" gap={6}>
					<ToolIcon type={identifier} />
					<Flex className={styles.content} gap={6} align="center">
						<div className={styles.action}>{action}</div>
						{showRemark && remark && (
							<SuperTooltip title={remarkTooltip}>
								<div className={styles.remark}>{remark}</div>
							</SuperTooltip>
						)}
					</Flex>
				</Flex>
			</Flex>
			{suffix && <div className={styles.suffix}>{suffix}</div>}
			{children}
		</Flex>
	)
	return cardContent
}

export default memo(ToolCard)
