import type { GroupDisbandMessage } from "@/types/chat/control_message"
import type { HTMLAttributes } from "react"
import { memo } from "react"
import { useTranslation } from "react-i18next"
import { useTipStyles } from "../../../../hooks/useTipStyles"

interface GroupDisbandTipProps extends Omit<HTMLAttributes<HTMLDivElement>, "content"> {
	content?: GroupDisbandMessage
}

const GroupDisbandTip = memo(({ content, className, onClick }: GroupDisbandTipProps) => {
	const { t } = useTranslation("interface")
	const { styles, cx } = useTipStyles()

	if (!content) {
		return null
	}

	return (
		<div className={cx(styles.container, className)} onClick={onClick}>
			{t("chat.groupDisbandTip.disbandGroup")}
		</div>
	)
})

export default GroupDisbandTip
