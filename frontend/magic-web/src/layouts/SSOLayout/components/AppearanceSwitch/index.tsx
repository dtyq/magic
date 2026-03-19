import MagicIcon from "@/components/base/MagicIcon"

import { IconMoon, IconSunHigh } from "@tabler/icons-react"
import { Flex } from "antd"
import { createStyles } from "antd-style"
import { useMemoizedFn } from "ahooks"
import { magic } from "@/enhance/magicElectron"
import { useTheme } from "@/models/config/hooks"

const useStyles = createStyles(({ css, isDarkMode, token }) => {
	return {
		container: css`
			position: relative;
			padding: 4px;
			border-radius: 100px;
			width: 56px;
			height: 28px;
			background: ${token.magicColorScales.grey[1]};
			cursor: pointer;
		`,
		icon: css`
			margin: 3px;
			cursor: pointer;
			color: ${isDarkMode ? token.magicColorUsages.white : token.magicColorScales.grey[8]};
			transition: color 0.3s ease;
		`,
		handler: css`
			border-radius: 100px;
			width: 20px;
			height: 20px;
			background: ${isDarkMode
				? token.magicColorScales.grey[8]
				: token.magicColorUsages.white};
			position: absolute;
			transform: translateX(${isDarkMode ? "28px" : "0"});
			transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
			box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.1);
			display: flex;
			align-items: center;
			justify-content: center;
		`,
	}
})

function AppearenceSwitch() {
	const { styles } = useStyles()

	const { prefersColorScheme, setTheme } = useTheme()

	const onThemeChange = useMemoizedFn(() => {
		setTheme(prefersColorScheme === "dark" ? "light" : "dark")
		magic?.theme?.setTheme?.(prefersColorScheme === "dark" ? "light" : "dark")
	})

	return (
		<Flex
			className={styles.container}
			align="center"
			justify="space-between"
			onClick={onThemeChange}
		>
			<MagicIcon className={styles.icon} component={IconSunHigh} size={16} />
			<MagicIcon className={styles.icon} component={IconMoon} size={16} />
			<div className={styles.handler}>
				<MagicIcon
					className={styles.icon}
					component={prefersColorScheme === "dark" ? IconMoon : IconSunHigh}
					size={14}
				/>
			</div>
		</Flex>
	)
}

export default AppearenceSwitch
