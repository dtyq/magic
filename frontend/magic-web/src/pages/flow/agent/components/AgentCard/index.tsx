import { Flex, Switch, Tag } from "antd"
import { IconCircleCheckFilled, IconAlertCircleFilled } from "@tabler/icons-react"
import type { Bot } from "@/types/bot"
import PromptCard from "@/pages/explore/components/PromptCard"
import { memo, useEffect, useState } from "react"
import { useMemoizedFn } from "ahooks"
import OperateMenu from "@/pages/flow/components/OperateMenu"
import { useTranslation } from "react-i18next"
import { hasEditRight } from "@/pages/flow/components/AuthControlButton/types"
import { colorScales } from "@/providers/ThemeProvider/colors"
import { BotApi } from "@/apis"
import { EntrepriseStatus, Status } from "../../constants"
import { useStyles } from "./styles"
import magicToast from "@/components/base/MagicToaster/utils"

interface AgentCardProps {
	card: Bot.BotItem
	onCardClick: (id: string) => void
	dropdownItems?: React.ReactNode
}

function Card({ card, dropdownItems, onCardClick }: AgentCardProps) {
	const { styles, cx } = useStyles()

	const { t } = useTranslation("interface")
	const { t: globalT } = useTranslation()

	const [enable, setEnable] = useState(false)

	const updateAgentEnable = useMemoizedFn(async (value, event) => {
		event.stopPropagation()
		setEnable(value)
		await BotApi.updateBotStatus(card.id, value ? Status.enable : Status.disable)
		const text = value
			? globalT("common.enabled", { ns: "flow" })
			: globalT("common.baned", { ns: "flow" })
		magicToast.success(`${card.robot_name} ${text}`)
	})

	useEffect(() => {
		if (card) {
			setEnable(card.status === Status.enable)
		}
	}, [card])

	const getTags = useMemoizedFn((status) => {
		switch (status) {
			case EntrepriseStatus.unrelease:
				return (
					<Tag
						icon={<IconAlertCircleFilled size={12} color={colorScales.orange[5]} />}
						className={cx(styles.tag, styles.orange)}
					>
						{t("agent.unPublishAgentTip")}
					</Tag>
				)
			case EntrepriseStatus.release:
				return (
					<Tag
						icon={<IconCircleCheckFilled size={12} />}
						className={cx(styles.tag, styles.green)}
					>
						{t("agent.publishToEnterprise")}
					</Tag>
				)
			default:
				// return <Tag icon={<IconClockFilled size={12} color={token.magicColorUsages.primary.default} />} className={cx(styles.tag, styles.blue)}>企业内部审批中</Tag>
				break
		}
		return null
	})

	return (
		<Flex
			vertical
			className={styles.cardWrapper}
			gap={8}
			onClick={() => onCardClick(card.id)}
			justify="space-between"
		>
			<PromptCard
				data={{
					id: card.id,
					title: card.robot_name,
					icon: card.robot_avatar,
					description: card.robot_description,
					user_operation: card.user_operation,
				}}
				lineCount={2}
				height={64}
				titleExtra={
					hasEditRight(card.user_operation) && (
						<OperateMenu menuItems={dropdownItems} useIcon />
					)
				}
			/>
			<Flex justify="space-between" align="center" className={styles.statusWrapper}>
				{card.bot_version && (
					<Flex gap={4} align="center">
						{getTags(card.bot_version.enterprise_release_status)}
					</Flex>
				)}
				{hasEditRight(card.user_operation) && (
					<Flex gap={8} align="center" style={{ marginLeft: "auto" }}>
						{t("agent.status")}
						<Switch checked={enable} onChange={updateAgentEnable} size="small" />
					</Flex>
				)}
			</Flex>
			<span>{`${t("agent.createTo")} ${card.created_at?.replace(/-/g, "/")}`}</span>
		</Flex>
	)
}

const AgentCard = memo(function AgentCard(props: AgentCardProps) {
	return (
		<OperateMenu
			trigger="contextMenu"
			placement="right"
			menuItems={hasEditRight(props.card.user_operation) && props.dropdownItems}
			key={props.card.id}
		>
			<Card {...props} />
		</OperateMenu>
	)
})

export default AgentCard
