import type { ReactNode } from "react"
import MagicFileIcon from "@/components/base/MagicFileIcon"
import fileAgentIcon from "../assets/file-md-agent.svg"
import fileBootstrapIcon from "../assets/file-md-bootstrap.svg"
import fileHeartbeatIcon from "../assets/file-md-heartbeat.svg"
import fileIdentityIcon from "../assets/file-md-identity.svg"
import fileMemoryIcon from "../assets/file-md-memory.svg"
import fileSkillsIcon from "../assets/file-md-skills.svg"
import fileSoulIcon from "../assets/file-md-soul.svg"
import fileToolsIcon from "../assets/file-md-tools.svg"
import fileUserIcon from "../assets/file-md-user.svg"
import folderCronIcon from "../assets/folder-cron-icon.svg"
import folderIcon from "../assets/folder-icon.svg"
import folderMagicIcon from "../assets/folder-magic-icon.svg"
import folderMemoryIcon from "../assets/folder-memory-icon.svg"
import folderNonEmptyIcon from "../assets/folder-non-empty-icon.svg"
import folderSkillIcon from "../assets/folder-skill-icon.svg"

export type TopicFileMagicVariant =
	| "magic-root"
	| "magic-cron"
	| "magic-skills"
	| "magic-memory"
	| "magic-file-skills"
	| "magic-file-agent"
	| "magic-file-heartbeat"
	| "magic-file-identity"
	| "magic-file-soul"
	| "magic-file-tools"
	| "magic-file-user"
	| "magic-file-bootstrap"
	| "magic-file-memory"

interface TopicFileIconProps {
	isDirectory?: boolean
	isMagicFolder?: boolean
	magicVariant?: TopicFileMagicVariant
	hasChildren?: boolean
	fileExtension?: string
	size?: number
	className?: string
	dataTestId?: string
	fallbackIcon?: ReactNode
}

const MAGIC_ICON_SRC_MAP: Record<TopicFileMagicVariant, string> = {
	"magic-root": folderMagicIcon,
	"magic-cron": folderCronIcon,
	"magic-skills": folderSkillIcon,
	"magic-memory": folderMemoryIcon,
	"magic-file-skills": fileSkillsIcon,
	"magic-file-agent": fileAgentIcon,
	"magic-file-heartbeat": fileHeartbeatIcon,
	"magic-file-identity": fileIdentityIcon,
	"magic-file-soul": fileSoulIcon,
	"magic-file-tools": fileToolsIcon,
	"magic-file-user": fileUserIcon,
	"magic-file-bootstrap": fileBootstrapIcon,
	"magic-file-memory": fileMemoryIcon,
}

/**
 * 目录图标只区分空目录和非空目录，保持与当前原型视觉反馈一致。
 */
function getFolderIconSrc(hasChildren?: boolean): string {
	if (hasChildren) return folderNonEmptyIcon

	return folderIcon
}

/**
 * 统一渲染 TopicFiles 当前真实使用到的图标，避免页面组件反复分支判断资源。
 */
export function TopicFileIcon({
	isDirectory = false,
	isMagicFolder = false,
	magicVariant,
	hasChildren = false,
	fileExtension,
	size,
	className,
	dataTestId,
	fallbackIcon,
}: TopicFileIconProps) {
	const resolvedMagicVariant = magicVariant || (isMagicFolder ? "magic-root" : undefined)
	const resolvedClassName =
		className ??
		(size ? "block shrink-0 object-contain" : "block size-6 shrink-0 object-contain")

	if (resolvedMagicVariant) {
		return (
			<img
				src={MAGIC_ICON_SRC_MAP[resolvedMagicVariant]}
				alt=""
				width={size}
				height={size}
				className={resolvedClassName}
				data-testid={dataTestId}
				aria-hidden
			/>
		)
	}

	if (!isDirectory)
		return (
			<span data-testid={dataTestId}>
				<MagicFileIcon
					type={fileExtension}
					size={size ?? 24}
					className={className}
					fallbackIcon={fallbackIcon}
				/>
			</span>
		)
	const iconSrc = getFolderIconSrc(hasChildren)

	return (
		<img
			src={iconSrc}
			alt=""
			width={size}
			height={size}
			className={resolvedClassName}
			data-testid={dataTestId}
			aria-hidden
		/>
	)
}
