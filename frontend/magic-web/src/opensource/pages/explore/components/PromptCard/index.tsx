import { Flex } from "antd"
import { memo, useMemo } from "react"
import MagicAvatar from "@/opensource/components/base/MagicAvatar"
import { FlowRouteType } from "@/opensource/types/flow"
import { useTranslation } from "react-i18next"
import DefaultAvatar from "../DefaultAvatar"
import useStyles from "./style"
import type { AvatarCard } from "./types"

interface PromptCardProps {
	/** 卡片数据 */
	data: AvatarCard
	/** 卡片类型 */
	type?: FlowRouteType
	/** 行数 */
	lineCount?: number
	/** 字体大小 */
	fontSize14?: boolean
	/** 文本间距 */
	textGap4?: boolean
	/** 卡片最小高度 */
	height?: number
	/** 标题右侧额外内容 */
	titleExtra?: React.ReactNode
	/** 点击事件 */
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
		titleExtra,
		onClick,
		...props
	}: PromptCardProps) => {
		const { t } = useTranslation("interface")

		const { id, title, icon, description } = data

		const { styles, cx } = useStyles({ img: icon as string })

		const renderTitle = useMemo(
			() => <div className={cx(styles.title, { [styles.title14]: fontSize14 })}>{title}</div>,
			[title, fontSize14, cx, styles],
		)

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
						<DefaultAvatar type={type} className={styles.defaultAvatar} size={50} />
					)}
					<Flex vertical gap={textGap4 ? 4 : 8} flex={1}>
						{titleExtra ? (
							<Flex
								justify="space-between"
								align="center"
								gap={4}
								className={styles.titleWrapper}
							>
								{renderTitle}
								{titleExtra}
							</Flex>
						) : (
							renderTitle
						)}
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
