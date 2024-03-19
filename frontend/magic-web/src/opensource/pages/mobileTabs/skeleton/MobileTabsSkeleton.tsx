import { SkeletonSafeAreaWrapper } from "@/opensource/components/base/Skeleton"
import SuperMagicMobileLayout from "../../superMagic/lazy/skeleton/SuperMagicMobileLayout"
import WorkspacePageMobileSkeleton from "../../superMagic/lazy/skeleton/WorkspacePageMobileSkeleton"
import MobileTabBarSkeleton from "./MobileTabBarSkeleton"
import { userStore } from "@/opensource/models/user"
import { observer } from "mobx-react-lite"

const MobileTabsSkeleton = () => {
	const { isPersonalOrganization } = userStore.user

	return (
		<SkeletonSafeAreaWrapper
			enableTop
			enableBottom
			topStyle={{ backgroundColor: "#ffffff" }}
			bottomStyle={{ backgroundColor: "#ffffff" }}
		>
			<SuperMagicMobileLayout>
				<WorkspacePageMobileSkeleton />
				{!isPersonalOrganization && <MobileTabBarSkeleton />}
			</SuperMagicMobileLayout>
		</SkeletonSafeAreaWrapper>
	)
}

export default observer(MobileTabsSkeleton)
