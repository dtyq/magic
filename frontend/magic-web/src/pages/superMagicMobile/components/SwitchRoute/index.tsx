import { IconBrain, IconLayoutGrid } from "@tabler/icons-react"
import { memo } from "react"
import { useTranslation } from "react-i18next"
import { useStyles } from "./style"
import { openLongTremMemoryModal } from "@/pages/superMagic/components/LongTremMemory"
import routeManageService from "@/pages/superMagic/services/routeManageService"

export default memo(function SwitchRoute() {
	const { styles, cx } = useStyles()
	const { t } = useTranslation("super")

	/** 打开长期记忆 */
	const handleLongMemoryClick = () => {
		openLongTremMemoryModal({ onWorkspaceStateChange: routeManageService.navigateToState })
	}

	return (
		<div className={styles.container}>
			<div className={styles.title}>{t("ui.navigation")}</div>
			<div className={styles.routeContainer}>
				<div className={cx(styles.item, styles.itemActive)}>
					<IconLayoutGrid className={styles.icon} />
					<div>{t("workspace.workspace")}</div>
				</div>
				<div className={cx(styles.item)} onClick={handleLongMemoryClick}>
					<IconBrain className={styles.icon} />
					<div>
						{t("longMemory", {
							ns: "super/longMemory",
						})}
					</div>
				</div>
				{/* <div className={styles.item}>
                    <IconLayoutGrid /> <span>归档</span>
                </div>
                <div className={styles.item}>
                    <IconLayoutGrid /> <span>快捷访问</span>
                </div> */}
			</div>
		</div>
	)
})
