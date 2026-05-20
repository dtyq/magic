import SuperMagicMobileLayout from "./SuperMagicMobileLayout"
import { MobileHeaderSkeleton } from "./mobileSkeletonShared"
import TopicPageMobileSkeleton from "./TopicPageMobileSkeleton"

/** Route sketch: shell header + topic conversation body. */
export default function TopicPageMobileSkeletonWithLayout() {
	return (
		<SuperMagicMobileLayout header={<MobileHeaderSkeleton variant="project-topic" />}>
			<TopicPageMobileSkeleton />
		</SuperMagicMobileLayout>
	)
}
