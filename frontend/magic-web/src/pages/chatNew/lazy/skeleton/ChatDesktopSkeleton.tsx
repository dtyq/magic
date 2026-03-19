import Flex from "@/components/base/FlexBox"
import { ChatDomId } from "../../constants"
import { createStyles } from "antd-style"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useTranslation } from "react-i18next"
import { MagicSpin } from "@/components/base"

const useStyles = createStyles(({ css, token, prefixCls }) => {
	return {
		chat: css`
			width: 100%;
			height: 100%;
			background: ${token.magicColorScales.grey[0]};
		`,
		left: css`
			width: 240px;
			height: 100%;
			background: ${token.magicColorUsages.bg[0]};
			border-right: 1px solid ${token.colorBorder};
		`,
		right: css`
			flex: 1;
			height: 100%;
			background: ${token.magicColorScales.grey[0]};
		`,
		spin: css`
			.${prefixCls}-spin-blur {
				opacity: 1;
			}

			& > div > .${prefixCls}-spin {
				--${prefixCls}-spin-content-height: unset;
				max-height: unset;
			}
		`,
	}
})

function ChatDesktopSkeleton() {
	const { styles } = useStyles()
	const isMobile = useIsMobile()
	const { t } = useTranslation("interface")

	if (isMobile) {
		return (
			<MagicSpin spinning tip={t("spin.loadingConfig")} wrapperClassName={styles.spin}>
				<div style={{ height: "100vh" }} />
			</MagicSpin>
		)
	}

	return (
		<Flex flex={1} className={styles.chat} id={ChatDomId.ChatContainer}>
			<div className={styles.left} />
			<div className={styles.right} />
		</Flex>
	)
}

export default ChatDesktopSkeleton
