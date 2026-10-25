import MagicIcon from "@/components/base/MagicIcon"

import { IconMoon, IconSunHigh } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { magic } from "@/enhance/magicElectron"
import { IS_DARK_MODE_DISABLED } from "@/constants/theme"
import { useTheme } from "@/models/config/hooks"

const iconClassName =
	"m-[3px] cursor-pointer text-neutral-800 transition-colors duration-300 ease-[ease] dark:text-white"

function AppearenceSwitch() {
	const { t } = useTranslation("interface")

	const { prefersColorScheme, setTheme } = useTheme()

	const onThemeChange = useMemoizedFn(() => {
		if (IS_DARK_MODE_DISABLED) return
		setTheme(prefersColorScheme === "dark" ? "light" : "dark")
		magic?.theme?.setTheme?.(prefersColorScheme === "dark" ? "light" : "dark")
	})

	return (
		<button
			type="button"
			role="switch"
			aria-checked={prefersColorScheme === "dark"}
			aria-label={t("setting.appearance")}
			className="relative flex h-7 w-14 cursor-pointer items-center justify-between rounded-[100px] border-0 bg-neutral-100 p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring dark:bg-neutral-800"
			onClick={onThemeChange}
		>
			<MagicIcon className={iconClassName} component={IconSunHigh} size={16} />
			<MagicIcon className={iconClassName} component={IconMoon} size={16} />
			<div className="absolute flex size-5 translate-x-0 items-center justify-center rounded-[100px] bg-white shadow-[0_2px_8px_0_rgba(0,0,0,0.1)] transition-all duration-300 ease-in-out dark:translate-x-7 dark:bg-neutral-100">
				<MagicIcon
					className={iconClassName}
					component={prefersColorScheme === "dark" ? IconMoon : IconSunHigh}
					size={14}
				/>
			</div>
		</button>
	)
}

export default AppearenceSwitch
