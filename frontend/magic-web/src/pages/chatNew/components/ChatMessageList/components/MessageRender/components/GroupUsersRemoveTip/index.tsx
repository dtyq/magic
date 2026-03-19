import type { HTMLAttributes } from "react"
import { Fragment, memo } from "react"
import type { GroupUsersRemoveMessage } from "@/types/chat/control_message"
import { useTranslation } from "react-i18next"
import { useTipStyles } from "../../../../hooks/useTipStyles"
import GroupTipMemberRender from "../GroupTipMemberRender"

interface GroupUsersRemoveTipProps extends Omit<HTMLAttributes<HTMLDivElement>, "content"> {
	content?: GroupUsersRemoveMessage
}

const GroupUsersRemoveTip = memo(({ content, className, onClick }: GroupUsersRemoveTipProps) => {
	const { styles, cx } = useTipStyles()
	const { t } = useTranslation("interface")

	if (!content) {
		return null
	}

	const leaveSelf =
		content?.group_users_remove.user_ids.length === 1 &&
		content?.group_users_remove.operate_user_id === content?.group_users_remove.user_ids[0]

	if (leaveSelf) {
		return (
			<div className={cx(styles.container, className)} onClick={onClick}>
				<GroupTipMemberRender uid={content?.group_users_remove.operate_user_id} />
				{t("chat.groupUsersRemoveTip.leaveGroup")}
			</div>
		)
	}
	return (
		<div className={cx(styles.container, className)} onClick={onClick}>
			<GroupTipMemberRender uid={content?.group_users_remove.operate_user_id} />
			{t("chat.groupUsersRemoveTip.make")}
			{content?.group_users_remove.user_ids.map((id, index, array) => {
				return (
					<Fragment key={id}>
						<GroupTipMemberRender uid={id} />
						{index === array.length - 1 ? "" : "、"}
					</Fragment>
				)
			})}
			{t("chat.groupUsersRemoveTip.removeMember")}
		</div>
	)
})

export default GroupUsersRemoveTip
