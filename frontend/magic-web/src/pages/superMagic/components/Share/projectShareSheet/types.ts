import type { ShareMode, ShareType } from "@/pages/superMagic/components/Share/types"
import type {
	ShareAdvancedSettingsData,
	ShareRange,
	ShareTarget,
} from "@/pages/superMagic/components/Share/ShareFields"
import type {
	FileShareItem,
	ProjectShareItem,
} from "@/pages/superMagic/components/ShareManagement/types"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { TreeNode } from "@dtyq/user-selector"
import type { RecordingDetailFileMap } from "@/pages/superMagic/pages/AudioRecordings/types/recording-detail"
import type { RecordingShareGroupedItem } from "@/pages/superMagic/pages/AudioRecordings/utils/build-recording-share-selection"

export type ProjectShareSheetView =
	"create" | "manage" | "linkDetail" | "edit" | "expiry" | "deleteConfirm"
export type MobileShareSheetMode = "project" | "file"
export type MobileShareItem = ProjectShareItem | FileShareItem

export interface SelectedFileHierarchyNode {
	id: string
	name: string
	isDirectory: boolean
	fileExtension?: string
	children: SelectedFileHierarchyNode[]
}

export interface ProjectShareSheetProps {
	open: boolean
	mode?: MobileShareSheetMode
	projectMode?: string | null
	projectId?: string
	projectName?: string
	attachments: AttachmentItem[]
	attachmentList?: AttachmentItem[]
	/** Full attachment snapshot used for hidden recording document dependency lookup. */
	dependencyAttachments?: AttachmentItem[]
	/** Recording bundle root used to prevent cross-bundle dependency matching. */
	dependencyBundleRootPath?: string
	fileMap?: RecordingDetailFileMap
	defaultSelectedFileIds?: string[]
	defaultOpenFileId?: string
	initialSelectedShare?: MobileShareItem | null
	onClose: () => void
}

export interface ProjectShareFormState {
	shareName: string
	shareType: ShareType
	shareExpiry: number | null
	password: string
	shareRange: ShareRange
	shareTargets: ShareTarget[]
	advancedSettings: ShareAdvancedSettingsData
}

export interface ProjectShareSheetController {
	open: boolean
	mode: MobileShareSheetMode
	projectMode?: string | null
	shareMode: ShareMode
	view: ProjectShareSheetView
	viewStack: ProjectShareSheetView[]
	projectName?: string
	projectId?: string
	formState: ProjectShareFormState
	filteredShareItems: MobileShareItem[]
	selectedShare: MobileShareItem | null
	loading: boolean
	saving: boolean
	isCheckingShare: boolean
	permittedShareTypes?: ShareType[]
	shareTypePermissionLoading?: boolean
	isSelectedShareTypePermitted?: boolean
	/** Whether the organization is on a free plan, i.e. the paid-plan sharing gate applies. */
	isFreePlan?: boolean
	advancedOpen: boolean
	defaultSelectedFileIds: string[]
	selectedFileIds: string[]
	groupedShareItems: RecordingShareGroupedItem[]
	enableInlineFileSelection: boolean
	selectedFileItems: AttachmentItem[]
	selectedFileHierarchy: SelectedFileHierarchyNode[]
	selectedFileCount: number
	defaultOpenFileId?: string
	defaultOpenFileItem?: AttachmentItem
	defaultOpenFileCandidates: AttachmentItem[]
	defaultOpenFileCandidateTree: AttachmentItem[]
	defaultOpenFilePickerOpen: boolean
	/** Whether the sheet is editing an existing share resource. */
	isEditing?: boolean
	/** Whether the edit settings request is still loading. */
	editLoading?: boolean
	/** Whether the file-range popup is visible. */
	fileSelectorOpen?: boolean
	memberSelectorOpen: boolean
	selectedMemberNodes: TreeNode[]
	detailMemberNodes: TreeNode[]
	detailMemberLoading: boolean
	selectedShareMessageText: string
	canNativeShare: boolean
	setShareName: (value: string) => void
	setShareType: (value: ShareType) => void
	setShareExpiry: (value: number | null) => void
	setPassword: (value: string) => void
	resetPassword: () => void
	setShareRange: (value: ShareRange) => void
	setShareTargets: (value: ShareTarget[]) => void
	setAdvancedSettings: (value: ShareAdvancedSettingsData) => void
	setAdvancedOpen: (value: boolean) => void
	setSelectedFileIds: (value: string[]) => void
	toggleShareFileId: (fileId: string) => void
	openMemberSelector: () => void
	closeMemberSelector: () => void
	setSelectedMemberNodes: (value: TreeNode[]) => void
	confirmMemberSelector: (value: TreeNode[]) => void
	goToManage: () => void
	goToExpiry: () => void
	goToDeleteConfirm: () => void
	goToLinkDetail: (resourceId: string) => void
	goBack: () => void
	close: () => void
	refreshShareList: () => void
	copySelectedShareUrl: () => void | Promise<void>
	copySelectedSharePassword: () => void
	shareSelectedShareToSystem: () => Promise<void>
	openDefaultOpenFilePicker: () => void
	closeDefaultOpenFilePicker: () => void
	selectDefaultOpenFile: (fileId: string) => void
	submitCreateShare: () => Promise<void>
	openEditSelectedShare: () => void
	openFileSelector?: () => void
	closeFileSelector?: () => void
	confirmFileSelector?: (fileIds: string[]) => void
	confirmCancelShare: () => Promise<void>
	editResourceId?: string
	closeEditModal: () => void
}
