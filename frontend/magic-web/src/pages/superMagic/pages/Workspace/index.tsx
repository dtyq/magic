// import SuperMagicMobileWorkSpace from "@/pages/superMagicMobile/pages/workspace/index"
// import pubsub, { PubSubEvents } from "@/utils/pubsub"
// import {
// 	useDeepCompareEffect,
// 	useResponsive,
// 	useDebounceFn,
// 	useUpdateEffect,
// 	useMemoizedFn,
// } from "ahooks"
// import { cx } from "antd-style"
// import { isEmpty, isObject } from "lodash-es"
// import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
// import { isEmptyJSONContent } from "../../components/MessageEditor/utils"
// import Detail, { type DetailRef } from "../../components/Detail"
// import EmptyWorkspacePanel from "../../components/EmptyWorkspacePanel"
// import MessageList, { MessageListProvider } from "../../components/MessageList"
// import MessagePanel from "../../components/MessagePanel/MessagePanel"
// import TopicFilesButton from "../../components/TopicFilesButton"
// import useStyles from "./style"
// import MessageHeader from "../../components/MessageHeader"
// import {
// 	ProjectListItem,
// 	type Topic,
// 	type Workspace,
// 	type CreatedProject,
// 	TaskStatus,
// 	TopicMode,
// } from "./types"
// import { WorkspacePage } from "@/pages/superMagic"
// import { JSONContent } from "@tiptap/core"
// import GlobalMentionPanelStore from "@/components/business/MentionPanel/store"
// import projectFilesStore from "@/stores/projectFiles"
// import ProjectSider from "../../components/ProjectSider"
// import { useTranslation } from "react-i18next"
// import { filterClickableMessageWithoutRevoked } from "../../utils/handleMessage"
// import { useDetailModeCache } from "../../hooks/useDetailModeCache"
// import { openModal } from "@/utils/react"
// import DeleteDangerModal from "@/components/business/DeleteDangerModal"
// import { useAttachmentsPolling } from "../../hooks/useAttachmentsPolling"
// import { AttachmentDataProcessor } from "../../utils/attachmentDataProcessor"
// import { type FetchTopicsParams, type UpdateTopicStatusParams } from "../../hooks/useTopics"
// import {
// 	type FetchProjectsParams,
// 	type HandleRenameProjectParams,
// 	type UpdateProjectStatusParams,
// 	type HandleCreateProjectParams,
// 	UpdateProjectsParams,
// } from "../../hooks/useProjects"
// import { type UpdateWorkspaceStatusParams } from "../../hooks/useWorkspace"
// import { isCollaborationWorkspace } from "../../constants"
// import { useNoPermissionCollaborationProject } from "../../hooks/useNoPermissionCollaborationProject"
// import SiderTask from "../../components/SiderTask"
// import { superMagicStore } from "@/pages/superMagic/stores"
// import { reaction } from "mobx"
// import { isReadOnlyProject } from "../../utils/permission"
// import { SuperMagicApi } from "@/apis"
// import { useTaskData } from "../../hooks/useTaskData"

// interface MainWorkspaceContentProps {
// 	workspacePage: WorkspacePage
// 	setWorkspacePage: (workspacePage: WorkspacePage) => void

// 	workspaces: Workspace[]
// 	setWorkspaces: (workspaces: Workspace[]) => void
// 	selectedWorkspace: Workspace
// 	setSelectedWorkspace: (workspace: Workspace | null) => void
// 	fetchWorkspaces: ({
// 		isAutoSelect,
// 		isSelectLast,
// 		isEditLast,
// 		page,
// 	}: {
// 		isAutoSelect?: boolean
// 		isSelectLast?: boolean
// 		isEditLast?: boolean
// 		page: number
// 	}) => void
// 	updateWorkspaceStatus: (params: UpdateWorkspaceStatusParams) => void
// 	handleDeleteWorkspace: (id: string) => void

// 	projects: ProjectListItem[]
// 	selectedProject: ProjectListItem | null
// 	setSelectedProject: (project: ProjectListItem) => void
// 	handleCreateProject: (params: HandleCreateProjectParams) => Promise<CreatedProject | null>
// 	handleDeleteProject: (projectId: string, isAutoSelect?: boolean) => void
// 	handleDeleteProjectConfirm: (projectId: string, isAutoSelect?: boolean) => void
// 	handleRenameProject: (params: HandleRenameProjectParams) => Promise<void>
// 	fetchProjects: (params: FetchProjectsParams) => void
// 	updateProjects: (params: UpdateProjectsParams) => Promise<ProjectListItem[]>
// 	updateProjectStatus: (params: UpdateProjectStatusParams) => void

// 	topics: Topic[]
// 	selectedTopic: Topic | null
// 	setSelectedTopic: (topicInfo: Topic | null | ((pre: Topic | null) => Topic | null)) => void
// 	handleCreateTopic: () => Promise<Topic | null>
// 	setTopics: (topics: Topic[]) => void
// 	fetchTopics: (params: FetchTopicsParams) => void
// 	updateTopicStatus: (params: UpdateTopicStatusParams) => void

// 	messages: any[]
// 	setAttachments: (attachments: any[]) => void
// 	// initializeTopicMessages: (workspaces: Workspace[]) => void
// 	handleSendMessage: (message: any) => void
// 	attachments: any[]
// 	handleProjectClick: (project: ProjectListItem) => void
// 	handleStartAddWorkspace: (workspaceName: string) => void
// }

// /**
//  * @description 超级麦吉工作区组件
//  * @deprecated 后续需要删除
//  * 拆分成三个组件：WorkspacePage、ProjectPage、TopicPage
//  * @param props
//  */
// function MainWorkspaceContent(props: MainWorkspaceContentProps) {
// 	const {
// 		workspacePage,
// 		setWorkspacePage,
// 		workspaces,
// 		setWorkspaces,
// 		selectedWorkspace,
// 		setSelectedWorkspace,
// 		fetchWorkspaces,
// 		updateWorkspaceStatus,
// 		handleDeleteWorkspace,
// 		projects,
// 		selectedProject,
// 		setSelectedProject,
// 		handleCreateProject,
// 		handleDeleteProject,
// 		handleDeleteProjectConfirm,
// 		handleRenameProject,
// 		fetchProjects,
// 		updateProjects,
// 		updateProjectStatus,
// 		topics,
// 		setTopics,
// 		fetchTopics,
// 		setSelectedTopic,
// 		updateTopicStatus,
// 		handleCreateTopic,
// 		messages,
// 		setAttachments,
// 		selectedTopic,
// 		// initializeTopicMessages,
// 		handleSendMessage,
// 		attachments,
// 		handleProjectClick,
// 		handleStartAddWorkspace,
// 	} = props

// 	/** ======================== Hooks ======================== */
// 	const { styles } = useStyles()
// 	const { t } = useTranslation("super")
// 	const responsive = useResponsive()
// 	const isMobile = !responsive.md
// 	const { handleNoPermissionCollaborationProject } = useNoPermissionCollaborationProject()

// 	/** ======================== Refs ======================== */
// 	const detailRef = useRef<DetailRef>(null)
// 	// topic_id和page_token的映射
// 	const topicPageTokenMap = useRef<Record<string, string>>({})
// 	const messagePanelContainerRef = useRef<HTMLDivElement>(null)
// 	const topicNotHaveMoreMessageMap = useRef<Record<string, boolean>>({})

// 	/** ======================== States ======================== */
// 	const [autoDetail, setAutoDetail] = useState<any>()
// 	const [userSelectDetail, setUserSelectDetail] = useState<any>()
// 	const [showLoading, setShowLoading] = useState(false)
// 	const [attachmentList, setAttachmentList] = useState<any[]>([])
// 	const [topicModeInfo, setTopicModeInfo] = useState<any>("")
// 	// 当前活跃的文件ID，用于同步文件列表和文件查看器的选中状态
// 	const [activeFileId, setActiveFileId] = useState<string | null>(null)
// 	const [agentDesignerVisible, setAgentDesignerVisible] = useState(false)
// 	const [isShowLoadingInit, setIsShowLoadingInit] = useState(false)

// 	// Get current topic status from historyItems (which has the latest status)
// 	const currentTopicStatus = useMemo(() => {
// 		if (!selectedTopic?.id) return undefined
// 		const currentTopic = topics.find((topic) => topic.id === selectedTopic.id)
// 		return currentTopic?.task_status || selectedTopic.task_status
// 	}, [selectedTopic?.id, selectedTopic?.task_status, topics])

// 	useUpdateEffect(() => {
// 		if (workspacePage === WorkspacePage.Home) {
// 			setIsShowLoadingInit(false)
// 		}
// 	}, [workspacePage])

// 	// 使用详情模式缓存 hook
// 	useDetailModeCache({
// 		selectedProjectId: selectedProject?.id,
// 		autoDetail,
// 		userDetail: userSelectDetail,
// 		setAutoDetail,
// 		setUserDetail: setUserSelectDetail,
// 	})

// 	// 订阅 activeFileId 更新事件
// 	useEffect(() => {
// 		const handleActiveFileIdUpdate = (fileId: string | null) => {
// 			console.log("🟢 Received activeFileId update via PubSub:", fileId)
// 			setActiveFileId(fileId)
// 		}

// 		pubsub.subscribe(PubSubEvents.Update_Active_File_Id, handleActiveFileIdUpdate)

// 		return () => {
// 			pubsub.unsubscribe(PubSubEvents.Update_Active_File_Id, handleActiveFileIdUpdate)
// 		}
// 	}, [])

// 	// 当项目或话题发生变化时，清理状态
// 	useUpdateEffect(() => {
// 		setActiveFileId(null)
// 		setAutoDetail(null)
// 		setUserSelectDetail(null)
// 	}, [selectedProject?.id])

// 	const updateDetail = useMemoizedFn(
// 		({
// 			latestMessageDetail,
// 			isLoading,
// 			tool,
// 		}: {
// 			latestMessageDetail: any
// 			isLoading: boolean
// 			tool?: any
// 		}) => {
// 			if (isEmpty(latestMessageDetail)) {
// 				setAutoDetail({
// 					type: "empty",
// 					data: {
// 						text: isLoading ? "正在思考" : "完成任务",
// 					},
// 				})
// 			} else {
// 				setAutoDetail({
// 					...latestMessageDetail,
// 					id: tool?.id,
// 					name: tool?.name,
// 				})
// 			}
// 		},
// 	)

// 	useUpdateEffect(() => {
// 		return reaction(
// 			() => superMagicStore.messages?.get(selectedTopic?.chat_topic_id || "") || [],
// 			(topicMessages) => {
// 				if (topicMessages.length > 1) {
// 					const lastMessageWithRole = topicMessages.findLast(
// 						(m) => m.role === "assistant",
// 					)
// 					const lastMessage = topicMessages?.[topicMessages.length - 1]
// 					const lastMessageNode = superMagicStore.getMessageNode(
// 						lastMessageWithRole?.app_message_id,
// 					)

// 					// 因新版本结构，所有消息都有 seq_id，所以从 !lastMessage?.seq_id 更改为 lastMessage.type === "rich_text"
// 					const isLoading =
// 						lastMessageNode?.status === "running" ||
// 						lastMessage.type === "rich_text" ||
// 						isObject(lastMessageNode?.content) ||
// 						Boolean(lastMessageNode?.rich_text?.content) ||
// 						Boolean(lastMessageNode?.text?.content)

// 					setShowLoading(isLoading)
// 					setIsShowLoadingInit(true)

// 					// 接收到任务消息并监测到状态变化后，需重新拉取工作区、项目、话题，更新其工作状态
// 					if (lastMessageNode?.status !== currentTopicStatus && selectedProject) {
// 						updateWorkspaceStatus({
// 							workspaceId: selectedWorkspace?.id,
// 						})
// 						updateProjectStatus({
// 							projectId: selectedProject?.id,
// 						})
// 						updateTopicStatus({
// 							topicId: selectedTopic?.id,
// 							status: lastMessageNode?.status,
// 						})
// 					}

// 					const lastDetailMessage = topicMessages.findLast((m) => {
// 						const node = superMagicStore.getMessageNode(m?.app_message_id)
// 						return filterClickableMessageWithoutRevoked(node)
// 					})

// 					const lastDetailMessageNode = superMagicStore.getMessageNode(
// 						lastDetailMessage?.app_message_id,
// 					)
// 					// 当且仅当为结束任务时才会调用
// 					if (filterClickableMessageWithoutRevoked(lastDetailMessageNode)) {
// 						updateDetail({
// 							latestMessageDetail: lastDetailMessageNode?.tool?.detail,
// 							isLoading,
// 							tool: lastDetailMessageNode?.tool,
// 						})
// 						// 自动打开playbackTab，使用默认行为：
// 						// - 如果用户正在预览其他文件，则静默打开但不激活（保持用户当前的预览状态）
// 						// - 如果用户没有预览任何文件，则打开并激活playbackTab
// 						setTimeout(() => {
// 							detailRef.current?.openPlaybackTab?.()
// 						}, 100)
// 					}
// 				} else if (topicMessages?.length === 1) {
// 					setShowLoading(true)
// 				}
// 			},
// 		)
// 	}, [selectedTopic?.chat_topic_id, currentTopicStatus])

// 	useEffect(() => {
// 		pubsub.subscribe(PubSubEvents.Open_File_Tab, (data: any) => {
// 			// 使用setTimeout确保DOM更新后再打开tab
// 			setTimeout(() => {
// 				detailRef.current?.openFileTab?.(data)
// 			}, 100)
// 		})
// 		pubsub.subscribe(PubSubEvents.Open_Playback_Tab, (toolData: any) => {
// 			// 打开playback tab，用户主动点击时应该强制激活
// 			setTimeout(() => {
// 				detailRef.current?.openPlaybackTab?.({ toolData, forceActivate: true })
// 			}, 100)
// 		})
// 		return () => {
// 			pubsub?.unsubscribe(PubSubEvents.Open_File_Tab)
// 			pubsub?.unsubscribe(PubSubEvents.Open_Playback_Tab)
// 		}
// 	}, [])

// 	useEffect(() => {
// 		// 订阅缓冲区是否存在内容（当存在消息没有被消费时取消loading状态）
// 		return reaction(
// 			() => superMagicStore.buffer.get(selectedTopic?.chat_topic_id || ""),
// 			(next) => {
// 				if (next && next?.length > 0) {
// 					setShowLoading(false)
// 				}
// 			},
// 		)
// 	}, [selectedTopic?.chat_topic_id])

// 	useDeepCompareEffect(() => {
// 		setShowLoading(false)
// 		setUserSelectDetail(null)
// 	}, [selectedTopic?.id, selectedTopic?.chat_topic_id])

// 	useDeepCompareEffect(() => {
// 		projectFilesStore.setSelectedProject(selectedProject)
// 	}, [selectedProject])

// 	// 集成轮询hook
// 	const { checkNowDebounced } = useAttachmentsPolling({
// 		projectId: selectedProject?.id,
// 		onAttachmentsChange: useCallback(
// 			({ tree, list }: { tree: any[]; list: never[] }) => {
// 				// 统一处理 metadata，内部自闭环处理验证和返回逻辑
// 				const processedData = AttachmentDataProcessor.processAttachmentData({ tree, list })
// 				setAttachments(processedData.tree)
// 				setAttachmentList(processedData.list)
// 				projectFilesStore.setWorkspaceFileTree(processedData.tree)
// 			},
// 			[setAttachments, setAttachmentList],
// 		),
// 		onError: useMemoizedFn((error: any, _projectId: string) => {
// 			if (isCollaborationWorkspace(selectedWorkspace)) {
// 				// 团队共享项目，如果权限不足，回到首页
// 				handleNoPermissionCollaborationProject(error)
// 				return
// 			}
// 		}),
// 	})

// 	const updateAttachments = useDebounceFn(
// 		(selectedProject: any, callback?: () => void) => {
// 			if (!selectedProject?.id) {
// 				setAttachments([])
// 				projectFilesStore.setWorkspaceFileTree([])
// 				return
// 			}
// 			try {
// 				pubsub.publish("update_attachments_loading", true)
// 				SuperMagicApi.getAttachmentsByProjectId({
// 					projectId: selectedProject?.id,
// 					// @ts-ignore 使用window添加临时的token
// 					temporaryToken: window.temporary_token || "",
// 				})
// 					.then((res: any) => {
// 						// 统一处理 metadata，包括 index.html 文件的特殊逻辑，内部自闭环处理验证和返回逻辑
// 						const processedData = AttachmentDataProcessor.processAttachmentData(res)
// 						setAttachments(processedData.tree)
// 						setAttachmentList(processedData.list)
// 						projectFilesStore.setWorkspaceFileTree(processedData.tree)
// 						GlobalMentionPanelStore.finishLoadAttachmentsPromise(selectedProject?.id)
// 					})
// 					.finally(() => {
// 						pubsub.publish("update_attachments_loading", false)
// 					})
// 			} catch (error) {
// 				console.error("Failed to fetch attachments:", error)
// 				setAttachments([])
// 				projectFilesStore.setWorkspaceFileTree([])
// 			} finally {
// 				callback?.()
// 			}
// 		},
// 		{
// 			wait: 500,
// 		},
// 	).run

// 	const updateTopicModeInfo = useCallback((topic_id: string) => {
// 		if (!topic_id) {
// 			return setTopicModeInfo("")
// 		}
// 		SuperMagicApi.getTopicDetail({ id: topic_id }).then((res: any) => {
// 			setTopicModeInfo(res?.task_mode || "")
// 		})
// 	}, [])

// 	useDeepCompareEffect(() => {
// 		if (selectedTopic) {
// 			updateTopicModeInfo(selectedTopic.id)
// 		}
// 	}, [selectedTopic])

// 	useDeepCompareEffect(() => {
// 		const projectId = selectedProject?.id
// 		if (selectedProject) {
// 			// 初始化加载附件的Promise
// 			GlobalMentionPanelStore.initLoadAttachments(selectedProject?.id)
// 			updateAttachments(selectedProject)
// 		}

// 		return () => {
// 			if (projectId) {
// 				GlobalMentionPanelStore.clearInitLoadAttachmentsPromise(projectId)
// 			}
// 		}
// 	}, [selectedProject])

// 	const disPlayDetail = useMemo(() => {
// 		return userSelectDetail || autoDetail
// 	}, [userSelectDetail, autoDetail])

// 	// 处理删除工作区
// 	const handleDeleteWorkspaceWithConfirm = useMemoizedFn((id: string) => {
// 		openModal(DeleteDangerModal, {
// 			content: workspaces.find((ws) => ws.id === id)?.name || t("workspace.unnamedWorkspace"),
// 			needConfirm: true,
// 			onSubmit: () => handleDeleteWorkspace(id),
// 		})
// 	})

// 	useEffect(() => {
// 		pubsub.subscribe("super_magic_delete_workspace", (id: string) => {
// 			handleDeleteWorkspaceWithConfirm(id)
// 		})
// 		return () => {
// 			pubsub?.unsubscribe("super_magic_delete_workspace")
// 		}
// 	}, [handleDeleteWorkspaceWithConfirm])

// 	const pullMessage = useMemoizedFn(
// 		({
// 			conversation_id,
// 			chat_topic_id,
// 			page_token,
// 			order,
// 			limit = 20,
// 			updatePageToken = true,
// 			refreshMessages = false,
// 			callback,
// 		}: {
// 			conversation_id: string
// 			chat_topic_id: string
// 			page_token: string
// 			order: "asc" | "desc"
// 			limit?: number
// 			updatePageToken?: boolean
// 			refreshMessages?: boolean
// 			callback?: () => void
// 		}) => {
// 			if (
// 				topicNotHaveMoreMessageMap.current[chat_topic_id] &&
// 				page_token &&
// 				updatePageToken
// 			) {
// 				console.log("没有更多消息")
// 				return
// 			}
// 			SuperMagicApi.getMessagesByConversationId({
// 				conversation_id,
// 				chat_topic_id,
// 				page_token,
// 				limit,
// 				order,
// 			}).then((res) => {
// 				const newMessage = res?.items
// 					.filter((item: any) => {
// 						return (
// 							item?.seq?.message?.general_agent_card ||
// 							item?.seq?.message?.text?.content ||
// 							item?.seq?.message?.rich_text?.content
// 						)
// 					})
// 					?.map((item: any) => {
// 						const data = item?.seq?.message?.general_agent_card
// 							? item?.seq?.message?.general_agent_card
// 							: item?.seq?.message
// 						return {
// 							...data,
// 							seq_id: item?.seq?.seq_id,
// 							messageStatus: item?.seq?.message?.status,
// 						}
// 					})
// 					.filter((item: any) => !isEmpty(item))

// 				const hasAttachments = newMessage.some(
// 					(item: any) =>
// 						item?.attachments?.length > 0 || item?.tool?.attachments?.length > 0,
// 				)
// 				if (hasAttachments) {
// 					checkNowDebounced()
// 					// 临时移除，改为轮询检查文件状态
// 					// pubsub.publish("update_attachments", {
// 					// 	conversation_id,
// 					// 	chat_topic_id,
// 					// })
// 				}
// 				if (updatePageToken && res?.page_token) {
// 					topicPageTokenMap.current[chat_topic_id] = res?.page_token
// 				}

// 				callback?.()
// 				if (refreshMessages) {
// 					res?.items?.reverse()?.forEach((o: any) => {
// 						superMagicStore.enqueueMessage(chat_topic_id, o)
// 					})
// 				} else {
// 					superMagicStore.initializeMessages(chat_topic_id, res?.items)
// 				}
// 			})
// 		},
// 	)

// 	const updateTopicMessages = useMemoizedFn(
// 		({
// 			refreshMessages = false,
// 			messageCount = 100,
// 		}: { refreshMessages?: boolean; messageCount?: number } = {}) => {
// 			if (selectedTopic?.id && selectedWorkspace) {
// 				pullMessage({
// 					conversation_id: selectedTopic.chat_conversation_id,
// 					chat_topic_id: selectedTopic.chat_topic_id,
// 					page_token: "",
// 					order: "desc",
// 					limit: messageCount,
// 					updatePageToken: true,
// 					refreshMessages,
// 				})
// 			}
// 		},
// 	)

// 	useDeepCompareEffect(() => {
// 		updateTopicMessages()
// 	}, [selectedTopic])

// 	const handlePullMoreMessage = useMemoizedFn(
// 		(topicInfo: Topic | null, callback?: () => void) => {
// 			if (selectedWorkspace && topicInfo) {
// 				pullMessage({
// 					conversation_id: topicInfo.chat_conversation_id,
// 					chat_topic_id: topicInfo.chat_topic_id,
// 					page_token: topicPageTokenMap.current[topicInfo?.chat_topic_id] || "",
// 					order: "desc",
// 					limit: 100,
// 					updatePageToken: true,
// 					callback,
// 				})
// 			}
// 		},
// 	)

// 	useEffect(() => {
// 		pubsub.subscribe("update_attachments", (callback: any) => {
// 			if (
// 				selectedProject &&
// 				selectedTopic
// 				// 消息只跟topic关联
// 				// &&
// 				// data?.chat_topic_id === selectedTopic.chat_topic_id
// 			) {
// 				updateAttachments(selectedProject, callback)
// 			}
// 		})
// 		return () => {
// 			pubsub?.unsubscribe("update_attachments")
// 		}
// 		// eslint-disable-next-line react-hooks/exhaustive-deps
// 	}, [selectedTopic, selectedProject])

// 	useEffect(() => {
// 		pubsub.subscribe("super_magic_update_auto_detail", (data: any) => {
// 			setAutoDetail(data)
// 		})
// 		return () => {
// 			pubsub?.unsubscribe("super_magic_update_auto_detail")
// 		}
// 	}, [])

// 	useEffect(() => {
// 		pubsub.subscribe("super_magic_new_message", (data: any) => {
// 			console.log("我接受到的 ws 消息", data)
// 			const { topic_id: chat_topic_id = "" } = data.message || {}
// 			// superMagicStore.setMessage(chat_topic_id, data)

// 			if (
// 				selectedTopic?.chat_conversation_id &&
// 				chat_topic_id /** selectedTopic?.chat_topic_id */
// 			) {
// 				pullMessage({
// 					conversation_id: selectedTopic?.chat_conversation_id,
// 					chat_topic_id: chat_topic_id,
// 					page_token: "",
// 					order: "desc",
// 					limit: 10,
// 					updatePageToken: false,
// 					refreshMessages: true,
// 				})
// 			}
// 		})
// 		return () => {
// 			pubsub?.unsubscribe("super_magic_new_message")
// 		}
// 		// eslint-disable-next-line react-hooks/exhaustive-deps
// 	}, [selectedTopic])

// 	// 定时器：每30秒调用一次pullMessage
// 	useEffect(() => {
// 		const timer = setInterval(() => {
// 			if (
// 				selectedTopic?.id &&
// 				selectedTopic.chat_conversation_id &&
// 				selectedTopic.chat_topic_id
// 			) {
// 				pullMessage({
// 					conversation_id: selectedTopic?.chat_conversation_id,
// 					chat_topic_id: selectedTopic?.chat_topic_id,
// 					page_token: "",
// 					order: "desc",
// 					limit: 10,
// 					updatePageToken: false,
// 					refreshMessages: true,
// 				})
// 			}
// 		}, 30 * 1000)

// 		// 清理定时器
// 		return () => {
// 			clearInterval(timer)
// 		}
// 	}, [selectedTopic, pullMessage])

// 	/** 该 useEffect 用于处理撤销消息后，重新拉取消息 */
// 	useEffect(() => {
// 		pubsub.subscribe(PubSubEvents.Refresh_Topic_Messages, () =>
// 			updateTopicMessages({
// 				refreshMessages: true,
// 				messageCount: 500,
// 			}),
// 		)

// 		return () => {
// 			pubsub?.unsubscribe(PubSubEvents.Refresh_Topic_Messages)
// 		}
// 	}, [updateTopicMessages])

// 	/**
// 	 * 创建新话题
// 	 * @description 在创建新话题时，发布创建新话题的事件, 切换到创建新话题的模式，并关闭创建新话题的模态框
// 	 */
// 	useEffect(() => {
// 		if (!handleCreateTopic) {
// 			return
// 		}
// 		pubsub.subscribe(PubSubEvents.Create_New_Topic, handleCreateTopic)
// 		return () => {
// 			pubsub.unsubscribe(PubSubEvents.Create_New_Topic, handleCreateTopic)
// 		}
// 	}, [handleCreateTopic])

// 	// 当组件卸载时清理
// 	useEffect(() => {
// 		return () => {
// 			// 清理topic_id和page_token的映射
// 			topicPageTokenMap.current = {}
// 		}
// 	}, [])

// 	const { taskData } = useTaskData({ selectedTopic })

// 	// 封装消息发送处理函数
// 	const handleSendMsg = useMemoizedFn((content: JSONContent | string, options?: any) => {
// 		if (typeof content === "string") {
// 			handleSendMessage({
// 				content,
// 				showLoading: messages?.length > 1 && showLoading,
// 				selectedWorkspace,
// 				options,
// 			})
// 		} else if (!isEmptyJSONContent(content)) {
// 			handleSendMessage({
// 				jsonContent: content,
// 				showLoading: messages?.length > 1 && showLoading,
// 				selectedWorkspace,
// 				options,
// 			})
// 		}

// 		const isRichText = isObject(content)

// 		const hasContent = isRichText ? !isEmptyJSONContent(content) : content.trim()

// 		// 延迟200ms通知MessageList组件滚动到底部
// 		pubsub.publish(PubSubEvents.Message_Scroll_To_Bottom, { time: 1000 })

// 		if (messages.length === 0) {
// 			setTopicModeInfo(options?.instructs?.[0]?.value || "")
// 		}

// 		if (hasContent && messages.length === 0) {
// 			// 当消息长度为0时，更新当前话题的 task_status 为 running
// 			setTimeout(() => {
// 				const updatedWorkspaces = workspaces.map((workspace) => {
// 					// 检查是否是当前选中的工作区
// 					if (workspace.id === selectedWorkspace?.id) {
// 						// 更新工作区内的topics数组
// 						const updatedTopics = topics.map((topic) => {
// 							// 找到匹配的topic，更新其task_status
// 							if (topic.id === selectedTopic?.id) {
// 								return {
// 									...topic,
// 									task_status: TaskStatus.RUNNING,
// 								}
// 							}
// 							return topic
// 						})

// 						return {
// 							...workspace,
// 							topics: updatedTopics,
// 						}
// 					}
// 					return workspace
// 				})
// 				setWorkspaces(updatedWorkspaces)
// 			}, 2000)
// 		}
// 	})

// 	const handleFileClick = useMemoizedFn((fileItem: any) => {
// 		setUserSelectDetail(null)
// 		// 设置活跃文件ID
// 		setActiveFileId(fileItem?.file_id)
// 		// use setTimeout to ensure the DOM is updated before opening tab
// 		setTimeout(() => {
// 			detailRef.current?.openFileTab?.(fileItem)
// 		}, 100)
// 	})

// 	const isReadOnly = isReadOnlyProject(selectedProject?.user_role)

// 	const value = useMemo(() => {
// 		return {
// 			allowRevoke: selectedTopic?.topic_mode !== TopicMode.DataAnalysis,
// 			allowUserMessageCopy: true,
// 			allowScheduleTaskCreate: true,
// 			allowMessageTooltip: true,
// 			allowConversationCopy: true,
// 		}
// 	}, [selectedTopic?.topic_mode])

// 	if (isMobile) {
// 		return (
// 			<SuperMagicMobileWorkSpace
// 				workspaces={workspaces}
// 				selectedWorkspace={selectedWorkspace}
// 				fetchWorkspaces={fetchWorkspaces}
// 				setSelectedWorkspace={setSelectedWorkspace}
// 				setSelectedTopic={setSelectedTopic}
// 				selectedTopic={selectedTopic}
// 				handlePullMoreMessage={handlePullMoreMessage}
// 				messages={messages}
// 				showLoading={showLoading}
// 				taskData={taskData}
// 				attachments={attachments}
// 				attachmentList={attachmentList}
// 				setWorkspaces={setWorkspaces}
// 				handleSendMessage={handleSendMsg}
// 				topicModeInfo={topicModeInfo}
// 				currentTopicStatus={currentTopicStatus}
// 				topics={topics}
// 				setTopics={setTopics}
// 				fetchProjects={fetchProjects}
// 				fetchTopics={fetchTopics}
// 				projects={projects}
// 				setSelectedProject={setSelectedProject}
// 				selectedProject={selectedProject}
// 				setWorkspacePage={setWorkspacePage}
// 				handleStartAddWorkspace={handleStartAddWorkspace}
// 				handleCreateProject={handleCreateProject}
// 				handleCreateTopic={handleCreateTopic}
// 				handleDeleteProject={handleDeleteProject}
// 				handleRenameProject={handleRenameProject}
// 				onFileClick={handleFileClick}
// 				updateProjects={updateProjects}
// 			/>
// 		)
// 	}

// 	return (
// 		<div className={styles.container} data-testid="main-workspace-container">
// 			<div
// 				className={cx(
// 					workspacePage === WorkspacePage.Home && styles.emptyTopicFilesWrapper,
// 					workspacePage !== WorkspacePage.Home && styles.topicFilesWrapper,
// 					isReadOnly && styles.readOnlyMode,
// 				)}
// 				data-testid="workspace-sidebar-wrapper"
// 			>
// 				{workspacePage !== WorkspacePage.Home && (
// 					<ProjectSider
// 						showDropdown={true}
// 						items={[
// 							{
// 								key: "topicFiles",
// 								title: t("topicFiles.title"),
// 								content: (
// 									<TopicFilesButton
// 										attachments={attachments as any}
// 										setUserSelectDetail={(detail: any) => {
// 											console.log("到顶层了", detail)
// 											setUserSelectDetail(detail)
// 										}}
// 										onFileClick={handleFileClick}
// 										projectId={selectedProject?.id}
// 										activeFileId={activeFileId}
// 										selectedTopic={selectedTopic}
// 										handleNewTopic={handleCreateTopic}
// 										onAttachmentsChange={setAttachments}
// 										selectedProject={selectedProject}
// 										allowEdit={!isReadOnly}
// 										selectedWorkspace={selectedWorkspace}
// 										projects={projects}
// 										workspaces={workspaces}
// 									/>
// 								),
// 							},
// 							// {
// 							// 	title: "数据看板",
// 							// 	content: <SiderDashboard />,
// 							// },
// 							// {
// 							// 	title: "数据源",
// 							// 	content: <SiderDataSource />,
// 							// },
// 							{
// 								key: "task",
// 								title: t("scheduleTask.title"),
// 								content: (
// 									<SiderTask
// 										selectWorkspaceId={selectedWorkspace?.id}
// 										selectProjectId={selectedProject?.id}
// 										selectTopicId={selectedTopic?.id}
// 									/>
// 								),
// 								visible: !isReadOnly,
// 							},
// 						]}
// 					/>
// 				)}
// 				{workspacePage !== WorkspacePage.Home && (
// 					<div className={styles.detailPanel} data-testid="detail-panel-wrapper">
// 						<Detail
// 							ref={detailRef}
// 							disPlayDetail={disPlayDetail}
// 							userSelectDetail={userSelectDetail}
// 							setUserSelectDetail={setUserSelectDetail}
// 							attachments={attachments}
// 							attachmentList={attachmentList}
// 							topicId={selectedTopic?.id}
// 							baseShareUrl={`${window.location.origin}/share`}
// 							currentTopicStatus={currentTopicStatus}
// 							messages={messages}
// 							autoDetail={autoDetail}
// 							allowEdit={!isReadOnly}
// 							selectedTopic={selectedTopic}
// 							selectedProject={selectedProject}
// 							activeFileId={activeFileId}
// 							onActiveFileChange={setActiveFileId}
// 						/>
// 					</div>
// 				)}
// 			</div>

// 			{workspacePage === WorkspacePage.Home && (
// 				<div className={cx(styles.messagePanelWrapper, styles.emptyMessagePanel)}>
// 					<EmptyWorkspacePanel
// 						onSendJSONContent={handleSendMsg}
// 						messages={messages}
// 						taskData={taskData}
// 						showLoading={showLoading}
// 						isEmptyStatus={workspacePage === WorkspacePage.Home}
// 					/>
// 				</div>
// 			)}

// 			{workspacePage === WorkspacePage.Chat && !isReadOnly && (
// 				<div className={cx(styles.messagePanelWrapper, styles.chatMessagePanelWrapper)}>
// 					{/* Message Header */}
// 					<MessageHeader />
// 					{selectedTopic && (
// 						<>
// 							<MessageListProvider value={value}>
// 								<MessageList
// 									data={messages}
// 									setSelectedDetail={(detail: any) => {
// 										setUserSelectDetail(detail)
// 									}}
// 									selectedTopic={selectedTopic}
// 									handlePullMoreMessage={handlePullMoreMessage}
// 									showLoading={showLoading}
// 									currentTopicStatus={currentTopicStatus}
// 									handleSendMsg={handleSendMsg}
// 									onFileClick={handleFileClick}
// 								/>
// 							</MessageListProvider>
// 							<MessagePanel
// 								containerRef={messagePanelContainerRef}
// 								onSendJSONContent={handleSendMsg}
// 								messages={messages}
// 								taskData={taskData}
// 								showLoading={showLoading}
// 								selectedProject={selectedProject}
// 								selectedTopic={selectedTopic}
// 								setSelectedTopic={setSelectedTopic}
// 								isEmptyStatus={false}
// 								handleCreateProject={handleCreateProject}
// 								className={styles.messagePanel}
// 								textAreaWrapperClassName={styles.emptyMessageTextAreaWrapper}
// 								topicModeInfo={topicModeInfo}
// 								handleCreateTopic={handleCreateTopic}
// 								onFileClick={handleFileClick}
// 								selectedWorkspace={selectedWorkspace}
// 								attachments={attachments}
// 								isShowLoadingInit={isShowLoadingInit}
// 								mentionPanelStore={GlobalMentionPanelStore}
// 							/>
// 						</>
// 					)}
// 				</div>
// 			)}
// 		</div>
// 	)
// }

// // 导出的工作区组件
// export default memo(MainWorkspaceContent)
