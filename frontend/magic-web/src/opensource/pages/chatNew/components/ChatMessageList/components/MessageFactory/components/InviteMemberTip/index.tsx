import type { GroupAddMemberMessage } from "@/opensource/types/chat/control_message"
import { useTranslation } from "react-i18next"
import { Fragment } from "react/jsx-runtime"
import { memo, type HTMLAttributes, useEffect } from "react"
import { useTipStyles } from "../../../../hooks/useTipStyles"
import userInfoService from "@/opensource/services/userInfo"
import GroupTipMemberRender from "../../../../components/MessageRender/components/GroupTipMemberRender"

interface InviteMemberTipProps extends Omit<HTMLAttributes<HTMLDivElement>, "content"> {
	content?: GroupAddMemberMessage
}

const InviteMemberTip = memo(({ content, className, onClick }: InviteMemberTipProps) => {
	const { styles, cx } = useTipStyles()
	const { t } = useTranslation("interface")

	// 获取用户信息
	useEffect(() => {
		if (content && content?.group_users_add.user_ids) {
			userInfoService.fetchUserInfos(content.group_users_add.user_ids, 2)
		}
	}, [content])

	if (!content) {
		return null
	}

	return (
		<div className={cx(styles.container, className)} onClick={onClick}>
			<GroupTipMemberRender uid={content.group_users_add.operate_user_id} />
			{t("chat.inviteMemberTip.invite")}
			{content.group_users_add.user_ids.map?.((id, index, array) => {
				return (
					<Fragment key={id}>
						<GroupTipMemberRender uid={id} />
						{index === array.length - 1 ? "" : "、"}
					</Fragment>
				)
			})}
			{t("chat.inviteMemberTip.joinGroupConversation")}
		</div>
	)
})

export default InviteMemberTip
