import { memo } from "react"

import type { GroupCreateMessage } from "@/types/chat/control_message"
import type { HTMLAttributes } from "react"
import { useTranslation } from "react-i18next"
import { useTipStyles } from "../../../../hooks/useTipStyles"
import GroupTipMemberRender from "../GroupTipMemberRender"

interface GroupCreateTipProps extends Omit<HTMLAttributes<HTMLDivElement>, "content"> {
	content?: GroupCreateMessage
}

const GroupCreateTip = memo(({ content, className, onClick }: GroupCreateTipProps) => {
	const { styles, cx } = useTipStyles()
	const { t } = useTranslation("interface")

	if (!content) {
		return null
	}

	return (
		<div className={cx(styles.container, className)} onClick={onClick}>
			<GroupTipMemberRender uid={content?.group_create.group_owner_id} />
			{t("chat.groupCreateTip.createGroup")}
		</div>
	)
})

export default GroupCreateTip
