import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"

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
