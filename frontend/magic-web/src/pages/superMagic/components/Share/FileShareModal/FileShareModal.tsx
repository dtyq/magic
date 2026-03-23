import { memo, useState, useMemo, useCallback, useEffect, useRef } from "react"
import { clipboard } from "@/utils/clipboard-helpers"
import { Modal } from "antd"
import { useTranslation } from "react-i18next"
import { SuperMagicApi } from "@/apis"
import FileSelector from "../FileSelector"
import MobileFileSelectorPopup from "./MobileFileSelectorPopup"
import FileShareModalFooter from "./FileShareModalFooter"
import { ShareType, ShareMode, ResourceType, type ShareExtraData } from "../types"
import useStyles from "./style"
import { AttachmentDataProcessor } from "../../../utils/attachmentDataProcessor"
import { findFileInTree, calculateActualFileCount } from "../FileSelector/utils"
import { useResponsive, useDebounceFn } from "ahooks"
import { handleShareTypeChangeWithConfirm, generateSharePassword } from "../utils"
import MagicModal from "@/components/base/MagicModal"
import { generateShareUrl } from "@/pages/superMagic/components/ShareManagement/utils/shareTypeHelpers"
import {
	ShareNameField,
	ShareTypeField,
	SharePasswordField,
	ShareExpiryField,
	ShareRangeField,
	ShareAdvancedSettings,
	type ShareAdvancedSettingsData,
	type ShareRange,
	type ShareTarget,
	calculateDefaultShareName,
} from "../ShareFields"
import { Switch } from "@/components/shadcn-ui/switch"
import { Separator } from "@/components/shadcn-ui/separator"
import magicToast from "@/components/base/MagicToaster/utils"
import { projectStore } from "@/pages/superMagic/stores/core"
import { userStore } from "@/models/user"

interface FileShareModalProps {
	attachments?: any[] // 可选，如果没有 resourceId 时使用（文件树）
	attachmentList?: any[] // 可选，扁平化的文件列表
	types: ShareType[]
	defaultSelectedFileIds?: string[] // 默认选中的文件ID列表
	defaultOpenFileId?: string // 默认打开的文件ID
	resourceId?: string // 外层传入的资源ID（如从列表管理页面传入）
	shareMode?: ShareMode // 分享模式：文件或项目
	projectName?: string // 项目名称（用于项目分享模式）
	projectId?: string // 项目ID（用于创建分享时使用，可选，如果不传则从附件列表获取）
	onCancel?: () => void // 取消回调
	onSaveSuccess?: (data: {
		shareName: string
		fileCount: number
		mainFileName: string
		shareUrl: string
		password?: string
		expire_at?: string // 过期时间（格式：xxxx/xx/xx 或 xxxx/xx/xx xx:xx:xx）
		shareType: ShareType
		resourceId?: string // 添加 resourceId
		shareProject?: boolean // 是否分享整个项目
		projectName?: string // 项目原始名称（用于项目分享时显示）
		fileIds?: string[] // 文件ID列表，用于查询文件详情
	}) => void // 保存成功回调，传递成功数据
	onCancelShareSuccess?: () => void // 取消分享成功回调
}

export default memo(function FileShareModal(props: FileShareModalProps) {
	const {
		attachments: externalAttachments,
		attachmentList: externalAttachmentList,
		types,
		defaultSelectedFileIds,
		defaultOpenFileId: externalDefaultOpenFileId,
		resourceId: externalResourceId,
		shareMode,
		projectName,
		projectId: externalProjectId,
		onCancel,
		onSaveSuccess,
		onCancelShareSuccess,
	} = props

	const { styles } = useStyles()
	const { t } = useTranslation("super")
	const responsive = useResponsive()
	const isMobile = responsive.md === false

	// Check if user is personal organization
	const { isPersonalOrganization } = userStore.user

	// State: saving status
	const [isSaving, setIsSaving] = useState(false)

	// State: selected files
	const [selectedFileIds, setSelectedFileIds] = useState<string[]>([])
	const [selectedFiles, setSelectedFiles] = useState<any[]>([])

	// State: share name and expiry (new fields)
	const [shareName, setShareName] = useState<string>("")
	const [shareExpiry, setShareExpiry] = useState<number | null>(null) // null = permanent

	// State: share range (for Organization share type)
	const [shareRange, setShareRange] = useState<ShareRange>("all")
	const [shareTargets, setShareTargets] = useState<ShareTarget[]>([])

	// State: share type and settings
	const [shareType, setShareType] = useState<ShareType>(
		isPersonalOrganization ? ShareType.Public : ShareType.PasswordProtected,
	)
	const [shareProject, setShareProject] = useState<boolean>(shareMode === ShareMode.Project) // 根据 shareMode 初始化
	const [extraData, setExtraData] = useState<ShareExtraData>({
		passwordEnabled: isPersonalOrganization ? false : true,
		password: shareType === ShareType.PasswordProtected ? generateSharePassword() : "",
		allowCopy: true,
		showFileList: true,
		hideCreatorInfo: false,
		allowDownloadProjectFile: true,
		showOriginalInfo: true,
	})

	// State: resource ID (use external if provided, otherwise fetch and cache)
	const [resourceId, setResourceId] = useState<string | undefined>(externalResourceId)

	// State: project ID
	// 优先使用外部传入的，如果没有则使用全局 store 的当前项目ID
	const [projectId, setProjectId] = useState<string | undefined>(
		externalProjectId || projectStore.selectedProject?.id,
	)

	// State: project name (内部状态，优先使用API加载的值，否则使用外部prop)
	const [internalProjectName, setInternalProjectName] = useState<string | undefined>(projectName)

	// State: attachments (internal if resourceId is provided)
	const [attachments, setAttachments] = useState<any[]>(externalAttachments || [])

	const [attachmentList, setAttachmentList] = useState<any[]>([])

	// State: default open file ID (initialize from external prop if provided)
	const [defaultOpenFileId, setDefaultOpenFileId] = useState<string | null>(
		externalDefaultOpenFileId || null,
	)

	// State: mobile file selector popup visibility
	const [fileSelectorPopupVisible, setFileSelectorPopupVisible] = useState(false)

	// Sync externalResourceId to resourceId state
	useEffect(() => {
		if (externalResourceId) {
			setResourceId(externalResourceId)
		}
	}, [externalResourceId])

	// Sync externalAttachments to internal attachments state
	useEffect(() => {
		// Only sync if externalAttachments is provided and we don't have resourceId
		// (if resourceId exists, attachments will be fetched from API)
		if (!externalResourceId && externalAttachments) {
			setAttachments(externalAttachments)
		}
	}, [externalAttachments, externalResourceId])

	useEffect(() => {
		if (externalAttachmentList) {
			setAttachmentList(externalAttachmentList)
		}
	}, [externalAttachmentList])

	// Sync externalProjectName to internal projectName state
	useEffect(() => {
		if (projectName) {
			setInternalProjectName(projectName)
		}
	}, [projectName])

	// Initialize selectedFileIds with defaultSelectedFileIds if provided (only when no resourceId)
	useEffect(() => {
		// Only initialize if:
		// 1. No resourceId (resourceId will fetch shared files from API)
		// 2. defaultSelectedFileIds is provided and not empty
		// 3. selectedFileIds is empty (not initialized yet)
		if (
			!externalResourceId &&
			defaultSelectedFileIds &&
			defaultSelectedFileIds.length > 0 &&
			selectedFileIds.length === 0
		) {
			setSelectedFileIds(defaultSelectedFileIds)
		}
	}, [externalResourceId, defaultSelectedFileIds, selectedFileIds.length])

	// Sync selectedFiles when selectedFileIds or attachments change
	useEffect(() => {
		if (selectedFileIds.length === 0) {
			setSelectedFiles([])
			return
		}

		if (attachments.length === 0) {
			return
		}

		// Find files from attachments based on selectedFileIds
		const files = selectedFileIds
			.map((id) => findFileInTree(attachments, id))
			.filter(Boolean) as any[]

		setSelectedFiles(files)
	}, [selectedFileIds, attachments])

	// Track if resourceId has been created (when first switching from OnlySelf to other types)
	const hasResourceIdCreated = useRef(false)
	// Track if resourceId is being fetched
	const isFetchingResourceId = useRef(false)
	// Track if resource data has been fetched for current resourceId
	const fetchedResourceIds = useRef<Set<string>>(new Set())

	// Statistics - 计算实际文件数量（递归统计并去重）
	const actualFileCount = useMemo(() => {
		// 如果分享了整个项目，返回附件列表的长度
		if (shareProject) {
			return attachmentList.filter((item) => !item.is_hidden && !item.is_directory)?.length
		}
		return calculateActualFileCount(selectedFiles)
	}, [selectedFiles, shareProject, attachmentList])

	// Handle file selection change
	const handleFileSelectionChange = useCallback((fileIds: string[], files: any[]) => {
		setSelectedFileIds(fileIds)
		setSelectedFiles(files)
	}, [])

	// Handle default open file change
	const handleDefaultOpenFileChange = useCallback((fileId: string | null) => {
		setDefaultOpenFileId(fileId)
	}, [])

	// Handle share type change
	const handleShareTypeChange = useCallback(
		(newType: ShareType) => {
			handleShareTypeChangeWithConfirm({
				currentType: shareType,
				newType,
				onConfirm: (confirmedType) => {
					// Just set the confirmed type directly
					// Public and PasswordProtected are separate types now
					setShareType(confirmedType)
					// Update passwordEnabled based on type
					if (confirmedType === ShareType.PasswordProtected) {
						setExtraData((prev) => ({
							...prev,
							passwordEnabled: true,
							password: prev.password || generateSharePassword(),
						}))
					} else if (confirmedType === ShareType.Public) {
						setExtraData((prev) => ({
							...prev,
							passwordEnabled: false,
						}))
					}
				},
			})
		},
		[shareType],
	)

	// Handle password copy
	const handlePasswordCopy = useCallback(() => {
		if (extraData.password) {
			clipboard.writeText(extraData.password)
			magicToast.success(t("share.copyPasswordSuccess"))
		}
	}, [extraData.password, t])

	// Handle password reset
	const handlePasswordReset = useCallback(() => {
		const newPassword = generateSharePassword()
		setExtraData((prev) => ({
			...prev,
			password: newPassword,
		}))
		magicToast.success(t("share.resetPasswordSuccess"))
	}, [t])

	// Handle advanced settings change
	const handleAdvancedSettingsChange = useCallback((settings: ShareAdvancedSettingsData) => {
		setExtraData((prev) => ({
			...prev,
			...settings,
		}))
	}, [])

	// 更新分享名称（当切换分享项目开关时）
	const updateShareNameOnToggle = useCallback(
		(newShareProject: boolean) => {
			// 提取"文件分享"前缀（单文件和多文件都是这个前缀）
			const fileSharePrefix = t("share.singleFileShareName", {
				fileName: "",
			}).split("_")[0]
			// 提取"项目分享"前缀
			const projectSharePrefix = t("share.projectShareName", {
				projectName: "",
			}).split("_")[0]

			// 检查当前分享名称是否以"文件分享"或"项目分享"开头
			if (shareName.startsWith(fileSharePrefix) || shareName.startsWith(projectSharePrefix)) {
				// 根据新的状态生成默认名称
				const newName = calculateDefaultShareName(
					defaultOpenFileId || undefined,
					selectedFiles,
					attachments,
					t,
					newShareProject,
					internalProjectName,
				)
				if (newName) {
					setShareName(newName)
				}
			}
		},
		[shareName, defaultOpenFileId, selectedFiles, attachments, t, internalProjectName],
	)

	// 处理项目分享开关变化
	const handleShareProjectChange = useCallback(
		(checked: boolean) => {
			if (checked) {
				// 开启项目分享，需要二次确认
				MagicModal.confirm({
					title: t("common.tip"),
					content: t("share.shareProjectDescription"),
					onOk: () => {
						setShareProject(true)
						updateShareNameOnToggle(true)
					},
					okText: t("common.confirm"),
					cancelText: t("common.cancel"),
					zIndex: 1500, // 确保在 ShareModal (1400) 之上
				})
			} else {
				// 关闭项目分享，不需要确认
				setShareProject(false)
				updateShareNameOnToggle(false)
			}
		},
		[t, updateShareNameOnToggle],
	)

	// Sync external resourceId to internal state
	useEffect(() => {
		if (externalResourceId) {
			setResourceId(externalResourceId)
			// If external resourceId is provided, mark as created
			hasResourceIdCreated.current = true
		}
	}, [externalResourceId])

	// Pre-fetch resourceId when modal opens (if no external resourceId)
	// This is just to generate the ID, not to create the share
	useEffect(() => {
		// Skip if external resourceId is provided
		if (externalResourceId) return

		// Skip if resourceId already exists
		if (resourceId) return

		// Skip if already fetching
		if (isFetchingResourceId.current) return

		const fetchResourceId = async () => {
			try {
				isFetchingResourceId.current = true
				const resourceIdResponse = await SuperMagicApi.getShareResourceId()

				if (resourceIdResponse?.id) {
					setResourceId(resourceIdResponse.id)
					// Note: Don't set hasResourceIdCreated here, as we haven't created the share yet
					// hasResourceIdCreated will be set when the first create/update API is called
				}
			} catch (error) {
				console.error("Failed to fetch resource ID:", error)
			} finally {
				isFetchingResourceId.current = false
			}
		}

		fetchResourceId()
	}, [externalResourceId, resourceId])

	// If resourceId is provided, fetch share settings and files
	const fetchResourceData = useCallback(async () => {
		if (!externalResourceId) return

		// Prevent duplicate fetches for the same resourceId
		if (fetchedResourceIds.current.has(externalResourceId)) {
			return
		}

		// Mark as fetched immediately to prevent race conditions
		fetchedResourceIds.current.add(externalResourceId)

		try {
			// Step 1: Get share settings (contains project_id, share_type, extra, etc.)
			const settingsData = await SuperMagicApi.getShareInfoByCode({
				code: externalResourceId,
			})
			const projectIdFromApi = settingsData?.project_id
			const defaultOpenFileIdFromApi = settingsData?.default_open_file_id
			const fileIds = settingsData?.file_ids
			const projectNameFromApi = settingsData?.project_name

			// Set project ID if available from API
			if (projectIdFromApi) {
				setProjectId(projectIdFromApi)

				// 从 projectStore 中查找项目名称（API 响应中没有 project_name 字段）
				const project = projectStore.projects.find((p) => p.id === projectIdFromApi)
				if (project?.project_name) {
					setInternalProjectName(project.project_name)
				}
			}

			// Set project name if available from API (fallback, though API doesn't return it)
			if (projectNameFromApi) {
				setInternalProjectName(projectNameFromApi)
			}

			// Load share_type
			if (settingsData?.share_type !== undefined && settingsData?.share_type !== null) {
				setShareType(settingsData.share_type as ShareType)
			}

			// Load share name
			if (settingsData?.resource_name) {
				setShareName(settingsData.resource_name)
			}

			// Load expiry days
			if (settingsData?.expire_days !== undefined) {
				setShareExpiry(settingsData.expire_days)
			}

			if (settingsData?.share_type === ShareType.Organization) {
				if (settingsData?.share_range) {
					setShareRange(settingsData.share_range as ShareRange)
				}
				if (settingsData?.target_ids) {
					setShareTargets(settingsData.target_ids as ShareTarget[])
				}
			}

			// Load extraData
			const extra = settingsData?.extra || {}
			setExtraData({
				passwordEnabled: !!settingsData?.password,
				password: settingsData?.password || "",
				allowCopy: extra?.allow_copy_project_files ?? true,
				showFileList: extra?.view_file_list ?? true,
				hideCreatorInfo: extra?.hide_created_by_super_magic ?? false,
				showOriginalInfo: extra?.show_original_info ?? true,
				allowDownloadProjectFile: extra?.allow_download_project_file ?? true,
			})

			// Load shareProject from top level field
			setShareProject(settingsData?.share_project ?? false)

			// Set default open file ID if exists
			if (defaultOpenFileIdFromApi) {
				setDefaultOpenFileId(defaultOpenFileIdFromApi)
			}

			// Set selectedFileIds directly from settingsData if available
			if (fileIds && Array.isArray(fileIds) && fileIds.length > 0) {
				setSelectedFileIds(fileIds)
			}

			if (projectId) {
				// Step 2: Get full file tree
				const fileTreeRes = await SuperMagicApi.getAttachmentsByProjectId({
					projectId,
					// @ts-ignore 使用window添加临时的token
					temporaryToken: window?.temporary_token || "",
				})
				const processedData = AttachmentDataProcessor.processAttachmentData(fileTreeRes)
				const fileTree = processedData.tree || []
				const fileList = processedData.list || []

				// Set attachments after selectedFileIds, so the sync effect can find the files
				setAttachments(fileTree)
				setAttachmentList(fileList)
			}
		} catch (error) {
			console.error("Failed to fetch resource data:", error)
			// Remove from fetched set on error to allow retry
			fetchedResourceIds.current.delete(externalResourceId)
		}
	}, [externalResourceId])

	// 防抖版本的 fetchResourceData
	const { run: debouncedFetchResourceData } = useDebounceFn(fetchResourceData, {
		wait: 300,
	})

	useEffect(() => {
		debouncedFetchResourceData()
	}, [debouncedFetchResourceData])

	// Manual save function (called by footer button)
	const handleSave = useCallback(async () => {
		// Validation: resource_name is required
		if (!shareName || shareName.trim() === "") {
			magicToast.error(t("share.shareNameRequired"))
			return
		}

		// 验证是否选择了文件
		if (selectedFileIds.length === 0 && !shareProject) {
			magicToast.warning(t("share.pleaseSelectFiles"))
			return
		}

		setIsSaving(true)

		try {
			let currentResourceId = resourceId

			// Step 1: Ensure resourceId exists
			if (!currentResourceId) {
				// 无论单文件还是多文件，都调用 API 获取资源 ID
				const resourceIdResponse: any = await SuperMagicApi.getShareResourceId()

				if (!resourceIdResponse?.id) {
					throw new Error("Failed to get resource ID")
				}

				currentResourceId = resourceIdResponse.id
				setResourceId(currentResourceId)
			}

			// Step 2: Create or update share resource
			const apiResult = await SuperMagicApi.createOrUpdateShareResource({
				resource_id: currentResourceId as string,
				resource_type: ResourceType.FileCollection,
				share_type: shareType,
				resource_name: shareName, // 必填字段，前面已经验证过
				expire_days: shareExpiry === null ? undefined : shareExpiry,
				share_range: shareType === ShareType.Organization ? shareRange : undefined,
				target_ids:
					shareType === ShareType.Organization && shareRange === "designated"
						? shareTargets.map((t) => ({
								target_type: t.target_type,
								target_id: t.target_id,
							}))
						: undefined,
				password: extraData.passwordEnabled ? extraData.password : undefined,
				file_ids: selectedFileIds,
				default_open_file_id: defaultOpenFileId || undefined,
				share_project: shareProject, // 顶层字段
				extra: {
					allow_copy_project_files: extraData.allowCopy ?? true,
					view_file_list: extraData.showFileList ?? true,
					hide_created_by_super_magic: extraData.hideCreatorInfo ?? false,
					show_original_info: extraData.showOriginalInfo ?? true,
					allow_download_project_file: extraData.allowDownloadProjectFile ?? true,
				},
				project_id: projectId, // 传递项目ID
			})

			// Mark as created after successful API call
			if (!hasResourceIdCreated.current) {
				hasResourceIdCreated.current = true
			}

			magicToast.success(
				externalResourceId ? t("share.updateSuccess") : t("share.createSuccess"),
			)

			// 调用成功回调，传递数据给父组件
			onSaveSuccess?.({
				shareName: shareName,
				fileCount: actualFileCount,
				mainFileName: apiResult?.main_file_name || t("share.untitled"),
				shareUrl: generateShareUrl(
					currentResourceId as string,
					extraData.passwordEnabled ? extraData.password : undefined,
					"files",
				),
				password: extraData.passwordEnabled ? extraData.password : undefined,
				expire_at: apiResult?.data?.expire_at || apiResult?.expire_at, // 使用后端返回的 expire_at
				shareType: shareType,
				resourceId: currentResourceId, // 传递 resourceId
				shareProject: shareProject, // 传递 shareProject
				projectName: projectName, // 传递项目原始名称
				fileIds: apiResult?.file_ids || selectedFileIds, // 传递 file_ids
			})
		} catch (error) {
			console.error("Failed to save share settings:", error)
			magicToast.error(externalResourceId ? t("share.updateFailed") : t("share.createFailed"))
		} finally {
			setIsSaving(false)
		}
	}, [
		shareName,
		selectedFileIds,
		shareProject,
		t,
		resourceId,
		shareType,
		shareExpiry,
		shareRange,
		shareTargets,
		extraData.passwordEnabled,
		extraData.password,
		extraData.allowCopy,
		extraData.showFileList,
		extraData.hideCreatorInfo,
		extraData.showOriginalInfo,
		extraData.allowDownloadProjectFile,
		defaultOpenFileId,
		projectId,
		externalResourceId,
		onSaveSuccess,
		actualFileCount,
		projectName,
	])

	// Handle cancel share
	const handleCancelShare = useCallback(async () => {
		if (!externalResourceId) return

		Modal.confirm({
			title: t("share.cancelShare"),
			content: t("share.cancelFileShareConfirm"),
			onOk: async () => {
				try {
					await SuperMagicApi.cancelShareResource({ resourceId: externalResourceId })
					magicToast.success(t("share.cancelShareSuccess"))
					onCancelShareSuccess?.()
				} catch (error) {
					console.error("Failed to cancel share:", error)
					magicToast.error(t("share.cancelShareFailed"))
				}
			},
		})
	}, [externalResourceId, t, onCancelShareSuccess])

	// Handle modal cancel
	const handleCancel = useCallback(() => {
		onCancel?.()
	}, [onCancel])

	// Handle file selection change from mobile popup (实时更新，不关闭弹层)
	const handleFileSelectorChange = useCallback(
		(fileIds: string[], files: any[]) => {
			handleFileSelectionChange(fileIds, files)
		},
		[handleFileSelectionChange],
	)

	// Handle file selection confirm from mobile popup (关闭弹层)
	const handleFileSelectorConfirm = useCallback(() => {
		setFileSelectorPopupVisible(false)
	}, [])

	// Determine mode: edit if externalResourceId exists, otherwise create
	const mode = externalResourceId ? "edit" : "create"

	// Normalize share type for display
	// Note: Public and PasswordProtected are now separate types (no more Internet type)
	const normalizedShareType = useMemo(() => {
		return shareType
	}, [shareType])

	// Check if password field should be visible
	const showPasswordField = normalizedShareType === ShareType.PasswordProtected

	// Mobile layout: file selection card + share options
	if (isMobile) {
		return (
			<>
				<div className={styles.mobileContainer}>
					{/* Share configuration fields */}
					<div className={styles.mobileShareOptions}>
						<div className="flex flex-col gap-3">
							{/* File Selection Card - 单文件模式下不显示 */}
							<div className="flex flex-col gap-3 self-stretch rounded-[10px] border border-border p-5 shadow-xs">
								{/* Card Header */}
								<div className="flex flex-col gap-0.5 self-stretch">
									<div className="text-lg font-medium leading-normal text-foreground">
										{t("share.selectShareFiles")}
									</div>
									<div className="text-xs leading-normal text-muted-foreground">
										{t("share.clickToSelectFiles")}
									</div>
								</div>

								{/* Select Button */}
								<button
									className="flex items-center justify-center gap-2 self-stretch rounded-lg bg-primary px-4 py-2 text-sm font-medium leading-normal text-primary-foreground shadow-xs"
									onClick={() => setFileSelectorPopupVisible(true)}
								>
									{t("share.selectFileWithCount", {
										count: actualFileCount,
									})}
								</button>
							</div>

							{/* Share Name */}
							<ShareNameField
								value={shareName}
								onChange={setShareName}
								defaultOpenFileId={defaultOpenFileId || undefined}
								selectedFiles={selectedFiles}
								attachments={attachments}
								shareProject={shareProject}
								projectName={internalProjectName}
							/>

							{/* Share Type */}
							<ShareTypeField
								value={normalizedShareType}
								onChange={handleShareTypeChange}
								availableTypes={types}
							/>

							{/* Share Range - only show for Organization share type */}
							{shareType === ShareType.Organization && (
								<ShareRangeField
									value={shareRange}
									onChange={setShareRange}
									targets={shareTargets}
									onTargetsChange={setShareTargets}
									resourceId={resourceId}
								/>
							)}

							{/* Password Field - only show if password protected */}
							{showPasswordField && (
								<SharePasswordField
									password={extraData.password || ""}
									onCopy={handlePasswordCopy}
									onReset={handlePasswordReset}
								/>
							)}

							{/* Expiry Field */}
							<ShareExpiryField value={shareExpiry} onChange={setShareExpiry} />

							{/* Advanced Settings */}
							<ShareAdvancedSettings
								settings={{
									allowCopy: extraData.allowCopy,
									showFileList: extraData.showFileList,
									showOriginalInfo: extraData.showOriginalInfo,
									hideCreatorInfo: extraData.hideCreatorInfo,
									allowDownloadProjectFile: extraData.allowDownloadProjectFile,
								}}
								onChange={handleAdvancedSettingsChange}
								mode={ShareMode.File}
							/>
						</div>
					</div>

					{/* Footer */}
					<FileShareModalFooter
						mode={mode}
						onCancel={handleCancel}
						onSave={handleSave}
						onCancelShare={handleCancelShare}
						isSaving={isSaving}
						isDisabled={selectedFileIds.length === 0}
					/>
				</div>

				{/* File selector popup - 单文件模式下不显示 */}

				<MobileFileSelectorPopup
					open={fileSelectorPopupVisible}
					onClose={handleFileSelectorConfirm}
					onConfirm={handleFileSelectorConfirm}
					onSelectionChange={handleFileSelectorChange}
					attachments={attachments}
					selectedFileIds={selectedFileIds}
					defaultOpenFileId={defaultOpenFileId || undefined}
					onDefaultOpenFileChange={handleDefaultOpenFileChange}
					disabled={shareProject}
					allowSetDefaultOpen={shareProject}
					shareProject={shareProject}
					onShareProjectChange={handleShareProjectChange}
				/>
			</>
		)
	}

	// Desktop layout: left file list + right share options
	return (
		<div className="flex flex-col">
			<div className={styles.body}>
				{/* Left: File selector - 单文件模式下不显示 */}
				<div className={styles.fileListSection}>
					{/* Share Project Switch */}
					<div className="flex items-start justify-between gap-3 px-3 py-3 pb-0">
						<Switch checked={shareProject} onCheckedChange={handleShareProjectChange} />
						<div className="flex flex-col gap-2">
							<div className="text-sm font-medium leading-none text-foreground">
								{t("share.shareProject")}
							</div>
							<div className="text-xs leading-normal text-muted-foreground">
								{t("share.shareProjectDescription")}
							</div>
						</div>
					</div>

					{/* Separator */}
					<Separator className="mx-3 mt-2" style={{ width: "auto" }} />

					{/* File Selector */}
					<FileSelector
						attachments={attachments}
						selectedFileIds={selectedFileIds}
						onSelectionChange={handleFileSelectionChange}
						defaultSelectedFileIds={defaultSelectedFileIds}
						defaultOpenFileId={defaultOpenFileId || undefined}
						onDefaultOpenFileChange={handleDefaultOpenFileChange}
						disabled={shareProject}
						allowSetDefaultOpen={shareProject}
						className={styles.fileSelector}
					/>
				</div>

				{/* Right: Statistics + Share type selector */}
				<div className={styles.shareOptionsSection}>
					{/* Share configuration fields */}
					<div className={styles.selectorContainer}>
						<div className="flex flex-col gap-3">
							{/* Share Name */}
							<ShareNameField
								value={shareName}
								onChange={setShareName}
								defaultOpenFileId={defaultOpenFileId || undefined}
								selectedFiles={selectedFiles}
								attachments={attachments}
								shareProject={shareProject}
								projectName={internalProjectName}
							/>

							{/* Share Type */}
							<ShareTypeField
								value={normalizedShareType}
								onChange={handleShareTypeChange}
								availableTypes={types}
							/>

							{/* Share Range - only show for Organization share type */}
							{shareType === ShareType.Organization && (
								<ShareRangeField
									value={shareRange}
									onChange={setShareRange}
									targets={shareTargets}
									onTargetsChange={setShareTargets}
									resourceId={resourceId}
								/>
							)}

							{/* Password Field - only show if password protected */}
							{showPasswordField && (
								<SharePasswordField
									password={extraData.password || ""}
									onCopy={handlePasswordCopy}
									onReset={handlePasswordReset}
								/>
							)}

							{/* Expiry Field */}
							<ShareExpiryField value={shareExpiry} onChange={setShareExpiry} />

							{/* Advanced Settings */}
							<ShareAdvancedSettings
								settings={{
									allowCopy: extraData.allowCopy,
									showFileList: extraData.showFileList,
									showOriginalInfo: extraData.showOriginalInfo,
									hideCreatorInfo: extraData.hideCreatorInfo,
									allowDownloadProjectFile: extraData.allowDownloadProjectFile,
								}}
								onChange={handleAdvancedSettingsChange}
								mode={ShareMode.File}
							/>
						</div>
					</div>
				</div>
			</div>

			{/* Footer */}
			<FileShareModalFooter
				mode={mode}
				onCancel={handleCancel}
				onSave={handleSave}
				onCancelShare={handleCancelShare}
				isSaving={isSaving}
				isDisabled={selectedFileIds.length === 0 && !shareProject}
			/>
		</div>
	)
})
