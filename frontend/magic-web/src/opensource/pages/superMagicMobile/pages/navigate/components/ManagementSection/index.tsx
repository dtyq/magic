import { IconChevronRight, IconArchive, IconShare } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import FlexBox from "@/opensource/components/base/FlexBox"
import { useStyles } from "./styles"

interface MenuItemProps {
	icon: React.ReactNode
	title: string
	onClick?: () => void
}

function MenuItem({ icon, title, onClick }: MenuItemProps) {
	const { styles } = useStyles()

	return (
		<div className={styles.menuItem} onClick={onClick}>
			<FlexBox gap={8} align="center">
				<div className={styles.iconWrapper}>{icon}</div>
				<div className={styles.menuTitle}>{title}</div>
			</FlexBox>
			<IconChevronRight className={styles.arrow} />
		</div>
	)
}

export default function ManagementSection() {
	const { styles } = useStyles()
	const { t } = useTranslation("super")

	const archiveIcon = (
		<div className={styles.archiveIcon}>
			<IconArchive size={20} color="white" />
		</div>
	)

	const shareIcon = (
		<div className={styles.shareIcon}>
			<IconShare size={20} />
		</div>
	)

	return (
		<div className={styles.container}>
			<MenuItem icon={archiveIcon} title={t("mobile.navigate.archiveSpace")} />
			<div className={styles.divider} />
			<MenuItem icon={shareIcon} title={t("mobile.navigate.shareManagement")} />
		</div>
	)
}
