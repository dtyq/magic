import { useProjectFileHelp, useProjectTypeNames } from "./useProjectFileHelp"
import {
	BookOpen,
	CalendarDays,
	FolderCog,
	Folder,
	History,
	ListTree,
	MessageSquare,
	NotebookPen,
	Settings,
	Terminal,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import MagicFileIcon from "@/components/base/MagicFileIcon"
import DingTalkIcon from "@/components/base/MagicFileIcon/assets/dingtalk-logo.svg"
import LarkIcon from "@/components/base/MagicFileIcon/assets/feishu-logo.svg"
import IconSuperTeamshare from "@/enhance/tabler/icons-react/icons/IconSuperTeamshare"
import type { HelpLocation } from "@/components/shadcn-composed/context-help/types"
import type {
	HelpNavigationGroup,
	HelpNavigationItem,
} from "@/components/shadcn-composed/context-help/HelpNavigation"
import {
	useClawFileHelp,
	type ClawFileHelpKind,
} from "../../../pages/ClawPlayground/components/ClawFileHelpTag"
import { getClawBrandTranslationValues } from "../../../utils/clawBrand"
import { useUserFileHelp, useUserSpaceOverviewHelp } from "../../UserSpace/useUserFileHelp"
import type { UserResourceKind } from "../../UserSpace/userSpaceFilePresentation"
import UserSpaceIcon from "../../UserSpace/UserSpaceIcon"
import { SkillFileIcon } from "../components/SkillFileIcon"
import { TopicFileIcon, type TopicFileMagicVariant } from "../components/TopicFileIcon"
import {
	FILE_HELP_ARTICLE_IDS,
	getFileHelpMetadata,
	type FileHelpArticleId,
	type FileHelpIcon,
	type FileHelpGroupId,
	type FileHelpReadingReason,
} from "../utils/file-help-catalog"
import type { FileHelpContext, SystemFileHelpKind } from "../utils/magic-system-folder"
import type { SkillFileKind } from "../utils/skill-file-structure"
import { useSystemFileHelp } from "./useSystemFileHelp"
import { useSkillFileHelp } from "./useSkillFileHelp"

const USER_SYMBOLS = {
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
}

/** canonical 说明复用文件图标素材，不构造虚假的文件 ID、附件或安装状态。 */
function renderFileHelpIcon(icon: FileHelpIcon, size: number) {
	if (icon === "user-space") return <UserSpaceIcon size={size} />
	if (icon.startsWith("magic-"))
		return <TopicFileIcon magicVariant={icon as TopicFileMagicVariant} size={size} />
	if (icon.startsWith("skill:")) {
		const kind = icon.slice(6) as SkillFileKind
		return <SkillFileIcon kind={kind} isDirectory={kind !== "entry"} size={size} />
	}
	if (icon.startsWith("file:")) return <MagicFileIcon type={icon.slice(5)} size={size} />
	if (icon === "user:dingtalk" || icon === "user:lark")
		return (
			<img
				src={icon === "user:dingtalk" ? DingTalkIcon : LarkIcon}
				alt=""
				width={size}
				height={size}
			/>
		)
	if (icon === "user:teamshare") return <IconSuperTeamshare size={size} />
	const symbol = icon.slice(5)
	if (Object.hasOwn(USER_SYMBOLS, symbol)) {
		const Icon = USER_SYMBOLS[symbol as keyof typeof USER_SYMBOLS]
		return <Icon size={size} aria-hidden />
	}
	return <MagicFileIcon type="" size={size} />
}

/** 只在完整指南里调用：语言变化重新取得文案，文章身份与当前工作区无关。 */
export function useFileHelpArticle(id: FileHelpArticleId) {
	const { t } = useTranslation("super")
	// id 已由闭集目录约束；这里拆分命名空间供既有内容 provider 使用，不按文件名猜测。
	const system = useSystemFileHelp(
		id.startsWith("system.") ? (id.slice(7) as SystemFileHelpKind) : undefined,
	)
	const skill = useSkillFileHelp(
		id.startsWith("skillLibrary.")
			? "library"
			: id.startsWith("skill.")
				? (id.slice(6) as SkillFileKind)
				: undefined,
		undefined,
		id.startsWith("skillLibrary.")
			? (id.slice(13) as FileHelpContext["kind"])
			: id === "skill.library"
				? "project"
				: undefined,
	)
	const user = useUserFileHelp(
		id.startsWith("user.") && id !== "user.overview"
			? (id.slice(5) as UserResourceKind)
			: undefined,
	)
	const claw = useClawFileHelp(
		id.startsWith("claw.") ? (id.slice(5) as ClawFileHelpKind) : undefined,
	)
	const overview = useUserSpaceOverviewHelp()
	const project = useProjectFileHelp(getFileHelpMetadata(id).projectKind)
	const result =
		system ??
		skill ??
		user ??
		claw ??
		(id === "user.overview" ? overview : undefined) ??
		project
	if (!result) return undefined
	const metadata = getFileHelpMetadata(id)
	return {
		...result.help,
		tone: metadata.tone,
		identity: {
			name: id === "user.overview" ? t("userSpace.title") : (metadata.name ?? result.label),
			scope: result.help.subtitle,
			renderIcon: (size: number) => renderFileHelpIcon(metadata.icon, size),
		},
	}
}

export function useFileHelpCatalog() {
	const projectNames = useProjectTypeNames()
	const { t } = useTranslation("super")
	const brand = getClawBrandTranslationValues()
	const reasons: Record<FileHelpReadingReason, string> = {
		skillEntry: t("topicFiles.helpGuide.reasons.skillEntry"),
		skillStructure: t("topicFiles.helpGuide.reasons.skillStructure"),
		progressiveReading: t("topicFiles.helpGuide.reasons.progressiveReading"),
		projectRules: t("topicFiles.helpGuide.reasons.projectRules"),
		projectConfig: t("topicFiles.helpGuide.reasons.projectConfig"),
		personalSpace: t("topicFiles.helpGuide.reasons.personalSpace"),
		memoryStructure: t("topicFiles.helpGuide.reasons.memoryStructure"),
		scope: t("topicFiles.helpGuide.reasons.scope"),
		assistantRules: t("topicFiles.helpGuide.reasons.assistantRules", brand),
		crewRules: t("topicFiles.helpGuide.reasons.crewRules"),
	}
	const groupLabels: Record<FileHelpGroupId, string> = {
		projectTypes: t("topicFiles.helpGuide.groups.projectTypes"),
		project: t("topicFiles.helpGuide.groups.project"),
		skills: t("topicFiles.helpGuide.groups.skills"),
		personal: t("topicFiles.helpGuide.groups.personal"),
		assistant: t("topicFiles.helpGuide.groups.assistant", brand),
		crew: t("topicFiles.helpGuide.groups.crew"),
		current: t("topicFiles.helpGuide.groups.current"),
	}
	const placeholders: Record<string, string> = {
		$directory: t("topicFiles.helpGuide.paths.directory"),
		$skill: t("topicFiles.helpGuide.paths.skill"),
		$memoryScope: t("topicFiles.helpGuide.paths.memoryScope"),
		$project: t("topicFiles.helpGuide.paths.project"),
		$overview: t("topicFiles.helpGuide.paths.overview"),
	}
	const navigationLabels: Partial<Record<FileHelpArticleId, string>> = {
		"user.coreMemory": t("userSpace.fileLabels.coreMemory"),
		"user.projectCoreMemory": t("userSpace.fileLabels.projectCoreMemory"),
		"user.notes": t("userSpace.fileLabels.notes"),
	}
	const translatePath = (path: string) =>
		path
			.split("/")
			.map((segment) => placeholders[segment] ?? segment)
			.join("/")
	const groups: HelpNavigationGroup[] = (
		["projectTypes", "project", "assistant", "crew", "personal", "skills"] as const
	).map((id) => ({ id, label: groupLabels[id], items: [] }))
	const nodes = new Map<string, HelpNavigationItem>()
	const articleNodes = new Map<FileHelpArticleId, HelpNavigationItem>()
	const ancestors = {} as Record<FileHelpArticleId, string[]>
	const locations = {} as Record<FileHelpArticleId, HelpLocation>
	const names = {} as Record<FileHelpArticleId, string>
	// 目录按静态示意路径组织，节点键不含翻译；切换语言不会丢失展开状态。
	for (const articleId of FILE_HELP_ARTICLE_IDS) {
		const metadata = getFileHelpMetadata(articleId)
		const path = metadata.path
		names[articleId] =
			(metadata.projectKind ? projectNames[metadata.projectKind] : undefined) ??
			metadata.name ??
			(articleId === "recording.project"
				? t("topicFiles.helpGuide.paths.recording")
				: articleId === "user.overview"
					? placeholders.$overview
					: groupLabels.current)
		locations[articleId] = {
			scope: groupLabels[metadata.group],
			path: path ? translatePath(path) : names[articleId],
		}
		ancestors[articleId] = [metadata.group]
		if (metadata.projectKind) {
			const node: HelpNavigationItem = {
				id: articleId,
				articleId,
				label: names[articleId],
				icon: renderFileHelpIcon(metadata.icon, 16),
			}
			groups.find((group) => group.id === metadata.group)?.items.push(node)
			articleNodes.set(articleId, node)
			continue
		}
		if (!path) continue
		// 记忆按用途直接列出全局、项目和详细记录，不把范围占位符渲染成文件夹。
		const parent = metadata.navigationParent
			? articleNodes.get(metadata.navigationParent)
			: undefined
		if (parent && metadata.navigationParent) {
			const node: HelpNavigationItem = {
				id: articleId,
				articleId,
				label:
					navigationLabels[articleId] ??
					`${names[articleId]}${path.endsWith("/") ? "/" : ""}`,
				path: translatePath(path),
				icon: renderFileHelpIcon(metadata.icon, 16),
				children: [],
			}
			parent.children ??= []
			parent.children.push(node)
			articleNodes.set(articleId, node)
			continue
		}
		const group = groups.find((item) => item.id === metadata.group)
		if (!group) continue
		const segments = path.split("/").filter(Boolean)
		let items = group.items
		for (let index = 0; index < segments.length; index++) {
			const last = index === segments.length - 1
			const id = `${metadata.group}:${segments.slice(0, index + 1).join("/")}`
			let node = nodes.get(id)
			if (!node) {
				node = {
					id,
					label:
						(placeholders[segments[index]] ?? segments[index]) +
						(!last || path.endsWith("/") ? "/" : ""),
					icon: <Folder size={16} aria-hidden />,
					path: translatePath(segments.slice(0, index + 1).join("/")),
					children: [],
				}
				nodes.set(id, node)
				items.push(node)
			}
			if (last) {
				node.articleId = articleId
				node.icon = renderFileHelpIcon(metadata.icon, 16)
				names[articleId] = node.label
				articleNodes.set(articleId, node)
			} else ancestors[articleId].push(id)
			items = node.children ?? []
		}
	}
	// 年月、具体笔记只从实际文件打开，并展开所属记忆目录；未知来源不归入项目。
	for (const articleId of FILE_HELP_ARTICLE_IDS) {
		const parent = getFileHelpMetadata(articleId).navigationParent
		if (parent) {
			ancestors[articleId] = [...ancestors[parent], articleNodes.get(parent)!.id]
		}
	}
	return { locations, names, reasons, groups, ancestors, groupLabels, articleNodes }
}
