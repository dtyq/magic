import {
	getAttachmentsByThreadId,
	getMessagesByConversationId,
	smartTopicRename,
	getTopicsByWorkspaceId,
	getTopicDetailByTopicId,
} from "@/opensource/pages/superMagic/utils/api"
import SuperMagicMobileWorkSpace from "@/opensource/pages/superMagicMobile/pages/workspace/index"
import pubsub from "@/utils/pubsub"
import { useDeepCompareEffect, useResponsive } from "ahooks"
import { Modal } from "antd"
import { cx } from "antd-style"
import { isEmpty } from "lodash-es"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Detail from "../../components/Detail"
import EmptyWorkspacePanel from "../../components/EmptyWorkspacePanel"
import MessageList from "../../components/MessageList"
import type { MessagePanelProps } from "../../components/MessagePanel/MessagePanel"
import MessagePanel from "../../components/MessagePanel/MessagePanel"
import WorkspaceHeader from "../../components/WorkspaceHeader"
import WorkspacePanel from "../../components/WorkSpacePanel"
import { useTopics } from "../../hooks/useTopics"
import { useWorkspace } from "../../hooks/useWorkspace"
import { userStore } from "@/opensource/models/user"
import { observer } from "mobx-react-lite"
import useStyles from "./style"
import type { TaskData, Workspace } from "./types"
// 工作区组件
function MainWorkspaceContent() {
	const { styles } = useStyles()
	const { userInfo } = userStore.user
	const [userSelectDetail, setUserSelectDetail] = useState() as any
	const [autoDetail, setAutoDetail] = useState() as any
	// 任务列表数据
	const [taskData, setTaskData] = useState<TaskData | null>(null)
	const [showLoading, setShowLoading] = useState(false)
	// topic_id和page_token的映射
	const topicPageTokenMap = useRef<Record<string, string>>({})
	const topicNotHaveMoreMessageMap = useRef<Record<string, boolean>>({})
	const responsive = useResponsive()
	const [topicModeInfo, setTopicModeInfo] = useState<any>("")
	const isMobile = responsive.md === false
	// 使用自定义hooks管理状态和逻辑
	const {
		workspaces,
		setWorkspaces,
		selectedWorkspace,
		setSelectedWorkspace,
		editingWorkspaceId,
		editingName,
		isAddingWorkspace,
		handleInputChange,
		handleInputKeyDown,
		handleInputBlur,
		handleStartEditWorkspace,
		handleStartAddWorkspace,
		handleDeleteWorkspace,
		fetchWorkspaces,
		// resetEditing,
	} = useWorkspace()

	const {
		messages,
		fileList,
		setFileList,
		attachments,
		setAttachments,
		handleSendMessage,
		initializeTopicMessages,
		selectedThreadInfo,
		setTopicMessagesMap,
		setSelectedThreadInfo,
	} = useTopics(userInfo)

	const updateDetail = useCallback(
		({ latestMessageDetail, isLoading }: { latestMessageDetail: any; isLoading: boolean }) => {
			if (isEmpty(latestMessageDetail)) {
				setAutoDetail({
					type: "empty",
					data: {
						text: isLoading ? "正在思考" : "完成任务",
					},
				})
			} else {
				setAutoDetail(latestMessageDetail)
			}
		},
		[setAutoDetail],
	)

	useEffect(() => {
		if (messages.length > 1) {
			const lastMessageWithTaskId = messages
				.slice()
				.reverse()
				.find((message) => message.role === "assistant")
			const lastMessage = messages
				.slice()
				.reverse()
				.find((message) => message)
			const isLoading = lastMessageWithTaskId?.status === "running" || !lastMessage?.seq_id
			setShowLoading(isLoading)

			const lastDetailMessage = messages
				.slice()
				.reverse()
				.find((message) => !isEmpty(message?.tool?.detail))

			updateDetail({ latestMessageDetail: lastDetailMessage?.tool?.detail, isLoading })
		} else if (messages?.length === 1) {
			setShowLoading(true)
		}
	}, [messages, updateDetail])

	useEffect(() => {
		pubsub.subscribe("OrganizationList_close", (data: boolean) => {
			if (data) {
				setWorkspaces([])
				fetchWorkspaces()
			}
		})
		return () => {
			pubsub?.unsubscribe("OrganizationList_close")
		}
	}, [])

	useDeepCompareEffect(() => {
		setAutoDetail(null)
		setUserSelectDetail(null)
		setShowLoading(false)
	}, [selectedThreadInfo])

	const updateAttachments = useCallback((selectedThreadInfo: any) => {
		if (!selectedThreadInfo?.id) {
			setAttachments([])
			return
		}
		try {
			getAttachmentsByThreadId({ id: selectedThreadInfo?.id }).then((res: any) => {
				setAttachments(res?.tree || [])
			})
		} catch (error) {
			console.error("Failed to fetch attachments:", error)
			setAttachments([])
		}
	}, [])

	const updateTopicModeInfo = useCallback((topic_id: string) => {
		if (!topic_id) {
			return setTopicModeInfo("")
		}
		getTopicDetailByTopicId({ id: topic_id }).then((res: any) => {
			setTopicModeInfo(res?.task_mode || "")
		})
	}, [])

	const isEmptyStatus = useMemo(() => {
		return messages?.length === 0
	}, [messages])

	useDeepCompareEffect(() => {
		updateAttachments(selectedThreadInfo)
		updateTopicModeInfo(selectedThreadInfo?.id)
	}, [selectedThreadInfo])

	const disPlayDetail = useMemo(() => {
		return userSelectDetail || autoDetail
	}, [userSelectDetail, autoDetail])

	// 处理删除工作区
	const handleDeleteWorkspaceWithConfirm = useCallback(
		(id: string) => {
			Modal.confirm({
				title: "确认删除",
				content: `确定要删除工作区 "${workspaces.find((ws) => ws.id === id)?.name}" 吗？`,
				onOk: () => handleDeleteWorkspace(id),
			})
		},
		[workspaces, handleDeleteWorkspace],
	)

	const pullMessage = useCallback(
		({
			conversation_id,
			chat_topic_id,
			page_token,
			order,
			limit = 20,
			updatePageToken = true,
		}: {
			conversation_id: string
			chat_topic_id: string
			page_token: string
			order: "asc" | "desc"
			limit?: number
			updatePageToken?: boolean
		}) => {
			if (
				topicNotHaveMoreMessageMap.current[chat_topic_id] &&
				page_token &&
				updatePageToken
			) {
				console.log("没有更多消息")
				return
			}
			getMessagesByConversationId({
				conversation_id,
				chat_topic_id,
				page_token,
				limit,
				order,
			}).then((res) => {
				const newMessage = res?.items
					.filter((item: any) => {
						return (
							item?.seq?.message?.general_agent_card ||
							item?.seq?.message?.text?.content
						)
					})
					?.map((item: any) => {
						const data = item?.seq?.message?.general_agent_card
							? item?.seq?.message?.general_agent_card
							: item?.seq?.message
						return {
							...data,
							seq_id: item?.seq?.seq_id,
						}
					})
					.filter((item: any) => !isEmpty(item))

				if (!newMessage?.length) {
					console.log("无需更新消息列表")
					return
				}
				const hasAttachments = newMessage.some(
					(item: any) =>
						item?.attachments?.length > 0 || item?.tool?.attachments?.length > 0,
				)
				if (hasAttachments) {
					pubsub.publish("update_attachments", {
						conversation_id,
						chat_topic_id,
					})
				}
				if (updatePageToken && res?.page_token) {
					console.log("更新page_token", res?.page_token)
					topicPageTokenMap.current[chat_topic_id] = res?.page_token
				}

				setTopicMessagesMap((pre) => {
					// 如果是拉取最新的消息，不需要更新page_token

					// 获取已有消息和新消息
					const existingMessages = pre?.[chat_topic_id] || []

					// 将消息按send_timestamp排序
					const sortMessagesByTimestamp = (msgArray: any[]) => {
						// 先过滤掉重复的seq_id
						const uniqueMessages = Array.from(
							new Map(msgArray.map((item) => [item.seq_id, item])).values(),
						)

						// 按seq_id从小到大排序
						return uniqueMessages.sort((a, b) => {
							const seqIdA = BigInt(a.seq_id || "0")
							const seqIdB = BigInt(b.seq_id || "0")
							return Number(seqIdA - seqIdB)
						})
					}

					const combinedMessages = [...existingMessages, ...newMessage].filter(
						(item) => item?.seq_id,
					)
					// 先排序
					const sortedMessages = sortMessagesByTimestamp(combinedMessages)
					// if (updatePageToken && page_token) {
					topicNotHaveMoreMessageMap.current[chat_topic_id] = !res.has_more
					// }
					return {
						...pre,
						[chat_topic_id]: sortedMessages,
					}
				})
			})
		},
		[setTopicMessagesMap, topicNotHaveMoreMessageMap],
	)

	useEffect(() => {
		if (selectedThreadInfo?.id && selectedWorkspace) {
			pullMessage({
				conversation_id: selectedWorkspace?.conversation_id || "",
				chat_topic_id: selectedThreadInfo?.chat_topic_id,
				page_token: "",
				order: "desc",
				limit: 100,
				updatePageToken: true,
			})
		}
	}, [selectedThreadInfo, selectedWorkspace])

	// 处理工作区选择
	const handleWorkspaceSelect = useCallback(
		(workspace: Workspace) => {
			setSelectedWorkspace(workspace)

			// 如果当前工作区有话题列表，且没有选中的话题ID，则选择第一个话题
			if (workspace.topics.length > 0 && !selectedThreadInfo?.id) {
				// 选择第一个话题
				setSelectedThreadInfo(workspace.topics[0])
			} else if (workspace.topics.length > 0) {
				// 判断当前选中的话题是否属于这个工作区
				const isSelectedTopicInWorkspace = workspace.topics.some(
					(topic) => topic.id === selectedThreadInfo?.id,
				)

				// 如果选中的话题不在当前工作区，则选择该工作区的第一个话题
				if (!isSelectedTopicInWorkspace) {
					setSelectedThreadInfo(workspace.topics[0])
				}
			} else {
				// 如果没有话题，清空选中状态
				setSelectedThreadInfo(null)
			}
		},
		[selectedThreadInfo, setSelectedWorkspace, setSelectedThreadInfo],
	)
	// 当工作区数据变化时，初始化话题消息映射表
	useEffect(() => {
		initializeTopicMessages(workspaces)
		if (isEmpty(selectedWorkspace) && !isEmpty(workspaces)) {
			setSelectedWorkspace(workspaces?.[0])
		}
		if (isEmpty(workspaces)) {
			setSelectedWorkspace(null)
			setSelectedThreadInfo(null)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [workspaces, selectedWorkspace])

	const handlePullMoreMessage = useCallback(
		(threadInfo: any) => {
			if (selectedWorkspace) {
				pullMessage({
					conversation_id: selectedWorkspace?.conversation_id,
					chat_topic_id: threadInfo?.chat_topic_id,
					page_token: topicPageTokenMap.current[threadInfo?.chat_topic_id] || "",
					order: "desc",
					limit: 100,
					updatePageToken: true,
				})
			}
		},
		[selectedWorkspace, pullMessage, topicPageTokenMap],
	)

	// 当选中的工作区变化时，尝试选择其中的话题
	useEffect(() => {
		if (selectedWorkspace) {
			// 判断当前选中的话题是否属于这个工作区
			const isSelectedTopicInWorkspace = selectedThreadInfo?.id
				? selectedWorkspace.topics.some((topic) => topic.id === selectedThreadInfo?.id)
				: false

			if (!isSelectedTopicInWorkspace && selectedWorkspace.topics.length > 0) {
				// 如果当前选中的话题不在这个工作区中，且工作区有话题，选择第一个话题
				setSelectedThreadInfo(selectedWorkspace.topics[0])
			} else if (!selectedThreadInfo?.id && selectedWorkspace.topics.length > 0) {
				// 如果没有选中的话题，且工作区有话题，选择第一个话题
				setSelectedThreadInfo(selectedWorkspace.topics[0])
			} else if (selectedWorkspace.topics.length === 0) {
				// 如果工作区没有话题，清空选中状态
				setSelectedThreadInfo(null)
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedWorkspace])

	useEffect(() => {
		pubsub.subscribe("update_attachments", (data: any) => {
			if (data?.chat_topic_id === selectedThreadInfo.chat_topic_id) {
				updateAttachments(selectedThreadInfo)
			}
		})
		return () => {
			pubsub?.unsubscribe("update_attachments")
		}
	}, [selectedThreadInfo])

	useEffect(() => {
		pubsub.subscribe("super_magic_new_message", (data: any) => {
			const { topic_id: chat_topic_id = "" } = data.message || {}
			pullMessage({
				conversation_id: data.conversation_id,
				chat_topic_id,
				page_token: "",
				order: "desc",
				limit: 10,
				updatePageToken: false,
			})
		})
		return () => {
			pubsub?.unsubscribe("super_magic_new_message")
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	// 当组件卸载时清理
	useEffect(() => {
		return () => {
			// 清理topic_id和page_token的映射
			topicPageTokenMap.current = {}
		}
	}, [])

	// 监听 selectedThreadInfo 变化，确保切换话题时重置 topicNotHaveMoreMessageMap

	// 初始加载工作区数据
	useEffect(() => {
		fetchWorkspaces()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	// 当消息列表变化时，查找最后一条有task且task.process长度不为0的消息
	useEffect(() => {
		if (messages && messages.length > 0) {
			// 从后往前遍历找到第一个符合条件的消息
			let foundTaskData = false
			for (let i = messages.length - 1; i >= 0; i -= 1) {
				const message = messages[i]
				if (message?.steps && message?.steps?.length > 0) {
					// 设置为当前任务数据
					setTaskData({
						process: message.steps,
						topic_id: message.topic_id,
					})
					foundTaskData = true
					break
				}
			}
			// 如果没有找到符合条件的消息，清空TaskData
			if (!foundTaskData) {
				setTaskData(null)
			}
		} else {
			// 如果消息列表为空，也清空TaskData
			setTaskData(null)
		}
	}, [messages])

	const handleThreadSelect = useCallback(
		(thread: any) => {
			setSelectedThreadInfo(thread)
		},
		[setSelectedThreadInfo],
	)

	// 封装消息发送处理函数
	const handleSendMsg = useCallback(
		(content: string, options: any) => {
			handleSendMessage({
				content: content?.trim(),
				showLoading: messages?.length > 1 && showLoading,
				selectedWorkspace,
				options,
			})
			if (messages.length === 0) {
				setTopicModeInfo(options?.instructs?.[0]?.value || "")
			}
			if (content?.trim() && messages.length === 0) {
				// 当消息长度为0时，更新当前话题的task_status为running
				setTimeout(() => {
					setWorkspaces((prev: Workspace[]) =>
						prev.map((workspace) => {
							// 检查是否是当前选中的工作区
							if (workspace.id === selectedWorkspace?.id) {
								// 更新工作区内的topics数组
								const updatedTopics = workspace.topics.map((topic) => {
									// 找到匹配的topic，更新其task_status
									if (topic.id === selectedThreadInfo?.id) {
										return {
											...topic,
											task_status: "running" as const,
										}
									}
									return topic
								})

								return {
									...workspace,
									topics: updatedTopics,
								}
							}
							return workspace
						}),
					)
				}, 2000)
				smartTopicRename({
					id: selectedThreadInfo?.id,
					user_question: content.trim(),
				}).then((res: any) => {
					const { topic_name } = res
					topic_name && fetchWorkspaces()
					setSelectedThreadInfo((pre: any) => {
						return {
							...pre,
							topic_name,
						}
					})
				})
			}
		},
		[
			handleSendMessage,
			showLoading,
			messages,
			selectedWorkspace,
			selectedThreadInfo,
			setWorkspaces,
			fetchWorkspaces,
		],
	)

	const messagePanelProps: MessagePanelProps = {
		onSendMessage: handleSendMsg,
		fileList,
		setFileList,
		taskData,
		showLoading,
		selectedThreadInfo,
		isEmptyStatus,
	}
	const updateTopicListStatus = useCallback(() => {
		if (selectedThreadInfo?.id && selectedWorkspace?.id) {
			getTopicsByWorkspaceId({ id: selectedWorkspace.id, page: 1, page_size: 999 }).then(
				(res: any) => {
					setWorkspaces((pre: any) => {
						return pre?.map((item: any) => {
							if (item.id === selectedWorkspace.id) {
								return {
									...item,
									topics: res?.list,
								}
							}
							return item
						})
					})
				},
			)
		}
	}, [selectedThreadInfo, selectedWorkspace, setWorkspaces])

	useEffect(() => {
		updateTopicListStatus()
	}, [selectedThreadInfo, showLoading, selectedWorkspace, updateTopicListStatus])

	// 添加定时器定期更新话题列表状态
	useEffect(() => {
		const timer = setInterval(() => {
			updateTopicListStatus()
		}, 5000)

		return () => {
			clearInterval(timer)
		}
	}, [updateTopicListStatus])

	console.log("isEmptyStatus-->", isEmptyStatus)
	return isMobile ? (
		<SuperMagicMobileWorkSpace
			workspaces={workspaces}
			selectedWorkspace={selectedWorkspace}
			fetchWorkspaces={fetchWorkspaces}
			setSelectedWorkspace={setSelectedWorkspace}
			setFileList={setFileList}
			fileList={fileList}
			setSelectedThreadInfo={handleThreadSelect}
			selectedThreadInfo={selectedThreadInfo}
			handlePullMoreMessage={handlePullMoreMessage}
			messages={messages}
			showLoading={showLoading}
			taskData={taskData}
			attachments={attachments}
			setWorkspaces={setWorkspaces}
			isEmptyStatus={isEmptyStatus}
			handleSendMessage={handleSendMsg}
			topicModeInfo={topicModeInfo}
		/>
	) : (
		<div className={styles.container}>
			<WorkspaceHeader
				workspaces={workspaces}
				selectedWorkspace={selectedWorkspace}
				editingWorkspaceId={editingWorkspaceId}
				editingName={editingName}
				isAddingWorkspace={isAddingWorkspace}
				onWorkspaceSelect={handleWorkspaceSelect}
				onInputChange={handleInputChange}
				onInputBlur={handleInputBlur}
				onInputKeyDown={handleInputKeyDown}
				onStartEditWorkspace={handleStartEditWorkspace}
				onStartAddWorkspace={handleStartAddWorkspace}
				onDeleteWorkspace={handleDeleteWorkspaceWithConfirm}
			/>
			<div className={styles.mainContent}>
				<div className={styles.workspacePanel}>
					<WorkspacePanel
						workspaces={workspaces}
						selectedWorkspaceId={selectedWorkspace?.id || null}
						selectedThreadInfo={selectedThreadInfo}
						onSelectThread={handleThreadSelect}
						onWorkspacesChange={setWorkspaces}
						setSelectedThreadInfo={setSelectedThreadInfo}
						attachments={attachments}
						setUserSelectDetail={setUserSelectDetail}
					/>
				</div>
				{!isEmptyStatus && (
					<div className={styles.detailPanel}>
						<Detail
							disPlayDetail={disPlayDetail}
							userSelectDetail={userSelectDetail}
							setUserSelectDetail={setUserSelectDetail}
							attachments={attachments}
						/>
					</div>
				)}
				<div
					className={cx(
						styles.messagePanelWrapper,
						isEmptyStatus && styles.emptyMessagePanel,
					)}
					style={
						isEmptyStatus
							? undefined
							: { paddingBottom: taskData?.process.length ? 224 : 185 }
					}
				>
					{isEmptyStatus ? (
						<EmptyWorkspacePanel messagePanelProps={messagePanelProps} />
					) : (
						<>
							<MessageList
								data={messages}
								setSelectedDetail={setUserSelectDetail}
								selectedThreadInfo={selectedThreadInfo}
								className={cx(isEmptyStatus && styles.emptyMessageWelcome)}
								handlePullMoreMessage={handlePullMoreMessage}
								showLoading={showLoading}
							/>
							<MessagePanel
								{...messagePanelProps}
								className={cx(
									isEmptyStatus && styles.emptyMessageInput,
									!isEmptyStatus && styles.messagePanel,
								)}
								textAreaWrapperClassName={styles.emptyMessageTextAreaWrapper}
								topicModeInfo={topicModeInfo}
							/>
						</>
					)}
				</div>
			</div>
		</div>
	)
}

// 导出的工作区组件
export default observer(MainWorkspaceContent)
