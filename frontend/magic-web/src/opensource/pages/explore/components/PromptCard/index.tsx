import { Flex } from "antd"
import { memo, useMemo } from "react"
import MagicAvatar from "@/opensource/components/base/MagicAvatar"
import defaultFlowAvatar from "@/assets/logos/flow-avatar.png"
import defaultToolAvatar from "@/assets/logos/tool-avatar.png"
import defaultAgentAvatar from "@/assets/logos/agent-avatar.jpg"
import defaultMCPAvatar from "@/assets/logos/mcp.png"
import defaultKnowledgeAvatar from "@/assets/logos/knowledge-avatar.png"
import { FlowRouteType } from "@/types/flow"
import { useTranslation } from "react-i18next"
import useStyles from "./style"
import type { AvatarCard } from "./types"

interface PromptCardProps {
	data: AvatarCard
	type?: FlowRouteType
	lineCount?: number
	fontSize14?: boolean
	textGap4?: boolean
	height?: number
	onClick?: (id: string) => void
}

const PromptCard = memo(
	({
		data,
		type,
		textGap4 = false,
		lineCount = 1,
		fontSize14 = false,
		height = 40,
		onClick,
		...props
	}: PromptCardProps) => {
		const { t } = useTranslation("interface")

		const { id, title, icon, description } = data

		const { styles, cx } = useStyles({ img: icon as string })

		const defaultAvatar = useMemo(() => {
			switch (type) {
				case FlowRouteType.Sub:
					return <img src={defaultFlowAvatar} className={styles.defaultAvatar} alt="" />
				case FlowRouteType.Tools:
					return <img src={defaultToolAvatar} className={styles.defaultAvatar} alt="" />
				case FlowRouteType.VectorKnowledge:
					return (
						<img src={defaultKnowledgeAvatar} className={styles.defaultAvatar} alt="" />
					)
				case FlowRouteType.Mcp:
					return <img src={defaultMCPAvatar} className={styles.defaultAvatar} alt="" />
				default:
					return <img src={defaultAgentAvatar} className={styles.defaultAvatar} alt="" />
			}
		}, [type, styles])

		return (
			<Flex
				vertical
				className={styles.container}
				onClick={() => onClick?.(id ?? "")}
				{...props}
			>
				<Flex
					gap={10}
					style={{ minHeight: height }}
					align={height === 40 ? "center" : "flex-start"}
				>
					{icon ? (
						<MagicAvatar style={{ borderRadius: 8 }} src={icon} size={50}>
							{title}
						</MagicAvatar>
					) : (
						defaultAvatar
					)}
					<Flex vertical gap={textGap4 ? 4 : 8} flex={1}>
						<div className={cx(styles.title, { [styles.title14]: fontSize14 })}>
							{title}
						</div>
						<div
							className={cx(styles.description, {
								[styles.lineClamp2]: lineCount === 2,
							})}
						>
							{description || t("explore.noDescription")}
						</div>
					</Flex>
				</Flex>
			</Flex>
		)
	},
)

export default PromptCard
