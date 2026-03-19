import MagicNavBar from "@/components/base-mobile/MagicNavBar"
import useNavigate from "@/routes/hooks/useNavigate"
import FlexBox from "@/components/base/FlexBox"
import { WorkspaceSection } from "./components"
import { useStyles } from "./styles"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { Navigate } from "@/routes/components/Navigate"
import { useIsMobile } from "@/hooks/useIsMobile"
import { RouteName } from "@/routes/constants"

function SuperMagicMobileNavigate() {
	const navigate = useNavigate({
		fallbackRoute: { name: RouteName.Super },
	})

	const isMobile = useIsMobile()
	const { styles } = useStyles()
	const { t } = useTranslation("super")

	const onBack = useMemoizedFn(() => {
		navigate({
			delta: -1,
			viewTransition: {
				direction: "right",
			},
		})
	})

	if (!isMobile) {
		return <Navigate name={RouteName.Super} replace />
	}

	return (
		<>
			<MagicNavBar className={styles.navBar} onBack={onBack}>
				<div>{t("mobile.navigate.title")}</div>
			</MagicNavBar>
			<FlexBox vertical gap={20} className={styles.content}>
				<WorkspaceSection toWorkspace={onBack} />
				{/* <ManagementSection /> */}
			</FlexBox>
		</>
	)
}

export default SuperMagicMobileNavigate
