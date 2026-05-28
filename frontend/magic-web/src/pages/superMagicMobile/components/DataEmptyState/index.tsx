import { useTranslation } from "react-i18next"
import type { LucideIcon } from "lucide-react"
import {
	AtSign,
	Box,
	ClipboardList,
	Cpu,
	FileSearch,
	Folder,
	FolderOpen,
	History,
	Inbox,
	Laptop,
	LayoutGrid,
	Link2,
	MessageCircle,
	MessageSquare,
	MessagesSquare,
	Mic,
	Network,
	Puzzle,
	Search,
	Share2,
	Trash2,
	UserPlus,
	Users,
	Wand2,
} from "lucide-react"
import { cn } from "@/lib/utils"

export const DATA_EMPTY_STATE_VARIANTS = [
	"generic",
	"search",
	"chat",
	"workspace",
	"project",
	"sharedProject",
	"topic",
	"crew",
	"orgMembers",
	"orgDept",
	"files",
	"chatFilesSearch",
	"chatFilesFolder",
	"plugin",
	"model",
	"skill",
	"mention",
	"mentionSelected",
	"shareLink",
	"collaborator",
	"apps",
	"trash",
	"loginDevice",
	"loginActivity",
	"feedback",
	"recording",
	"recordingGroup",
] as const

export type DataEmptyStateVariant = (typeof DATA_EMPTY_STATE_VARIANTS)[number]

const VARIANT_ICONS: Record<DataEmptyStateVariant, LucideIcon> = {
	generic: Inbox,
	search: Search,
	chat: MessageCircle,
	workspace: Box,
	project: Folder,
	sharedProject: Share2,
	topic: MessageSquare,
	crew: Users,
	orgMembers: Users,
	orgDept: Network,
	files: FolderOpen,
	chatFilesSearch: FileSearch,
	chatFilesFolder: FolderOpen,
	plugin: Puzzle,
	model: Cpu,
	skill: Wand2,
	mention: AtSign,
	mentionSelected: ClipboardList,
	shareLink: Link2,
	collaborator: UserPlus,
	apps: LayoutGrid,
	trash: Trash2,
	loginDevice: Laptop,
	loginActivity: History,
	feedback: MessagesSquare,
	recording: Mic,
	recordingGroup: FolderOpen,
}

export interface DataEmptyStateProps {
	variant: DataEmptyStateVariant
	className?: string
	/** Smaller icon and spacing for sheets or compact lists */
	compact?: boolean
	/** Optional override for page-specific test selectors */
	testId?: string
}

/**
 * Resolves title/description copy for a variant using static i18n keys
 * so tooling can track translations (no dynamic key concatenation).
 */
function useEmptyStateCopy(variant: DataEmptyStateVariant) {
	const { t } = useTranslation("super")

	switch (variant) {
		case "generic":
			return {
				title: t("mobile.emptyState.variants.generic.title"),
				description: t("mobile.emptyState.variants.generic.description"),
			}
		case "search":
			return {
				title: t("mobile.emptyState.variants.search.title"),
				description: t("mobile.emptyState.variants.search.description"),
			}
		case "chat":
			return {
				title: t("mobile.emptyState.variants.chat.title"),
				description: t("mobile.emptyState.variants.chat.description"),
			}
		case "workspace":
			return {
				title: t("mobile.emptyState.variants.workspace.title"),
				description: t("mobile.emptyState.variants.workspace.description"),
			}
		case "project":
			return {
				title: t("mobile.emptyState.variants.project.title"),
				description: t("mobile.emptyState.variants.project.description"),
			}
		case "sharedProject":
			return {
				title: t("mobile.emptyState.variants.sharedProject.title"),
				description: t("mobile.emptyState.variants.sharedProject.description"),
			}
		case "topic":
			return {
				title: t("mobile.emptyState.variants.topic.title"),
				description: t("mobile.emptyState.variants.topic.description"),
			}
		case "crew":
			return {
				title: t("mobile.emptyState.variants.crew.title"),
				description: t("mobile.emptyState.variants.crew.description"),
			}
		case "orgMembers":
			return {
				title: t("mobile.emptyState.variants.orgMembers.title"),
				description: t("mobile.emptyState.variants.orgMembers.description"),
			}
		case "orgDept":
			return {
				title: t("mobile.emptyState.variants.orgDept.title"),
				description: t("mobile.emptyState.variants.orgDept.description"),
			}
		case "files":
			return {
				title: t("mobile.emptyState.variants.files.title"),
				description: t("mobile.emptyState.variants.files.description"),
			}
		case "chatFilesSearch":
			return {
				title: t("mobile.emptyState.variants.chatFilesSearch.title"),
				description: t("mobile.emptyState.variants.chatFilesSearch.description"),
			}
		case "chatFilesFolder":
			return {
				title: t("mobile.emptyState.variants.chatFilesFolder.title"),
				description: t("mobile.emptyState.variants.chatFilesFolder.description"),
			}
		case "plugin":
			return {
				title: t("mobile.emptyState.variants.plugin.title"),
				description: t("mobile.emptyState.variants.plugin.description"),
			}
		case "model":
			return {
				title: t("mobile.emptyState.variants.model.title"),
				description: t("mobile.emptyState.variants.model.description"),
			}
		case "skill":
			return {
				title: t("mobile.emptyState.variants.skill.title"),
				description: t("mobile.emptyState.variants.skill.description"),
			}
		case "mention":
			return {
				title: t("mobile.emptyState.variants.mention.title"),
				description: t("mobile.emptyState.variants.mention.description"),
			}
		case "mentionSelected":
			return {
				title: t("mobile.emptyState.variants.mentionSelected.title"),
				description: t("mobile.emptyState.variants.mentionSelected.description"),
			}
		case "shareLink":
			return {
				title: t("mobile.emptyState.variants.shareLink.title"),
				description: t("mobile.emptyState.variants.shareLink.description"),
			}
		case "collaborator":
			return {
				title: t("mobile.emptyState.variants.collaborator.title"),
				description: t("mobile.emptyState.variants.collaborator.description"),
			}
		case "apps":
			return {
				title: t("mobile.emptyState.variants.apps.title"),
				description: t("mobile.emptyState.variants.apps.description"),
			}
		case "trash":
			return {
				title: t("mobile.emptyState.variants.trash.title"),
				description: t("mobile.emptyState.variants.trash.description"),
			}
		case "loginDevice":
			return {
				title: t("mobile.emptyState.variants.loginDevice.title"),
				description: t("mobile.emptyState.variants.loginDevice.description"),
			}
		case "loginActivity":
			return {
				title: t("mobile.emptyState.variants.loginActivity.title"),
				description: t("mobile.emptyState.variants.loginActivity.description"),
			}
		case "feedback":
			return {
				title: t("mobile.emptyState.variants.feedback.title"),
				description: t("mobile.emptyState.variants.feedback.description"),
			}
		case "recording":
			return {
				title: t("mobile.emptyState.variants.recording.title"),
				description: t("mobile.emptyState.variants.recording.description"),
			}
		case "recordingGroup":
			return {
				title: t("mobile.emptyState.variants.recordingGroup.title"),
				description: t("mobile.emptyState.variants.recordingGroup.description"),
			}
		default: {
			const _exhaustive: never = variant
			return _exhaustive
		}
	}
}

/**
 * Unified mobile empty state: muted icon badge, title, and helper description.
 * Copy and icons align with the magicrewapp prototype DataEmptyState variants.
 */
export function DataEmptyState({
	variant,
	className,
	compact = false,
	testId,
}: DataEmptyStateProps) {
	const { title, description } = useEmptyStateCopy(variant)
	const Icon = VARIANT_ICONS[variant]

	return (
		<div
			role="status"
			data-testid={testId ?? `mobile-data-empty-state-${variant}`}
			className={cn(
				"flex flex-col items-center justify-center px-4 text-center",
				compact ? "py-8" : "py-12",
				className,
			)}
		>
			<div
				className={cn(
					"mb-3 rounded-full bg-muted text-muted-foreground",
					compact ? "p-3" : "p-4",
				)}
			>
				<Icon
					className={cn(compact ? "h-7 w-7" : "h-8 w-8")}
					strokeWidth={1.5}
					aria-hidden
				/>
			</div>
			<p
				className={cn(
					"font-medium text-foreground",
					compact ? "text-[15px] leading-6" : "text-[16px] leading-6",
				)}
			>
				{title}
			</p>
			<p
				className={cn(
					"mt-1 text-muted-foreground",
					compact ? "text-[13px] leading-5" : "max-w-[280px] text-[14px] leading-5",
				)}
			>
				{description}
			</p>
		</div>
	)
}
