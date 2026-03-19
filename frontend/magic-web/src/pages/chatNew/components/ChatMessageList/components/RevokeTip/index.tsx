import { type HTMLAttributes } from "react"
import { useTranslation } from "react-i18next"
import { getUserName } from "@/utils/modules/chat"
import userInfoStore from "@/stores/userInfo"
import { observer } from "mobx-react-lite"
import MemberCardStore from "@/stores/display/MemberCardStore"
import { useTipStyles } from "../../hooks/useTipStyles"
import { userStore } from "@/models/user"

interface RevokeTipProps extends HTMLAttributes<HTMLDivElement> {
	senderUid: string
}

const RevokeTip = observer(({ senderUid, className, ...rest }: RevokeTipProps) => {
	const { styles, cx } = useTipStyles()
	const { t } = useTranslation("interface")

	const userId = userStore.user.userInfo?.user_id

	return (
		<div className={cx(styles.container, className)} {...rest}>
			{senderUid === userId ? (
				t("chat.you")
			) : (
				<span
					className={cx(styles.highlight, MemberCardStore.domClassName)}
					data-user-id={senderUid}
					style={{ cursor: "pointer" }}
				>
					{getUserName(senderUid ? userInfoStore.get(senderUid) : undefined)}
				</span>
			)}
			{t("chat.revoke_one_message")}
		</div>
	)
})

export default RevokeTip
