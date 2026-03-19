import MagicButton from "@/components/base/MagicButton"
import MagicIcon from "@/components/base/MagicIcon"
import { splitNumber } from "@/utils/number"

import { IconThumbUp, IconThumbUpFilled } from "@tabler/icons-react"
import { Flex } from "antd"
import { createStyles, cx } from "antd-style"
import { useTranslation } from "react-i18next"

interface PraiseButtonProps {
	hasPraise?: boolean
	count?: number
}

const useStyles = createStyles(({ css, isDarkMode, token }) => {
	return {
		hasPraise: {
			color: token.magicColorScales.amber[5],
		},
		count: css`
			color: ${isDarkMode ? token.magicColorScales.grey[5] : token.magicColorUsages.text[3]};

			font-size: 12px;
			font-weight: 400;
			line-height: 16px;
		`,
	}
})

function PraiseButton({ hasPraise = false, count }: PraiseButtonProps) {
	const { t } = useTranslation("interface")

	const { styles } = useStyles()

	return (
		<MagicButton
			className={cx({ [styles.hasPraise]: hasPraise })}
			justify="flex-start"
			icon={
				hasPraise ? (
					<MagicIcon component={IconThumbUpFilled} size={20} />
				) : (
					<MagicIcon component={IconThumbUp} size={20} />
				)
			}
			size="large"
			type="text"
			block
		>
			<Flex flex={1} align="center" justify="space-between">
				{hasPraise ? t("chat.floatButton.Praised") : t("chat.floatButton.Praise")}
				{count ? <span className={styles.count}>{splitNumber(count)}</span> : null}
			</Flex>
		</MagicButton>
	)
}

export default PraiseButton
