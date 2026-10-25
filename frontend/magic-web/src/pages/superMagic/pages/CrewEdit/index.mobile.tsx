import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import PcOnlyNoticeDialog from "@/pages/superMagic/components/PcOnlyNoticeDialog"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { ViewTransitionPresets } from "@/types/viewTransition"

export default function CrewEditMobilePage() {
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

		navigate({ name: RouteName.MyCrew, replace: true })
	}, [navigate])

	return (
		<div
			className="flex h-full min-h-0 w-full min-w-0 bg-background"
			data-testid="crew-edit-mobile-page"
		>
			<PcOnlyNoticeDialog
				open
				onOpenChange={(open) => !open && handleClose()}
				title={t("myCrew.pcOnlyNotice.title")}
				description={t("myCrew.pcOnlyNotice.description")}
				confirmText={t("myCrew.pcOnlyNotice.confirm")}
				testIdPrefix="crew-edit-mobile-pc-only"
			/>
		</div>
	)
}
