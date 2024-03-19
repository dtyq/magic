import EmptyConversationFallbackImage from "./image"
import { Flex } from "antd"
import { useTranslation } from "react-i18next"
import { createStyles } from "antd-style"
import MagicButton from "@/opensource/components/base/MagicButton"
import useNavigate from "@/opensource/routes/hooks/useNavigate"
import { useMemoizedFn } from "ahooks"
import { userStore } from "@/opensource/models/user"
import { observer } from "mobx-react-lite"
import { RouteName } from "@/opensource/routes/constants"

const useStyles = createStyles(({ token, css }) => {
	return {
		emptyFallback: css`
			width: 100%;
			height: 100%;
			background-color: ${token.magicColorUsages.bg[0]};
		`,
		emptyFallbackText: css`
			color: ${token.magicColorUsages.text[3]};
			text-align: center;
			font-size: 14px;
			font-weight: 400;
			line-height: 20px;
		`,
	}
})

const EmptyConversationFallback = observer(() => {
	const { styles } = useStyles()
	const { t } = useTranslation("interface")
	const navigate = useNavigate()
	const { isPersonalOrganization } = userStore.user

	const navigateToContacts = useMemoizedFn(() => {
		navigate({
			name: RouteName.ContactsOrganization,
		})
	})

	return (
		<Flex vertical gap={4} align="center" justify="center" className={styles.emptyFallback}>
			{EmptyConversationFallbackImage}
			<div className={styles.emptyFallbackText}>
				{t("chat.emptyConversationFallbackText")}
			</div>
			{!isPersonalOrganization && (
				<MagicButton type="primary" style={{ marginTop: 10 }} onClick={navigateToContacts}>
					{t("chat.emptyConversationFallbackButtonText")}
				</MagicButton>
			)}
		</Flex>
	)
})

export default EmptyConversationFallback
