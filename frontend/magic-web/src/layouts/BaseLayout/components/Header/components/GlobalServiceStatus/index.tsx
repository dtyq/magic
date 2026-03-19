import MagicIcon from "@/components/base/MagicIcon"
import { interfaceStore } from "@/stores/interface"
import { IconWifiOff, IconLoader2 } from "@tabler/icons-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { useStyles } from "./styles"
import { useInterval, useNetwork } from "ahooks"
import { useState } from "react"
import { GlobalApi } from "@/apis"

function GlobalServiceStatus() {
	const { t } = useTranslation("interface")
	const { styles } = useStyles()
	const isWebSocketConnecting = interfaceStore.isConnecting
	const showReloadButton = interfaceStore.showReloadButton

	const { online } = useNetwork()

	const [isServiceMaintenance, setIsServiceMaintenance] = useState(false)
	const [maintenanceDescription, setMaintenanceDescription] = useState("")

	// 初始化在全局接口中获取，这里不需要了
	// useMount(() => {
	// 	GlobalApi.getGlobalConfig().then((res) => {
	// 		setIsServiceMaintenance(res.is_maintenance)
	// 		setMaintenanceDescription(res.maintenance_description)
	// 	})
	// })

	useInterval(
		() => {
			GlobalApi.getGlobalConfig().then((res) => {
				setIsServiceMaintenance(res.is_maintenance)
				setMaintenanceDescription(res.maintenance_description)
			})
		},
		// 2 minutes
		1000 * 60 * 2,
	)

	// Network offline status has highest priority
	if (!online || showReloadButton) {
		return (
			<div className={styles.offlineContainer} onClick={() => window.location.reload()}>
				<MagicIcon
					component={IconWifiOff}
					size={16}
					color="currentColor"
					className={styles.offlineIcon}
				/>
				<span className={styles.offlineText}>
					{t("globalServiceStatus.networkOffline")}
				</span>
			</div>
		)
	}

	if (isServiceMaintenance) {
		return (
			<div className={styles.container}>
				<div className={styles.statusDot} />
				<span className={styles.statusText}>
					{maintenanceDescription || t("globalServiceStatus.serviceMaintenance")}
				</span>
			</div>
		)
	}

	// WebSocket connecting status
	if (isWebSocketConnecting) {
		return (
			<div className={styles.connectingContainer}>
				<MagicIcon
					component={IconLoader2}
					size={16}
					color="currentColor"
					className={styles.connectingIcon}
				/>
				<span className={styles.connectingText}>
					{t("globalServiceStatus.networkConnecting")}
				</span>
			</div>
		)
	}

	return null
}

export default observer(GlobalServiceStatus)
