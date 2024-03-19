import { observer } from "mobx-react-lite"
import { createStyles } from "antd-style"

// Components
import { ActionSheet } from "antd-mobile"
import FlexBox from "@/opensource/components/base/FlexBox"
import MagicAvatar from "@/opensource/components/base/MagicAvatar"

// Types
import { MessageReceiveType } from "@/opensource/types/chat"

// Hooks
import { useMemo, useEffect } from "react"
import { useTranslation } from "react-i18next"

// Stores
import ConversationMenuStore, { Action } from "../../stores/ConversationMenuStore"
import GroupInfoStore from "@/opensource/stores/groupInfo"
import UserInfoStore from "@/opensource/stores/userInfo"

import { getUserJobTitle, getUserName } from "@/opensource/utils/modules/chat"
import DepartmentRender from "@/opensource/components/business/DepartmentRender"
import { useMemoizedFn } from "ahooks"
import ConversationService from "@/opensource/services/chat/conversation/ConversationService"
import { autorun } from "mobx"
import OrganizationRender from "@/opensource/components/business/OrganizationRender"

const useStyles = createStyles(({ css, token }) => ({
	userDetails: css`
		flex: 1;
		align-items: flex-start;
	`,
	userName: css`
		color: ${token.magicColorUsages.text[0]};
		text-align: center;

		font-size: 14px;
		font-style: normal;
		font-weight: 600;
		line-height: 20px;
	`,
	userCompany: css`
		color: ${token.magicColorUsages.text[3]};
		font-size: 12px;
		font-style: normal;
		font-weight: 400;
		line-height: 16px;
	`,
	actionSheetPopup: css`
		--adm-color-background: ${token.magicColorUsages.bg[0]};
		--adm-color-border: ${token.magicColorUsages.border};
	`,
	actionSheet: css`
		.adm-action-sheet-button-item {
			padding: 15px 20px;
		}

		.adm-action-sheet-button-item-danger {
			color: ${token.magicColorUsages.danger.default};
		}

		.adm-action-sheet-button-item-name {
			color: ${token.magicColorUsages.text[0]};
			font-size: 14px;
			font-style: normal;
			font-weight: 400;
			line-height: 20px;
		}

		.adm-action-sheet-extra {
			padding: 12px;
			justify-content: flex-start;
		}

		.adm-action-sheet-cancel {
			background-color: transparent;
			padding-top: 0;

			.adm-action-sheet-button-item {
				border-radius: 8px;
				background: ${token.magicColorUsages.fill[0]};
				color: ${token.magicColorUsages.text[1]};
				margin: 12px;
				padding: 11px 20px;
				font-size: 14px;
				font-style: normal;
				font-weight: 400;
				line-height: 20px;
			}
		}
	`,
}))

const ConversationMenu = observer(() => {
	const { styles } = useStyles()
	const { t } = useTranslation("interface")
	const { open, actions, closeMenu, receiveType, receiveId, conversationId, conversation } =
		ConversationMenuStore

	// Update menu with i18n texts when conversation or language changes
	useEffect(() => {
		if (conversation && open) {
			ConversationMenuStore.setMenu(conversation)
		}
	}, [conversation, open])

	useEffect(() => {
		return autorun(() => {
			if (conversation) ConversationMenuStore.setMenu(conversation)
		})
	}, [conversation])

	const onAction = useMemoizedFn((action) => {
		if (!conversationId) return
		switch (action.key) {
			case Action.Pin:
				ConversationService.setTopStatus(conversationId, 1)
				closeMenu()
				break
			case Action.Unpin:
				ConversationService.setTopStatus(conversationId, 0)
				closeMenu()
				break
			case Action.Delete:
				ConversationService.deleteConversation(conversationId)
				closeMenu()
				break
			case Action.Unmute:
				ConversationService.setNotDisturbStatus(conversationId, 0)
				break
			case Action.Mute:
				ConversationService.setNotDisturbStatus(conversationId, 1)
				break
			default:
				break
		}
	})

	const UserHeader = useMemo(() => {
		switch (receiveType) {
			case MessageReceiveType.User:
				const userInfo = UserInfoStore.get(receiveId)
				const userAvatar = userInfo?.avatar_url
				const userName = getUserName(userInfo)
				const departmentName = userInfo?.path_nodes[0]?.path
				const jobTitle = getUserJobTitle(userInfo)
				return (
					<FlexBox align="center" gap={6}>
						<MagicAvatar size={40} style={{ borderRadius: 4 }} src={userAvatar}>
							{userName}
						</MagicAvatar>
						<FlexBox vertical className={styles.userDetails} justify="center">
							<div className={styles.userName}>{userName}</div>
							<div className={styles.userCompany}>
								<DepartmentRender path={departmentName} />
								{jobTitle && ` | ${jobTitle}`}
							</div>
						</FlexBox>
					</FlexBox>
				)
			case MessageReceiveType.Ai:
				const aiInfo = UserInfoStore.get(receiveId)
				const aiAvatar = aiInfo?.avatar_url
				const aiName = getUserName(aiInfo)
				return (
					<FlexBox align="center" gap={6}>
						<MagicAvatar size={40} style={{ borderRadius: 4 }} src={aiAvatar}>
							{aiInfo?.nickname}
						</MagicAvatar>
						<FlexBox vertical className={styles.userDetails} justify="center">
							<div className={styles.userName}>{aiName}</div>
							<div className={styles.userCompany}>{t("sider.aiAssistant")}</div>
						</FlexBox>
					</FlexBox>
				)
			case MessageReceiveType.Group:
				const groupInfo = GroupInfoStore.get(receiveId)
				const groupName = groupInfo?.group_name
				return (
					<FlexBox align="center" gap={6}>
						<MagicAvatar size={40} style={{ borderRadius: 4 }}>
							{groupName}
						</MagicAvatar>
						<FlexBox vertical className={styles.userDetails} justify="center">
							<div className={styles.userName}>{groupName}</div>
							<div className={styles.userCompany}>
								{t("chat.groupSetting.belongsTo")}{" "}
								<OrganizationRender
									organizationCode={groupInfo?.organization_code}
								/>
							</div>
						</FlexBox>
					</FlexBox>
				)
			default:
				return null
		}
	}, [receiveId, receiveType, styles.userCompany, styles.userDetails, styles.userName, t])

	return (
		<ActionSheet
			popupClassName={styles.actionSheetPopup}
			className={styles.actionSheet}
			extra={UserHeader}
			visible={open}
			actions={actions}
			onAction={onAction}
			cancelText={t("button.cancel")}
			onClose={() => closeMenu()}
		/>
	)
})

export default ConversationMenu
