import ProjectPageMobileSkeleton from "./ProjectPageMobileSkeleton"
import SuperMagicMobileLayout from "./SuperMagicMobileLayout"
import { MobileHeaderSkeleton } from "./mobileSkeletonShared"

/** Route sketch: project-entry header + tabs/topic list body. */
const ProjectPageMobileSkeletonWithLayout = () => {
	return (
		<SuperMagicMobileLayout header={<MobileHeaderSkeleton variant="project-entry" />}>
			<ProjectPageMobileSkeleton />
		</SuperMagicMobileLayout>
	)
}

export default ProjectPageMobileSkeletonWithLayout
