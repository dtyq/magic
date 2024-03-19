import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import { lazy, Suspense } from "react"
import ProfileMobileSkeleton from "./skeleton/ProfileMobileSkeleton"

const ProfileMobile = lazy(() => import("@/opensource/pages/user/pages/my"))

function Profile() {
	const isMobile = useIsMobile()

	if (isMobile) {
		return (
			<Suspense fallback={<ProfileMobileSkeleton />}>
				<ProfileMobile />
			</Suspense>
		)
	}

	// Desktop version not implemented yet
	return null
}

export default Profile
