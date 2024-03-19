import MagicIcon from "@/opensource/components/base/MagicIcon"
import { IconWifi, IconWifiOff } from "@tabler/icons-react"
import { useNetwork, useUpdateEffect } from "ahooks"
import { memo, useRef } from "react"
import { useTranslation } from "react-i18next"
import { colorScales } from "@/opensource/providers/ThemeProvider/colors"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

const networkTipKey = "networkTip"

const NetworkTip = memo(() => {
	const { t } = useTranslation("interface")
	const { online } = useNetwork()
	const ref = useRef<string | number | null>(null)

	useUpdateEffect(() => {
		if (!online) {
			ref.current = magicToast.error({
				icon: <MagicIcon component={IconWifiOff} color={colorScales.red[4]} />,
				content: t("networkTip.offline"),
				duration: 0,
				key: networkTipKey,
				onClose: () => {
					ref.current = null
				},
			})
		} else if (ref.current) {
			magicToast.success({
				icon: <MagicIcon component={IconWifi} color={colorScales.green[5]} />,
				content: t("networkTip.online"),
				duration: 3000,
				key: networkTipKey,
				onClose: () => {
					ref.current = null
				},
			})
		}
	}, [online, t])

	return null
})

export default NetworkTip
