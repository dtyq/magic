import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { NodeType, type TreeNode } from "@dtyq/user-selector"
import { SuperMagicApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import { clipboard } from "@/utils/clipboard-helpers"
import { ShareMode, ShareType, ResourceType } from "@/pages/superMagic/components/Share/types"
import {
	calculateDefaultShareName,
	generateSharePassword,
} from "@/pages/superMagic/components/Share/utils"
import { generateShareUrl } from "@/pages/superMagic/components/ShareManagement/utils/shareTypeHelpers"
import { useShareProject } from "@/pages/superMagic/layouts/MainLayout/hooks/useShareProject"
import {
	SharedResourceType,
	SharedTopicFilterStatus,
	type FileShareItem,
	type ProjectShareItem,
} from "@/pages/superMagic/components/ShareManagement/types"
import { useShareData } from "@/pages/superMagic/components/ShareManagement/hooks/useShareData"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type {
	MobileShareItem,
	MobileShareSheetMode,
	ProjectShareFormState,
	ProjectShareSheetController,
	ProjectShareSheetProps,
	ProjectShareSheetView,
	SelectedFileHierarchyNode,
} from "../types"
import { isPartialFileShare, isWholeProjectShare } from "../utils/shareScope"

/**
 * 构造分享表单的基础默认值；`shareName` 在 Sheet 打开创建页时由 `buildDefaultShareNameForSheet` 覆盖。
 */
function createInitialFormState(): ProjectShareFormState {
	return {
		shareName: "",
		shareType: ShareType.PasswordProtected,
		shareExpiry: null,
		password: generateSharePassword(),
		shareRange: "all",
		shareTargets: [],
		advancedSettings: {
			allowCopy: true,
			showFileList: true,
			showOriginalInfo: true,
			hideCreatorInfo: false,
			allowDownloadProjectFile: true,
		},
	}
}

/**
 * 从附件树中回捞选中的文件/文件夹，用于文件模式的创建页和详情页展示。
 */
function collectSelectedItems(
	attachments: AttachmentItem[],
	selectedIds: string[],
): AttachmentItem[] {
	if (selectedIds.length === 0 || attachments.length === 0) {
		return []
	}

	const selectedIdSet = new Set(selectedIds)
	const result: AttachmentItem[] = []

	const visit = (items: AttachmentItem[]) => {
		items.forEach((item) => {
			const itemId = item.file_id
			if (itemId && selectedIdSet.has(itemId)) {
				result.push(item)
			}
			if (item.children?.length) {
				visit(item.children)
			}
		})
	}

	visit(attachments)
	return result
}

interface BuildDefaultShareNameForSheetParams {
	mode: MobileShareSheetMode
	defaultOpenFileId?: string
	attachments: AttachmentItem[]
	effectiveSelectedFileIds: string[]
	projectName?: string
	t: (key: string, options?: Record<string, unknown>) => string
}

/**
 * 计算移动端分享 Sheet 创建页的默认链接名称，与 Web 端 `calculateDefaultShareName` 规则保持一致。
 */
function buildDefaultShareNameForSheet({
	mode,
	defaultOpenFileId,
	attachments,
	effectiveSelectedFileIds,
	projectName,
	t,
}: BuildDefaultShareNameForSheetParams): string {
	const selectedItems = collectSelectedItems(attachments, effectiveSelectedFileIds)
	return calculateDefaultShareName(
		defaultOpenFileId,
		selectedItems,
		attachments,
		t,
		mode === "project",
		projectName,
	)
}

/**
 * 把附件节点转换成分享 Sheet 可直接渲染的树节点，避免 View 层继续理解原始附件结构。
 */
function createSelectedHierarchyNode(item: AttachmentItem): SelectedFileHierarchyNode | null {
	const itemId = item.file_id
	if (!itemId) {
		return null
	}

	return {
		id: itemId,
		name: item.name || item.file_name || item.display_filename || item.filename || "",
		isDirectory: Boolean(item.is_directory),
		fileExtension: item.file_extension,
		children: (item.children || [])
			.map((child) => createSelectedHierarchyNode(child))
			.filter((child): child is SelectedFileHierarchyNode => Boolean(child)),
	}
}

/**
 * 构造“已选文件”的层级树：
 * - 直接选中文件时，保留该文件作为根节点
 * - 直接选中文件夹时，保留整个文件夹子树，确保详情里能展开看到后代文件和子文件夹
 * - 未选中的父文件夹不会额外出现在根层，保持当前分享对象语义清晰
 */
function buildSelectedFileHierarchy(
	attachments: AttachmentItem[],
	selectedIds: string[],
): SelectedFileHierarchyNode[] {
	if (selectedIds.length === 0 || attachments.length === 0) {
		return []
	}

	const selectedIdSet = new Set(selectedIds)
	const result: SelectedFileHierarchyNode[] = []

	const visit = (items: AttachmentItem[]) => {
		items.forEach((item) => {
			const itemId = item.file_id
			if (!itemId) {
				if (item.children?.length) {
					visit(item.children)
				}
				return
			}

			if (selectedIdSet.has(itemId)) {
				const node = createSelectedHierarchyNode(item)
				if (node) {
					result.push(node)
				}
				return
			}

			if (item.children?.length) {
				visit(item.children)
			}
		})
	}

	visit(attachments)
	return result
}

/**
 * 统计已选文件数量：
 * - 普通文件按 1 计数
 * - 文件夹按其后代文件总数计数
 * - 空文件夹保底按 1 计数，避免 UI 出现“已选文件 0”但实际上选中了空目录
 */
function countSelectedHierarchyFiles(nodes: SelectedFileHierarchyNode[]): number {
	return nodes.reduce((total, node) => {
		if (!node.isDirectory) {
			return total + 1
		}

		const childCount = countSelectedHierarchyFiles(node.children)
		return total + (childCount > 0 ? childCount : 1)
	}, 0)
}

/**
 * 移动端项目分享控制器：只编排原型视图栈，并把保存、列表、取消等动作委托给现有分享 API/Hook。
 */
export function useProjectShareSheet({
	open,
	mode = "project",
	projectId,
	projectName,
	attachments,
	defaultSelectedFileIds,
	defaultOpenFileId,
	initialSelectedShare,
	onClose,
}: ProjectShareSheetProps): ProjectShareSheetController {
	const { t } = useTranslation("super")
	const shareMode = mode === "file" ? ShareMode.File : ShareMode.Project
	const [view, setView] = useState<ProjectShareSheetView>("create")
	const [viewStack, setViewStack] = useState<ProjectShareSheetView[]>([])
	const [selectedShareId, setSelectedShareId] = useState<string | null>(null)
	const [localSelectedShare, setLocalSelectedShare] = useState<MobileShareItem | null>(null)
	const [saving, setSaving] = useState(false)
	const [editResourceId, setEditResourceId] = useState<string | undefined>()
	const [advancedOpen, setAdvancedOpen] = useState(true)
	const [memberSelectorOpen, setMemberSelectorOpen] = useState(false)
	const [selectedMemberNodes, setSelectedMemberNodes] = useState<TreeNode[]>([])
	const [formState, setFormState] = useState<ProjectShareFormState>(() =>
		createInitialFormState(),
	)

	const shareProject = useShareProject({
		attachments,
		projectName,
	})
	const effectiveSelectedFileIds = useMemo(() => {
		if (mode === "file") {
			if (defaultSelectedFileIds) {
				return defaultSelectedFileIds
			}

			if (
				initialSelectedShare &&
				"file_ids" in initialSelectedShare &&
				Array.isArray(initialSelectedShare.file_ids)
			) {
				return initialSelectedShare.file_ids
			}

			return []
		}

		return shareProject.defaultSelectedFileIds
	}, [defaultSelectedFileIds, initialSelectedShare, mode, shareProject.defaultSelectedFileIds])

	const projectShareList = useShareData({
		resourceType: SharedResourceType.Project,
		filterStatus: SharedTopicFilterStatus.Active,
		searchText: "",
		projectId,
		currentPage: 1,
		pageSize: 50,
	})
	const fileShareList = useShareData({
		resourceType: SharedResourceType.File,
		filterStatus: SharedTopicFilterStatus.Active,
		searchText: "",
		projectId,
		currentPage: 1,
		pageSize: 50,
	})

	useEffect(() => {
		if (!open) return
		setView(initialSelectedShare ? "linkDetail" : "create")
		setViewStack([])
		setSelectedShareId(initialSelectedShare?.resource_id || null)
		setLocalSelectedShare(initialSelectedShare || null)
		setEditResourceId(undefined)
		setAdvancedOpen(true)
		setMemberSelectorOpen(false)
		setSelectedMemberNodes([])
		setFormState({
			...createInitialFormState(),
			shareName: initialSelectedShare
				? ""
				: buildDefaultShareNameForSheet({
						mode,
						defaultOpenFileId,
						attachments,
						effectiveSelectedFileIds,
						projectName,
						t,
					}),
		})
		// Intentionally omit selection/mode deps so reopening does not overwrite user-edited shareName mid-session.
		// eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when sheet open context changes
	}, [open, projectName, initialSelectedShare])

	const filteredShareItems = useMemo(() => {
		const projectItems = projectShareList.data.filter(
			(item): item is ProjectShareItem => "resource_id" in item,
		)
		const fileItems = fileShareList.data.filter(
			(item): item is FileShareItem => "resource_id" in item,
		)
		const mergedItems = [...projectItems, ...fileItems]
		const scopedItems = !projectId
			? mergedItems
			: mergedItems.filter((item) => !item.project_id || item.project_id === projectId)

		return scopedItems.sort(
			(left, right) =>
				new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
		)
	}, [fileShareList.data, projectId, projectShareList.data])

	const selectedShare = useMemo(() => {
		const remoteMatch =
			filteredShareItems.find((item) => item.resource_id === selectedShareId) || null
		if (remoteMatch) return remoteMatch
		if (localSelectedShare?.resource_id === selectedShareId) return localSelectedShare
		return null
	}, [filteredShareItems, localSelectedShare, selectedShareId])
	const displayedSelectedFileIds = useMemo(() => {
		// Whole-project share detail: do not use list selection or share.file_ids, to avoid showing the selected-files block incorrectly.
		if (selectedShare && isWholeProjectShare(selectedShare)) {
			return []
		}

		if (
			selectedShare &&
			isPartialFileShare(selectedShare) &&
			"file_ids" in selectedShare &&
			Array.isArray(selectedShare.file_ids) &&
			selectedShare.file_ids.length > 0
		) {
			return selectedShare.file_ids
		}

		return effectiveSelectedFileIds
	}, [effectiveSelectedFileIds, selectedShare])
	const selectedFileItems = useMemo(
		() => collectSelectedItems(attachments, displayedSelectedFileIds),
		[attachments, displayedSelectedFileIds],
	)
	const selectedFileHierarchy = useMemo(
		() => buildSelectedFileHierarchy(attachments, displayedSelectedFileIds),
		[attachments, displayedSelectedFileIds],
	)
	const selectedFileCount = useMemo(
		() => countSelectedHierarchyFiles(selectedFileHierarchy),
		[selectedFileHierarchy],
	)

	const goTo = useMemoizedFn((nextView: ProjectShareSheetView) => {
		setViewStack((prev) => [...prev, view])
		setView(nextView)
	})

	const goBack = useMemoizedFn(() => {
		setViewStack((prev) => {
			const nextStack = [...prev]
			const previousView = nextStack.pop()
			setView(previousView || "create")
			return nextStack
		})
	})

	const setFormValue = useCallback(
		<K extends keyof ProjectShareFormState>(key: K, value: ProjectShareFormState[K]) => {
			setFormState((prev) => ({
				...prev,
				[key]: value,
			}))
		},
		[],
	)

	const refreshShareList = useMemoizedFn(() => {
		projectShareList.refreshData()
		fileShareList.refreshData()
	})

	const confirmMemberSelector = useMemoizedFn((value: TreeNode[]) => {
		setSelectedMemberNodes(value)
		setMemberSelectorOpen(false)
		setFormState((prev) => ({
			...prev,
			// 移动端选择成员即代表指定范围分享，避免提交时退化成全组织可见。
			shareRange: value.length > 0 ? "designated" : "all",
			shareTargets: value.map((item) => ({
				target_type: item.dataType === NodeType.User ? "User" : "Department",
				target_id: item.id,
				name: item.name,
				avatar_url: item.avatar_url,
			})),
		}))
	})

	const copySelectedShareUrl = useMemoizedFn(() => {
		if (!selectedShare?.resource_id) return
		const shareUrl = generateShareUrl(
			selectedShare.resource_id,
			selectedShare.password,
			"files",
		)
		clipboard.writeText(shareUrl)
		magicToast.success(t("share.copySuccess"))
	})

	const copySelectedSharePassword = useMemoizedFn(() => {
		if (!selectedShare?.password) return
		clipboard.writeText(selectedShare.password)
		magicToast.success(t("share.copyPasswordSuccess"))
	})

	const submitCreateShare = useMemoizedFn(async () => {
		if (effectiveSelectedFileIds.length === 0) {
			magicToast.warning(t("share.noShareableFiles"))
			return
		}

		setSaving(true)
		try {
			// 复用现有项目分享保存契约；移动端 Sheet 只替换 UI，不新增接口形态。
			const resourceIdResponse = await SuperMagicApi.getShareResourceId()
			const resourceId = resourceIdResponse?.id
			if (!resourceId) {
				throw new Error("Failed to get share resource id")
			}

			const password =
				formState.shareType === ShareType.PasswordProtected ? formState.password : undefined
			const fallbackShareName =
				mode === "file"
					? calculateDefaultShareName(
							defaultOpenFileId,
							selectedFileItems,
							attachments,
							t,
							false,
							projectName,
						)
					: t("share.projectShareName", {
							projectName: projectName || t("common.untitledProject"),
						})
			const resourceName = formState.shareName.trim() || fallbackShareName

			await SuperMagicApi.createOrUpdateShareResource({
				resource_id: resourceId,
				resource_type: ResourceType.FileCollection,
				share_type: formState.shareType,
				resource_name: resourceName,
				expire_days: formState.shareExpiry === null ? undefined : formState.shareExpiry,
				share_range:
					formState.shareType === ShareType.Organization
						? formState.shareRange
						: undefined,
				target_ids:
					formState.shareType === ShareType.Organization &&
					formState.shareRange === "designated"
						? formState.shareTargets.map((target) => ({
								target_type: target.target_type,
								target_id: target.target_id,
							}))
						: undefined,
				password,
				file_ids: effectiveSelectedFileIds,
				default_open_file_id: mode === "file" ? defaultOpenFileId : undefined,
				share_project: mode === "project",
				project_id: projectId,
				extra: {
					allow_copy_project_files: formState.advancedSettings.allowCopy ?? true,
					view_file_list: formState.advancedSettings.showFileList ?? true,
					hide_created_by_super_magic:
						formState.advancedSettings.hideCreatorInfo ?? false,
					show_original_info: formState.advancedSettings.showOriginalInfo ?? true,
					allow_download_project_file:
						formState.advancedSettings.allowDownloadProjectFile ?? true,
				},
			})

			const shareUrl = generateShareUrl(resourceId, password, "files")
			clipboard.writeText(shareUrl)
			magicToast.success(t("share.createSuccessAndCopied"))
			refreshShareList()
			setLocalSelectedShare(
				mode === "file"
					? ({
							title: resourceName,
							project_name: projectName || t("common.untitledProject"),
							project_id: projectId || "",
							workspace_id: "",
							workspace_name: "",
							resource_type: ResourceType.FileCollection,
							share_type: formState.shareType,
							resource_id: resourceId,
							has_password: Boolean(password),
							password,
							main_file_name:
								selectedFileItems[0]?.name || selectedFileItems[0]?.file_name || "",
							file_ids: effectiveSelectedFileIds,
							created_at: new Date().toISOString(),
							expire_at: undefined,
							share_project: false,
							extend: {
								file_count: effectiveSelectedFileIds.length,
							},
						} satisfies FileShareItem)
					: ({
							title: resourceName,
							project_name: projectName || t("common.untitledProject"),
							project_id: projectId || "",
							workspace_id: "",
							workspace_name: "",
							resource_type: ResourceType.Project,
							share_type: formState.shareType,
							resource_id: resourceId,
							has_password: Boolean(password),
							password,
							created_at: new Date().toISOString(),
							expire_at: undefined,
							extend: {
								file_count: effectiveSelectedFileIds.length,
							},
						} satisfies ProjectShareItem),
			)
			setSelectedShareId(resourceId)
			setView("linkDetail")
			setViewStack(["create"])
		} catch (error) {
			console.error("Failed to create project share:", error)
			magicToast.error(t("share.createFailed"))
		} finally {
			setSaving(false)
		}
	})

	const openEditSelectedShare = useMemoizedFn(() => {
		if (!selectedShare?.resource_id) return
		setEditResourceId(selectedShare.resource_id)
	})

	const confirmCancelShare = useMemoizedFn(async () => {
		if (!selectedShare?.resource_id) return
		await projectShareList.cancelShare(selectedShare.resource_id)
		refreshShareList()
		setSelectedShareId(null)
		setLocalSelectedShare(null)
		setView("manage")
		setViewStack([])
	})

	return {
		open,
		mode,
		shareMode,
		view,
		viewStack,
		projectName,
		projectId,
		formState,
		filteredShareItems,
		selectedShare,
		loading: projectShareList.loading || fileShareList.loading,
		saving,
		isCheckingShare: mode === "project" ? shareProject.isCheckingShare : false,
		advancedOpen,
		defaultSelectedFileIds: effectiveSelectedFileIds,
		selectedFileItems,
		selectedFileHierarchy,
		selectedFileCount,
		memberSelectorOpen,
		selectedMemberNodes,
		setShareName: (value) => setFormValue("shareName", value),
		setShareType: (value) => setFormValue("shareType", value),
		setShareExpiry: (value) => setFormValue("shareExpiry", value),
		setPassword: (value) => setFormValue("password", value),
		resetPassword: () => setFormValue("password", generateSharePassword()),
		setShareRange: (value) => setFormValue("shareRange", value),
		setShareTargets: (value) => setFormValue("shareTargets", value),
		setAdvancedSettings: (value) => setFormValue("advancedSettings", value),
		setAdvancedOpen,
		openMemberSelector: () => setMemberSelectorOpen(true),
		closeMemberSelector: () => setMemberSelectorOpen(false),
		setSelectedMemberNodes,
		confirmMemberSelector,
		goToManage: () => goTo("manage"),
		goToExpiry: () => goTo("expiry"),
		goToDeleteConfirm: () => goTo("deleteConfirm"),
		goToLinkDetail: (resourceId) => {
			setSelectedShareId(resourceId)
			setLocalSelectedShare(null)
			goTo("linkDetail")
		},
		goBack,
		close: onClose,
		refreshShareList,
		copySelectedShareUrl,
		copySelectedSharePassword,
		submitCreateShare,
		openEditSelectedShare,
		confirmCancelShare,
		editResourceId,
		closeEditModal: () => {
			setEditResourceId(undefined)
			refreshShareList()
		},
	}
}
