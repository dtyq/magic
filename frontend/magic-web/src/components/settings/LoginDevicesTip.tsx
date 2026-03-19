import { Flex } from "antd"
import { useTheme, useThemeMode } from "antd-style"
import { useTranslation } from "react-i18next"
import { IconShieldLockFilled } from "@tabler/icons-react"
import MagicIcon from "@/components/base/MagicIcon"

export default function LoginDevicesTip() {
	const { t } = useTranslation("interface")
	const { isDarkMode } = useThemeMode()

	const { magicColorScales, magicColorUsages } = useTheme()

	return (
		<Flex
			gap={4}
			style={{
				padding: "10px 20px",
				flex: 1,
				backgroundColor: isDarkMode ? magicColorUsages.black : magicColorScales.green[0],
			}}
		>
			<MagicIcon
				component={IconShieldLockFilled}
				color={magicColorScales.green[5]}
				size={18}
				style={{ transform: "translateY(2px)" }}
			/>
			<span>{t("setting.tip.loginDevicesTip")}</span>
		</Flex>
	)
}
