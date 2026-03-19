import MagicMemberAvatar from "@/components/business/MagicMemberAvatar"
import { MagicList } from "@/components/MagicList"
import { Col, Flex, Row, Switch, Typography } from "antd"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import conversationStore from "@/stores/chatNew/conversation"
import conversationService from "@/services/chat/conversation/ConversationService"
import { observer } from "mobx-react-lite"
import SettingListItem from "../SettingListItem"
import useStyles from "./styles"
import { useIsMobile } from "@/hooks/useIsMobile"

const NormalUserSetting = observer(() => {
	const isMobile = useIsMobile()
	const { styles } = useStyles({ isMobile })
	const { t } = useTranslation("interface")

	const { currentConversation: conversation } = conversationStore

	const members = useMemo(() => {
		return [conversation?.receive_id]
	}, [conversation])

	const topConversation = useMemoizedFn((value: boolean) => {
		if (!conversation) return
		conversationService.setTopStatus(conversation.id, value ? 1 : 0)
	})

	const notDisturbConversation = useMemoizedFn((value: boolean) => {
		if (!conversation) return
		conversationService.setNotDisturbStatus(conversation.id, value ? 1 : 0)
	})

	const listItems = useMemo(() => {
		return [
			{
				id: "topConversation",
				title: t("chat.userSetting.topConversation"),
				extra: (
					<Switch checked={Boolean(conversation?.is_top)} onChange={topConversation} />
				),
			},
			{
				id: "disturbMessage",
				title: t("chat.userSetting.disturbMessage"),
				extra: (
					<Switch
						checked={Boolean(conversation?.is_not_disturb)}
						onChange={notDisturbConversation}
					/>
				),
			},
			// {
			// 	id: "specialAttention",
			// 	title: t("chat.userSetting.specialAttention"),
			// 	extra: <Switch checked={Boolean(conversation?.is_mark)} />,
			// },
			// {
			// 	id: "aiTranslateRealTime",
			// 	title: t("chat.userSetting.aiTranslateRealTime"),
			// },
			// {
			// 	id: "groupInWhich",
			// 	title: t("chat.userSetting.GroupInWhich"),
			// },
		]
	}, [
		conversation?.is_not_disturb,
		conversation?.is_top,
		notDisturbConversation,
		t,
		topConversation,
	])

	return (
		<Flex vertical gap={10} align="start" className={styles.container}>
			<Row
				className={styles.memberSection}
				gutter={[15, 8]}
				align="middle"
				justify="start"
				style={{ margin: 0 }}
			>
				{members.map((uid) => (
					<Col key={uid} className={styles.member}>
						<MagicMemberAvatar size={45} uid={uid} showName="vertical" />
					</Col>
				))}
				{/* <Col className={styles.member}>
					<Flex vertical align="center" justify="center" gap={4}>
						<MagicButton
							className={styles.addMember}
							icon={<MagicIcon component={IconPlus} size={24} />}
							type="default"
						/>
						<AutoTooltipText maxWidth={50} className={styles.text}>
							{t("chat.userSetting.startConversation")}
						</AutoTooltipText>
					</Flex>
				</Col> */}
			</Row>
			<Typography.Text className={styles.title}>{t("chat.setting")}</Typography.Text>
			<MagicList
				gap={0}
				className={styles.list}
				items={listItems}
				listItemComponent={SettingListItem}
			/>
		</Flex>
	)
})

export default NormalUserSetting
