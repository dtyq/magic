import { Flex } from "antd"
import { memo } from "react"
import { useTranslation } from "react-i18next"
import { RouteName } from "@/const/routes"
import { useAdmin } from "@/provider/AdminProvider"
import AtLogo from "@/assets/logos/favicon.svg"
import { useStyles } from "./styles"

const MobileHeader = memo(() => {
	const { styles } = useStyles()
	const { t } = useTranslation("admin/common")
	const { navigate } = useAdmin()

	return (
		<header className={styles.header}>
			<Flex
				gap={8}
				align="center"
				className={styles.logo}
				onClick={() => navigate({ name: RouteName.AdminHome })}
			>
				<img src={AtLogo} alt="atLogo" width={32} height={32} />
				<div className={styles.title}>{t("title")}</div>
			</Flex>
		</header>
	)
})

export default MobileHeader
