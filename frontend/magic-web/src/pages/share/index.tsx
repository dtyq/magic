import { IconFolder, IconGitFork } from "@tabler/icons-react"
import {
	useMemoizedFn,
	useResponsive,
	useDebounceEffect,
	useDeepCompareEffect,
	useUpdateEffect,
} from "ahooks"
import MagicSpin from "@/components/base/MagicSpin"
import { Button } from "@/components/shadcn-ui/button"
import magicToast from "@/components/base/MagicToaster/utils"
import { cn } from "@/lib/utils"
import { isEmpty } from "lodash-es"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useLocation } from "react-router"
import { ErrorDisplay, PasswordVerification, ShareEmptyState } from "./components"
import ShareContent from "./components/ShareContent"
import CopyProjectModal from "./components/CopyProjectModal"
import CreatedByBadge from "./components/CreatedByBadge"
import { SuperMagicApi } from "@/apis"
import StatusIcon from "../superMagic/components/MessageHeader/components/StatusIcon"
import { useTranslation } from "react-i18next"
import pubsub from "@/utils/pubsub"
import Logo from "@/layouts/BaseLayout/components/Header/components/Logo"
import { history } from "@/routes/history"
import { RouteName } from "@/routes/constants"
import { useTokenRefreshPolling } from "./hooks/useTokenRefreshPolling"
import WorkspaceButton from "./components/WorkspaceButton"
import { formatCopyProjectCount } from "@/utils/format"
import CopyProjectProgressToast from "@/components/base/CopyProjectProgressToast"
import useNavigate from "@/routes/hooks/useNavigate"
import useRoutesMetaSet from "@/routes/hooks/useRoutesMetaSet"
import useShareRoute from "../superMagic/hooks/useShareRoute"
import useLegacyFileShareData from "./hooks/useLegacyFileShareData"
import useLegacyTopicShareData from "./hooks/useLegacyTopicShareData"
import useNewFileShareData from "./hooks/useNewFileShareData"
import useNewTopicShareData from "./hooks/useNewTopicShareData"
import { userStore } from "@/models/user"
import { MagicAvatar } from "@/components/base"
import { useSharePermission } from "./hooks/useSharePermission"

const topicContainerBase =
	"flex items-center justify-between py-2.5 px-3.5 h-12 bg-card dark:bg-card backdrop-blur-[50px] border-b border-border rounded-[5px] w-full z-[99] max-md:absolute max-md:h-[calc(52px+var(--safe-area-inset-top,0px))] max-md:pt-[var(--safe-area-inset-top,0px)] max-md:px-3 max-md:pb-0 max-md:rounded-none"

function Share() {
	const navigate = useNavigate()
	const { t } = useTranslation("super")
	const { setMeta } = useRoutesMetaSet()
	// const [shareId, setShareId] = useState<string>("")
	const [isLogined, setIsLogined] = useState(false)
	const { pathname, search } = useLocation()
	// ✨ 权限管理 hook
	const { emptyStateInfo, handleSwitchOrganization, isSwitching, setRequiredOrgCode } =
		useSharePermission()
	const [isNeedPassword, setIsNeedPassword] = useState(false)
	const [resourceId, setResourceId] = useState("")
	const [projectId, setProjectId] = useState("")
	const [passwordFromUrl, setPasswordFromUrl] = useState("")
	const [data, setData] = useState({}) as any
	const [error, setError] = useState<Error | null>(null)
	const [attachments, setAttachments] = useState({} as any)
	const [loading, setLoading] = useState(false)
	const responsive = useResponsive()
	const isMobile = responsive.md === false // md breakpoint is typically 768px, so anything smaller is mobile
	const [isProjectShare, setIsProjectShare] = useState(false)
	// File sharing state
	const [isFileShare, setIsFileShare] = useState(false)
	const [fileId, setFileId] = useState("")
	// Topic sharing: view_file_list state
	const [viewFileList, setViewFileList] = useState(false)
	const [defaultOpenFileId, setDefaultOpenFileId] = useState<string>("")
	// 是否允许复制项目文件（默认为 true）
	const [allowCopyProjectFiles, setAllowCopyProjectFiles] = useState(false)
	// 是否允许下载项目文件（默认为 true）
	const [allowDownloadProjectFile, setAllowDownloadProjectFile] = useState(true)

	// Use route hook to determine route format
	const routeInfo = useShareRoute()

	// Use appropriate data hooks based on route format
	const legacyFileShareData = useLegacyFileShareData()
	const legacyTopicShareData = useLegacyTopicShareData()
	const newFileShareData = useNewFileShareData()
	const newTopicShareData = useNewTopicShareData()

	// Determine which hook to use based on route format
	const activeDataHook = useMemo(() => {
		if (routeInfo.isLegacy) {
			return routeInfo.isFileShare ? legacyFileShareData : legacyTopicShareData
		} else {
			return routeInfo.isFileShare ? newFileShareData : newTopicShareData
		}
	}, [
		routeInfo.isLegacy,
		routeInfo.isFileShare,
		legacyFileShareData,
		legacyTopicShareData,
		newFileShareData,
		newTopicShareData,
	])
	const [taskStatus, setTaskStatus] = useState("waiting")
	const [hasStarted, setHasStarted] = useState(false)
	const [showAllProjectFiles, setShowAllProjectFiles] = useState(false)
	const [isCopyProjectModalOpen, setIsCopyProjectModalOpen] = useState(false)
	// 复制进度相关状态
	const [showCopyProgress, setShowCopyProgress] = useState(false)
	const [copyingProjectId, setCopyingProjectId] = useState("")
	const [copyingProjectInfo, setCopyingProjectInfo] = useState<any>(null)
	// const [copyProjectProgress, setCopyProjectProgress] = useState(0)
	const [copyProjectIsRunning, setCopyProjectIsRunning] = useState(false)
	// 实际验证成功的密码（可能来自 URL 或用户手动输入）
	const [verifiedPassword, setVerifiedPasswordFn] = useState<string | undefined>(passwordFromUrl)

	const setVerifiedPassword = useMemoizedFn((verifiedPassword: string | undefined) => {
		setVerifiedPasswordFn(verifiedPassword)
	})

	useTokenRefreshPolling({
		resourceId,
		password: verifiedPassword,
		data,
		onTokenRefreshed: (tokenInfo) => {
			console.log("Token refreshed successfully:", tokenInfo)
		},
		onRefreshError: (error) => {
			console.error("Token refresh failed:", error)
		},
	})

	// Use getShareData from active hook
	const getShareData = useMemoizedFn(
		({ resource_id, password }: { resource_id: string; password?: string }) => {
			return activeDataHook.getShareData({ resource_id, password })
		},
	)

	// 从URL中删除password参数
	// const removePasswordFromUrl = useCallback(() => {
	// 	const urlSearchParams = new URLSearchParams(search)
	// 	if (urlSearchParams.has("password")) {
	// 		urlSearchParams.delete("password")
	// 		const newSearch = urlSearchParams.toString() ? `?${urlSearchParams.toString()}` : ""
	// 		navigate(`/share/${resourceId}${newSearch}`, { replace: true })
	// 	}
	// }, [search, resourceId, navigate])

	useUpdateEffect(() => {
		if (passwordFromUrl) {
			setVerifiedPassword(passwordFromUrl)
		}
	}, [passwordFromUrl])

	useEffect(() => {
		if (isFileShare) {
			const urlSearchParams = new URLSearchParams(search)
			if (urlSearchParams.has("showProject")) {
				setShowAllProjectFiles(true)
			}
		}
	}, [search, isFileShare])

	const updateAttachments = useCallback(
		(params: { projectId?: string; resource_id?: string; password?: string }) => {
			if (activeDataHook.updateAttachments) {
				activeDataHook.updateAttachments(params)
			}
		},
		[activeDataHook],
	)

	useEffect(() => {
		if (data?.temporary_token) {
			// @ts-ignore 给window添加临时token
			window.temporary_token = data.temporary_token
			const projectId = data?.data?.project_id || data?.data?.data?.project_id
			// @ts-ignore 给window添加临时project_id
			window.project_id = projectId
			console.log(data.data, "dataxxxxxxxx", projectId, "projectIdprojectId")
			updateAttachments({ projectId, password: verifiedPassword, resource_id: resourceId })
			setProjectId(projectId)
		}
	}, [data])

	const updateShareInfo = useMemoizedFn(() => {
		// Use route info from useShareRoute hook
		if (routeInfo.isShareRoute) {
			const params = routeInfo.shareParams
			setIsFileShare(routeInfo.isFileShare)

			if (routeInfo.isLegacy) {
				// Legacy format
				if (routeInfo.isFileShare) {
					// Legacy file share: /share/{topicId}/file/{fileId}
					setResourceId(params.topicId || "")
					setFileId(params.fileId || "")
					//@ts-ignore
					window.topic_id = params.topicId
				} else {
					// Legacy topic share: /share/{topicId}
					setResourceId(params.topicId || "")
					setFileId("")
					//@ts-ignore
					window.topic_id = params.topicId
				}
			} else {
				// New format
				if (routeInfo.isFileShare) {
					// New file share: /share/files/{resourceId}
					setResourceId(params.resourceId || "")
					setFileId("")
					//@ts-ignore
					window.topic_id = params.resourceId
				} else {
					// New topic share: /share/topic/{resourceId}
					setResourceId(params.resourceId || "")
					setFileId("")
					//@ts-ignore
					window.topic_id = params.resourceId
				}
			}
		}
	})

	useDebounceEffect(() => {
		updateShareInfo()
	}, [pathname])

	// Sync attachments from active hook
	useEffect(() => {
		if (activeDataHook.attachments && Object.keys(activeDataHook.attachments).length > 0) {
			setAttachments(activeDataHook.attachments)
		}
	}, [activeDataHook.attachments])

	// Sync loading and error from active hook
	useEffect(() => {
		setLoading(activeDataHook.loading)
	}, [activeDataHook.loading])

	useEffect(() => {
		if (activeDataHook.error) {
			setError(activeDataHook.error)
		}
	}, [activeDataHook.error])

	// Sync isProjectShare from active hook (所有 hooks 现在都返回 isProjectShare)
	useEffect(() => {
		if ("isProjectShare" in activeDataHook) {
			const hook = activeDataHook as {
				isProjectShare: boolean
			}
			setIsProjectShare(hook.isProjectShare)
		}
	}, [activeDataHook])

	// 统一处理分享数据的设置
	const applyShareData = useMemoizedFn((newData: any) => {
		if (!newData) return

		setData(newData)

		// 设置 view_file_list
		// 如果 share_project 为 true，则 view_file_list 也应该为 true
		if (newData?.share_project === true) {
			setViewFileList(true)
		} else if (newData?.extra?.view_file_list !== undefined) {
			setViewFileList(newData.extra.view_file_list)
		}

		// 设置是否允许复制项目文件（默认为 true）
		setAllowCopyProjectFiles(newData?.extra?.allow_copy_project_files ?? true)

		// 设置是否允许下载项目文件（默认为 true）
		setAllowDownloadProjectFile(newData?.extra?.allow_download_project_file ?? true)

		// 新格式分享：设置 projectId 和 defaultOpenFileId
		if (!routeInfo.isLegacy) {
			if (newData?.data?.project_id) {
				setProjectId(newData.data.project_id)
			}
			if (newData?.default_open_file_id) {
				setDefaultOpenFileId(newData.default_open_file_id)
			}
		}
	})

	const updateShareData = useMemoizedFn(() => {
		if (resourceId) {
			setLoading(true)
			setError(null)
			SuperMagicApi.checkShareResourcePassword({ resource_id: resourceId })
				.then(async (res: any) => {
					setIsNeedPassword(res?.has_password)

					// 获取URL中的password参数
					const urlSearchParams = new URLSearchParams(search)
					const password = urlSearchParams.get("password")
					setPasswordFromUrl(password || "")
					console.log(res, "resresres")
					if (res?.user_id) {
						setIsLogined(true)
					} else {
						setIsLogined(false)
					}

					// ✨ 新增：处理权限信息

					if (!res?.has_password) {
						console.log("没有密码")
						return getShareData({ resource_id: resourceId })
							.then((newData: any) => {
								applyShareData(newData)
								return newData
							})
							.catch((err: Error) => {
								if (res) {
									setRequiredOrgCode(res?.required_magic_organization_code || "")
								}
								setError(err)
								return null
							})
					}

					if (res?.has_password && password) {
						console.log("有密码")
						// 如果需要密码且URL中有密码，直接尝试验证
						return getShareData({
							resource_id: resourceId,
							password,
						})
							.then((newData: any) => {
								applyShareData(newData)
								return newData
							})
							.catch(() => {
								// setError(err)
								return null
							})
					}

					return null
				})
				.catch((err) => {
					if (userStore.user.userInfo?.user_id) {
						setIsLogined(true)
					}
					setError(err)
				})
				.finally(() => {
					setLoading(false)
				})
		}
	})
	useDeepCompareEffect(() => {
		updateShareData()
	}, [resourceId])

	// 处理密码验证成功
	const handleVerifySuccess = useMemoizedFn((newData: any, password?: string) => {
		applyShareData(newData)
		setError(null)

		// 更新实际验证成功的密码（用于 token polling）
		if (password !== undefined) {
			setVerifiedPassword(password)
		}
	})

	// 处理密码验证失败
	const handleVerifyFail = () => {
		// setError(err)
	}

	// 重新加载数据
	const handleRetry = () => {
		if (resourceId) {
			setLoading(true)
			setError(null)

			SuperMagicApi.checkShareResourcePassword({ resource_id: resourceId })
				.then((res: any) => {
					setIsNeedPassword(res?.has_password)

					if (!res?.has_password) {
						return getShareData({ resource_id: resourceId })
					}

					if (passwordFromUrl) {
						return getShareData({
							resource_id: resourceId,
							password: passwordFromUrl,
						})
					}

					return null
				})
				.then((newData: any) => {
					applyShareData(newData)
				})
				.catch(() => {
					// setError(err)
				})
				.finally(() => {
					setLoading(false)
				})
		}
	}

	useEffect(() => {
		pubsub.subscribe("super_magic_playback_end", (taskData: any) => {
			const lastTaskStatus = taskData?.process?.[taskData?.process?.length - 1]?.status
			setTaskStatus(lastTaskStatus)
		})
		pubsub.subscribe("super_magic_playback_start", () => {
			setTaskStatus("running")
			setHasStarted(true)
		})
		return () => {
			pubsub.unsubscribe("super_magic_playback_end")
			pubsub.unsubscribe("super_magic_playback_start")
		}
	}, [])

	const showWorkspaceButton = useMemo(() => {
		if (isFileShare && isMobile && isLogined) return true
		return !isMobile && isLogined
	}, [isFileShare, isMobile, isLogined])

	// 是否显示复制项目按钮：旧文件分享 或 allowCopyProjectFiles 为 true 时显示，且用户已登录
	const showCopyProjectButton = useMemo(() => {
		if (!isProjectShare || !isLogined) return false
		// 旧文件分享：始终显示
		if (routeInfo.isLegacy && routeInfo.isFileShare) return true
		// 新格式分享：根据 allowCopyProjectFiles 决定
		return allowCopyProjectFiles
	}, [
		isProjectShare,
		isLogined,
		routeInfo.isLegacy,
		routeInfo.isFileShare,
		allowCopyProjectFiles,
	])

	const showSuperMagicIcon = useMemo(() => {
		if (isFileShare && isMobile) return true
		return !isMobile || (!hasStarted && isMobile)
	}, [isFileShare, isMobile, hasStarted])

	const clearWindowData = useMemoizedFn(() => {
		// @ts-ignore
		window.temporary_token = ""
		// @ts-ignore
		window.project_id = ""
		// @ts-ignore
		window.topic_id = ""
	})
	useEffect(() => {
		return () => {
			clearWindowData()
		}
	}, [])
	const handleCopyProject = useMemoizedFn(() => {
		// 处理查询参数，添加 copyProject=1
		const urlSearchParams = new URLSearchParams(window.location.search)
		urlSearchParams.set("copyProject", "1")

		// 构建新的完整路径
		const newFullPath =
			window.location.origin +
			window.location.pathname +
			"?" +
			urlSearchParams.toString() +
			window.location.hash
		if (!isLogined) {
			navigate({
				name: RouteName.Login,
				query: {
					redirect: encodeURIComponent(newFullPath),
				},
			})
			return
		}
		console.log("登录过了")
		openCopyProjectModal()
	})

	useEffect(() => {
		console.log("useMount")
		const urlSearchParams = new URLSearchParams(window.location.search)
		if (urlSearchParams.get("copyProject") && isLogined) {
			openCopyProjectModal()
		}
	}, [isLogined])

	const openCopyProjectModal = () => {
		setIsCopyProjectModalOpen(true)
	}

	// 准备复制项目的数据
	const copyProjectData = useMemo(() => {
		if (!data?.data) return null
		return {
			originalAuthor: data?.data?.extended?.creator,
			originalProjectName: data?.data?.project_name,
			projectId: data.data.project_id,
			defaultNewProjectName: data.data.project_name,
			// 新格式文件分享的参数
			resourceId: resourceId, // 资源ID（用于新接口）
			password: verifiedPassword, // 访问密码
		}
	}, [data, resourceId, verifiedPassword])

	const handleCopySuccess = useMemoizedFn((copiedProject: any, selectedWorkspaceId: string) => {
		// 关闭复制模态框
		setIsCopyProjectModalOpen(false)

		// 保存项目信息并开始显示进度条
		setCopyingProjectId(copiedProject.project_id)
		setCopyingProjectInfo({
			...copiedProject,
			selectedWorkspaceId,
		})
		setShowCopyProgress(true)
	})

	// 进度完成回调（现在用于处理关闭）
	const handleCopyProgressComplete = useMemoizedFn(() => {
		setShowCopyProgress(false)
		setCopyingProjectId("")
		setCopyingProjectInfo(null)
		// setCopyProjectProgress(0)
	})

	// 进度错误回调
	const handleCopyProgressError = useMemoizedFn((error: Error) => {
		console.error("项目复制失败:", error)
		setShowCopyProgress(false)
		setCopyingProjectId("")
		setCopyingProjectInfo(null)

		magicToast.error(`${t("share.copyProjectFailed")}: ${error.message}`)
	})

	useEffect(() => {
		// 设置元信息，分享文件/项目
		if (data?.resource_name) {
			setMeta({
				title: `${data?.resource_name}`,
			})
		}
	}, [data?.resource_name, t])

	// ✨ 早期返回：如果需要显示缺省页
	if (emptyStateInfo) {
		return (
			<ShareEmptyState
				currentOrgName={emptyStateInfo.currentOrgName}
				targetOrgName={emptyStateInfo.targetOrgName}
				targetOrgLogo={emptyStateInfo.targetOrgLogo || ""}
				userInfo={emptyStateInfo.userInfo}
				onSwitch={handleSwitchOrganization}
				isLoading={isSwitching}
				isFileShare={isFileShare}
			/>
		)
	}

	return (
		<div
			className={cn(
				"box-border flex h-full w-screen flex-col overflow-hidden bg-muted pb-[50px] dark:bg-muted",
				"max-md:block max-md:bg-white max-md:pb-[calc(50px+var(--safe-area-inset-bottom,0px))] dark:max-md:bg-card",
				isFileShare && "max-md:pb-0",
			)}
		>
			{copyProjectData && isProjectShare && isLogined && (
				<CopyProjectModal
					open={isCopyProjectModalOpen}
					onCancel={() => setIsCopyProjectModalOpen(false)}
					projectData={copyProjectData}
					onCopySuccess={handleCopySuccess}
				/>
			)}

			{/* 复制项目进度条 */}
			<CopyProjectProgressToast
				projectId={copyingProjectId}
				visible={showCopyProgress}
				projectInfo={copyingProjectInfo}
				onComplete={handleCopyProgressComplete}
				onError={handleCopyProgressError}
				setCopyProjectIsRunning={setCopyProjectIsRunning}
				onProgress={(_progress) => {
					// setCopyProjectProgress(progress)
				}}
				position="top"
			/>
			<div className={topicContainerBase}>
				{showSuperMagicIcon ? <Logo className="h-[42px] shrink-0 max-md:h-9" /> : null}
				{isMobile && hasStarted && !isFileShare && (
					<div className="flex min-w-0 flex-1 items-center gap-2 max-md:gap-1">
						<StatusIcon status={taskStatus as any} />
						<span className="min-w-0 flex-1 cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap text-sm font-normal leading-[1.43] text-foreground transition-all duration-200">
							{data?.resource_name || t("messageHeader.untitledTopic")}
						</span>
					</div>
				)}
				{!isMobile && hasStarted && data?.extra?.show_original_info ? (
					<div className="ml-[30px] flex min-w-0 flex-1 shrink items-center gap-2.5 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold leading-5 text-foreground/80">
						<MagicAvatar src={data?.creator?.avatar_url} size={24} />
						<span className="shrink-0 font-semibold text-foreground/80">
							{data?.creator?.nickname || t("common.unknownUser")}
						</span>
						<span className="shrink-0 text-muted-foreground">/</span>
						<span>
							{data?.resource_name ||
								(isFileShare
									? t("common.untitledProject")
									: t("messageHeader.untitledTopic"))}
						</span>
					</div>
				) : !isMobile && hasStarted && data?.extra ? (
					<div className="ml-[30px] flex min-w-0 flex-1 shrink items-center gap-2.5 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold leading-5 text-foreground/80">
						<span>
							{data?.resource_name ||
								(isFileShare
									? t("common.untitledProject")
									: t("messageHeader.untitledTopic"))}
						</span>
					</div>
				) : null}
				<div className="flex gap-2">
					{isMobile && hasStarted && (
						<Button
							variant="outline"
							size="icon-sm"
							className="h-8 w-8 rounded-lg p-1.5"
							onClick={() => pubsub.publish("super_magic_folder_click")}
						>
							<IconFolder size={20} />
						</Button>
					)}
					{showCopyProjectButton && (
						<Button
							variant="outline"
							size="sm"
							className="h-8 gap-1.5 rounded-lg border-black/[0.08] px-1.5 py-1.5 dark:border-white/[0.08]"
							onClick={handleCopyProject}
							disabled={copyProjectIsRunning}
						>
							<IconGitFork size={18} stroke={1.5} className="size-[18px]" />
							<span className="text-sm font-normal leading-5 text-foreground/80">
								{t("share.copyProject")}
							</span>
							<span className="inline-flex h-[22px] items-center rounded-[4px] bg-fill px-1.5 py-0.5 text-xs font-bold leading-4 text-foreground">
								{formatCopyProjectCount(data?.data?.extended?.fork_num)}
							</span>
						</Button>
					)}
					{showWorkspaceButton ? (
						<WorkspaceButton
							onClick={() => {
								clearWindowData()
								history.push({ name: RouteName.Super })
							}}
						/>
					) : null}
					{!isLogined ? (
						<Button
							variant="outline"
							size="sm"
							className="h-8 rounded-lg px-5 py-1.5"
							onClick={() => {
								clearWindowData()
								history.replace({ name: RouteName.Login })
							}}
						>
							{t("share.login")}
						</Button>
					) : null}
				</div>
			</div>
			<div className="relative h-full overflow-hidden max-md:w-full">
				{loading && (
					<div className="flex h-full items-center justify-center">
						<MagicSpin />
					</div>
				)}
				{isNeedPassword && isEmpty(data) && !error && !loading && (
					<PasswordVerification
						resourceId={resourceId}
						initialPassword={passwordFromUrl}
						onVerifySuccess={handleVerifySuccess}
						onVerifyFail={handleVerifyFail}
						getShareData={getShareData}
						isFileShare={routeInfo.isFileShare}
					/>
				)}
				{error && !loading && (
					<ErrorDisplay
						errorMessage={t("share.noPermissionToView")}
						onRetry={handleRetry}
						isFileShare={routeInfo.isFileShare}
					/>
				)}
				{(!isEmpty(data) || isFileShare || isProjectShare) && !error && (
					<ShareContent
						isMobile={isMobile}
						data={data}
						attachments={attachments}
						isLogined={isLogined}
						isFileShare={isFileShare || isProjectShare}
						isProjectShare={isProjectShare}
						fileId={fileId}
						defaultOpenFileId={defaultOpenFileId}
						projectId={projectId}
						topicId={resourceId}
						showAllProjectFiles={showAllProjectFiles || viewFileList}
						viewFileList={viewFileList}
						showCreatedByBadge={data?.extra?.hide_created_by_super_magic === false}
						allowDownloadProjectFile={allowDownloadProjectFile}
					/>
				)}
			</div>
			{/* 由超级麦吉创造按钮：默认不显示，只有 hide_created_by_super_magic 为 false 时才显示 */}
			<CreatedByBadge
				visible={data?.extra?.hide_created_by_super_magic === false}
				style={{ bottom: routeInfo.isFileShare || !hasStarted ? "12px" : "64px" }}
			/>
		</div>
	)
}

export default Share
