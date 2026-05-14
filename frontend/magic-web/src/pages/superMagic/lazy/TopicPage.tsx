import { lazy, Suspense, useEffect, useState } from "react"
import { useParams } from "react-router"
import { Navigate } from "@/routes/components/Navigate"
import { RouteName } from "@/routes/constants"
import TopicPageMobileSkeleton from "./skeleton/TopicPageMobileSkeleton"
import TopicPageDesktopSkeleton from "./skeleton/TopicPageDesktopSkeleton"
import { useIsMobile } from "@/hooks/useIsMobile"
import { observer } from "mobx-react-lite"
import { projectStore, topicStore } from "../stores/core"
import superMagicService from "../services"

// 懒加载桌面端与移动端对应的 TopicPage 组件
const TopicPageDesktop = lazy(() => import("@/pages/superMagic/pages/TopicPage/index.desktop"))
const TopicPageMobile = lazy(() => import("@/pages/superMagicMobile/pages/TopicPage"))

/**
 * TopicPage 组件负责根据终端类型加载不同的 TopicPage 实现。
 *
 * 移动端话题页支持深链直达，因此如果进入时没有加载相应的项目或话题上下文，
 * 需要根据路由参数自动补充 store 中的项目和话题详情。
 *
 * 如果数据尚未恢复，则显示骨架屏；恢复后显示对应页面内容。
 */
const TopicPage = observer(function TopicPage() {
	const isMobile = useIsMobile()
	const { projectId, topicId } = useParams()
	const [hasRestoreFailed, setHasRestoreFailed] = useState(false)
	const selectedTopic = topicStore.selectedTopic
	const needsTopicDetailRestore =
		selectedTopic?.id !== topicId ||
		!selectedTopic?.chat_conversation_id ||
		!selectedTopic?.chat_topic_id

	useEffect(() => {
		// 仅在移动端且存在 projectId 和 topicId 时尝试恢复上下文
		if (!isMobile || !projectId || !topicId) return
		let isCancelled = false
		const restoreTasks: Promise<unknown>[] = []

		setHasRestoreFailed(false)

		// 检查项目是不是已与当前 projectId 匹配，否则需从后台拉取详情并同步至 store
		if (projectStore.selectedProject?.id !== projectId) {
			restoreTasks.push(
				superMagicService.project
					.getProjectDetail(projectId, { enableErrorMessagePrompt: false })
					.then((project) => {
						// 防止数据被异步请求覆盖无效
						if (isCancelled || !project || project.id !== projectId) return
						projectStore.setSelectedProject(project)
					}),
			)
		}

		// 列表态 topic 可能只有展示字段；只要缺少 chat 会话映射，也必须补详情后再进入消息页。
		if (needsTopicDetailRestore) {
			restoreTasks.push(
				superMagicService.topic.getTopicDetail(topicId).then((topic) => {
					// 同理，确认拉取的数据为当前话题
					if (isCancelled || !topic || topic.id !== topicId) return
					topicStore.setSelectedTopic(topic)
				}),
			)
		}

		// 只要存在需要恢复的异步任务，就在失败时跳出骨架态并回到项目详情页兜底。
		if (restoreTasks.length > 0) {
			void Promise.allSettled(restoreTasks).then((results) => {
				if (isCancelled) return

				const rejectedResult = results.find((result) => result.status === "rejected")
				if (rejectedResult?.status === "rejected") {
					console.error(
						"Failed to restore mobile topic route context:",
						rejectedResult.reason,
					)
					setHasRestoreFailed(true)
				}
			})
		}

		return () => {
			isCancelled = true
		}
	}, [isMobile, needsTopicDetailRestore, projectId, topicId])

	if (isMobile) {
		if (projectId && topicId && hasRestoreFailed) {
			return (
				<Navigate
					name={RouteName.SuperWorkspaceProjectState}
					params={{ projectId }}
					replace
				/>
			)
		}

		// 如果当前 store 里的项目或话题尚未恢复，则先显示骨架屏
		if (
			projectId &&
			topicId &&
			!hasRestoreFailed &&
			(projectStore.selectedProject?.id !== projectId || needsTopicDetailRestore)
		) {
			return <TopicPageMobileSkeleton />
		}

		// 移动端正常渲染
		return (
			<Suspense fallback={<TopicPageMobileSkeleton />}>
				<TopicPageMobile />
			</Suspense>
		)
	}

	// 桌面端渲染，对应桌面端骨架屏和页面内容
	return (
		<Suspense fallback={<TopicPageDesktopSkeleton />}>
			<TopicPageDesktop />
		</Suspense>
	)
})

export default TopicPage
