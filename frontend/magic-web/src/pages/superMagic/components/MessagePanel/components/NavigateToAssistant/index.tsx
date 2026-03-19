import MagicButton from "@/components/base/MagicButton"
import MagicIcon from "@/components/base/MagicIcon"
import useNavigate from "@/routes/hooks/useNavigate"
import { IconArrowRight } from "@tabler/icons-react"
import { createStyles } from "antd-style"
import { RouteName } from "@/routes/constants"
import { useTranslation } from "react-i18next"

const useStyles = createStyles(({ token, css }) => {
	return {
		historyChatButton: css`
			background-color: ${token.magicColorUsages.white};
			color: ${token.magicColorUsages.text[1]};
			font-size: 14px;
			font-weight: 400;
			line-height: 20px;
			width: fit-content;
			gap: 4px;
		`,
	}
})

function NavigateToAssistant({
	visible,
	style,
}: {
	visible: boolean
	style?: React.CSSProperties
}) {
	const navigate = useNavigate()
	const { styles } = useStyles()
	const { t } = useTranslation("super")

	if (!visible) {
		return null
	}

	return (
		<MagicButton
			className={styles.historyChatButton}
			style={style}
			onClick={() => {
				navigate({ name: RouteName.SuperAssistant })
			}}
		>
			{t("chat.viewHistoryConversations")}
			<MagicIcon component={IconArrowRight} size={14} />
		</MagicButton>
	)
}

export default NavigateToAssistant
