import type { ProjectListItem, Topic } from "@/pages/superMagic/pages/Workspace/types"
import type { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"

interface ResolveHomepageDisplayTopicModeParams {
	topicMode: TopicMode
	homepageModeOverride: TopicMode | null
	selectedProject: ProjectListItem | null
	selectedTopic: Pick<Topic, "id"> | null
}

/**
 * 解析 mobile-home 首页当前应该展示的模式。
 * 在项目/话题尚未挂载的空态首页，优先使用 URL 恢复出来的覆盖值；
 * 一旦进入真实上下文，则完全回退给 topic/project 驱动的模式。
 */
export function resolveHomepageDisplayTopicMode({
	topicMode,
	homepageModeOverride,
	selectedProject,
	selectedTopic,
}: ResolveHomepageDisplayTopicModeParams): TopicMode {
	/**
	 * mobile-home 首次刷新时，会先根据 URL 把首页模式切到目标值，
	 * 随后再执行一次“清空 project/topic 选择”的初始化。
	 * 这里在首页空态下优先读 override，避免那次清空把刚恢复出来的模式回退成 general。
	 */
	if (!selectedProject && !selectedTopic && homepageModeOverride) {
		return homepageModeOverride
	}

	return topicMode
}
