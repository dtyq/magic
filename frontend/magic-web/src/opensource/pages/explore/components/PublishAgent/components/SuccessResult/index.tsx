import { memo } from "react"
import { Flex } from "antd"
import { useTranslation } from "react-i18next"
import MagicButton from "@/opensource/components/base/MagicButton"
import { useStyles } from "./style"

interface SuccessResultProps {
	selectIcon: string
	handleConversation: () => void
	handleCancel: () => void
}

const SuccessResult = memo(
	({ selectIcon, handleConversation, handleCancel }: SuccessResultProps) => {
		const { t } = useTranslation("interface")
		const { styles, cx } = useStyles()

		return (
			<Flex vertical gap={10} align="center" className={styles.successContainer}>
				<img alt="" src={selectIcon} />
				<Flex align="center" gap={4} vertical className={styles.successText}>
					<div className={styles.successTitle}>
						{t("sider.aiAssistants")}
						{t("explore.form.publishSuccess")}
					</div>
					<div>{t("explore.form.conversationTip")}</div>
				</Flex>
				<MagicButton type="primary" className={styles.button} onClick={handleConversation}>
					{t("explore.buttonText.conversationAssistant")}
				</MagicButton>
				<MagicButton
					className={cx(styles.button, styles.defaultButton)}
					onClick={handleCancel}
				>
					{t("button.close")}
				</MagicButton>
			</Flex>
		)
	},
)

export default SuccessResult
