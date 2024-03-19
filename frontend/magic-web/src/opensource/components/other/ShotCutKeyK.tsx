import { createStyles, cx } from "antd-style"
import type { HTMLAttributes } from "react"

const useStyles = createStyles(
	(
		{ isDarkMode, token },
		{
			fontSize,
		}: {
			fontSize: number
		},
	) => {
		return {
			shotcutKey: {
				borderRadius: 4,
				padding: "2px 4px",
				fontSize,
				fontWeight: 400,
				lineHeight: "16px",
				border: `1px solid ${token.colorBorder}`,
				color: isDarkMode ? token.magicColorScales.grey[4] : token.magicColorUsages.text[3],
				backgroundColor: token.magicColorUsages.nav.bg,
				// background: isDarkMode
				// 	? token.magicColorScales.grey[6]
				// 	: token.magicColorUsages.white,
			},
		}
	},
)

interface ShotCutKeyKProps extends HTMLAttributes<HTMLSpanElement> {
	size?: number
}

function ShotCutKeyK({ size = 12, className, ...props }: ShotCutKeyKProps) {
	const { styles } = useStyles({ fontSize: size })

	// useKeyPress()

	return (
		<span className={cx(styles.shotcutKey, className)} {...props}>
			⌘ K
		</span>
	)
}

export default ShotCutKeyK
