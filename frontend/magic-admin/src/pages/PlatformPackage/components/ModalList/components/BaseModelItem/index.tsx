import type { PropsWithChildren } from "react"
import { memo, useMemo } from "react"
import { Flex, Tag, Tooltip, Popover } from "antd"
import { IconTools, IconEyeSpark, IconTopologyStarRing3, IconStars } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { MagicAvatar } from "components"
import type { AiManage } from "@/types/aiManage"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useStyles } from "./styles"

interface ModelItemProps extends PropsWithChildren {
	item: AiManage.ModelInfo
	isLLM: boolean
	showDescription?: boolean
	showModelId?: boolean
	avatarConfig?: {
		shape?: "circle" | "square"
		size?: number
	}
	className?: string
	onClick?: () => void
}
const BaseModelItem = ({
	item,
	isLLM,
	showDescription = true,
	showModelId = false,
	avatarConfig,
	className,
	children,
	onClick,
}: ModelItemProps) => {
	const isMobile = useIsMobile()
	const { t } = useTranslation("admin/ai/model")
	const { styles, cx } = useStyles({ isMobile })

	// 计算模型能力
	const capabilities = useMemo(() => {
		const caps = []
		if (item.config.max_tokens > 0) {
			caps.push({
				key: "maxTokens",
				icon: "",
				label: `${
					item.config.max_tokens < 1000
						? item.config.max_tokens
						: Math.round(item.config.max_tokens / 1000)
				}K`,
			})
		}
		if (item.config.support_function) {
			caps.push({
				key: "function",
				icon: <IconTools size={14} />,
				label: t("form.supportTool"),
			})
		}
		if (item.config.support_multi_modal) {
			caps.push({
				key: "multiModal",
				icon: <IconEyeSpark size={14} />,
				label: t("form.supportVision"),
			})
		}
		if (item.config.support_deep_think) {
			caps.push({
				key: "deepThink",
				icon: <IconTopologyStarRing3 size={14} />,
				label: t("form.supportThink"),
			})
		}
		return caps
	}, [item.config, t])

	return (
		<Flex
			className={cx(styles.listItem, className)}
			justify="space-between"
			align="center"
			key={item.id}
			gap={10}
			onClick={onClick}
		>
			<Flex
				gap={isMobile ? 6 : 10}
				align="center"
				justify="flex-start"
				className={styles.modelInfo}
			>
				<MagicAvatar
					shape={avatarConfig?.shape || "circle"}
					src={item.icon}
					size={avatarConfig?.size || isMobile ? 16 : 24}
				>
					{item.name}
				</MagicAvatar>
				<Tooltip title={isMobile ? item.name : undefined}>
					<div className={styles.title}>{item.name || item.model_version}</div>
				</Tooltip>
				{showModelId && (
					<div className={styles.description}>( Model ID: {item.model_id} )</div>
				)}
				{!isMobile && showDescription && (
					<div className={styles.description}>{item.description}</div>
				)}
				{isLLM &&
					(isMobile && capabilities.length > 0 ? (
						<Popover
							trigger="click"
							placement="bottom"
							style={{ minWidth: "unset" }}
							content={
								<Flex vertical gap={8} style={{ minWidth: 120 }}>
									{capabilities.map((cap) => (
										<Tag className={styles.tag} key={cap.key}>
											{cap.key === "maxTokens" ? cap.label : cap.icon}
										</Tag>
									))}
								</Flex>
							}
						>
							<Tag className={styles.tag} style={{ cursor: "pointer" }}>
								<IconStars size={14} />
								<span style={{ marginLeft: 2 }}>+{capabilities.length}</span>
							</Tag>
						</Popover>
					) : (
						<Flex gap={4}>
							{capabilities.map((cap) => (
								<Tag className={styles.tag} key={cap.key}>
									{cap.key === "maxTokens" ? cap.label : cap.icon}
								</Tag>
							))}
						</Flex>
					))}
			</Flex>
			{children}
		</Flex>
	)
}

export default memo(BaseModelItem)
