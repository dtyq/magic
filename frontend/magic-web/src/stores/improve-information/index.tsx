import { useEffect } from "react"
import useNavigate from "@/routes/hooks/useNavigate"
import { useImproveInformationForm } from "@/components/business/ImproveInformationModal/hooks/useImproveInformationForm"
import ImproveInformationForm from "@/components/business/ImproveInformationModal/components/ImproveInformationForm"
import { improveInformationPageCallbackStore } from "./store"
import { RouteName } from "@/routes/constants"
import { useIsMobile } from "@/hooks/useIsMobile"

function ImproveInformationPage() {
	const navigate = useNavigate()
	const isMobile = useIsMobile()

	const form = useImproveInformationForm({
		onSubmit: improveInformationPageCallbackStore.onSubmit,
		onSuccess: () => {
			improveInformationPageCallbackStore.onSuccess?.()
			navigate({
				name: RouteName.Super,
			})
		},
	})

	useEffect(() => {
		if (!isMobile) {
			navigate({
				name: RouteName.Super,
			})
		}
	}, [isMobile, navigate])

	return (
		<div className="h-full overflow-y-auto bg-background pt-safe-top">
			<ImproveInformationForm form={form} />
		</div>
	)
}

export default ImproveInformationPage
