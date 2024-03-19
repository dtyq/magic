import SuperMagicMobileLayout from "./SuperMagicMobileLayout"
import { WorkspacePageMobileSkeleton } from "./WorkspacePageMobileSkeleton"
import { SkeletonSafeAreaWrapper } from "@/opensource/components/base/Skeleton"

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
