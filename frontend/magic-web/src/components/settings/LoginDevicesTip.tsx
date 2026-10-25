import { useTranslation } from "react-i18next"
import { IconShieldLockFilled } from "@tabler/icons-react"
import MagicIcon from "@/components/base/MagicIcon"

export default function LoginDevicesTip() {
	const { t } = useTranslation("interface")

	return (
		<div className="flex flex-1 gap-1 bg-green-50 px-5 py-2.5 dark:bg-black">
			<MagicIcon
				component={IconShieldLockFilled}
				size={18}
				className="translate-y-0.5 fill-current text-green-500 dark:text-green-400"
			/>
			<span>{t("setting.tip.loginDevicesTip")}</span>
		</div>
	)
}
