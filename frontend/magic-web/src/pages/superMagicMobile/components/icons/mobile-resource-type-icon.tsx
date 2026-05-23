import {
	Bot,
	Box,
	FileText,
	Folder,
	LibraryBig,
	Loader,
	MessageCircle,
	MessageSquare,
	Sparkles,
	type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

/** Resource kinds for mobile list rows and recycle bin (aligned with prototype TrashScreen). */
export type MobileResourceTypeKind =
	| "workspace"
	| "project"
	| "sharedProject"
	| "topic"
	| "projectTopic"
	| "conversation"
	| "file"
	| "crew"
	| "skill"

export interface MobileResourceTypeIconConfig {
	Icon: LucideIcon
	boxClass: string
	iconClass: string
}

/**
 * Icon + token colors from prototype TrashScreen TYPE_ICON_CELL.
 * projectTopic uses MessageCircle (ProjectDetailScreen) while topic uses MessageSquare (trash entity).
 */
export const MOBILE_RESOURCE_TYPE_ICON_CONFIG: Record<
	MobileResourceTypeKind,
	MobileResourceTypeIconConfig
> = {
	workspace: {
		Icon: Box,
		boxClass: "bg-icon-workspace/8",
		iconClass: "text-icon-workspace",
	},
	project: {
		Icon: LibraryBig,
		boxClass: "bg-icon-project/8",
		iconClass: "text-icon-project",
	},
	sharedProject: {
		Icon: Folder,
		boxClass: "bg-icon-project/8",
		iconClass: "text-icon-project",
	},
	topic: {
		Icon: MessageSquare,
		boxClass: "bg-icon-topic/8",
		iconClass: "text-icon-topic",
	},
	projectTopic: {
		Icon: MessageCircle,
		boxClass: "bg-icon-topic/8",
		iconClass: "text-icon-topic",
	},
	conversation: {
		Icon: MessageCircle,
		boxClass: "bg-icon-chat/8",
		iconClass: "text-icon-chat",
	},
	file: {
		Icon: FileText,
		boxClass: "bg-icon-app-cloud/8",
		iconClass: "text-icon-app-cloud",
	},
	crew: {
		Icon: Bot,
		boxClass: "bg-icon-app-knowledge/8",
		iconClass: "text-icon-app-knowledge",
	},
	skill: {
		Icon: Sparkles,
		boxClass: "bg-icon-app-bookmarks/8",
		iconClass: "text-icon-app-bookmarks",
	},
}

const DEFAULT_RESOURCE_TYPE_KIND: MobileResourceTypeKind = "file"

/** Resolve icon config for arbitrary type strings (e.g. recycle bin row types). */
export function getMobileResourceTypeIconConfig(type: string): MobileResourceTypeIconConfig {
	if (type in MOBILE_RESOURCE_TYPE_ICON_CONFIG) {
		return MOBILE_RESOURCE_TYPE_ICON_CONFIG[type as MobileResourceTypeKind]
	}
	return MOBILE_RESOURCE_TYPE_ICON_CONFIG[DEFAULT_RESOURCE_TYPE_KIND]
}

interface MobileResourceTypeIconProps {
	type: string
	className?: string
	iconClassName?: string
	/** Default size-6 for list rows; compact rows (picker/orphan) may use size-5. */
	iconSizeClass?: string
	/** Loader size when isRunning; defaults to h-[22px] w-[22px] for topic-style rows. */
	loaderSizeClass?: string
	isRunning?: boolean
	"aria-label"?: string
	"aria-busy"?: boolean
	"data-testid"?: string
	iconDataTestId?: string
	loadingDataTestId?: string
}

/**
 * Left type icon cell for mobile list rows and recycle bin.
 * Matches prototype: size-9 container, rounded-[10px], token-based background.
 */
export function MobileResourceTypeIcon(props: MobileResourceTypeIconProps) {
	const {
		type,
		className,
		iconClassName,
		iconSizeClass = "size-6",
		loaderSizeClass = "h-[22px] w-[22px] shrink-0",
		isRunning = false,
		"aria-label": ariaLabel,
		"aria-busy": ariaBusy,
		"data-testid": dataTestId,
		iconDataTestId,
		loadingDataTestId,
	} = props
	const { Icon, boxClass, iconClass } = getMobileResourceTypeIconConfig(type)

	return (
		<div
			className={cn(
				"flex size-9 shrink-0 flex-col items-center justify-center overflow-hidden rounded-[10px]",
				boxClass,
				className,
			)}
			data-testid={dataTestId}
			aria-hidden={ariaLabel === undefined && ariaBusy === undefined ? true : undefined}
			aria-label={ariaLabel}
			aria-busy={ariaBusy}
		>
			{isRunning ? (
				<Loader
					className={cn(loaderSizeClass, "animate-spin", iconClass, iconClassName)}
					aria-hidden
					data-testid={loadingDataTestId}
				/>
			) : (
				<Icon
					className={cn(iconSizeClass, "shrink-0", iconClass, iconClassName)}
					aria-hidden
					data-testid={iconDataTestId}
				/>
			)}
		</div>
	)
}

/** @deprecated Use MOBILE_RESOURCE_TYPE_ICON_CONFIG — kept for recycle-bin re-exports. */
export const RECYCLE_BIN_TYPE_ICONS: Record<string, LucideIcon> = Object.fromEntries(
	Object.entries(MOBILE_RESOURCE_TYPE_ICON_CONFIG).map(([key, { Icon }]) => [key, Icon]),
)

/** @deprecated Use MOBILE_RESOURCE_TYPE_ICON_CONFIG — kept for recycle-bin re-exports. */
export const RECYCLE_BIN_TYPE_ICON_CELL: Record<string, { box: string; icon: string }> =
	Object.fromEntries(
		Object.entries(MOBILE_RESOURCE_TYPE_ICON_CONFIG).map(([key, { boxClass, iconClass }]) => [
			key,
			{ box: boxClass, icon: iconClass },
		]),
	)
