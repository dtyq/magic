import useNavigate from "@/opensource/routes/hooks/useNavigate"
import { RouteName } from "@/opensource/routes/constants"

export const navigateToUserDetail = (uid: string, navigate: ReturnType<typeof useNavigate>) => {
	navigate({
		name: RouteName.UserInfoDetails,
		params: {
			userId: uid,
		},
		viewTransition: {
			type: "slide",
			direction: "left",
		},
	})
}
