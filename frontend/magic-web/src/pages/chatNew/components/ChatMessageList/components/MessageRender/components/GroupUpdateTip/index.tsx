import type { HTMLAttributes } from "react"
import { memo } from "react"
import type { GroupUpdateMessage } from "@/types/chat/control_message"
import { useTranslation } from "react-i18next"
import { useTipStyles } from "../../../../hooks/useTipStyles"
import GroupTipMemberRender from "../GroupTipMemberRender"

interface GroupUpdateTipProps extends Omit<HTMLAttributes<HTMLDivElement>, "content"> {
	content?: GroupUpdateMessage
}

const GroupUpdateTip = memo((props: GroupUpdateTipProps) => {
	const { content, className, onClick } = props
	const { styles, cx } = useTipStyles()
	const { t } = useTranslation("interface")

	if (!content) {
		return null
	}

	return (
		<div className={cx(styles.container, className)} onClick={onClick}>
			<GroupTipMemberRender uid={content?.group_update.operate_user_id} />
			{content?.group_update.group_name &&
				`${t("chat.groupUpdateTip.updateGroupName")}${content?.group_update.group_name}`}
			{content?.group_update.group_avatar && `${t("chat.groupUpdateTip.updateGroupAvatar")}`}
		</div>
	)
})

export default GroupUpdateTip
