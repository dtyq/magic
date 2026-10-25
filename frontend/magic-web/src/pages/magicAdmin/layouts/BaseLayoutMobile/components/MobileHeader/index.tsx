import { Flex } from "antd"
import { memo } from "react"
import { useTranslation } from "react-i18next"
import AtLogo from "@/assets/logos/favicon.svg"
import { useStyles } from "./styles"
import OrganizationSwitch from "../../../BaseLayout/components/OrganizationSwitch"
import UserHeader from "@/pages/chatMobile/components/UserHeader"
import { useMainTranslation } from "@/hooks/i18n/useMainTranslation"

const MobileHeader = memo(({ onClick }: { onClick: () => void }) => {
	const { styles } = useStyles()
	const { t } = useTranslation("admin/common")
	const { t: tMainCommon } = useMainTranslation("common")

	return (
		<header className={styles.header}>
			<Flex gap={8} align="center" className={styles.logo} onClick={onClick}>
				<img src={AtLogo} alt="atLogo" width={32} height={32} />
				<div className={styles.title}>
					{t("title", { platformName: tMainCommon("platform.name") })}
				</div>
			</Flex>
			<Flex gap={12} align="center" className={styles.actions}>
				<OrganizationSwitch />
				<UserHeader className={styles.userHeader} />
			</Flex>
		</header>
	)
})

export default MobileHeader
