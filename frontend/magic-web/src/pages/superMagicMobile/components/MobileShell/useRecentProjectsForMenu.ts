import { useEffect, useMemo, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { SuperMagicApi } from "@/apis"
import { type ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import {
	isSelfCollaborationProject,
	isWorkspaceShortcutProject,
} from "@/pages/superMagic/constants"
import { projectStore } from "@/pages/superMagic/stores/core"
import { useTranslation } from "react-i18next"
import {
	getCachedChatWorkspaceId,
	ensureChatWorkspaceId,
} from "@/pages/superMagic/hooks/useChatWorkspace"
import type { MobileShellMenuRecentItem } from "./MobileShellMenuContext"

// 最近项目最多只拉10个
const RECENT_PROJECTS_PAGE_SIZE = 10

/**
 * 最近使用项目需要始终给侧栏一个可见标题，避免后端返回空项目名时出现空白点击区域。
 * 对话项目（属于 chat workspace）用对话专属占位文案。
 */
function getRecentProjectTitle(
	project: ProjectListItem,
	chatWorkspaceId: string | null,
	translations: {
		unnamedChat: string
		unnamedProject: string
	},
) {
	if (project.project_name?.trim()) return project.project_name

	// 通过 workspace_id 判断是否为对话，与导航逻辑保持一致
	return chatWorkspaceId && project.workspace_id === chatWorkspaceId
		? translations.unnamedChat
		: translations.unnamedProject
}

/**
 * 项目话题或项目本身处于执行中状态时，侧栏显示 Loader 动画。
 * 复用与 ProjectItem 相同的判断逻辑，保证各视图状态一致。
 */
function isRunningLikeStatus(status: string | undefined | null) {
	return status === "running" || status === "waiting_for_user"
}

/**
 * 把项目接口结果映射为侧栏菜单可消费的数据结构，避免展示层直接依赖接口细节。
 *
 * badge 逻辑与 PC 端保持一致：
 * - isShared：isSelfCollaborationProject（tag=collaboration && 当前用户是 owner）
 *   → 自己创建并分享出去的协作项目，展示分享图标
 * - isLinked：isWorkspaceShortcutProject（非 owner && (tag=collaboration || is_bind_workspace)）
 *   → 加入的他人协作项目或关联工作区项目，展示链接图标
 * - isChatProject：workspace_id 与 chat workspace（workspace_type="chat"）的 ID 一致
 *   → 对话项目，点击后导航到对话页而非普通项目详情
 *   注意：不能用 project_mode 判断，因为对话创建时 projectMode 由用户角色决定，可以是 General 等任意值。
 */
function mapRecentProjectToMenuItem(
	project: ProjectListItem,
	chatWorkspaceId: string | null,
	translations: {
		unnamedChat: string
		unnamedProject: string
	},
): MobileShellMenuRecentItem {
	return {
		id: project.id,
		title: getRecentProjectTitle(project, chatWorkspaceId, translations),
		project,
		inProgress:
			isRunningLikeStatus(project.current_topic_status) ||
			isRunningLikeStatus(project.project_status),
		isPinned: project.is_pinned === true,
		isShared: isSelfCollaborationProject(project),
		isLinked: Boolean(isWorkspaceShortcutProject(project)),
		isChatProject: chatWorkspaceId != null && project.workspace_id === chatWorkspaceId,
	}
}

/**
 * 并行拉取最近项目列表与 chat workspace ID（后者优先复用缓存，避免额外网络请求）。
 * 返回项目列表及 chat workspace ID，供映射层判断项目是否为对话。
 */
async function requestRecentProjects(): Promise<{
	projects: ProjectListItem[]
	chatWorkspaceId: string | null
}> {
	const [projectsResult, chatWorkspaceId] = await Promise.all([
		SuperMagicApi.getProjectsWithCollaboration({
			page: 1,
			page_size: RECENT_PROJECTS_PAGE_SIZE,
		}).catch((error) => {
			console.error("加载移动端菜单最近项目失败:", error)
			return { list: [], total: 0 }
		}),
		// getCachedChatWorkspaceId 同步读缓存：若已有则零开销；否则发起一次共享请求
		getCachedChatWorkspaceId() != null
			? Promise.resolve(getCachedChatWorkspaceId())
			: ensureChatWorkspaceId(),
	])

	return {
		projects: projectsResult.list || [],
		chatWorkspaceId,
	}
}

/**
 * 预热最近项目所属工作区缓存，保证用户后续从菜单直达真实项目时能尽快复用工作区数据。
 */
function warmRecentProjectsCache(projects: ProjectListItem[]) {
	projects.forEach((project) => {
		const cachedProjects = projectStore.getProjectsByWorkspace(project.workspace_id)
		const hasCachedProject = cachedProjects.some((item) => item.id === project.id)
		if (hasCachedProject) return

		projectStore.setProjectsForWorkspace(project.workspace_id, [project, ...cachedProjects])
	})
}

/**
 * 为共享移动端侧栏拉取"最近使用项目"。
 * 接口失败时直接回退为空列表，避免继续把联调期 mock 语义带入正式交互分支。
 */
export function useRecentProjectsForMenu() {
	const { t } = useTranslation("super")
	const [recentItems, setRecentItems] = useState<MobileShellMenuRecentItem[]>([])
	const recentItemTranslations = useMemo(
		() => ({
			unnamedChat: t("chat.unnamedChat"),
			unnamedProject: t("project.unnamedProject"),
		}),
		[t],
	)

	/**
	 * 统一刷新最近项目，供侧栏首次加载和操作完成后复用同一条数据链路。
	 */
	const reloadRecentItems = useMemoizedFn(async () => {
		const { projects, chatWorkspaceId } = await requestRecentProjects()
		warmRecentProjectsCache(projects)
		setRecentItems(
			projects.map((project) =>
				mapRecentProjectToMenuItem(project, chatWorkspaceId, recentItemTranslations),
			),
		)
	})

	useEffect(() => {
		let disposed = false

		/**
		 * 首次加载保留卸载保护，避免路由切换时异步回写到已卸载组件。
		 */
		async function loadRecentProjects() {
			const { projects, chatWorkspaceId } = await requestRecentProjects()
			if (disposed) return

			warmRecentProjectsCache(projects)
			if (disposed) return

			setRecentItems(
				projects.map((project) =>
					mapRecentProjectToMenuItem(project, chatWorkspaceId, recentItemTranslations),
				),
			)
		}

		void loadRecentProjects()

		return () => {
			disposed = true
		}
	}, [recentItemTranslations, reloadRecentItems])

	return useMemo(
		() => ({
			recentItems,
			reloadRecentItems,
		}),
		[recentItems, reloadRecentItems],
	)
}
