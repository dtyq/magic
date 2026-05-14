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

export type ProjectShareSheetView = "create" | "manage" | "linkDetail" | "expiry" | "deleteConfirm"
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
	projectId?: string
	projectName?: string
	attachments: AttachmentItem[]
	attachmentList?: AttachmentItem[]
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
	advancedOpen: boolean
	defaultSelectedFileIds: string[]
	selectedFileItems: AttachmentItem[]
	selectedFileHierarchy: SelectedFileHierarchyNode[]
	selectedFileCount: number
	memberSelectorOpen: boolean
	selectedMemberNodes: TreeNode[]
	setShareName: (value: string) => void
	setShareType: (value: ShareType) => void
	setShareExpiry: (value: number | null) => void
	setPassword: (value: string) => void
	resetPassword: () => void
	setShareRange: (value: ShareRange) => void
	setShareTargets: (value: ShareTarget[]) => void
	setAdvancedSettings: (value: ShareAdvancedSettingsData) => void
	setAdvancedOpen: (value: boolean) => void
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
	copySelectedShareUrl: () => void
	copySelectedSharePassword: () => void
	submitCreateShare: () => Promise<void>
	openEditSelectedShare: () => void
	confirmCancelShare: () => Promise<void>
	editResourceId?: string
	closeEditModal: () => void
}
