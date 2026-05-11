import type { ReactNode } from "react"
import { Badge } from "@/components/shadcn-ui/badge"
import type { TopicFileRowDecorationResolver } from "@/pages/superMagic/components/TopicFilesButton"
import {
	AgentsFileIcon,
	BootstrapFileIcon,
	CronFolderIcon,
	HeartbeatFileIcon,
	IdentityFileIcon,
	MemoryFileIcon,
	MemoryFolderIcon,
	SkillsFileIcon,
	SkillsFolderIcon,
	SoulFileIcon,
	ToolsFileIcon,
	UserFileIcon,
} from "./components/file-tree-icons"

interface ClawPlaygroundFileDecorationOptions {
	t: (key: string) => string
}

interface FileDecorationDefinition {
	icon: ReactNode
	tagKey: string
}

interface FileDecorationMatcher extends FileDecorationDefinition {
	matches: (context: DecorationMatchContext) => boolean
}

interface DecorationMatchContext {
	itemName: string
	isInMagicDirectory: boolean
}

const MAGIC_FOLDER_NAME = ".magic"

const folderDecorationMatchers: FileDecorationMatcher[] = [
	{
		icon: <CronFolderIcon />,
		tagKey: "scheduledTasks",
		matches: createMagicFolderNameMatcher("cron"),
	},
	{
		icon: <SkillsFolderIcon />,
		tagKey: "installedSkills",
		matches: createMagicFolderNameMatcher("skills"),
	},
	{
		icon: <MemoryFolderIcon />,
		tagKey: "memoryFolder",
		matches: createMagicFolderNameMatcher("memory"),
	},
]

const fileDecorationMatchers: FileDecorationMatcher[] = [
	{
		icon: <SkillsFileIcon />,
		tagKey: "skillList",
		matches: createMagicFileNameMatcher("SKILLS.MD"),
	},
	{
		icon: <AgentsFileIcon />,
		tagKey: "prompts",
		matches: createMagicFileNameMatcher("AGENTS.MD"),
	},
	{
		icon: <HeartbeatFileIcon />,
		tagKey: "proactiveExecution",
		matches: createMagicFileNameMatcher("HEARTBEAT.MD"),
	},
	{
		icon: <IdentityFileIcon />,
		tagKey: "identityInfo",
		matches: createMagicFileNameMatcher("IDENTITY.MD"),
	},
	{
		icon: <SoulFileIcon />,
		tagKey: "guidelines",
		matches: createMagicFileNameMatcher("SOUL.MD"),
	},
	{
		icon: <ToolsFileIcon />,
		tagKey: "toolList",
		matches: createMagicFileNameMatcher("TOOLS.MD"),
	},
	{
		icon: <UserFileIcon />,
		tagKey: "aboutYou",
		matches: createMagicFileNameMatcher("USER.MD"),
	},
	{
		icon: <BootstrapFileIcon />,
		tagKey: "initialSetup",
		matches: createMagicFileNameMatcher("BOOTSTRAP.MD"),
	},
	{
		icon: <MemoryFileIcon />,
		tagKey: "memoryFile",
		matches: createMagicFileNameMatcher("MEMORY.MD"),
	},
]

export function createClawPlaygroundFileRowDecorationResolver({
	t,
}: ClawPlaygroundFileDecorationOptions): TopicFileRowDecorationResolver {
	return function resolveTopicFileRowDecoration({ item, isVirtual }) {
		if (isVirtual) return

		const itemName = (item.file_name || item.name || "").trim()
		if (!itemName) return

		const matchContext: DecorationMatchContext = {
			itemName,
			isInMagicDirectory: isInMagicDirectory(item.relative_file_path || item.path),
		}
		const decoration = item.is_directory
			? folderDecorationMatchers.find((matcher) => matcher.matches(matchContext))
			: fileDecorationMatchers.find((matcher) => matcher.matches(matchContext))
		if (!decoration) return

		return {
			icon: decoration.icon,
			tag: (
				<Badge
					variant="outline"
					className="h-5 rounded-md border-border bg-background px-2 py-0.5 text-[10px] font-normal leading-3 text-muted-foreground shadow-none"
				>
					{t(`topicFiles.clawPlaygroundTags.${decoration.tagKey}`)}
				</Badge>
			),
		}
	}
}

function createMagicFolderNameMatcher(expectedName: string) {
	const normalizedExpectedName = expectedName.toLowerCase()

	return function matchesMagicFolderByName({
		itemName,
		isInMagicDirectory,
	}: DecorationMatchContext) {
		if (!isInMagicDirectory) return false
		return itemName.toLowerCase() === normalizedExpectedName
	}
}

function createMagicFileNameMatcher(expectedName: string) {
	const normalizedExpectedName = expectedName.toUpperCase()

	return function matchesMagicFileByName({
		itemName,
		isInMagicDirectory,
	}: DecorationMatchContext) {
		if (!isInMagicDirectory) return false
		return itemName.toUpperCase() === normalizedExpectedName
	}
}

function normalizeRelativePath(path: string | undefined) {
	if (!path) return ""
	return path.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "").replace(/\/+$/, "")
}

function isInMagicDirectory(path: string | undefined) {
	const normalizedPath = normalizeRelativePath(path)
	if (!normalizedPath) return false

	const segments = normalizedPath.split("/").filter(Boolean)
	const magicDirectoryIndex = segments.lastIndexOf(MAGIC_FOLDER_NAME)
	if (magicDirectoryIndex === -1) return false

	return segments.length === magicDirectoryIndex + 2
}
