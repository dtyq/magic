import { useCallback } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import PcOnlyNoticeDialog from "@/pages/superMagic/components/PcOnlyNoticeDialog"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { ViewTransitionPresets } from "@/types/viewTransition"

function SkillEditMobilePage() {
	const { t } = useTranslation("crew/market")
	const navigate = useNavigate()

	const handleClose = useCallback(() => {
		if (window.history.length > 1) {
			navigate({
				delta: -1,
				viewTransition: ViewTransitionPresets.slideRight,
			})
			return
		}

		navigate({ name: RouteName.MySkills, replace: true })
	}, [navigate])

	return (
		<div
			className="flex h-full min-h-0 w-full min-w-0 bg-background"
			data-testid="skill-edit-mobile-page"
		>
			<PcOnlyNoticeDialog
				open
				onOpenChange={(open) => !open && handleClose()}
				title={t("mySkills.pcOnlyNotice.title")}
				description={t("mySkills.pcOnlyNotice.description")}
				confirmText={t("mySkills.pcOnlyNotice.confirm")}
				testIdPrefix="skill-edit-mobile-pc-only"
			/>
		</div>
	)
}

export default observer(SkillEditMobilePage)
