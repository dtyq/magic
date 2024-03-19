import { memo, useMemo } from "react"
import { IconDots, IconChevronRight } from "@tabler/icons-react"
import { observer } from "mobx-react-lite"
import { useStyles } from "./styles"
import type { TopicListProps } from "./types"
import ModeTag from "../../../components/HierarchicalWorkspacePopup/components/ModeTag"
import { Topic, TopicMode } from "@/opensource/pages/superMagic/pages/Workspace/types"
import { useTranslation } from "react-i18next"
import StatusIcon from "@/opensource/pages/superMagic/components/MessageHeader/components/StatusIcon"
import { useMemoizedFn } from "ahooks"
import { projectStore, topicStore } from "@/opensource/pages/superMagic/stores/core"
import { isReadOnlyProject } from "@/opensource/pages/superMagic/utils/permission"
import TopicItemSkeleton from "./components/TopicItemSkeleton"
import MagicPullToRefresh from "@/opensource/components/base-mobile/MagicPullToRefresh"
import SuperMagicService from "@/opensource/pages/superMagic/services"

const TopicItemComponent = memo(
	({
		item,
		setSelectedTopic,
		openActionsPopup,
	}: {
		item: Topic
		setSelectedTopic?: (topic: Topic) => void
		openActionsPopup: (topic: Topic) => void
	}) => {
		const { styles } = useStyles()
		const { t } = useTranslation("super")

		const handleOpenActionsPopup = (e: React.MouseEvent<HTMLDivElement>) => {
			e.stopPropagation()
			openActionsPopup(item)
		}

		return (
			<div
				className={styles.topicItem}
				onClick={() => {
					setSelectedTopic?.(item)
				}}
			>
				<div className={styles.leftContent}>
					<StatusIcon status={item.task_status} />
					<ModeTag mode={item.topic_mode || TopicMode.General} />
					<div className={styles.topicTitle}>
						{item.topic_name || t("topic.unnamedTopic")}
					</div>
				</div>
				<div className={styles.rightActions}>
					<div className={styles.actionButton} onClick={handleOpenActionsPopup}>
						<IconDots size={18} />
					</div>
					<div className={styles.actionButton}>
						<IconChevronRight size={18} />
					</div>
				</div>
			</div>
		)
	},
)

const ProjectPageMain = observer(function ProjectPageMain({
	className,
	topicFilesCore,
	openActionsPopup,
}: TopicListProps) {
	const { styles, cx } = useStyles()
	const { t } = useTranslation("super")

	// Get state from stores
	const selectedProject = projectStore.selectedProject
	const setSelectedTopic = topicStore.setSelectedTopic
	const processedTopics = topicStore.topics

	const isReadonly = isReadOnlyProject(selectedProject?.user_role)

	const groupedTopics = useMemo(() => {
		const today = new Date()
		today.setHours(0, 0, 0, 0)
		const todayTimestamp = today.getTime()

		return processedTopics.reduce(
			(acc, topic) => {
				// Get updated_at timestamp, fallback to created_at or current time
				const topicTime = topic.updated_at
					? new Date(topic.updated_at).getTime()
					: Date.now()
				const isToday = topicTime >= todayTimestamp
				const category = isToday ? "today" : "history"
				acc[category] = acc[category] || []
				acc[category].push({ ...topic })
				return acc
			},
			{} as Record<"today" | "history", Topic[]>,
		)
	}, [processedTopics])

	const onSwitchSuperMagicChat = useMemoizedFn((topic: Topic) => {
		// Mobile: Only update selected topic state, popup will handle display
		// Desktop: Navigate to topic route (handled by routeManageService)
		setSelectedTopic(topic)
	})

	const loading = topicStore.isFetchList

	// 刷新话题列表
	const handleRefreshTopics = useMemoizedFn(async () => {
		if (!selectedProject?.id) return
		await SuperMagicService.topic.fetchTopics({
			projectId: selectedProject.id,
		})
	})

	if (isReadonly) {
		return topicFilesCore
	}

	return (
		<>
			<MagicPullToRefresh onRefresh={handleRefreshTopics} showSuccessMessage={false}>
				<div className={cx(styles.container, className)}>
					<p className={styles.sectionTitle}>{t("topic.projectTopics")}</p>
					<div className={styles.itemsContainer}>
						{loading ? (
							<>
								<div className={styles.groupTitle}>{t("topic.today")}</div>
								<TopicItemSkeleton />
								<TopicItemSkeleton />
								<div className={styles.groupTitle}>{t("topic.history")}</div>
								<TopicItemSkeleton />
								<TopicItemSkeleton />
								<TopicItemSkeleton />
							</>
						) : (
							<>
								{/* Today's topics */}
								{groupedTopics.today && groupedTopics.today.length > 0 && (
									<>
										<div className={styles.groupTitle}>{t("topic.today")}</div>
										{groupedTopics.today.map((item) => (
											<TopicItemComponent
												key={item.id}
												item={item}
												setSelectedTopic={onSwitchSuperMagicChat}
												openActionsPopup={(topic) =>
													openActionsPopup(topic, selectedProject)
												}
											/>
										))}
									</>
								)}

								{/* Historical topics */}
								{groupedTopics.history && groupedTopics.history.length > 0 && (
									<>
										<div className={styles.groupTitle}>
											{t("topic.history")}
										</div>
										{groupedTopics.history.map((item) => (
											<TopicItemComponent
												key={item.id}
												item={item}
												setSelectedTopic={onSwitchSuperMagicChat}
												openActionsPopup={(topic) =>
													openActionsPopup(topic, selectedProject)
												}
											/>
										))}
									</>
								)}
							</>
						)}
					</div>
				</div>
			</MagicPullToRefresh>
		</>
	)
})

ProjectPageMain.displayName = "ProjectPageMain"
export default ProjectPageMain
