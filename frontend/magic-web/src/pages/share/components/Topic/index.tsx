import TopicFilesButton from "@/pages/superMagic/components/TopicFilesButton"
import TopicFilesCore, {
	TopicFilesCoreRef,
} from "@/pages/superMagic/components/TopicFilesButton/TopicFilesCore"
import Detail, { DetailRef } from "@/pages/superMagic/components/Detail"
import LoadingMessage from "@/pages/superMagic/components/LoadingMessage"
import TaskList from "../TaskList"
import ReplayLogo from "@/pages/share/assets/icon/replay_logo.svg"
import PreviewDetailPopup from "@/pages/superMagicMobile/components/PreviewDetailPopup/index"
import { getFileType } from "@/pages/superMagic/utils/handleFIle"
import { getAppEntryFile } from "@/pages/superMagic/components/MessageList/components/MessageAttachment/utils"
import { detectContentTypeRender } from "@/pages/superMagic/components/Detail/components/FilesViewer/utils/preview"
import { IconFolder, IconLayoutGrid, IconLogin, IconPlayerPlayFilled } from "@tabler/icons-react"
import { MagicTooltip } from "@/components/base"
import { Slider } from "@/components/shadcn-ui/slider"
import { Button } from "@/components/shadcn-ui/button"
import { Popup, SafeArea } from "antd-mobile"
import { useDebounceFn, useMemoizedFn } from "ahooks"
import { isEmpty } from "lodash-es"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import MessageList from "../MessageList"
import {
	MessageStatus,
	TaskStatus,
	type TaskData,
} from "@/pages/superMagic/pages/Workspace/types"
import CommonPopup from "@/pages/superMagicMobile/components/CommonPopup"
import { useDownloadAll } from "@/pages/superMagic/components/TopicFilesButton/useDownloadAll"
import { getBaseUrl } from "@/pages/superMagicMobile/utils/mobile"
import { useTranslation } from "react-i18next"
import ProjectSider from "@/pages/superMagic/components/ProjectSider"
import BackToLatestButton from "@/pages/superMagic/components/MessageList/components/BackToLatestButton"
import { filterClickableMessage } from "@/pages/superMagic/utils/handleMessage"
import { history } from "@/routes/history"
import { RouteName } from "@/routes/constants"
import { messagesTransformer } from "../MessageList/utils"
import { observer } from "mobx-react-lite"
import FooterLogo from "./components/FooterLogo"
import useResizablePanel from "@/pages/superMagic/hooks/useResizablePanel"
import ResizableDivider from "@/pages/superMagic/components/ResizableDivider"
import {
	PROJECT_SIDER_WIDTH_STORAGE_KEY,
	MESSAGE_PANEL_WIDTH_STORAGE_KEY,
	DEFAULT_MIN_WIDTH,
	DEFAULT_MAX_WIDTH,
	DEFAULT_WIDTH,
} from "@/pages/superMagic/constants/resizablePanel"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import projectFilesStore from "@/stores/projectFiles"
import useShareRoute from "@/pages/superMagic/hooks/useShareRoute"
import { calculateDefaultOpenFileId } from "@/pages/superMagic/components/Share/FileSelector/utils"
import { useShareMenuFilters } from "../../hooks"

function Topic({
	data,
	resource_name,
	isMobile,
	attachments,
	isLogined,
	isFileShare,
	fileId,
	defaultOpenFileId,
	topicId,
	projectId,
	showAllProjectFiles,
	viewFileList,
	showCreatedByBadge,
	allowDownloadProjectFile,
}: {
	data: any
	resource_name: string
	isMobile: boolean
	attachments: any
	isLogined: boolean
	isFileShare?: boolean
	fileId?: string
	defaultOpenFileId?: string
	topicId?: string
	projectId?: string
	showAllProjectFiles?: boolean
	isProjectShare?: boolean
	viewFileList?: boolean
	showCreatedByBadge?: boolean
	allowDownloadProjectFile?: boolean
}) {
	const { t } = useTranslation("super")

	const [taskData, setTaskData] = useState<TaskData | null>(null)
	const previewDetailPopupRef = useRef(null) as any
	const manualFilePopupRef = useRef(null) as any // 用于手动选择文件的 Popup
	const [messageList, setMessageList] = useState<any[]>([])
	const [autoDetail, setAutoDetail] = useState<any>(null)
	const [userDetail, setUserDetail] = useState<any>(null)
	const timerRef = useRef<any>({})
	const messageContainerRef = useRef<HTMLDivElement>(null)
	const [taskIsEnd, setTaskIsEnd] = useState(false)
	const [isBottom, setIsBottom] = useState(false)
	const [attachmentVisible, setAttachmentVisible] = useState(false)
	const [hasStarted, setHasStarted] = useState(false)
	const [countdown, setCountdown] = useState(10)
	const detailRef = useRef<DetailRef>(null)
	const topicFilesCoreRef = useRef<TopicFilesCoreRef>(null)
	const [sliderValue, setSliderValue] = useState(0)
	const [showBackToLatest, setShowBackToLatest] = useState(false)
	// Add activeFileId state management same as workspace
	const [activeFileId, setActiveFileId] = useState<string | null>(null)

	const { handleDownloadAll, allLoading } = useDownloadAll({ projectId })

	const { isShareRoute, isLegacy } = useShareRoute()

	// 判断是否是新格式文件分享（多个文件，无fileId）
	const isNewFileShare = isFileShare && !fileId

	// 使用分享页面菜单过滤 Hook
	const { filterShareMenuItems, filterBatchDownloadLayerMenuItems } = useShareMenuFilters({
		allowDownloadProjectFile,
	})

	// 判断是否需要调整 BackToLatestButton 的位置
	// BackToLatestButton 只在话题分享场景显示，当 Badge 也显示时，需要上移按钮避免遮挡
	const needAdjustButtonPosition = showCreatedByBadge && !isFileShare

	// Hover 状态管理
	const [isProjectSiderHovering, setIsProjectSiderHovering] = useState(false)
	const [isMessagePanelHovering, setIsMessagePanelHovering] = useState(false)

	// ProjectSider 宽度管理（与 TopicPage/ProjectPage 共享 storageKey）
	const {
		width: projectSiderWidth,
		isDragging: isProjectSiderDragging,
		handleMouseDown: handleProjectSiderMouseDown,
	} = useResizablePanel({
		minWidth: DEFAULT_MIN_WIDTH.PROJECT_SIDER,
		maxWidth: DEFAULT_MAX_WIDTH.PROJECT_SIDER,
		defaultWidth: DEFAULT_WIDTH.PROJECT_SIDER,
		storageKey: PROJECT_SIDER_WIDTH_STORAGE_KEY,
		direction: "left", // 向左拖拽增加宽度（右侧边框）
	})

	// 消息面板宽度管理（与 TopicPage 共享 storageKey）
	const {
		width: messagePanelWidth,
		isDragging: isMessagePanelDragging,
		handleMouseDown: handleMessagePanelMouseDown,
	} = useResizablePanel({
		minWidth: DEFAULT_MIN_WIDTH.MESSAGE_PANEL,
		maxWidth: DEFAULT_MAX_WIDTH.MESSAGE_PANEL,
		defaultWidth: DEFAULT_WIDTH.MESSAGE_PANEL,
		storageKey: MESSAGE_PANEL_WIDTH_STORAGE_KEY,
	})

	// const setMessageList = (list: any[]) => {
	// 	console.log("@---->", topicId, list)
	// 	superMagicStore.setShareMessage(topicId, list)
	// 	setMessageLists(
	// 		(list || [])?.map((o) => {
	// 			return {
	// 				...o,
	// 				magic_message_id: o?.message_id,
	// 				app_message_id: o?.message_id,
	// 				topic_id: o?.topic_id,
	// 				type: o?.type,
	// 				send_time: o?.send_timestamp,
	// 				status: o?.status,
	// 				event: o?.event,
	// 				debug: o?.[o?.type],
	// 				correlation_id: o?.correlation_id,
	// 				role: o?.role || "user",
	// 				seq_id: o?.message_id,
	// 			}
	// 		}),
	// 	)
	// }

	const handlePreviewDetail = useMemoizedFn((item: any) => {
		previewDetailPopupRef.current?.open(item, attachments.tree, attachments.list)
	})

	const messagesWithoutRevoked = useMemo(() => {
		if (!data?.list?.length) {
			return data?.list
		}
		const _revokedMessageIndex = data.list.findIndex(
			(item: any) => item?.im_status === MessageStatus.REVOKED,
		)
		const revokedMessageIndex =
			_revokedMessageIndex !== -1 ? _revokedMessageIndex : data.list.length
		return data.list.slice(0, revokedMessageIndex)
	}, [data])

	const updateDataWithValue = useMemoizedFn((value: number) => {
		if (!messagesWithoutRevoked?.length) return

		const clampedIndex = Math.max(0, Math.min(value, messagesWithoutRevoked.length))
		const targetMessages = messagesWithoutRevoked.slice(0, clampedIndex)
		setMessageList(messagesTransformer(targetMessages))
		setUserDetail(null)

		if (targetMessages.length > 0) {
			const lastTaskMessage = [...targetMessages]
				.reverse()
				.find((msg) => msg?.steps && msg?.steps?.length > 0)
			if (lastTaskMessage?.steps)
				setTaskData({
					process: lastTaskMessage.steps,
					topic_id: lastTaskMessage.topic_id,
				})

			const lastDetailMessage = [...targetMessages]
				.reverse()
				.find((msg) => filterClickableMessage(msg))
			if (filterClickableMessage(lastDetailMessage))
				setAutoDetail({
					...lastDetailMessage.tool.detail,
					id: lastDetailMessage.tool.id,
					name: lastDetailMessage.tool.name,
				})
			if (isMobile) {
				handlePreviewDetail({
					...lastDetailMessage.tool.detail,
					id: lastDetailMessage.tool.id,
					name: lastDetailMessage.tool.name,
					isFromNode: true,
				})
			}
		} else {
			setTaskData(null)
			setAutoDetail({})
		}

		setIsBottom(clampedIndex >= messagesWithoutRevoked.length)
		setHasStarted(true)
		// 移除强制滚动，让 useLayoutEffect 来处理滚动逻辑
	})

	const { run: debouncedUpdateData } = useDebounceFn(updateDataWithValue, {
		wait: 300,
	})

	// 处理进度条拖拽中
	const handleSliderChange = useCallback(
		(value: number) => {
			// 清除所有定时器
			if (timerRef.current.timer) clearInterval(timerRef.current.timer)
			if (timerRef.current.countdownTimer) clearInterval(timerRef.current.countdownTimer)

			// 立即更新slider的值，保持UI响应
			setSliderValue(value)
			// 防抖更新实际数据
			debouncedUpdateData(value)
		},
		[debouncedUpdateData],
	)

	// 从当前进度继续播放
	const resumePlay = useCallback(() => {
		if (!messagesWithoutRevoked?.length) return

		// 清除现有定时器
		if (timerRef.current.timer) clearInterval(timerRef.current.timer)

		// 从当前messageList长度开始播放
		let currentIndex = messageList.length

		// 如果已经播放完了，就不需要继续播放
		if (currentIndex >= messagesWithoutRevoked.length) return

		timerRef.current.timer = setInterval(() => {
			if (currentIndex < messagesWithoutRevoked.length) {
				const newMessage = messagesWithoutRevoked[currentIndex]
				if (filterClickableMessage(newMessage)) {
					setAutoDetail?.({
						...newMessage?.tool?.detail,
						id: newMessage?.tool?.id,
						name: newMessage?.tool?.name,
					})
					// 移动端，更新detail
					if (isMobile && !userDetail) {
						previewDetailPopupRef.current?.onlyUpdateDetail(
							{
								...newMessage?.tool?.detail,
								id: newMessage?.tool?.id,
								isFromNode: true,
							},
							attachments.tree,
							attachments.list,
						)
					}
				}
				setMessageList((pre) => [...pre, ...messagesTransformer([newMessage])])
				currentIndex += 1
			} else {
				clearInterval(timerRef.current.timer)
			}
		}, 400)
	}, [
		messagesWithoutRevoked,
		messageList.length,
		isMobile,
		userDetail,
		attachments.tree,
		attachments.list,
	])

	// 处理进度条拖拽完成
	const handleSliderChangeComplete = useCallback(
		(value: number) => {
			// 拖拽完成后，如果还没播放完，就继续播放
			if (value < messagesWithoutRevoked.length) {
				resumePlay()
			}
		},
		[messagesWithoutRevoked.length, resumePlay],
	)

	// 同步messageList长度到sliderValue
	useEffect(() => {
		setSliderValue(messageList.length)
	}, [messageList.length])

	// 初始加载前10条消息
	useEffect(() => {
		if (messagesWithoutRevoked?.length) {
			// 只加载前10条消息，或者如果总条数少于10则全部加载
			const initialCount = Math.min(10, messagesWithoutRevoked.length)
			const initialMessages = messagesWithoutRevoked.slice(0, initialCount)
			setMessageList(messagesTransformer(initialMessages))
		}
	}, [messagesWithoutRevoked])

	const play = useCallback(() => {
		pubsub.publish("super_magic_playback_start")
		setIsBottom(false)
		// 确保清除任何现有的定时器
		if (timerRef.current.timer) {
			clearInterval(timerRef.current.timer)
		}
		// 从头开始加载消息
		let currentIndex = 0
		timerRef.current.timer = setInterval(() => {
			if (currentIndex < messagesWithoutRevoked.length) {
				const newMessage = messagesWithoutRevoked[currentIndex]
				if (filterClickableMessage(newMessage)) {
					setAutoDetail?.({
						...newMessage?.tool?.detail,
						id: newMessage?.tool?.id,
						name: newMessage?.tool?.name,
					})
					// 移动端，更新detail
					if (isMobile && !userDetail) {
						previewDetailPopupRef.current?.onlyUpdateDetail(
							{
								...newMessage?.tool?.detail,
								id: newMessage?.tool?.id,
								name: newMessage?.tool?.name,
								isFromNode: true,
							},
							attachments.tree,
							attachments.list,
						)
					}
				}
				setMessageList((pre) => [...pre, ...messagesTransformer([newMessage])])
				currentIndex += 1
			} else {
				clearInterval(timerRef.current.timer)
			}
		}, 400)
	}, [messagesWithoutRevoked])

	// 处理开始显示消息
	const startShowingMessages = useCallback(() => {
		pubsub.publish("super_magic_playback_start")
		setMessageList([])
		setHasStarted(true)
		play()
	}, [play])

	const isLoadAll = useMemo(() => {
		return messageList.length === messagesWithoutRevoked.length
	}, [messageList, messagesWithoutRevoked])

	// 倒计时自动开始显示
	useEffect(() => {
		if (hasStarted || !messagesWithoutRevoked?.length) return undefined

		// 清除任何现有的定时器
		if (timerRef.current.countdownTimer) {
			clearInterval(timerRef.current.countdownTimer)
		}

		timerRef.current.countdownTimer = setInterval(() => {
			setCountdown((prev) => {
				if (prev <= 1) {
					clearInterval(timerRef.current.countdownTimer)
					startShowingMessages()
					return 0
				}
				return prev - 1
			})
		}, 1000)

		return () => {
			if (timerRef.current.countdownTimer) {
				clearInterval(timerRef.current.countdownTimer)
			}
		}
	}, [messagesWithoutRevoked, hasStarted, startShowingMessages, messageList])

	// 滚动到消息列表的合适位置，确保初始消息可见
	useEffect(() => {
		if (messageList.length > 0 && !hasStarted) {
			const container = messageContainerRef.current
			if (container) {
				// 滚动到50%高度位置，让上半部分消息可见
				container.scrollTop = container.scrollHeight * 0.3
			}
		}
	}, [messageList, hasStarted])

	// Add pubsub event listeners same as workspace
	useEffect(() => {
		pubsub.subscribe(PubSubEvents.Open_File_Tab, (openFileTabData: any) => {
			// 使用setTimeout确保DOM更新后再打开tab
			setTimeout(() => {
				detailRef.current?.openFileTab?.(openFileTabData)
			}, 100)
		})
		pubsub.subscribe(PubSubEvents.Open_Playback_Tab, (toolData: any) => {
			// 打开playback tab，用户主动点击时应该强制激活
			setTimeout(() => {
				detailRef.current?.openPlaybackTab?.({ toolData, forceActivate: true })
			}, 100)
		})
		return () => {
			pubsub?.unsubscribe(PubSubEvents.Open_File_Tab)
			pubsub?.unsubscribe(PubSubEvents.Open_Playback_Tab)
		}
	}, [])

	// 分享场景初始化时自动打开playback tab
	useEffect(() => {
		// 确保消息列表已加载且不是文件分享场景
		if (!isFileShare && messageList.length > 0 && detailRef.current) {
			// 检查是否有工具调用消息
			const hasToolMessages = messageList.some((msg) => filterClickableMessage(msg))
			if (hasToolMessages) {
				// 延迟打开，确保Detail组件已完全初始化
				// 使用默认行为：如果没有激活的文件tab则激活playbackTab
				setTimeout(() => {
					detailRef.current?.openPlaybackTab?.()
				}, 100)
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [messageList.length, isFileShare])

	// 清理定时器
	useEffect(() => {
		return () => {
			if (timerRef.current.timer) {
				clearInterval(timerRef.current.timer)
			}
			if (timerRef.current.countdownTimer) {
				clearInterval(timerRef.current.countdownTimer)
			}
		}
	}, [])

	// Clear activeFileId when projectId or topicId changes
	useEffect(() => {
		setActiveFileId(null)
	}, [projectId])

	// 同步 attachments.tree 到 projectFilesStore，确保 ToolCall 组件能正确获取 fileTree
	useEffect(() => {
		if (attachments?.tree && attachments.tree.length > 0) {
			projectFilesStore.setWorkspaceFileTree(attachments.tree)
		} else {
			projectFilesStore.setWorkspaceFileTree([])
		}
	}, [attachments?.tree])

	const isAtBottomRef = useRef(true) // 👈 用 ref 保存旧的 isAtBottom 状态

	useEffect(() => {
		const el = messageContainerRef.current
		if (!el) return

		const handleScroll = () => {
			const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
			isAtBottomRef.current = distanceFromBottom < 30
			setShowBackToLatest(!isAtBottomRef.current)
		}

		el.addEventListener("scroll", handleScroll)
		return () => el.removeEventListener("scroll", handleScroll)
	}, [hasStarted])

	// 👇 2. 在 DOM 完成渲染后再判断要不要滚到底部
	useLayoutEffect(() => {
		const el = messageContainerRef.current
		if (!el) return

		if (isAtBottomRef.current) {
			requestAnimationFrame(() => {
				el.scrollTo({
					top: el.scrollHeight,
				})
			})
		}
	}, [messageList]) // 👈 注意：这里不能再判断 isScrolledToBottom，而是用之前记录的 isAtBottomRef

	useEffect(() => {
		if (messageList.length === messagesWithoutRevoked?.length) {
			setIsBottom(true)
		}
	}, [messageList.length, messagesWithoutRevoked?.length, taskData])

	// 当消息列表变化时，查找最后一条有task且task.process长度不为0的消息
	useEffect(() => {
		if (messageList && messageList.length > 0) {
			// 从后往前遍历找到第一个符合条件的消息
			let foundTaskData = false
			for (let i = messageList.length - 1; i >= 0; i -= 1) {
				const message = messageList[i]
				if (message?.steps && message?.steps?.length > 0) {
					// 设置为当前任务数据
					const newTaskData = {
						process: message.steps,
						topic_id: message.topic_id,
					}
					setTaskData(newTaskData)
					// 发布任务结束事件
					if (
						message?.steps?.every?.(
							(step: any) => step?.status === "finished" || step?.status === "error",
						)
					) {
						pubsub.publish("super_magic_playback_end", newTaskData)
					}
					foundTaskData = true
					break
				}
			}
			// 如果没有找到符合条件的消息，清空TaskData
			if (!foundTaskData) {
				setTaskData(null)
			}
			const lastMessageWithTaskId = messageList
				.slice()
				.reverse()
				.find((message) => message.role === "assistant")
			const lastMessage = messageList[messageList.length - 1]
			const isLoading =
				lastMessageWithTaskId?.status === "running" || lastMessage?.text?.content
			setTaskIsEnd(!isLoading)
		} else {
			// 如果消息列表为空，也清空TaskData
			setTaskData(null)
		}
	}, [messageList])

	const scrollToBottom = useCallback(() => {
		const container = messageContainerRef.current
		if (container) {
			container.scrollTo({
				top: container.scrollHeight,
			})
		}
	}, [])

	// 直接显示结果的处理：立即加载所有消息，停止倒计时
	const handleShowResult = useMemoizedFn(() => {
		pubsub.publish("super_magic_playback_start")
		setUserDetail(null)
		setHasStarted(true)
		// 查找所有消息中带有详情的最后一条
		const lastDetailItem = [...messagesWithoutRevoked]
			.reverse()
			.find((item) => filterClickableMessage(item))
		if (lastDetailItem && !isFileShare) {
			setAutoDetail({
				...lastDetailItem.tool.detail,
				id: lastDetailItem.tool.id,
				name: lastDetailItem.tool.name,
			})
		}

		// 清除所有定时器
		if (timerRef.current.timer) {
			clearInterval(timerRef.current.timer)
		}
		if (timerRef.current.countdownTimer) {
			clearInterval(timerRef.current.countdownTimer)
		}

		// 一次性设置所有消息
		setMessageList(messagesTransformer(messagesWithoutRevoked))

		// 滚动到底部
		requestAnimationFrame(() => {
			scrollToBottom()
		})
		setIsBottom(true)
	})

	// Handle file sharing mode
	// 旧格式文件分享（有fileId）：自动打开并最大化指定文件
	// 新格式文件分享（无fileId）：如果有defaultOpenFileId，自动打开指定文件；否则只显示消息列表
	useEffect(() => {
		// 确定要打开的文件ID：旧格式用fileId，新格式用defaultOpenFileId
		let targetFileId = fileId || defaultOpenFileId

		if (!targetFileId) {
			const levelOneFile = attachments?.tree?.map?.((item: any) => item.file_id) || []
			const firstFileId = calculateDefaultOpenFileId(levelOneFile, attachments?.tree || [])
			targetFileId = firstFileId || ""
		}

		// 新格式文件分享：只显示消息列表，如果有defaultOpenFileId则自动打开文件
		if (isNewFileShare && handleShowResult) {
			handleShowResult()
			// 如果没有要打开的文件，直接返回
			if (!targetFileId) {
				return
			}
		}

		// 旧格式文件分享：自动打开并最大化指定文件
		if (fileId && (isFileShare || messagesWithoutRevoked?.length) && handleShowResult) {
			handleShowResult()
		}

		// 如果有要打开的文件ID，执行打开逻辑（新旧格式共用）
		// 需要等待 attachments.tree 加载完成
		if (
			targetFileId &&
			attachments?.tree &&
			attachments.tree.length > 0 &&
			handlePreviewDetail
		) {
			// Find the file in attachments and set it as user detail
			const findFileInAttachments = (attachmentTree: any): any => {
				if (!attachmentTree) return null

				for (const item of attachmentTree) {
					if (item.file_id === targetFileId || item.id === targetFileId) {
						return item
					}
					if (item.children) {
						const found = findFileInAttachments(item.children)
						if (found) return found
					}
				}
				return null
			}

			const targetFile = findFileInAttachments(attachments.tree)
			if (targetFile) {
				// 检查是否是文件夹且有 metadata.type
				const isFolder =
					targetFile.is_directory ||
					(targetFile.children && targetFile.children.length > 0)
				let fileToOpen = targetFile

				// 如果是文件夹且有 metadata.type，获取入口文件
				if (isFolder && targetFile.metadata?.type) {
					const entryFile = getAppEntryFile(targetFile.children || [])
					if (entryFile) {
						fileToOpen = entryFile
					}
				}

				const fileName =
					fileToOpen.display_filename || fileToOpen.file_name || fileToOpen.filename

				// 先检查是否有内容类型渲染配置（如 design 类型）
				const contentTypeConfig = detectContentTypeRender(fileToOpen)
				let type: string | null = null
				let fileData: any = {
					file_name: fileName,
					file_extension: fileToOpen.file_extension,
					file_size: fileToOpen.file_size,
					file_id: fileToOpen.file_id || fileToOpen.id,
					metadata: fileToOpen?.metadata,
				}

				if (contentTypeConfig) {
					// 使用内容类型渲染配置
					type = contentTypeConfig.detailType
					// 使用数据转换器转换数据
					if (contentTypeConfig.dataTransformer) {
						fileData = {
							...fileData,
							...contentTypeConfig.dataTransformer(fileToOpen),
						}
					}
				} else {
					// 没有内容类型配置，使用文件扩展名判断
					type = getFileType(fileToOpen.file_extension)
				}

				if (type && type !== "notSupport") {
					const fileDetail = {
						type, // 根据内容类型配置或文件扩展名确定类型
						data: fileData,
						currentFileId: fileToOpen.file_id || fileToOpen.id,
						attachments: attachments.tree,
					}

					if (isMobile) {
						// 移动端：调用handlePreviewDetail打开弹层
						handlePreviewDetail(fileDetail)
					} else {
						// PC端：直接设置Detail并打开文件tab
						if (isFileShare) {
							setTimeout(() => {
								detailRef.current?.openFileTab(fileToOpen)
							}, 100)
						} else {
							setUserDetail(fileDetail)
							pubsub.publish("super_magic_maximize_file")
						}
					}
				} else {
					const emptyDetail = {
						type: "empty",
						data: {
							text: "暂不支持预览该文件,请下载该文件",
						},
					}

					if (isMobile) {
						handlePreviewDetail(emptyDetail)
					} else {
						setUserDetail(emptyDetail)
					}
				}
			}
		}
	}, [
		isNewFileShare,
		isFileShare,
		fileId,
		defaultOpenFileId,
		data,
		attachments,
		handleShowResult,
		isMobile,
		handlePreviewDetail,
		showAllProjectFiles,
		detailRef,
		messagesWithoutRevoked?.length,
	])

	const replay = useCallback(() => {
		// 重置状态
		setMessageList([])
		setAutoDetail(null)
		setTaskData(null)

		// 清除现有定时器
		if (timerRef.current.timer) {
			clearInterval(timerRef.current.timer)
		}
		if (timerRef.current.countdownTimer) {
			clearInterval(timerRef.current.countdownTimer)
		}

		// 立即开始播放
		play()
	}, [play])

	useEffect(() => {
		pubsub.subscribe("super_magic_folder_click", () => {
			setAttachmentVisible(true)
		})
		return () => {
			pubsub.unsubscribe("super_magic_folder_click")
		}
	}, [])

	const baseShareUrl = useMemo(() => {
		return `${getBaseUrl()}/share`
	}, [])

	// 判断是否显示项目文件栏
	const shouldShowProjectSider = useMemo(() => {
		const isNewTopicShare = isShareRoute && !isLegacy
		// 如果 viewFileList 为 false，则不显示项目文件栏（仅对新分享格式生效）
		if (viewFileList === false && (isNewFileShare || isNewTopicShare)) {
			return false
		}

		// 移动端不显示项目文件栏
		if (isMobile) {
			return false
		}

		// 新文件分享：仅在桌面端显示
		if (isNewFileShare || isFileShare) {
			return true
		}

		// 其他情况：使用原有逻辑
		// 隐藏条件：
		// 1. 任务数据为空且附件树为空
		// 2. 自动详情和用户详情都为空
		// 且不满足显示条件：showAllProjectFiles 为 true
		const shouldHide =
			(isEmpty(attachments.tree) || isEmpty(autoDetail || userDetail)) && !showAllProjectFiles

		return !shouldHide
	}, [
		isNewFileShare,
		isMobile,
		attachments.tree,
		autoDetail,
		userDetail,
		isFileShare,
		showAllProjectFiles,
		viewFileList,
	])

	return (
		<>
			<div className="flex h-full w-full flex-row justify-center overflow-hidden bg-transparent">
				{isMobile ? (
					<>
						<PreviewDetailPopup
							ref={previewDetailPopupRef}
							setUserSelectDetail={(detail) => {
								handlePreviewDetail(detail)
							}}
							onClose={() => {
								handlePreviewDetail(autoDetail)
							}}
							isFileShare={isFileShare}
							onOpenNewPopup={(detail, attachmentTree, attachmentList) => {
								// 打开新弹层用于显示链接文件
								manualFilePopupRef.current?.open(
									detail,
									attachmentTree,
									attachmentList,
								)
							}}
							projectId={projectId}
							allowDownload={allowDownloadProjectFile}
						/>
						{/* 独立的文件预览 Popup，用于手动选择文件 */}
						{isFileShare && (
							<PreviewDetailPopup
								ref={manualFilePopupRef}
								setUserSelectDetail={(detail) => {
									manualFilePopupRef.current?.open(
										detail,
										attachments.tree,
										attachments.list,
									)
								}}
								onClose={() => {
									// 关闭时不做任何操作，保持原有分享文件的渲染
								}}
								isFileShare={false}
								allowDownload={allowDownloadProjectFile}
							/>
						)}
					</>
				) : null}

				{hasStarted && (
					<>
						{shouldShowProjectSider ? (
							<>
								<ProjectSider
									width={projectSiderWidth}
									className="m-2 overflow-hidden rounded-lg border bg-background"
									items={[
										{
											key: "topicFiles",
											title: t("topicFiles.title"),
											content: (
												<TopicFilesButton
													attachments={attachments.tree}
													setUserSelectDetail={(detail: any) => {
														setUserDetail(detail)
													}}
													projectId={projectId}
													className="left-0"
													onFileClick={(fileItem: any) => {
														setUserDetail(null)
														// use setTimeout to ensure the DOM is updated before opening tab
														setTimeout(() => {
															detailRef.current?.openFileTab(fileItem)
														}, 100)
													}}
													activeFileId={activeFileId}
													allowEdit={false}
													filterMenuItems={filterShareMenuItems}
													filterBatchDownloadLayerMenuItems={
														filterBatchDownloadLayerMenuItems
													}
													allowDownload={allowDownloadProjectFile}
												/>
											),
										},
									]}
								/>
								<ResizableDivider
									position="right"
									offsetLeft={projectSiderWidth}
									onMouseDown={handleProjectSiderMouseDown}
									onHoverChange={setIsProjectSiderHovering}
								/>
							</>
						) : null}
						{(isEmpty(autoDetail) &&
							isEmpty(userDetail) &&
							!showAllProjectFiles &&
							!isFileShare) ||
							isMobile ? null : (
							<div className="my-2 flex-1 overflow-y-hidden rounded-lg border border-border bg-card transition-all duration-300 ease-in-out">
								<Detail
									ref={detailRef}
									disPlayDetail={isEmpty(userDetail) ? autoDetail : userDetail}
									attachments={attachments.tree}
									attachmentList={attachments.list}
									userSelectDetail={userDetail}
									setUserSelectDetail={(detail: any) => {
										setUserDetail(detail)
									}}
									topicId={topicId}
									baseShareUrl={baseShareUrl}
									currentTopicStatus={
										isLoadAll ? TaskStatus.FINISHED : TaskStatus.RUNNING
									}
									messages={messageList}
									autoDetail={autoDetail}
									showPlaybackControl={false}
									isFileShare={isFileShare}
									onActiveFileChange={setActiveFileId}
									topicName={resource_name}
									projectId={projectId}
									allowDownload={allowDownloadProjectFile}
								/>
							</div>
						)}
					</>
				)}

				{hasStarted && !isFileShare && !isNewFileShare && (
					<>
						<ResizableDivider
							position="left"
							offsetLeft={messagePanelWidth + 5}
							onMouseDown={handleMessagePanelMouseDown}
							onHoverChange={setIsMessagePanelHovering}
						/>
						<div className={cn("p-2", isMobile ? "w-full" : "")}>
							<div
								className={cn(
									"duration-[0.8s] relative h-full max-w-full overflow-x-hidden overflow-y-hidden rounded-lg border border-border bg-white transition-[width] ease-in-out dark:bg-card",
									"max-md:w-full max-md:min-w-0",
									((!showAllProjectFiles &&
										isEmpty(autoDetail) &&
										isEmpty(userDetail)) ||
										!hasStarted) &&
									"w-full min-w-[420px] max-w-[840px] max-md:max-w-none",
									!(
										(!showAllProjectFiles &&
											isEmpty(autoDetail) &&
											isEmpty(userDetail)) ||
										!hasStarted
									) && "w-[420px] min-w-[420px]",
									!hasStarted &&
									"scale-[1.7] [transform:perspective(900px)_rotateX(30deg)_translateY(150px)] max-md:scale-110 max-md:[transform:perspective(550px)_rotateX(20deg)_translateY(-20px)]",
									(isMessagePanelDragging || isMessagePanelHovering) &&
									"select-none !transition-none",
								)}
								style={
									showAllProjectFiles ||
										!isEmpty(autoDetail) ||
										!isEmpty(userDetail)
										? {
											width: messagePanelWidth,
											position: "relative",
										}
										: undefined
								}
							>
								<div className="relative h-full min-h-0 w-full">
									<ScrollArea
										className="h-full min-h-0 w-full [&_[data-slot='scroll-area-viewport']>div]:!block"
										viewportClassName="p-2.5 max-md:pt-[calc(60px+var(--safe-area-inset-top,env(safe-area-inset-top)))]"
										viewportRef={messageContainerRef}
									>
										<MessageList
											topicId={data?.project_id}
											messageList={messageList}
											onSelectDetail={(detail) => {
												setUserDetail(detail)
												if (isMobile) {
													handlePreviewDetail(detail)
												}
											}}
											currentTopicStatus={
												isLoadAll ? TaskStatus.FINISHED : TaskStatus.RUNNING
											}
										/>
										{!taskIsEnd && messageList?.length > 0 && !hasStarted && (
											<LoadingMessage />
										)}
									</ScrollArea>
									<BackToLatestButton
										visible={showBackToLatest}
										onClick={scrollToBottom}
										className={cn(
											"fixed",
											needAdjustButtonPosition && "!bottom-[58px]",
										)}
									/>
								</div>
							</div>
						</div>
					</>
				)}
			</div>

			{hasStarted && !isFileShare && !isNewFileShare && (
				<div className="fixed bottom-0 left-0 right-0 z-[1020] box-border h-[50px] bg-background shadow-[0px_0px_1px_0px_rgba(0,0,0,0.3),0px_0px_30px_0px_rgba(0,0,0,0.06)] max-md:h-[calc(50px+var(--safe-area-inset-bottom,env(safe-area-inset-bottom)))]">
					<div className="flex flex-col gap-2.5 p-2">
						<div className="flex flex-1 flex-row items-center justify-between max-md:gap-2.5 [&_img]:h-9 [&_img]:w-auto">
							{isMobile && <FooterLogo />}
							{(taskData?.process?.length || 0) > 0 && (
								<div className="mr-[30px] min-w-0 max-w-[400px] shrink overflow-visible max-md:mr-0 max-md:flex-1">
									<TaskList taskData={taskData} />
								</div>
							)}
							{!isMobile && (
								<div className="mr-2.5 flex h-9 w-auto shrink-0 select-none items-center gap-2 p-1 px-2">
									<MagicTooltip title={t("playbackControl.autoPlayback")}>
										<span className="topic-status-shimmer shrink overflow-hidden text-ellipsis whitespace-nowrap text-xs font-normal leading-[18px]">
											{isLoadAll
												? t("playbackControl.finished")
												: t("playbackControl.autoPlayback")}
										</span>
									</MagicTooltip>
								</div>
							)}
							<div className="mr-[30px] flex-1 max-md:absolute max-md:-top-[18px] max-md:left-0 max-md:right-0 max-md:z-10 max-md:mr-0 max-md:h-[26px]">
								<Slider
									min={0}
									max={messagesWithoutRevoked?.length || 0}
									value={[sliderValue]}
									onValueChange={(values) => handleSliderChange(values[0])}
									onValueCommit={(values) =>
										handleSliderChangeComplete(values[0])
									}
									disabled={!messagesWithoutRevoked?.length}
									className="[&_[data-slot=slider-range]]:bg-foreground [&_[data-slot=slider-thumb]]:hidden [&_[data-slot=slider-track]]:bg-[#d1d1d1]"
								/>
							</div>
							{isBottom ? (
								<Button
									variant="outline"
									className="h-[30px] rounded-full border-border px-5 py-1.5 text-sm font-normal leading-5 text-foreground"
									onClick={replay}
								>
									{t("share.replay")}
								</Button>
							) : null}
							{!isBottom ? (
								<Button
									variant="outline"
									className="h-[30px] rounded-full border-border px-5 py-1.5 text-sm font-normal leading-5 text-foreground"
									onClick={handleShowResult}
								>
									{t("share.viewResult")}
								</Button>
							) : null}
						</div>
					</div>
				</div>
			)}
			{!hasStarted && !isFileShare && (
				<div className="fixed bottom-0 left-0 right-0 z-10 flex h-full animate-fadeInUp flex-col items-center justify-center bg-gradient-to-b from-transparent via-[#F9F9F9] to-[#F9F9F9] px-5 pb-0 pt-[60px] transition-all duration-300 ease-in-out dark:via-background dark:to-background">
					<div className="w-[840px] max-md:w-[335px] max-md:max-w-[335px]">
						<div className="mb-5 flex items-center justify-start gap-2.5 rounded-lg">
							<div className="relative h-[50px] w-[50px] shrink-0 overflow-hidden rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.12)] transition-all duration-300">
								<div className="absolute -left-[30px] -top-[30px] h-[120px] w-[120px] animate-[spin_3s_linear_infinite] bg-gradient-to-r from-[#FFAFC8] via-[#E08AFF] to-[#9FC3FF] opacity-90"></div>
								<div className="absolute z-10 flex h-[50px] w-[50px] items-center justify-center rounded-full">
									<img
										src={ReplayLogo}
										alt=""
										className="h-[30px] w-[30px] brightness-0 invert"
									/>
								</div>
							</div>
							<div className="flex flex-col items-start">
								<div className="mb-1.5 text-center text-sm font-normal leading-5 text-foreground max-md:text-sm max-md:leading-5">
									{t("share.viewingTask")}
								</div>
								<div className="bg-gradient-to-br from-[#3F8FFF] to-[#EF2FDF] bg-clip-text text-lg font-semibold leading-[1.3333em] text-transparent [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] max-md:max-h-10 max-md:text-sm max-md:leading-5">
									{resource_name}
								</div>
							</div>
						</div>
						<div className="relative mx-auto flex min-h-[300px] w-full min-w-[200px] flex-col items-center justify-center gap-5 rounded-[20px] bg-white/95 shadow-[0_20px_40px_rgba(0,0,0,0.1)] backdrop-blur-[10px] after:absolute after:bottom-[-1px] after:left-0 after:h-full after:w-full after:rounded-b-lg after:bg-gradient-to-b after:from-transparent after:via-transparent after:to-background dark:bg-white/[0.95] dark:after:to-gray-100">
							<div className="absolute bottom-0 left-0 right-0 top-0 z-10 flex h-full w-full items-center justify-center">
								<div
									className="relative h-20 w-20 cursor-pointer overflow-hidden rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.12)] transition-all duration-300 max-md:h-[60px] max-md:w-[60px]"
									onClick={startShowingMessages}
								>
									<div className="absolute -left-[50px] -top-[50px] h-[150px] w-[150px] cursor-pointer bg-black/80 max-md:-left-[30px] max-md:-top-[30px] max-md:h-[120px] max-md:w-[120px]"></div>
									<div className="absolute left-1/2 top-1/2 z-10 flex h-[50px] w-[50px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full max-md:h-10 max-md:w-10">
										<IconPlayerPlayFilled
											size={50}
											color="white"
											className="h-[50px] w-[50px] cursor-pointer brightness-0 invert max-md:h-10 max-md:w-10"
										/>
									</div>
								</div>
							</div>
							{/* Static progress bar */}
							<div className="absolute bottom-7 left-6 right-6 z-[1] flex h-6 items-center">
								<div className="absolute bottom-0 left-0 right-0 h-1 w-full overflow-visible rounded-full bg-[#E6E7EA]">
									<div
										className="absolute left-[5px] top-1/2 z-[2] -ml-[5px] h-[13px] w-[13px] -translate-y-1/2 rounded-full border-2 border-white bg-[#315CEC] shadow-[0px_0px_1px_0px_rgba(0,0,0,0.3),0px_4px_14px_0px_rgba(0,0,0,0.1)] transition-[left] duration-300"
										style={{ left: "5px" }}
									/>
								</div>
							</div>
							<div
								className={cn(
									"duration-[0.8s] relative h-full max-h-[500px] overflow-x-hidden overflow-y-hidden rounded-lg bg-background px-[90px] pt-7 transition-all ease-in-out dark:bg-card max-md:max-h-[335px] max-md:min-w-0 max-md:max-w-[calc(100%-40px)] max-md:p-0",
									((!showAllProjectFiles &&
										isEmpty(autoDetail) &&
										isEmpty(userDetail)) ||
										!hasStarted) &&
									"w-full min-w-[420px] max-w-[840px] max-md:max-w-none",
								)}
							>
								<div className="h-full w-full overflow-y-auto overflow-x-hidden p-2.5">
									<MessageList
										topicId={data?.project_id}
										messageList={messageList}
										onSelectDetail={(detail) => {
											setUserDetail(detail)
											if (isMobile) {
												handlePreviewDetail(detail)
											}
										}}
										currentTopicStatus={
											isLoadAll ? TaskStatus.FINISHED : TaskStatus.RUNNING
										}
									/>
									{!taskIsEnd && messageList?.length > 0 && !hasStarted && (
										<LoadingMessage />
									)}
								</div>
							</div>
						</div>
						<div className="flex w-full flex-col items-center gap-3 text-center">
							<div className="my-5 rounded-md backdrop-blur-[5px]">
								<div className="text-xs font-normal leading-4 text-muted-foreground [text-shadow:0_1px_1px_rgba(255,255,255,0.6)] dark:[text-shadow:none] max-md:text-[13px] max-md:leading-[18px]">
									{t("share.replayWillStartIn", { countdown })}
								</div>
							</div>
						</div>
						<div
							className={cn(
								"flex justify-center gap-4",
								isMobile && "flex-col gap-3",
							)}
						>
							<Button
								variant="default"
								size="lg"
								onClick={startShowingMessages}
								className={cn(
									"rounded-lg shadow-md transition-all duration-200 hover:shadow-lg hover:brightness-105 active:scale-[0.98]",
									"dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1)] dark:hover:shadow-[0_0_0_1px_rgba(255,255,255,0.15),0_4px_12px_rgba(255,255,255,0.06)]",
									isMobile && "w-full",
								)}
							>
								<IconPlayerPlayFilled
									size={16}
									className="text-primary-foreground"
								/>
								<span>{t("share.viewReplay")}</span>
							</Button>
							<Button
								variant="outline"
								size="lg"
								onClick={handleShowResult}
								className={cn(
									"rounded-lg font-medium transition-all duration-200 hover:bg-accent/50 active:scale-[0.98]",
									"dark:hover:ring-1 dark:hover:ring-white/10",
									isMobile && "w-full",
								)}
							>
								{t("share.viewResult")}
							</Button>
						</div>
					</div>
				</div>
			)}
			<Popup
				bodyStyle={{
					width: "80%",
					backgroundColor: "#fff",
					padding: "20px",
					borderRadius: "12px 0px 0px 12px",
				}}
				position="right"
				style={{
					zIndex: 1021,
				}}
			>
				<SafeArea position="top" />
				<div className="mt-2.5 border-b border-border">
					<div className="mb-2.5 text-xs font-normal text-muted-foreground">
						{t("share.navigation")}
					</div>
					{!isLogined ? (
						<div
							className="flex h-10 cursor-pointer items-center gap-1 rounded-lg p-2.5 text-sm text-foreground"
							onClick={() => history.replace({ name: RouteName.Login })}
						>
							<IconLogin className="size-5" />
							{t("share.login")}
						</div>
					) : (
						<div
							className="flex h-10 cursor-pointer items-center gap-1 rounded-lg p-2.5 text-sm text-foreground"
							onClick={() => history.push({ name: RouteName.Super })}
						>
							<IconLayoutGrid className="size-5" />
							{t("share.enterWorkspace")}
						</div>
					)}
				</div>
				<div className="mt-2.5 border-b border-border">
					<div className="mb-2.5 text-xs font-normal text-muted-foreground">
						{t("share.topic")}
					</div>
					<div
						className="flex h-10 cursor-pointer items-center gap-1 rounded-lg p-2.5 text-sm text-foreground"
						onClick={() => setAttachmentVisible(true)}
					>
						<IconFolder className="size-5" /> <span>{t("share.viewProjectFiles")}</span>
					</div>
				</div>
				<SafeArea position="bottom" />
			</Popup>
			<CommonPopup
				popupProps={{
					onMaskClick: () => {
						setAttachmentVisible(false)
						// 重置TopicFilesCore所有状态
						setTimeout(() => {
							topicFilesCoreRef.current?.resetAllStates()
						}, 0)
					},
					onClose: () => {
						setAttachmentVisible(false)
						// 重置TopicFilesCore所有状态
						setTimeout(() => {
							topicFilesCoreRef.current?.resetAllStates()
						}, 0)
					},
					visible: attachmentVisible,
					bodyStyle: {
						backgroundColor: "#fff",
						display: "flex",
						flexDirection: "column",
					},
				}}
				title={t("share.projectFiles")}
			>
				<div className="flex flex-1 flex-col gap-2.5 overflow-hidden p-0">
					<TopicFilesCore
						ref={topicFilesCoreRef}
						attachments={attachments.tree}
						setUserSelectDetail={(detail: any) => {
							setUserDetail(detail)
							if (isMobile && isFileShare) {
								// 文件分享场景：使用独立的 Popup 打开手动选择的文件
								manualFilePopupRef.current?.open(
									detail,
									attachments.tree,
									attachments.list,
								)
							} else if (isMobile) {
								// 非文件分享场景：使用原有逻辑
								handlePreviewDetail(detail)
							}
						}}
						projectId={projectId}
						handleDownloadAll={handleDownloadAll}
						allLoading={allLoading}
						activeFileId={activeFileId}
						allowEdit={false}
						filterMenuItems={filterShareMenuItems}
						filterBatchDownloadLayerMenuItems={filterBatchDownloadLayerMenuItems}
						allowDownload={allowDownloadProjectFile}
					/>
				</div>
			</CommonPopup>
		</>
	)
}

export default observer(Topic)
