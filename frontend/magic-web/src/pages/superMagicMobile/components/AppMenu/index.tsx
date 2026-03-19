import { IconInfoCircle } from "@tabler/icons-react"
import { useStyles } from "./style"
import { useTranslation } from "react-i18next"

export default function AppMenu() {
	const { styles, cx } = useStyles()
	const { t } = useTranslation("super")

	const handleOpenAbout = () => {
		window.location.href = "magic://magic.app/openwith?name=gotoAbout"
	}

	return (
		<div className={styles.container}>
			<div className={styles.title}>{t("mobile.my.aboutUs")}</div>
			<div>
				<div className={cx(styles.item)} onClick={handleOpenAbout} role="button">
					<IconInfoCircle className={styles.icon} />
					<span>{t("mobile.my.productName")}</span>
				</div>
				{/* <div className={styles.item}>
					<IconShare /> <span>分享话题</span>
				</div>
				<div className={styles.item}>
					<IconEdit className={styles.icon} /> <span>重命名</span>
				</div>
				<div className={styles.item}>
					<IconTrash className={styles.icon} /> <span>删除话题</span>
				</div> */}
			</div>
		</div>
	)
}
