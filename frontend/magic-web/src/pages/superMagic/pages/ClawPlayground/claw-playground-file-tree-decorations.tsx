import type { ReactNode } from "react"
import { Badge } from "@/components/shadcn-ui/badge"
import type { TopicFileRowDecorationResolver } from "@/pages/superMagic/components/TopicFilesButton"
import agentsMdIcon from "./assets/file-tree-icons/agents-md.svg"
import bootstrapMdIcon from "./assets/file-tree-icons/bootstrap-md.svg"
import folderCronBottom from "./assets/file-tree-icons/folder-cron-bottom.svg"
import folderCronClock from "./assets/file-tree-icons/folder-cron-clock.svg"
import folderCronTop from "./assets/file-tree-icons/folder-cron-top.svg"
import folderSkillsBottom from "./assets/file-tree-icons/folder-skills-bottom.svg"
import folderSkillsGlyph from "./assets/file-tree-icons/folder-skills-glyph.svg"
import folderSkillsTop from "./assets/file-tree-icons/folder-skills-top.svg"
import heartbeatMdIcon from "./assets/file-tree-icons/heartbeat-md.svg"
import identityMdIcon from "./assets/file-tree-icons/identity-md.svg"
import skillsMdIcon from "./assets/file-tree-icons/skills-md.svg"
import soulMdBase from "./assets/file-tree-icons/soul-md-base.svg"
import soulMdOverlay from "./assets/file-tree-icons/soul-md-overlay.svg"
import toolsMdIcon from "./assets/file-tree-icons/tools-md.svg"
import userMdIcon from "./assets/file-tree-icons/user-md.svg"

interface ClawPlaygroundFileDecorationOptions {
	t: (key: string) => string
}

interface FileDecorationDefinition {
	icon: ReactNode
	tagKey: string
}

const folderDecorations: Record<string, FileDecorationDefinition> = {
	cron: {
		icon: (
			<CompositeFolderIcon
				bottomSrc={folderCronBottom}
				glyphSrc={folderCronClock}
				glyphWrapperClassName="inset-[18.73%_16.19%_8.76%_7.86%]"
				glyphClassName="h-[10px] w-[10.667px] rotate-[-9.36deg]"
				name="cron"
				topSrc={folderCronTop}
				topWrapperClassName="inset-[4.17%_6.25%_4.17%_0]"
			/>
		),
		tagKey: "scheduledTasks",
	},
	skills: {
		icon: (
			<CompositeFolderIcon
				bottomSrc={folderSkillsBottom}
				glyphSrc={folderSkillsGlyph}
				glyphWrapperClassName="inset-[13.46%_9.55%_2.34%_6.25%]"
				glyphClassName="size-[11px] -rotate-[15deg]"
				name="skills"
				topSrc={folderSkillsTop}
				topWrapperClassName="inset-[4.17%_6.25%_4.17%_0]"
			/>
		),
		tagKey: "installedSkills",
	},
}

const fileDecorations: Record<string, FileDecorationDefinition> = {
	"SKILLS.MD": {
		icon: <SimpleFileIcon name="skills-md" src={skillsMdIcon} />,
		tagKey: "skillList",
	},
	"AGENTS.MD": {
		icon: <SimpleFileIcon name="agents-md" src={agentsMdIcon} />,
		tagKey: "prompts",
	},
	"HEARTBEAT.MD": {
		icon: <SimpleFileIcon name="heartbeat-md" src={heartbeatMdIcon} />,
		tagKey: "proactiveExecution",
	},
	"IDENTITY.MD": {
		icon: <SimpleFileIcon name="identity-md" src={identityMdIcon} />,
		tagKey: "identityInfo",
	},
	"SOUL.MD": {
		icon: (
			<LayeredIcon
				baseSrc={soulMdBase}
				name="soul-md"
				overlaySrc={soulMdOverlay}
				overlayWrapperClassName="bottom-[20.83%] left-[20.83%] right-1/4 top-[20.83%]"
			/>
		),
		tagKey: "guidelines",
	},
	"TOOLS.MD": {
		icon: <SimpleFileIcon name="tools-md" src={toolsMdIcon} />,
		tagKey: "toolList",
	},
	"USER.MD": {
		icon: <SimpleFileIcon name="user-md" src={userMdIcon} />,
		tagKey: "aboutYou",
	},
	"BOOTSTRAP.MD": {
		icon: <SimpleFileIcon name="bootstrap-md" src={bootstrapMdIcon} />,
		tagKey: "initialSetup",
	},
}

export function createClawPlaygroundFileRowDecorationResolver({
	t,
}: ClawPlaygroundFileDecorationOptions): TopicFileRowDecorationResolver {
	return function resolveTopicFileRowDecoration({ item, isVirtual }) {
		if (isVirtual) return

		const itemName = (item.file_name || item.name || "").trim()
		if (!itemName) return

		const decoration = item.is_directory
			? folderDecorations[itemName.toLowerCase()]
			: fileDecorations[itemName.toUpperCase()]
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

function CompositeFolderIcon({
	bottomSrc,
	glyphClassName,
	glyphSrc,
	glyphWrapperClassName,
	name,
	topSrc,
	topWrapperClassName,
}: {
	bottomSrc: string
	glyphClassName: string
	glyphSrc: string
	glyphWrapperClassName: string
	name: string
	topSrc: string
	topWrapperClassName: string
}) {
	return (
		<div
			className="relative size-4 overflow-hidden"
			data-testid={`claw-playground-file-tree-icon-${name}`}
		>
			<div className={`absolute ${topWrapperClassName}`}>
				<img alt="" aria-hidden className="block size-full max-w-none" src={topSrc} />
			</div>
			<div className={`absolute flex items-center justify-center ${glyphWrapperClassName}`}>
				<img
					alt=""
					aria-hidden
					className={`block max-w-none ${glyphClassName}`}
					src={glyphSrc}
				/>
			</div>
			<div className="absolute inset-[48.33%_0_4.17%_0]">
				<div className="absolute inset-[0_1.61%_0_0]">
					<img
						alt=""
						aria-hidden
						className="block size-full max-w-none"
						src={bottomSrc}
					/>
				</div>
			</div>
		</div>
	)
}

function LayeredIcon({
	baseSrc,
	name,
	overlaySrc,
	overlayWrapperClassName,
}: {
	baseSrc: string
	name: string
	overlaySrc: string
	overlayWrapperClassName: string
}) {
	return (
		<div
			className="relative size-4 shrink-0"
			data-testid={`claw-playground-file-tree-icon-${name}`}
		>
			<img alt="" aria-hidden className="block size-full max-w-none" src={baseSrc} />
			<div className={`absolute ${overlayWrapperClassName}`}>
				<img alt="" aria-hidden className="block size-full max-w-none" src={overlaySrc} />
			</div>
		</div>
	)
}

function SimpleFileIcon({ name, src }: { name: string; src: string }) {
	return (
		<div
			className="relative size-4 shrink-0"
			data-testid={`claw-playground-file-tree-icon-${name}`}
		>
			<img alt="" aria-hidden className="block size-full max-w-none" src={src} />
		</div>
	)
}
