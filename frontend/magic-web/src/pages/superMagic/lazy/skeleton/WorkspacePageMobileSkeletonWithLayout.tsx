import SuperMagicMobileLayout from "./SuperMagicMobileLayout"
import { WorkspacePageMobileSkeleton } from "./WorkspacePageMobileSkeleton"
import { SkeletonSafeAreaWrapper } from "@/components/base/Skeleton"

const WorkspacePageMobileSkeletonWithLayout = () => {
	return (
		<SkeletonSafeAreaWrapper
			enableTop
			enableBottom
			topStyle={{ backgroundColor: "#ffffff" }}
			bottomStyle={{ backgroundColor: "#ffffff" }}
		>
			<SuperMagicMobileLayout>
				<WorkspacePageMobileSkeleton />
			</SuperMagicMobileLayout>
		</SkeletonSafeAreaWrapper>
	)
}

export default WorkspacePageMobileSkeletonWithLayout
