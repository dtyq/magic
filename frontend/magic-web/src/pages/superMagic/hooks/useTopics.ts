import { useEffect, useState } from "react"
import type {
	ProjectListItem,
	CollaborationProjectListItem,
	TaskStatus,
	Topic,
	Workspace,
} from "../pages/Workspace/types"
import pubsub from "@/utils/pubsub"
import { WorkspacePage } from "@/pages/superMagic/layouts/MainLayout/types"
import { useMemoizedFn } from "ahooks"
import routeManageService from "../services/routeManageService"
import { isCollaborationWorkspace, SHARE_WORKSPACE_ID } from "../constants"
import { useNoPermissionCollaborationProject } from "./useNoPermissionCollaborationProject"
import { SuperMagicApi } from "@/apis"
import SuperMagicService from "../services"

interface UseTopicsProps {
	workspacePage: WorkspacePage
	selectedWorkspace: Workspace | null
	selectedProject: ProjectListItem | null
	updateProjects: (params: { workspaceId: string }) => void
	setSelectedProject: (project: ProjectListItem | null) => void
	setWorkspacePage: (page: WorkspacePage) => void
}

export interface FetchTopicsParams {
	project: ProjectListItem
	isAutoSelect?: boolean
	isSelectLast?: boolean
	page?: number
}

export interface UpdateTopicStatusParams {
	topicId?: string
	status: TaskStatus
}

export function useTopics({
	selectedWorkspace,
	selectedProject,
	updateProjects,
	setSelectedProject,
	setWorkspacePage,
}: UseTopicsProps) {
	const [topics, setTopics] = useState<Topic[]>([])
	const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null)

	const { handleNoPermissionCollaborationProject } = useNoPermissionCollaborationProject()

	/**
	 * 获取项目话题列表
	 * @param project 当前选中项目
	 * @param isAutoSelect 返回列表后是否自动选中话题
	 * @param isSelectLast 返回列表后是否选中最新的话题
	 * @param page 话题列表页码
	 */
	const fetchTopics = useMemoizedFn(
		async ({
			project,
			isAutoSelect = true,
			isSelectLast = false,
			page = 1,
		}: FetchTopicsParams) => {
			try {
				const res = await SuperMagicApi.getTopicsByProjectId({
					id: project.id,
					page,
					page_size: 99,
				})
				const updatedTopics = Array.isArray(res.list) ? res.list : []
				setTopics(updatedTopics)

				if (isAutoSelect && !isSelectLast && selectedTopic) {
					const _selectedTopic =
						updatedTopics.find((topic: Topic) => topic.id === selectedTopic.id) ||
						updatedTopics[0] ||
						null
					setSelectedTopic(_selectedTopic)
					routeManageService.navigateToState({
						workspaceId: project.workspace_id,
						projectId: project.id,
						topicId: _selectedTopic?.id || null,
					})
				} else if (isAutoSelect) {
					const _selectedTopic = updatedTopics[0] || null
					setSelectedTopic(_selectedTopic)
					routeManageService.navigateToState({
						workspaceId: project.workspace_id,
						projectId: project.id,
						topicId: _selectedTopic?.id || null,
					})
				}

				return res.list
			} catch (error) {
				if (isCollaborationWorkspace(selectedWorkspace)) {
					handleNoPermissionCollaborationProject(error)
					return []
				}

				console.error("🚀 ~ 获取项目话题列表失败 ~ error:", error)
				return []
			}
		},
	)

	/**
	 * 更新话题的名称
	 * 注意：该方法仅用于更新指定话题的话题名称，不会调用onWorkspaceStateChange触发路由的更新。
	 */
	const updateTopicName = useMemoizedFn(async (topicId: string, topicName: string) => {
		if (selectedTopic?.id === topicId) {
			setSelectedTopic((preState: Topic | null) => {
				return {
					...preState,
					topic_name: topicName,
				} as Topic
			})
		}
		setTopics((preState) => {
			return preState.map((topic) => {
				if (topic.id === topicId) {
					return { ...topic, topic_name: topicName }
				}
				return topic
			})
		})
	})

	/**
	 * 更新话题的运行状态
	 * 注意：该方法仅用于更新指定话题的运行状态，不会调用onWorkspaceStateChange触发路由的更新。
	 */
	const updateTopicStatus = useMemoizedFn(
		async ({ topicId, status }: UpdateTopicStatusParams) => {
			if (!topicId) return
			if (selectedTopic?.id === topicId) {
				setSelectedTopic((preState: Topic | null) => {
					return {
						...preState,
						task_status: status,
					} as Topic
				})
			}
			setTopics((preState) => {
				return preState.map((topic) => {
					if (topic.id === topicId) {
						return { ...topic, task_status: status }
					}
					return topic
				})
			})
		},
	)

	// 创建新话题
	const handleCreateTopic = useMemoizedFn(
		async (targetProject?: ProjectListItem): Promise<Topic | null> => {
			const project = targetProject ?? selectedProject

			return SuperMagicService.handleCreateTopic({
				selectedProject,
				targetProject,
				onError: handleNoPermissionCollaborationProject,
				onSuccess: async (newTopic) => {
					if (!project) return
					// Fetch latest topics list and update local state
					const topicsRes = await SuperMagicApi.getTopicsByProjectId({
						id: project.id,
						page: 1,
						page_size: 999,
					})
					const updatedTopics = Array.isArray(topicsRes?.list) ? topicsRes?.list : []
					setTopics(updatedTopics)
					const targetTopic = updatedTopics.find(
						(topic: Topic) => topic?.id === newTopic?.id,
					)
					if (targetTopic) {
						setSelectedTopic(targetTopic)
					}
				},
			})
		},
	)

	/**
	 * 通过选中指定项目，获取话题列表，并选中历史话题或第一个话题
	 * @param project 指定项目
	 */
	const selectTopicWithProject = useMemoizedFn(async (project: ProjectListItem) => {
		setWorkspacePage(WorkspacePage.Chat)
		setSelectedProject(project)
		try {
			const res = await SuperMagicApi.getTopicsByProjectId({
				id: project.id,
				page: 1,
				page_size: 99,
			})
			const updatedTopics = Array.isArray(res.list) ? res.list : []
			setTopics(updatedTopics)
			// 缓存优先：获取本地缓存的历史话题，如果存在，则选中该话题，否则选中第一个话题
			const projectTopicMapLocalStorageKey =
				routeManageService.getProjectTopicMapLocalStorageKey()
			const cachedProjectTopicMap = JSON.parse(
				localStorage.getItem(projectTopicMapLocalStorageKey) || "{}",
			)

			const cachedSelectedTopicId = cachedProjectTopicMap[project.id]

			const _selectedTopic =
				updatedTopics.find((topic: Topic) => topic.id === cachedSelectedTopicId) ||
				updatedTopics[0] ||
				null

			setSelectedTopic(_selectedTopic)

			routeManageService.navigateToState({
				projectId: project.id,
				topicId: _selectedTopic?.id || null,
			})
		} catch (error) {
			console.error("获取话题列表失败:", error)

			if (isCollaborationWorkspace(selectedWorkspace)) {
				handleNoPermissionCollaborationProject(error)
				return
			}

			setWorkspacePage(WorkspacePage.Home)
			if (selectedWorkspace) {
				updateProjects({ workspaceId: selectedWorkspace.id })
			}

			setSelectedProject(null)
			setSelectedTopic(null)

			routeManageService.navigateToState({
				projectId: null,
				topicId: null,
			})
		}
	})

	/**
	 * 通过选中指定项目，获取话题列表，并选中历史话题或第一个话题
	 * @param project 指定项目
	 */
	const selectTopicWithCollaborationProject = useMemoizedFn(
		async (project: CollaborationProjectListItem) => {
			setWorkspacePage(WorkspacePage.Chat)
			setSelectedProject(project)
			try {
				const res = await SuperMagicApi.getTopicsByProjectId({
					id: project.id,
					page: 1,
					page_size: 99,
				})
				const updatedTopics = Array.isArray(res.list) ? res.list : []
				setTopics(updatedTopics)
				// 缓存优先：获取本地缓存的历史话题，如果存在，则选中该话题，否则选中第一个话题
				const projectTopicMapLocalStorageKey =
					routeManageService.getProjectTopicMapLocalStorageKey()
				const cachedProjectTopicMap = JSON.parse(
					localStorage.getItem(projectTopicMapLocalStorageKey) || "{}",
				)

				const cachedSelectedTopicId = cachedProjectTopicMap[project.id]

				const _selectedTopic =
					updatedTopics.find((topic: Topic) => topic.id === cachedSelectedTopicId) ||
					updatedTopics[0] ||
					null

				setSelectedTopic(_selectedTopic)

				routeManageService.navigateToState({
					workspaceId: SHARE_WORKSPACE_ID,
					projectId: project.id,
					topicId: _selectedTopic?.id || null,
				})
			} catch (error) {
				console.error("获取话题列表失败:", error)

				if (isCollaborationWorkspace(selectedWorkspace)) {
					handleNoPermissionCollaborationProject(error)
					return
				}

				setWorkspacePage(WorkspacePage.Home)
				if (selectedWorkspace) {
					updateProjects({ workspaceId: selectedWorkspace.id })
				}

				setSelectedProject(null)
				setSelectedTopic(null)

				routeManageService.navigateToState({
					projectId: null,
					topicId: null,
				})
			}
		},
	)

	useEffect(() => {
		pubsub.subscribe("super_magic_add_topic", (newTopic: Topic) => {
			setTopics([...topics, newTopic])
		})
		pubsub.subscribe("super_magic_create_create_topic", () => {
			handleCreateTopic()
		})

		return () => {
			pubsub.unsubscribe("super_magic_add_topic")
			pubsub.unsubscribe("super_magic_create_create_topic")
		}
	}, [handleCreateTopic, selectedTopic, topics])

	return {
		topics,
		setTopics,
		selectedTopic,
		setSelectedTopic,
		handleCreateTopic,
		fetchTopics,
		updateTopicName,
		updateTopicStatus,
		selectTopicWithProject,
		selectTopicWithCollaborationProject,
	}
}
