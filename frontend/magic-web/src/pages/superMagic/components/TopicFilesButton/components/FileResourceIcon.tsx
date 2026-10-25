import { getMagicProjectType } from "@/constants/magicProjectTypes"
import { isMagicProjectConfigFile } from "../../MessageList/components/MessageAttachment/utils"
import {
	BookOpen,
	CalendarDays,
	FolderCog,
	History,
	ListTree,
	NotebookPen,
	Settings,
	Terminal,
	MessageSquare,
} from "lucide-react"
import MagicFileIcon from "@/components/base/MagicFileIcon"
import { useInRouterContext } from "react-router"
import { UnknownFileIcon } from "./UnknownFileIcon"
import DingTalkIcon from "@/components/base/MagicFileIcon/assets/dingtalk-logo.svg"
import LarkIcon from "@/components/base/MagicFileIcon/assets/feishu-logo.svg"
import IconSuperTeamshare from "@/enhance/tabler/icons-react/icons/IconSuperTeamshare"
import FoldIcon from "@/pages/superMagic/assets/svg/file-folder.svg"
import { CustomFolderMagicIcon } from "./CustomFolderMagicIcon"
import { TopicFileIcon } from "./TopicFileIcon"
import { SkillFileIcon, hasSkillFileIcon } from "./SkillFileIcon"
import { SlidesTemplateFolderIcon } from "./SlidesTemplateFolderIcon"
import type { FilePresentation } from "../utils/file-presentation"
import { isSlidesTemplateFolder } from "../utils/slides-template-folder"

interface FileResourceIconProps {
	allowRemoteIcon?: boolean
	presentation: FilePresentation
	size?: number
	className?: string
	folderWidth?: number
	folderHeight?: number
	folderClassName?: string
	folderTestId?: string
}

const USER_ICONS = {
	notes: NotebookPen,
	references: BookOpen,
	subject: BookOpen,
	timeline: History,
	event: History,
	year: CalendarDays,
	month: CalendarDays,
	index: ListTree,
	topics: MessageSquare,
	tools: FolderCog,
	cli: Terminal,
	settings: Settings,
} as const

/** 只渲染同一份文件身份；媒体预览和操作状态仍由各入口管理。 */
export function FileResourceIcon({
	presentation,
	allowRemoteIcon = true,
	size = 16,
	className,
	folderWidth = size,
	folderHeight = size,
	folderClassName,
	folderTestId,
}: FileResourceIconProps) {
	const hasRouterContext = useInRouterContext()
	const { item, isDirectory, magicVariant, userKind, skillKind, type, customChildren } =
		presentation
	if (skillKind === "library" && !item.display_config?.type)
		return <SkillFileIcon kind="library" isDirectory size={size} className={className} />
	if (magicVariant)
		return <TopicFileIcon magicVariant={magicVariant} size={size} className={className} />
	if (userKind === "dingtalk" || userKind === "lark")
		return (
			<img
				src={userKind === "dingtalk" ? DingTalkIcon : LarkIcon}
				alt=""
				width={size}
				height={size}
				className={className}
			/>
		)
	if (userKind === "teamshare") return <IconSuperTeamshare size={size} className={className} />
	const UserIcon =
		userKind && Object.hasOwn(USER_ICONS, userKind)
			? USER_ICONS[userKind as keyof typeof USER_ICONS]
			: undefined
	if (UserIcon)
		return (
			<UserIcon
				size={size}
				className={className ?? "shrink-0 text-muted-foreground"}
				aria-hidden
			/>
		)
	const displayType = item.display_config?.type
	// 模板类型可能只由预览入口补出；附件快照没有该字段时，仍按同一目录结构识别图标。
	if (displayType === "slide-template" || isSlidesTemplateFolder(item))
		return <SlidesTemplateFolderIcon size={size} className={className} />
	// magic.project.js 描述项目本身，保留代码图标；其它入口沿用自定义远程图与原有缓存。
	if (
		getMagicProjectType(displayType)?.customIconPolicy === "configured" &&
		!isMagicProjectConfigFile(
			item.file_name || item.display_filename || item.filename || item.name,
		)
	)
		return allowRemoteIcon ? (
			<CustomFolderMagicIcon
				displayConfig={item.display_config}
				childrenItems={customChildren}
				typeFallback={displayType}
				size={size}
				className={className}
			/>
		) : (
			<MagicFileIcon type={displayType} size={size} className={className} />
		)
	if (!displayType && hasSkillFileIcon(skillKind, isDirectory))
		return (
			<SkillFileIcon
				kind={skillKind}
				isDirectory={isDirectory}
				size={size}
				className={className}
			/>
		)
	if (isDirectory && !displayType)
		return (
			<img
				src={FoldIcon}
				alt=""
				width={folderWidth}
				height={folderHeight}
				className={folderClassName ?? className}
				aria-hidden
				data-testid={folderTestId}
			/>
		)
	return (
		<MagicFileIcon
			type={type}
			size={size}
			className={className}
			fallbackIcon={
				// 静态导出没有路由作用域；页面中继续使用已缓存的文件内容分类，不额外下载。
				hasRouterContext ? (
					<UnknownFileIcon file={item} size={size} className={className} />
				) : undefined
			}
		/>
	)
}
