import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import {
	calculateDefaultOpenFileId,
	canSetAsDefault,
	findFileInTree,
	isFileDescendantOfSelectedFolders,
} from "@/pages/superMagic/components/Share/FileSelector/utils"
import { useShareProject } from "@/pages/superMagic/layouts/MainLayout/hooks/useShareProject"
import {
	SharedResourceType,
	SharedTopicFilterStatus,
	type FileShareItem,
	type ProjectShareItem,
} from "@/pages/superMagic/components/ShareManagement/types"
import { useShareData } from "@/pages/superMagic/components/ShareManagement/hooks/useShareData"
import { generateShareUrl } from "@/pages/superMagic/components/ShareManagement/utils/shareTypeHelpers"
import {
	canUseNativeShare,
	shareToNativeTarget,
} from "@/pages/superMagic/components/Share/utils/nativeShare"
import { analyticsService } from "@/services/analytics"
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
import { buildShareClipboardText } from "../utils/buildShareClipboardText"
import { isOrganizationShareScopeAll } from "@/pages/superMagic/components/ShareManagement/utils/shareScopeSummary"
import { ensureOrganizationAllMembersShareConfirmed } from "@/pages/superMagic/components/Share/utils/organizationShareConfirm"
import {
	DEFAULT_NEW_ORGANIZATION_SHARE_RANGE,
	isOrganizationDesignatedShareIncomplete,
} from "@/pages/superMagic/components/Share/utils/organizationShareGuards"
import { isPartialFileShare, isWholeProjectShare } from "../utils/shareScope"
import {
	buildRecordingShareSelection,
	collectRecordingRequiredShareFileIds,
	mergeRecordingShareFileIds,
} from "@/pages/superMagic/pages/AudioRecordings/utils/build-recording-share-selection"
import { isAudioProjectMode } from "@/services/audioRecordings/audioProjectMode"
import { resolveShareDocumentDependencies } from "@/pages/superMagic/components/Share/FileShareModal/hooks/resolveShareDocumentDependencies"
import { useShareTypePermissions } from "@/pages/superMagic/components/Share/hooks/useShareTypePermissions"
import { useSharePermissionResource } from "@/pages/superMagic/components/Share/SharePermissionResourceContext"
import {
	canCreateShareType,
	isFreePlanFromSubscription,
	pickDefaultShareType,
} from "@/pages/superMagic/components/Share/utils/sharePlanRestrictions"
import { userStore } from "@/models/user"

/**
 * Constructs the base default values for the share form.
 * `shareName` will be overridden by `buildDefaultShareNameForSheet` when the Sheet opens the creation page.
 */
function createInitialFormState(
	isAudioRecordingScene = false,
	isFreePlan = false,
): ProjectShareFormState {
	return {
		shareName: "",
		// Password protection is a paid-plan feature, so a free organization must not start on it.
		shareType: isFreePlan ? ShareType.Public : ShareType.PasswordProtected,
		shareExpiry: null,
		password: generateSharePassword(),
		shareRange: DEFAULT_NEW_ORGANIZATION_SHARE_RANGE,
		shareTargets: [],
		advancedSettings: {
			allowCopy: true,
			showFileList: isAudioRecordingScene ? false : true,
			showOriginalInfo: true,
			hideCreatorInfo: false,
			allowDownloadProjectFile: true,
		},
	}
}

/**
 * Retrieves the selected files/folders from the attachment tree,
 * used for displaying the creation page and detail page in file mode.
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
	projectMode?: string | null
	defaultOpenFileId?: string
	attachments: AttachmentItem[]
	effectiveSelectedFileIds: string[]
	projectName?: string
	t: (key: string, options?: Record<string, unknown>) => string
}

function buildDefaultShareNameForSheet({
	mode,
	projectMode,
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
		projectMode,
	)
}

/**
 * Converts attachment nodes into tree nodes that can be directly rendered by the share Sheet,
 * preventing the View layer from having to parse the raw attachment structure.
 */
function createSelectedHierarchyNode(item: AttachmentItem): SelectedFileHierarchyNode | null {
	const itemId = item.file_id
	if (!itemId) {
		return null
	}

	return {
		id: itemId,
		// Prefer the recording-only UI label while preserving original attachment identity.
		name:
			item.share_display_name ||
			item.name ||
			item.file_name ||
			item.display_filename ||
			item.filename ||
			"",
		isDirectory: Boolean(item.is_directory),
		fileExtension: item.file_extension,
		children: (item.children || [])
			.map((child) => createSelectedHierarchyNode(child))
			.filter((child): child is SelectedFileHierarchyNode => Boolean(child)),
	}
}

/**
 * Builds the hierarchical tree of "selected files":
 * - When a file is directly selected, it is kept as a root node.
 * - When a folder is directly selected, the entire folder subtree is preserved, ensuring descendants and subfolders can be expanded in details.
 * - Unselected parent folders will not appear as extra items at the root level to keep the sharing semantic clean.
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
 * Counts the number of selected files:
 * - Regular files count as 1.
 * - Folders count as the total number of their descendant files.
 * - Empty folders fall back to a count of 1, avoiding showing "Selected 0 files" when an empty folder is actually selected.
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
 * Checks whether a default-open candidate still belongs to the current share selection.
 */
function isDefaultOpenFileInSelection(
	fileId: string,
	selectedFileIds: string[],
	attachments: AttachmentItem[],
): boolean {
	if (selectedFileIds.includes(fileId)) {
		return true
	}

	const selectedIdSet = new Set(selectedFileIds)
	const stack = [...attachments]

	while (stack.length > 0) {
		const item = stack.pop()
		if (!item?.file_id) {
			if (item?.children?.length) {
				stack.push(...item.children)
			}
			continue
		}

		if (selectedIdSet.has(item.file_id) && item.children?.length) {
			const childrenStack = [...item.children]
			while (childrenStack.length > 0) {
				const child = childrenStack.pop()
				if (child?.file_id === fileId) {
					return true
				}
				if (child?.children?.length) {
					childrenStack.push(...child.children)
				}
			}
			continue
		}

		if (item.children?.length) {
			stack.push(...item.children)
		}
	}

	// Some flat payloads only preserve parent_id, so keep the existing helper as a compatibility fallback.
	return isFileDescendantOfSelectedFolders(fileId, selectedFileIds, attachments)
}

/**
 * Finds an attachment by ID using the current tree payload without relying on parent metadata.
 */
function findAttachmentInTree(
	attachments: AttachmentItem[],
	fileId: string,
): AttachmentItem | undefined {
	const stack = [...attachments]

	while (stack.length > 0) {
		const item = stack.pop()
		if (!item) {
			continue
		}

		if (item.file_id === fileId) {
			return item
		}

		if (item.children?.length) {
			stack.push(...item.children)
		}
	}

	return undefined
}

/**
 * Resolves the file ID used for default-open behavior in mobile file shares.
 */
function resolveDefaultOpenFileId({
	defaultOpenFileId,
	selectedFileIds,
	attachments,
}: {
	defaultOpenFileId?: string
	selectedFileIds: string[]
	attachments: AttachmentItem[]
}): string | undefined {
	if (selectedFileIds.length === 0 || attachments.length === 0) {
		return undefined
	}

	if (
		defaultOpenFileId &&
		canSetAsDefault(findAttachmentInTree(attachments, defaultOpenFileId) ?? {}) &&
		isDefaultOpenFileInSelection(defaultOpenFileId, selectedFileIds, attachments)
	) {
		return defaultOpenFileId
	}

	return calculateDefaultOpenFileId(selectedFileIds, attachments) ?? undefined
}

/**
 * Finds a default-open attachment from the flat list first, falling back to the tree only when needed.
 */
function findDefaultOpenFileItem({
	fileId,
	attachmentList,
	attachments,
}: {
	fileId?: string
	attachmentList: AttachmentItem[]
	attachments: AttachmentItem[]
}): AttachmentItem | undefined {
	if (!fileId) {
		return undefined
	}

	return (
		attachmentList.find((item) => item.file_id === fileId) ||
		(findFileInTree(
			attachments as unknown as Record<string, unknown>[],
			fileId,
		) as AttachmentItem | null) ||
		undefined
	)
}

/**
 * Builds the selectable default-open scope as a pruned tree plus a flat candidate list.
 * Folders stay in the tree for navigation, while only openable files/folders become candidates.
 */
function buildDefaultOpenFileScope({
	attachments,
	selectedFileIds,
	includeWholeTree,
}: {
	attachments: AttachmentItem[]
	selectedFileIds: string[]
	includeWholeTree: boolean
}): { tree: AttachmentItem[]; candidates: AttachmentItem[] } {
	const selectedIdSet = new Set(selectedFileIds)
	const candidates: AttachmentItem[] = []

	const visit = (item: AttachmentItem, forceIncludeChildren: boolean): AttachmentItem | null => {
		const itemId = item.file_id
		const isSelectedRoot = includeWholeTree || Boolean(itemId && selectedIdSet.has(itemId))
		const shouldIncludeChildren = forceIncludeChildren || isSelectedRoot
		const childNodes = (item.children || [])
			.map((child) => visit(child, shouldIncludeChildren))
			.filter((child): child is AttachmentItem => Boolean(child))

		if (item.is_hidden || !itemId) {
			return childNodes.length > 0
				? ({ ...item, children: childNodes } as AttachmentItem)
				: null
		}

		if (shouldIncludeChildren && canSetAsDefault(item)) {
			candidates.push(item)
		}

		if (shouldIncludeChildren || childNodes.length > 0) {
			return {
				...item,
				children: childNodes,
			}
		}

		return null
	}

	if (attachments.length === 0) {
		return { tree: [], candidates }
	}

	return {
		tree: attachments
			.map((item) => visit(item, includeWholeTree))
			.filter((item): item is AttachmentItem => Boolean(item)),
		candidates,
	}
}

const DINGTALK_AVATAR_SIZE_SUFFIX_PATTERN = /@\d+w_\d+h$/

/** Treat members-API `type` and selector `dataType` as the same person-vs-department signal. */
function isShareMemberUser(node: Partial<TreeNode>): boolean {
	return node.type === "User" || node.dataType === NodeType.User
}

/**
 * Align a share member with selector nodes.
 * The members API returns `type` and omits selector `dataType`; without that field the
 * edit list renders a department icon and resubmits the user id as a department target.
 */
function normalizeDetailMemberNode(node: TreeNode): TreeNode {
	const isUser = isShareMemberUser(node)
	const normalizedId = isUser ? node.user_id || node.id : node.department_id || node.id
	const normalizedAvatarUrl =
		typeof node.avatar_url === "string" &&
		node.avatar_url.includes("static-legacy.dingtalk.com")
			? node.avatar_url.replace(DINGTALK_AVATAR_SIZE_SUFFIX_PATTERN, "")
			: node.avatar_url || ""

	return {
		...node,
		id: normalizedId,
		dataType: node.dataType || (isUser ? NodeType.User : NodeType.Department),
		avatar_url: normalizedAvatarUrl,
	}
}

/**
 * Mobile project share controller: orchestrates only the prototype view stack,
 * and delegates actions like save, list, and cancel to the existing share API/Hooks.
 */
export function useProjectShareSheet({
	open,
	mode = "project",
	projectMode,
	projectId,
	projectName,
	attachments,
	attachmentList,
	dependencyAttachments,
	dependencyBundleRootPath,
	fileMap,
	defaultSelectedFileIds,
	defaultOpenFileId,
	initialSelectedShare,
	onClose,
}: ProjectShareSheetProps): ProjectShareSheetController {
	const { t } = useTranslation("super")
	const isAudioRecordingScene = isAudioProjectMode(projectMode)
	const effectiveMode: MobileShareSheetMode = isAudioRecordingScene ? "file" : mode
	const recordingShareSelection = useMemo(
		() => buildRecordingShareSelection(isAudioRecordingScene ? (fileMap ?? null) : null),
		[fileMap, isAudioRecordingScene],
	)
	const recordingRequiredFileIds = useMemo(
		() => (isAudioRecordingScene ? collectRecordingRequiredShareFileIds(fileMap ?? null) : []),
		[fileMap, isAudioRecordingScene],
	)
	const shareableAttachments = isAudioRecordingScene
		? recordingShareSelection.shareableFiles
		: attachments
	const shareableAttachmentList = useMemo(
		() =>
			isAudioRecordingScene ? recordingShareSelection.shareableFiles : (attachmentList ?? []),
		[attachmentList, isAudioRecordingScene, recordingShareSelection.shareableFiles],
	)
	const [view, setView] = useState<ProjectShareSheetView>("create")
	const [viewStack, setViewStack] = useState<ProjectShareSheetView[]>([])
	const [selectedShareId, setSelectedShareId] = useState<string | null>(null)
	const [localSelectedShare, setLocalSelectedShare] = useState<MobileShareItem | null>(null)
	const [saving, setSaving] = useState(false)
	const [editResourceId, setEditResourceId] = useState<string | undefined>()
	const [editingShareMode, setEditingShareMode] = useState<MobileShareSheetMode | null>(null)
	const [editLoading, setEditLoading] = useState(false)
	const [fileSelectorOpen, setFileSelectorOpen] = useState(false)
	const [advancedOpen, setAdvancedOpen] = useState(true)
	const [memberSelectorOpen, setMemberSelectorOpen] = useState(false)
	const [selectedMemberNodes, setSelectedMemberNodes] = useState<TreeNode[]>([])
	const [detailMemberNodes, setDetailMemberNodes] = useState<TreeNode[]>([])
	const [detailMemberLoading, setDetailMemberLoading] = useState(false)
	// Keep the prefetched text tied to its share so a rapid selection change cannot reuse stale content.
	const [selectedShareMessage, setSelectedShareMessage] = useState<{
		resourceId: string
		text: string
	} | null>(null)
	const [canNativeShare] = useState(() => canUseNativeShare())
	const isFreePlan = isFreePlanFromSubscription(userStore.user.organizationSubscriptionInfo)
	const [formState, setFormState] = useState<ProjectShareFormState>(() =>
		createInitialFormState(isAudioRecordingScene, isFreePlan),
	)
	const [selectedFileIds, setSelectedFileIds] = useState<string[]>([])
	const [recordingDependencyFileIds, setRecordingDependencyFileIds] = useState<string[]>([])
	const [recordingDependencyAnalysisLoading, setRecordingDependencyAnalysisLoading] =
		useState(false)
	// Keep the latest analysis promise available so submission can await the exact current inputs.
	const recordingDependencyAnalysisRef = useRef<{
		selectedFileIds: string[]
		attachments: NonNullable<ProjectShareSheetProps["dependencyAttachments"]>
		bundleRootPath?: string
		promise: ReturnType<typeof resolveShareDocumentDependencies>
	} | null>(null)
	const [userDefaultOpenFileId, setUserDefaultOpenFileId] = useState<string | undefined>()
	const [defaultOpenFilePickerOpen, setDefaultOpenFilePickerOpen] = useState(false)
	const activeMode = editingShareMode || effectiveMode
	const sharePermissionResource = useSharePermissionResource()
	const shareTypePermissions = useShareTypePermissions(sharePermissionResource)
	// The owning project or micro-app page supplies one permission group for both whole-resource
	// and child-file shares, so every mobile entry point exposes the same administrator choices.
	const shouldControlShareType = activeMode === "project" || activeMode === "file"
	const permittedShareTypes = useMemo(() => {
		if (!shouldControlShareType || shareTypePermissions.isLoading) return undefined
		return shareTypePermissions.permittedShareTypes
	}, [
		shareTypePermissions.isLoading,
		shareTypePermissions.permittedShareTypes,
		shouldControlShareType,
	])
	const isSelectedShareTypePermitted =
		permittedShareTypes === undefined || permittedShareTypes.includes(formState.shareType)
	const recordingDependencyAnalysisEnabled =
		isAudioRecordingScene &&
		Boolean(dependencyAttachments) &&
		Boolean(dependencyBundleRootPath?.trim())

	useEffect(() => {
		if (
			!open ||
			editResourceId ||
			permittedShareTypes === undefined ||
			permittedShareTypes.length === 0
		) {
			return
		}

		setFormState((prev) => {
			// A method the administrator allows but the plan forbids must not survive either: the card
			// would be hidden or disabled while the submission still carried the method.
			if (
				permittedShareTypes.includes(prev.shareType) &&
				canCreateShareType(prev.shareType, isFreePlan)
			) {
				return prev
			}
			// Nothing satisfies both gates: keep the current method and let the sheet explain it.
			const nextShareType = pickDefaultShareType(permittedShareTypes, isFreePlan)
			if (nextShareType === undefined) return prev
			return { ...prev, shareType: nextShareType }
		})
	}, [editResourceId, formState.shareType, isFreePlan, open, permittedShareTypes])

	useEffect(() => {
		if (!recordingDependencyAnalysisEnabled || !dependencyAttachments) {
			recordingDependencyAnalysisRef.current = null
			setRecordingDependencyFileIds([])
			setRecordingDependencyAnalysisLoading(false)
			return
		}

		let cancelled = false
		setRecordingDependencyAnalysisLoading(true)
		const analysisPromise = resolveShareDocumentDependencies({
			selectedFileIds,
			attachments: dependencyAttachments,
			bundleRootPath: dependencyBundleRootPath,
			requireBundleRootPath: true,
		})
		recordingDependencyAnalysisRef.current = {
			selectedFileIds: [...selectedFileIds],
			attachments: dependencyAttachments,
			bundleRootPath: dependencyBundleRootPath,
			promise: analysisPromise,
		}
		void analysisPromise
			.then((result) => {
				if (cancelled) return
				setRecordingDependencyFileIds(result.dependencyFileIds)
				if (result.missingResourcePaths.length > 0) {
					console.warn("Some recording share resources could not be resolved", result)
				}
			})
			.catch((error) => {
				if (!cancelled) {
					console.warn("Recording share dependency analysis failed", error)
					setRecordingDependencyFileIds([])
				}
			})
			.finally(() => {
				if (!cancelled) setRecordingDependencyAnalysisLoading(false)
			})

		return () => {
			cancelled = true
		}
	}, [
		dependencyAttachments,
		dependencyBundleRootPath,
		isAudioRecordingScene,
		recordingDependencyAnalysisEnabled,
		selectedFileIds,
	])

	const shareProject = useShareProject({
		attachments: shareableAttachments,
		projectName,
	})
	const effectiveSelectedFileIds = useMemo(() => {
		if (isAudioRecordingScene) {
			return selectedFileIds
		}

		if (editingShareMode || effectiveMode === "file") {
			if (editingShareMode) {
				return selectedFileIds
			}

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
	}, [
		defaultSelectedFileIds,
		effectiveMode,
		editingShareMode,
		initialSelectedShare,
		isAudioRecordingScene,
		selectedFileIds,
		shareProject.defaultSelectedFileIds,
	])
	const defaultOpenFileScope = useMemo(() => {
		if (isAudioRecordingScene) {
			return { tree: [], candidates: [] }
		}

		return buildDefaultOpenFileScope({
			attachments: shareableAttachments,
			selectedFileIds: effectiveSelectedFileIds,
			// Editing follows desktop behavior: the default file can come from the full project tree.
			includeWholeTree: activeMode === "project" || Boolean(editingShareMode),
		})
	}, [
		activeMode,
		effectiveSelectedFileIds,
		editingShareMode,
		isAudioRecordingScene,
		shareableAttachments,
	])
	const autoDefaultOpenFileId = useMemo(() => {
		if (isAudioRecordingScene) {
			return undefined
		}

		if (editingShareMode && defaultOpenFileId) {
			const candidate = findAttachmentInTree(shareableAttachments, defaultOpenFileId)
			if (candidate && canSetAsDefault(candidate)) {
				return defaultOpenFileId
			}
		}

		return resolveDefaultOpenFileId({
			defaultOpenFileId,
			selectedFileIds: effectiveSelectedFileIds,
			attachments: shareableAttachments,
		})
	}, [
		defaultOpenFileId,
		editingShareMode,
		effectiveSelectedFileIds,
		isAudioRecordingScene,
		shareableAttachments,
	])
	const effectiveDefaultOpenFileId = useMemo(() => {
		if (isAudioRecordingScene) {
			return undefined
		}

		const userDefaultFile = userDefaultOpenFileId
			? defaultOpenFileScope.candidates.find((item) => item.file_id === userDefaultOpenFileId)
			: undefined

		return userDefaultFile?.file_id || autoDefaultOpenFileId
	}, [
		autoDefaultOpenFileId,
		defaultOpenFileScope.candidates,
		isAudioRecordingScene,
		userDefaultOpenFileId,
	])
	const defaultOpenFileItem = useMemo(
		() =>
			findDefaultOpenFileItem({
				fileId: effectiveDefaultOpenFileId,
				attachmentList: shareableAttachmentList,
				attachments: shareableAttachments,
			}),
		[effectiveDefaultOpenFileId, shareableAttachmentList, shareableAttachments],
	)

	// Share-management list API requires login; only fetch when the sheet is open.
	const shouldFetchShareLists = open && Boolean(projectId)

	const projectShareList = useShareData({
		resourceType: SharedResourceType.Project,
		filterStatus: SharedTopicFilterStatus.Active,
		searchText: "",
		projectId,
		currentPage: 1,
		pageSize: 50,
		enabled: shouldFetchShareLists,
	})
	const fileShareList = useShareData({
		resourceType: SharedResourceType.File,
		filterStatus: SharedTopicFilterStatus.Active,
		searchText: "",
		projectId,
		currentPage: 1,
		pageSize: 50,
		enabled: shouldFetchShareLists,
	})

	useEffect(() => {
		if (!open) return
		setView(initialSelectedShare ? "linkDetail" : "create")
		setViewStack([])
		setSelectedShareId(initialSelectedShare?.resource_id || null)
		setLocalSelectedShare(initialSelectedShare || null)
		setEditResourceId(undefined)
		setEditingShareMode(null)
		setEditLoading(false)
		setFileSelectorOpen(false)
		setAdvancedOpen(true)
		setMemberSelectorOpen(false)
		setSelectedMemberNodes([])
		setDetailMemberNodes([])
		setDetailMemberLoading(false)
		setSelectedShareMessage(null)
		setUserDefaultOpenFileId(undefined)
		setDefaultOpenFilePickerOpen(false)
		setSelectedFileIds(
			isAudioRecordingScene
				? recordingShareSelection.defaultSelectedFileIds
				: initialSelectedShare && "file_ids" in initialSelectedShare
					? initialSelectedShare.file_ids || []
					: defaultSelectedFileIds || [],
		)
		const initialFormState = createInitialFormState(isAudioRecordingScene, isFreePlan)
		// The open-reset effect runs after permission normalization on first mount; apply the
		// permission- and plan-aware default here so it cannot restore a hidden option. When nothing
		// satisfies both gates, the plan-aware base default (never password on a free plan) stays.
		const initialShareType =
			pickDefaultShareType(permittedShareTypes ?? [], isFreePlan) ??
			initialFormState.shareType
		setFormState({
			...initialFormState,
			shareType: initialShareType,
			shareName: initialSelectedShare
				? ""
				: buildDefaultShareNameForSheet({
						mode: effectiveMode,
						projectMode,
						defaultOpenFileId: effectiveDefaultOpenFileId,
						attachments: shareableAttachments,
						effectiveSelectedFileIds: isAudioRecordingScene
							? recordingShareSelection.defaultSelectedFileIds
							: effectiveSelectedFileIds,
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
		if (localSelectedShare?.resource_id === selectedShareId) return localSelectedShare

		const remoteMatch =
			filteredShareItems.find((item) => item.resource_id === selectedShareId) || null
		if (remoteMatch) return remoteMatch
		return null
	}, [filteredShareItems, localSelectedShare, selectedShareId])
	// Expose text only when it belongs to the currently selected share.
	const selectedShareMessageText =
		selectedShareMessage && selectedShareMessage.resourceId === selectedShare?.resource_id
			? selectedShareMessage.text
			: ""
	const displayedSelectedFileIds = useMemo(() => {
		// Edit mode displays the draft selection rather than the stale list-row snapshot.
		if (editResourceId) {
			return effectiveSelectedFileIds
		}

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
	}, [editResourceId, effectiveSelectedFileIds, selectedShare])
	const selectedFileItems = useMemo(
		() => collectSelectedItems(shareableAttachments, displayedSelectedFileIds),
		[displayedSelectedFileIds, shareableAttachments],
	)
	const selectedFileHierarchy = useMemo(
		() => buildSelectedFileHierarchy(shareableAttachments, displayedSelectedFileIds),
		[displayedSelectedFileIds, shareableAttachments],
	)
	const selectedFileCount = useMemo(
		() => countSelectedHierarchyFiles(selectedFileHierarchy),
		[selectedFileHierarchy],
	)

	useEffect(() => {
		if (
			!open ||
			view !== "linkDetail" ||
			selectedShare?.share_type !== ShareType.Organization ||
			!selectedShare.resource_id ||
			isOrganizationShareScopeAll(selectedShare.share_scope)
		) {
			setDetailMemberNodes([])
			setDetailMemberLoading(false)
			return
		}

		let isCancelled = false
		setDetailMemberLoading(true)
		setDetailMemberNodes([])

		// Keep the detail shell responsive and ignore late responses when the user switches shares quickly.
		void SuperMagicApi.getShareResourceMembers({
			resource_id: selectedShare.resource_id,
		})
			.then((response) => {
				if (isCancelled) {
					return
				}

				setDetailMemberNodes((response.members || []).map(normalizeDetailMemberNode))
			})
			.catch((error) => {
				if (isCancelled) {
					return
				}

				console.error("Failed to fetch organization share members:", error)
				setDetailMemberNodes([])
			})
			.finally(() => {
				if (!isCancelled) {
					setDetailMemberLoading(false)
				}
			})

		return () => {
			isCancelled = true
		}
	}, [
		open,
		selectedShare?.resource_id,
		selectedShare?.share_scope,
		selectedShare?.share_type,
		view,
	])

	useEffect(() => {
		if (!open || view !== "linkDetail" || !selectedShare?.resource_id) {
			setSelectedShareMessage(null)
			return
		}

		let isCancelled = false
		setSelectedShareMessage(null)
		const resourceId = selectedShare.resource_id

		// Prebuild the shared payload before any user action so iOS clipboard and Web Share calls stay inside the click gesture.
		void buildShareClipboardText({
			share: selectedShare,
			projectName,
			t,
		})
			.then((shareMessageText) => {
				if (!isCancelled) {
					setSelectedShareMessage({ resourceId, text: shareMessageText })
				}
			})
			.catch((error) => {
				if (!isCancelled) {
					console.error("Failed to build share message:", error)
					setSelectedShareMessage(null)
				}
			})

		return () => {
			isCancelled = true
		}
		// The selected share is the real rebuild signal; keeping `t` out avoids repeated async rebuilds in tests with unstable mocks.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open, projectName, selectedShare, view])

	const goTo = useMemoizedFn((nextView: ProjectShareSheetView) => {
		setViewStack((prev) => [...prev, view])
		setView(nextView)
	})

	const goBack = useMemoizedFn(() => {
		if (view === "edit") {
			setEditResourceId(undefined)
			setEditingShareMode(null)
			setEditLoading(false)
			setFileSelectorOpen(false)
			setView("linkDetail")
			setViewStack([])
			return
		}

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
		// Selector echoes can keep members-API `type` and drop `dataType`; classify before writing targets.
		const normalizedMembers = value.map((item) => normalizeDetailMemberNode(item))
		setSelectedMemberNodes(normalizedMembers)
		setMemberSelectorOpen(false)
		setFormState((prev) => ({
			...prev,
			// Keep explicit "all team" choice; designated scope stays designated even when the list is empty.
			shareRange: prev.shareRange === "all" ? "all" : DEFAULT_NEW_ORGANIZATION_SHARE_RANGE,
			shareTargets: normalizedMembers.map((item) => ({
				target_type: isShareMemberUser(item) ? "User" : "Department",
				target_id: item.id,
				name: item.name,
				avatar_url: item.avatar_url,
			})),
		}))
	})

	const openDefaultOpenFilePicker = useMemoizedFn(() => {
		if (defaultOpenFileScope.candidates.length === 0) return
		setDefaultOpenFilePickerOpen(true)
	})

	const closeDefaultOpenFilePicker = useMemoizedFn(() => {
		setDefaultOpenFilePickerOpen(false)
	})

	const selectDefaultOpenFile = useMemoizedFn((fileId: string) => {
		// Only accept IDs from the current share scope so the submitted payload cannot escape the visible picker.
		const selectedCandidate = defaultOpenFileScope.candidates.find(
			(item) => item.file_id === fileId,
		)
		if (!selectedCandidate?.file_id) return

		setUserDefaultOpenFileId(selectedCandidate.file_id)
		setDefaultOpenFilePickerOpen(false)
	})

	const copySelectedShareUrl = useMemoizedFn(async () => {
		if (!selectedShare?.resource_id || !selectedShareMessageText) return

		try {
			// Keep the clipboard write as the first asynchronous operation in the click handler for iOS WebKit.
			await clipboard.writeText(selectedShareMessageText)
			magicToast.success(t("share.copySuccess"))
		} catch {
			magicToast.error(t("common.copyFailed"))
		}
	})

	const copySelectedSharePassword = useMemoizedFn(async () => {
		if (!selectedShare?.password) return

		try {
			await clipboard.writeText(selectedShare.password)
			magicToast.success(t("share.copyPasswordSuccess"))
		} catch {
			magicToast.error(t("common.copyFailed"))
		}
	})

	/**
	 * Shares the prebuilt detail message through the mobile system share sheet.
	 */
	const shareSelectedShareToSystem = useMemoizedFn(async () => {
		if (!selectedShare?.resource_id || !selectedShareMessageText) return

		const shareUrl = generateShareUrl(
			selectedShare.resource_id,
			selectedShare.password,
			"files",
		)
		const result = await shareToNativeTarget({
			title: selectedShare.title || projectName,
			text: selectedShareMessageText,
			url: shareUrl,
		})

		if (result === "failed" || result === "unsupported") {
			magicToast.error(t("share.nativeShareFailed"))
		}
	})

	const submitCreateShare = useMemoizedFn(async () => {
		const isEditing = Boolean(editResourceId)
		if (shouldControlShareType && !isSelectedShareTypePermitted) {
			magicToast.error(t("share.currentShareMethodUnavailable"))
			return
		}
		// Backstop for the paid-plan gate: a new mobile share must never be created with a
		// plan-disabled method. Editing an existing share keeps that share's own method.
		if (
			!isEditing &&
			shouldControlShareType &&
			!canCreateShareType(formState.shareType, isFreePlan)
		) {
			return
		}
		const selectedIdsForSubmission = [...effectiveSelectedFileIds]
		// Desktop behavior keeps the selected default file in the share scope even when it was picked from elsewhere.
		if (
			isEditing &&
			activeMode === "file" &&
			effectiveDefaultOpenFileId &&
			!selectedIdsForSubmission.includes(effectiveDefaultOpenFileId)
		) {
			selectedIdsForSubmission.push(effectiveDefaultOpenFileId)
		}

		if (selectedIdsForSubmission.length === 0) {
			magicToast.warning(t("share.noShareableFiles"))
			return
		}

		if (
			isOrganizationDesignatedShareIncomplete(
				formState.shareType,
				formState.shareRange,
				formState.shareTargets.length,
			)
		) {
			magicToast.error(t("share.organizationDesignatedMembersRequired"))
			return
		}

		const confirmed = await ensureOrganizationAllMembersShareConfirmed(
			formState.shareType,
			formState.shareRange,
			t,
		)
		if (!confirmed) return

		setSaving(true)
		try {
			// Await the current recording analysis so the payload cannot use stale dependency state.
			let dependencyFileIds = recordingDependencyFileIds
			if (recordingDependencyAnalysisEnabled && dependencyAttachments) {
				const currentAnalysis = recordingDependencyAnalysisRef.current
				if (
					!currentAnalysis ||
					currentAnalysis.attachments !== dependencyAttachments ||
					currentAnalysis.bundleRootPath !== dependencyBundleRootPath ||
					currentAnalysis.selectedFileIds.length !== selectedFileIds.length ||
					!currentAnalysis.selectedFileIds.every(
						(fileId, index) => fileId === selectedFileIds[index],
					)
				) {
					throw new Error("Recording dependency analysis is not ready")
				}
				dependencyFileIds = (await currentAnalysis.promise).dependencyFileIds
			}

			// Recording shares keep the visible picker unchanged and augment only the submitted payload.
			const submittedFileIds = isAudioRecordingScene
				? mergeRecordingShareFileIds(
						mergeRecordingShareFileIds(selectedIdsForSubmission, dependencyFileIds),
						recordingRequiredFileIds,
					)
				: selectedIdsForSubmission

			// Reuse the existing resource for edits and allocate a new ID only for creation.
			let resourceId = editResourceId
			if (!resourceId) {
				const resourceIdResponse = await SuperMagicApi.getSnowflakeIds()
				resourceId = resourceIdResponse?.ids?.[0]
				if (!resourceId) {
					throw new Error("Failed to get share resource id")
				}
			}

			const password =
				formState.shareType === ShareType.PasswordProtected ? formState.password : undefined
			const currentResourceId = resourceId
			const fallbackShareName =
				activeMode === "file"
					? calculateDefaultShareName(
							effectiveDefaultOpenFileId,
							selectedFileItems,
							shareableAttachments,
							t,
							false,
							projectName,
							projectMode,
						)
					: t("share.projectShareName", {
							projectName: projectName || t("common.untitledProject"),
						})
			const resourceName = formState.shareName.trim() || fallbackShareName
			if (!isEditing) {
				analyticsService.report("content_share_attempted", {
					resourceType: ResourceType.FileCollection,
					shareProject: !isAudioRecordingScene && activeMode === "project",
				})
			}
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
				...(formState.shareType === ShareType.Organization ? {} : { password }),
				file_ids: submittedFileIds,
				default_open_file_id: isAudioRecordingScene
					? undefined
					: effectiveDefaultOpenFileId,
				share_project: isAudioRecordingScene ? false : activeMode === "project",
				project_id: projectId,
				extra: {
					allow_copy_project_files: formState.advancedSettings.allowCopy ?? true,
					view_file_list: isAudioRecordingScene
						? false
						: (formState.advancedSettings.showFileList ?? true),
					hide_created_by_super_magic:
						formState.advancedSettings.hideCreatorInfo ?? false,
					show_original_info: formState.advancedSettings.showOriginalInfo ?? true,
					allow_download_project_file:
						formState.advancedSettings.allowDownloadProjectFile ?? true,
					pure_mode: formState.advancedSettings.pureMode ?? false,
				},
			})

			const createdShareForClipboard: MobileShareItem =
				activeMode === "file"
					? ({
							title: resourceName,
							project_name: projectName || t("common.untitledProject"),
							project_id: projectId || "",
							workspace_id: "",
							workspace_name: "",
							resource_type: ResourceType.FileCollection,
							share_type: formState.shareType,
							resource_id: currentResourceId,
							has_password: Boolean(password),
							password,
							main_file_name:
								selectedFileItems[0]?.name || selectedFileItems[0]?.file_name || "",
							file_ids: submittedFileIds,
							created_at: new Date().toISOString(),
							expire_days: formState.shareExpiry ?? undefined,
							expire_at: undefined,
							share_project: false,
							extend: {
								file_count: submittedFileIds.length,
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
							resource_id: currentResourceId,
							has_password: Boolean(password),
							password,
							created_at: new Date().toISOString(),
							expire_days: formState.shareExpiry ?? undefined,
							expire_at: undefined,
							share_project: activeMode === "project",
							extend: {
								file_count: submittedFileIds.length,
							},
						} satisfies ProjectShareItem)

			if (!isEditing) {
				try {
					const shareMessageText = await buildShareClipboardText({
						share: createdShareForClipboard,
						projectName,
						t,
					})
					await clipboard.writeText(shareMessageText)
				} catch (error) {
					console.error("Failed to copy share message after create:", error)
				}
			}

			const updatedShareForDetail: MobileShareItem = selectedShare
				? ({
						...selectedShare,
						...createdShareForClipboard,
						share_scope:
							formState.shareType === ShareType.Organization
								? { type: formState.shareRange }
								: undefined,
						extra: {
							...(
								selectedShare as MobileShareItem & {
									extra?: Record<string, unknown>
								}
							).extra,
							pure_mode: formState.advancedSettings.pureMode ?? false,
						},
					} as MobileShareItem)
				: createdShareForClipboard

			magicToast.success(
				t(isEditing ? "share.updateSuccess" : "share.createSuccessAndCopied"),
			)
			refreshShareList()
			setLocalSelectedShare(updatedShareForDetail)
			setSelectedShareId(currentResourceId)
			setView("linkDetail")
			setEditResourceId(undefined)
			setEditingShareMode(null)
			setEditLoading(false)
			setFileSelectorOpen(false)
			// Clear stack so the header close button dismisses the whole sheet instead of returning to create.
			setViewStack([])
		} catch (error) {
			console.error("Failed to save project share:", error)
			magicToast.error(t(isEditing ? "share.updateFailed" : "share.createFailed"))
		} finally {
			setSaving(false)
		}
	})

	/** Enters the new H5 edit view and hydrates it from the authoritative share settings API. */
	const openEditSelectedShare = useMemoizedFn(() => {
		if (!selectedShare?.resource_id) return

		const resourceId = selectedShare.resource_id
		const shareModeForEdit = isWholeProjectShare(selectedShare) ? "project" : "file"
		setEditResourceId(resourceId)
		setEditingShareMode(shareModeForEdit)
		setEditLoading(true)
		setFileSelectorOpen(false)
		// Clear the previous share draft before loading the selected share's authoritative settings.
		setSelectedFileIds([])
		setUserDefaultOpenFileId(undefined)
		setSelectedMemberNodes([])
		setDetailMemberNodes([])
		setViewStack(["linkDetail"])
		setView("edit")

		// Load the complete settings payload before exposing the edit form so fields cannot save stale values.
		void Promise.all([
			SuperMagicApi.getShareInfoByCode({ code: resourceId }),
			selectedShare.share_type === ShareType.Organization
				? SuperMagicApi.getShareResourceMembers({ resource_id: resourceId }).catch(() => ({
						members: [],
					}))
				: Promise.resolve({ members: [] }),
		])
			.then(([settings, membersResponse]) => {
				const fileIds =
					Array.isArray(settings?.file_ids) && settings.file_ids.length > 0
						? settings.file_ids
						: "file_ids" in selectedShare && Array.isArray(selectedShare.file_ids)
							? selectedShare.file_ids
							: shareModeForEdit === "project"
								? shareProject.defaultSelectedFileIds
								: []
				const defaultFileId = settings?.default_open_file_id || undefined
				const shareType = (settings?.share_type ?? selectedShare.share_type) as ShareType
				const shareRange = settings?.share_range === "designated" ? "designated" : "all"
				const targetIds = settings?.target_ids || []
				const memberNodes = targetIds.map((target) => {
					const matched = (membersResponse.members || []).find((member) => {
						const memberId = isShareMemberUser(member)
							? member.user_id || member.id
							: member.department_id || member.id
						return memberId === target.target_id
					})
					if (matched) return normalizeDetailMemberNode(matched)
					return {
						id: target.target_id,
						name: target.target_id,
						type: target.target_type,
						dataType:
							target.target_type === "User" ? NodeType.User : NodeType.Department,
					} as TreeNode
				})

				setFormState({
					shareName: settings?.resource_name || selectedShare.title || "",
					shareType,
					shareExpiry: settings?.expire_days ?? selectedShare.expire_days ?? null,
					password: settings?.password || "",
					shareRange,
					shareTargets: targetIds.map((target) => ({
						target_type: target.target_type as "User" | "Department",
						target_id: target.target_id,
						name: memberNodes.find((member) => member.id === target.target_id)?.name,
					})),
					advancedSettings: {
						allowCopy: settings?.extra?.allow_copy_project_files ?? true,
						showFileList: settings?.extra?.view_file_list ?? true,
						showOriginalInfo: settings?.extra?.show_original_info ?? true,
						hideCreatorInfo: settings?.extra?.hide_created_by_super_magic ?? false,
						allowDownloadProjectFile:
							settings?.extra?.allow_download_project_file ?? true,
						pureMode: settings?.extra?.pure_mode ?? false,
					},
				})
				setSelectedFileIds(fileIds)
				setUserDefaultOpenFileId(defaultFileId)
				setSelectedMemberNodes(shareRange === "designated" ? memberNodes : [])
				setAdvancedOpen(true)
			})
			.catch((error) => {
				console.error("Failed to load share settings for edit:", error)
				magicToast.error(t("share.updateFailed"))
				setEditResourceId(undefined)
				setEditingShareMode(null)
				setView("linkDetail")
				setViewStack([])
			})
			.finally(() => setEditLoading(false))
	})

	/** Opens the staged file-range picker for file-share edits only. */
	const openFileSelector = useMemoizedFn(() => {
		if (!editResourceId || activeMode !== "file") return
		setFileSelectorOpen(true)
	})

	/** Discards staged file-range changes when the picker is closed without saving. */
	const closeFileSelector = useMemoizedFn(() => setFileSelectorOpen(false))

	/** Commits the picker selection into the edit draft without calling the share API. */
	const confirmFileSelector = useMemoizedFn((fileIds: string[]) => {
		setSelectedFileIds(fileIds)
		setFileSelectorOpen(false)
	})

	const confirmCancelShare = useMemoizedFn(async () => {
		if (!selectedShare?.resource_id) return
		await projectShareList.cancelShare(selectedShare.resource_id)
		refreshShareList()
		setSelectedShareId(null)
		setLocalSelectedShare(null)
		setEditResourceId(undefined)
		setEditingShareMode(null)
		setView("manage")
		setViewStack([])
	})

	const toggleShareFileId = useMemoizedFn((fileId: string) => {
		if (!isAudioRecordingScene && !editResourceId) return

		setSelectedFileIds((current) =>
			current.includes(fileId) ? current.filter((id) => id !== fileId) : [...current, fileId],
		)
	})

	return {
		open,
		mode: activeMode,
		projectMode,
		shareMode: activeMode === "file" ? ShareMode.File : ShareMode.Project,
		view,
		viewStack,
		isFreePlan,
		projectName,
		projectId,
		formState,
		filteredShareItems,
		selectedShare,
		loading: projectShareList.loading || fileShareList.loading,
		saving,
		isCheckingShare:
			activeMode === "project"
				? shareProject.isCheckingShare
				: recordingDependencyAnalysisLoading,
		permittedShareTypes,
		shareTypePermissionLoading: shouldControlShareType && shareTypePermissions.isLoading,
		isSelectedShareTypePermitted,
		advancedOpen,
		defaultSelectedFileIds: effectiveSelectedFileIds,
		selectedFileIds,
		groupedShareItems: recordingShareSelection.groupedItems,
		enableInlineFileSelection: isAudioRecordingScene,
		selectedFileItems,
		selectedFileHierarchy,
		selectedFileCount,
		defaultOpenFileId: effectiveDefaultOpenFileId,
		defaultOpenFileItem,
		defaultOpenFileCandidates: defaultOpenFileScope.candidates,
		defaultOpenFileCandidateTree: defaultOpenFileScope.tree,
		defaultOpenFilePickerOpen,
		isEditing: Boolean(editResourceId),
		editLoading,
		fileSelectorOpen,
		memberSelectorOpen,
		selectedMemberNodes,
		detailMemberNodes,
		detailMemberLoading,
		selectedShareMessageText,
		canNativeShare,
		setShareName: (value) => setFormValue("shareName", value),
		setShareType: (value) => setFormValue("shareType", value),
		setShareExpiry: (value) => setFormValue("shareExpiry", value),
		setPassword: (value) => setFormValue("password", value),
		resetPassword: () => setFormValue("password", generateSharePassword()),
		setShareRange: (value) => setFormValue("shareRange", value),
		setShareTargets: (value) => setFormValue("shareTargets", value),
		setAdvancedSettings: (value) => setFormValue("advancedSettings", value),
		setAdvancedOpen,
		setSelectedFileIds,
		toggleShareFileId,
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
		shareSelectedShareToSystem,
		openDefaultOpenFilePicker,
		closeDefaultOpenFilePicker,
		selectDefaultOpenFile,
		submitCreateShare,
		openEditSelectedShare,
		openFileSelector,
		closeFileSelector,
		confirmFileSelector,
		confirmCancelShare,
		editResourceId,
		closeEditModal: () => {
			setEditResourceId(undefined)
			setEditingShareMode(null)
			setEditLoading(false)
			setFileSelectorOpen(false)
			setView("linkDetail")
			setViewStack([])
			refreshShareList()
		},
	}
}
