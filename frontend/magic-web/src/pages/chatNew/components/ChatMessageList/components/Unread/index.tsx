import { createStyles } from "antd-style"
import { Flex } from "antd"
import { useTranslation } from "react-i18next"

import { IconEye, IconEyeCheck } from "@tabler/icons-react"
import { memo } from "react"
import { calculateRelativeSize } from "@/utils/styles"
import MagicIcon from "@/components/base/MagicIcon"
import { colorUsages } from "@/providers/ThemeProvider/colors"
import { useFontSize } from "@/providers/AppearanceProvider/hooks"

const useUnreadStyles = createStyles(
	({ css, isDarkMode, token }, { fontSize }: { fontSize: number }) => {
		return {
			text: css`
				color: ${isDarkMode
					? token.magicColorScales.grey[6]
					: token.magicColorUsages.text[3]};
				text-align: justify;
				font-size: ${calculateRelativeSize(12, fontSize)}px;
				font-weight: 400;
				line-height: ${calculateRelativeSize(16, fontSize)}px;
			`,
		}
	},
)

const Unread = memo(
	({ status = false }: { status?: boolean }) => {
		const { t } = useTranslation("interface")

		const { fontSize } = useFontSize()
		const { styles } = useUnreadStyles({ fontSize })
		return (
			<Flex
				className={styles.text}
				align="center"
				gap={calculateRelativeSize(2, fontSize)}
				justify="center"
			>
				{status ? (
					<>
						<MagicIcon
							component={IconEye}
							size={calculateRelativeSize(16, fontSize)}
							color={colorUsages.text[2]}
						/>
						{t("chat.unread")}
					</>
				) : (
					<>
						<MagicIcon
							component={IconEyeCheck}
							size={calculateRelativeSize(16, fontSize)}
							color={colorUsages.text[2]}
						/>
						{t("chat.read")}
					</>
				)}{" "}
			</Flex>
		)
	},
	(prevProps, nextProps) => {
		return prevProps.status === nextProps.status
	},
)

export default Unread
