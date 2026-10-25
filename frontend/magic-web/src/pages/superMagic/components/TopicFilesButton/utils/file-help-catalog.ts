import {
	MAGIC_PROJECT_TYPES,
	type MagicProjectKind,
	type MagicProjectHelpKind,
} from "@/constants/magicProjectTypes"
import type { HelpTone } from "@/components/shadcn-composed/context-help/types"
import type { TopicFileMagicVariant } from "../components/TopicFileIcon"
import type { SkillFileKind } from "./skill-file-structure"
import type { UserResourceKind } from "../../UserSpace/userSpaceFilePresentation"

export type FileHelpGroupId =
	"projectTypes" | "project" | "skills" | "personal" | "assistant" | "crew" | "current"
export type FileHelpIcon =
	| TopicFileMagicVariant
	| `skill:${SkillFileKind}`
	| `user:${UserResourceKind}`
	| "user-space"
	| "file:md"
	| "file:json"
	| "file:yaml"
	| "file:txt"
	| `file:${MagicProjectKind}`

interface FileHelpMetadata {
	group: FileHelpGroupId
	/** 类型文章常驻逻辑分类，不用虚构磁盘路径建立目录。 */
	projectKind?: MagicProjectKind
	name?: string
	/** 静态示意路径决定目录层级；缺省时只保留真实入口，不常驻目录。 */
	path?: string
	/** 按用途归类时指定父文章，完整文件路径仍用于正文与悬停说明。 */
	navigationParent?: "user.memory" | "user.notes" | "user.references" | "user.timeline"
	icon: FileHelpIcon
	tone: HelpTone
}

const projectArticles = Object.fromEntries(
	MAGIC_PROJECT_TYPES.flatMap((definition) =>
		definition.helpKind
			? [
					[
						definition.helpKind,
						{
							group: "projectTypes",
							projectKind: definition.kind,
							icon: `file:${definition.kind}`,
							tone: "teal",
						},
					],
				]
			: [],
	),
) as Record<MagicProjectHelpKind, FileHelpMetadata>

/** 文章身份不依赖翻译或真实文件；目录只登记说明，不表示文件存在、技能安装或权限状态。 */
export const FILE_HELP_CATALOG = {
	"system.projectInstructions": {
		path: "AGENTS.md",
		group: "project",
		name: "AGENTS.md",
		icon: "magic-file-agent",
		tone: "red",
	},
	"system.directoryInstructions": {
		path: "$directory/AGENTS.md",
		group: "project",
		name: "AGENTS.md",
		icon: "magic-file-agent",
		tone: "red",
	},
	"system.projectMagic": {
		path: ".magic/",
		group: "project",
		name: ".magic",
		icon: "magic-root",
		tone: "indigo",
	},
	"system.agentInstructions": {
		path: ".magic/AGENTS.md",
		group: "project",
		name: "AGENTS.md",
		icon: "magic-file-agent",
		tone: "red",
	},
	"system.instructionFile": {
		group: "current",
		name: "AGENTS.md",
		icon: "magic-file-agent",
		tone: "red",
	},
	"system.userMagic": {
		path: ".magic/",
		group: "personal",
		name: ".magic",
		icon: "magic-root",
		tone: "indigo",
	},
	"system.clawMagic": {
		path: ".magic/",
		group: "assistant",
		name: ".magic",
		icon: "magic-root",
		tone: "indigo",
	},
	"system.clawInstructions": {
		path: ".magic/AGENTS.md",
		group: "assistant",
		name: "AGENTS.md",
		icon: "magic-file-agent",
		tone: "red",
	},
	"system.clawIdentity": {
		path: ".magic/IDENTITY.md",
		group: "assistant",
		name: "IDENTITY.md",
		icon: "magic-file-identity",
		tone: "indigo",
	},
	"system.clawSoul": {
		path: ".magic/SOUL.md",
		group: "assistant",
		name: "SOUL.md",
		icon: "magic-file-soul",
		tone: "indigo",
	},
	"system.crewMagic": {
		path: ".magic/",
		group: "crew",
		name: ".magic",
		icon: "magic-root",
		tone: "indigo",
	},
	"system.crewInstructions": {
		path: ".magic/AGENTS.md",
		group: "crew",
		name: "AGENTS.md",
		icon: "magic-file-agent",
		tone: "red",
	},
	"system.crewIdentity": {
		path: ".magic/IDENTITY.md",
		group: "crew",
		name: "IDENTITY.md",
		icon: "magic-file-identity",
		tone: "indigo",
	},
	"system.crewSoul": {
		path: ".magic/SOUL.md",
		group: "crew",
		name: "SOUL.md",
		icon: "magic-file-soul",
		tone: "indigo",
	},
	"skill.library": {
		path: ".magic/skills/",
		group: "project",
		name: "skills",
		icon: "skill:library",
		tone: "indigo",
	},
	"skill.skill": { path: "$skill/", group: "skills", icon: "skill:skill", tone: "indigo" },
	"skill.entry": {
		path: "$skill/SKILL.md",
		group: "skills",
		name: "SKILL.md",
		icon: "skill:entry",
		tone: "indigo",
	},
	"skill.references": {
		path: "$skill/references/",
		group: "skills",
		name: "references",
		icon: "skill:references",
		tone: "indigo",
	},
	"skill.scripts": {
		path: "$skill/scripts/",
		group: "skills",
		name: "scripts",
		icon: "skill:scripts",
		tone: "indigo",
	},
	"skill.assets": {
		path: "$skill/assets/",
		group: "skills",
		name: "assets",
		icon: "skill:assets",
		tone: "indigo",
	},
	"skill.templates": {
		path: "$skill/assets/templates/",
		group: "skills",
		name: "templates",
		icon: "skill:templates",
		tone: "indigo",
	},
	"skill.examples": {
		path: "$skill/examples/",
		group: "skills",
		name: "examples",
		icon: "skill:examples",
		tone: "indigo",
	},
	"skill.evals": {
		path: "$skill/evals/",
		group: "skills",
		name: "evals",
		icon: "skill:evals",
		tone: "indigo",
	},
	"skill.evalCases": {
		path: "$skill/evals/evals.json",
		group: "skills",
		name: "evals.json",
		icon: "file:json",
		tone: "indigo",
	},
	"skill.evalInputs": {
		path: "$skill/evals/files/",
		group: "skills",
		name: "files",
		icon: "skill:evalInputs",
		tone: "indigo",
	},
	"skill.agents": {
		path: "$skill/agents/",
		group: "skills",
		name: "agents",
		icon: "skill:agents",
		tone: "indigo",
	},
	"skill.readme": {
		path: "$skill/README.md",
		group: "skills",
		name: "README.md",
		icon: "file:md",
		tone: "indigo",
	},
	"skill.license": {
		path: "$skill/LICENSE",
		group: "skills",
		name: "LICENSE",
		icon: "file:txt",
		tone: "neutral",
	},
	"skill.publishConfig": {
		path: ".magic/skills/skill_config.yaml",
		group: "skills",
		name: "skill_config.yaml",
		icon: "file:yaml",
		tone: "indigo",
	},
	"skillLibrary.unknown": {
		group: "current",
		name: "skills",
		icon: "skill:library",
		tone: "indigo",
	},
	"skillLibrary.user": {
		path: ".magic/skills/",
		group: "personal",
		name: "skills",
		icon: "skill:library",
		tone: "indigo",
	},
	"skillLibrary.claw": {
		path: ".magic/skills/",
		group: "assistant",
		name: "skills",
		icon: "skill:library",
		tone: "indigo",
	},
	"skillLibrary.crew": {
		path: ".magic/skills/",
		group: "crew",
		name: "skills",
		icon: "skill:library",
		tone: "indigo",
	},
	"user.overview": { path: "$overview", group: "personal", icon: "user-space", tone: "indigo" },
	"user.memory": {
		path: ".magic/memory/",
		group: "personal",
		name: "memory",
		icon: "magic-memory",
		tone: "neutral",
	},
	"user.coreMemory": {
		path: ".magic/memory/global/MEMORY.md",
		navigationParent: "user.memory",
		group: "personal",
		name: "MEMORY.md",
		icon: "magic-file-memory",
		tone: "neutral",
	},
	"user.projectCoreMemory": {
		path: ".magic/memory/projects/$project/MEMORY.md",
		navigationParent: "user.memory",
		group: "personal",
		name: "MEMORY.md",
		icon: "magic-file-memory",
		tone: "neutral",
	},
	"user.notes": {
		path: ".magic/memory/$memoryScope/notes/",
		navigationParent: "user.memory",
		group: "personal",
		name: "notes",
		icon: "user:notes",
		tone: "neutral",
	},
	"user.references": {
		path: ".magic/memory/$memoryScope/notes/references/",
		navigationParent: "user.notes",
		group: "personal",
		name: "references",
		icon: "user:references",
		tone: "neutral",
	},
	"user.subject": {
		navigationParent: "user.references",
		group: "personal",
		icon: "user:subject",
		tone: "neutral",
	},
	"user.timeline": {
		path: ".magic/memory/$memoryScope/notes/timeline/",
		navigationParent: "user.notes",
		group: "personal",
		name: "timeline",
		icon: "user:timeline",
		tone: "neutral",
	},
	"user.year": {
		navigationParent: "user.timeline",
		group: "personal",
		icon: "user:year",
		tone: "neutral",
	},
	"user.month": {
		navigationParent: "user.timeline",
		group: "personal",
		icon: "user:month",
		tone: "neutral",
	},
	"user.event": {
		navigationParent: "user.timeline",
		group: "personal",
		icon: "user:event",
		tone: "neutral",
	},
	"user.index": {
		path: ".magic/memory/$memoryScope/notes/index.md",
		navigationParent: "user.notes",
		group: "personal",
		name: "index.md",
		icon: "user:index",
		tone: "neutral",
	},
	"user.topics": {
		path: ".magic/memory/$memoryScope/notes/topics/",
		navigationParent: "user.notes",
		group: "personal",
		name: "topics",
		icon: "user:topics",
		tone: "neutral",
	},
	"user.dingtalk": {
		path: ".dws/",
		group: "personal",
		name: ".dws",
		icon: "user:dingtalk",
		tone: "indigo",
	},
	"user.lark": {
		path: ".lark-cli/",
		group: "personal",
		name: ".lark-cli",
		icon: "user:lark",
		tone: "indigo",
	},
	"user.teamshare": {
		path: ".magic/teamshare-cli/",
		group: "personal",
		name: "teamshare-cli",
		icon: "user:teamshare",
		tone: "indigo",
	},
	"user.tools": {
		path: ".local/",
		group: "personal",
		name: ".local",
		icon: "user:tools",
		tone: "indigo",
	},
	"user.cli": {
		path: ".magic/cli/",
		group: "personal",
		name: "cli",
		icon: "user:cli",
		tone: "indigo",
	},
	"user.settings": {
		path: ".magic/super-magic.env",
		group: "personal",
		name: "super-magic.env",
		icon: "user:settings",
		tone: "indigo",
	},
	"claw.scheduledTasks": {
		path: ".magic/cron/",
		group: "assistant",
		name: "cron",
		icon: "magic-cron",
		tone: "indigo",
	},
	"claw.memoryFolder": {
		path: ".magic/memory/",
		group: "assistant",
		name: "memory",
		icon: "magic-memory",
		tone: "neutral",
	},
	"claw.skillList": {
		path: ".magic/SKILLS.md",
		group: "assistant",
		name: "SKILLS.md",
		icon: "magic-file-skills",
		tone: "indigo",
	},
	"claw.proactiveExecution": {
		path: ".magic/HEARTBEAT.md",
		group: "assistant",
		name: "HEARTBEAT.md",
		icon: "magic-file-heartbeat",
		tone: "indigo",
	},
	"claw.toolList": {
		path: ".magic/TOOLS.md",
		group: "assistant",
		name: "TOOLS.md",
		icon: "magic-file-tools",
		tone: "indigo",
	},
	"claw.aboutYou": {
		path: ".magic/USER.md",
		group: "assistant",
		name: "USER.md",
		icon: "magic-file-user",
		tone: "indigo",
	},
	"claw.initialSetup": {
		path: ".magic/BOOTSTRAP.md",
		group: "assistant",
		name: "BOOTSTRAP.md",
		icon: "magic-file-bootstrap",
		tone: "indigo",
	},
	"claw.memoryFile": {
		path: ".magic/MEMORY.md",
		group: "assistant",
		name: "MEMORY.md",
		icon: "magic-file-memory",
		tone: "neutral",
	},
	...projectArticles,
} as const satisfies Record<string, FileHelpMetadata>

export type FileHelpArticleId = keyof typeof FILE_HELP_CATALOG
export const FILE_HELP_ARTICLE_IDS = Object.keys(FILE_HELP_CATALOG) as FileHelpArticleId[]

export function isFileHelpArticleId(id: string): id is FileHelpArticleId {
	return Object.hasOwn(FILE_HELP_CATALOG, id)
}

export function getFileHelpMetadata(id: FileHelpArticleId): FileHelpMetadata {
	return FILE_HELP_CATALOG[id]
}

export type FileHelpReadingReason =
	| "skillEntry"
	| "skillStructure"
	| "progressiveReading"
	| "projectRules"
	| "projectConfig"
	| "personalSpace"
	| "memoryStructure"
	| "scope"
	| "assistantRules"
	| "crewRules"
export interface FileHelpReadingLink {
	id: FileHelpArticleId
	reason: FileHelpReadingReason
}
interface FileHelpRelations {
	further?: FileHelpReadingLink[]
	recommended?: FileHelpReadingLink[]
}

/** 每条关系说明为何值得阅读；无关联的文章保留空结果，不按目录顺序填充推荐。 */
const RELATIONS: Partial<Record<FileHelpArticleId, FileHelpRelations>> = {
	"skill.entry": {
		further: [{ id: "skill.references", reason: "progressiveReading" }],
		recommended: [{ id: "skill.library", reason: "skillStructure" }],
	},
	"skill.references": {
		further: [{ id: "skill.entry", reason: "skillEntry" }],
		recommended: [{ id: "skill.library", reason: "skillStructure" }],
	},
	"skill.library": {
		further: [{ id: "skill.entry", reason: "skillEntry" }],
		recommended: [{ id: "system.projectMagic", reason: "projectConfig" }],
	},
	"system.projectMagic": {
		further: [{ id: "system.projectInstructions", reason: "projectRules" }],
		recommended: [{ id: "skill.library", reason: "skillStructure" }],
	},
	"system.projectInstructions": {
		recommended: [
			{ id: "system.projectMagic", reason: "projectConfig" },
			{ id: "skill.library", reason: "skillStructure" },
		],
	},
	"skillLibrary.user": {
		further: [{ id: "skill.entry", reason: "skillEntry" }],
		recommended: [{ id: "user.overview", reason: "personalSpace" }],
	},
	"skillLibrary.crew": {
		further: [{ id: "skill.entry", reason: "skillEntry" }],
		recommended: [{ id: "system.crewInstructions", reason: "crewRules" }],
	},
	"skillLibrary.claw": {
		further: [{ id: "skill.entry", reason: "skillEntry" }],
		recommended: [{ id: "system.clawInstructions", reason: "assistantRules" }],
	},
	"user.overview": {
		recommended: [
			{ id: "user.memory", reason: "memoryStructure" },
			{ id: "skillLibrary.user", reason: "scope" },
		],
	},
	"user.memory": {
		recommended: [
			{ id: "user.coreMemory", reason: "memoryStructure" },
			{ id: "user.projectCoreMemory", reason: "memoryStructure" },
			{ id: "user.overview", reason: "personalSpace" },
		],
	},
}

export function getFileHelpRelations(id: FileHelpArticleId): FileHelpRelations {
	const explicit = RELATIONS[id]
	if (explicit) return explicit
	if (id.startsWith("skill."))
		return {
			recommended: [
				{ id: "skill.entry", reason: "skillEntry" },
				{ id: "skill.library", reason: "skillStructure" },
			],
		}
	const { group } = FILE_HELP_CATALOG[id]
	if (group === "personal")
		return {
			recommended: [
				{ id: "user.overview", reason: "personalSpace" },
				{ id: "user.memory", reason: "memoryStructure" },
			],
		}
	if (group === "assistant")
		return {
			recommended: [
				{ id: "system.clawInstructions", reason: "assistantRules" },
				{ id: "skillLibrary.claw", reason: "scope" },
			],
		}
	if (group === "crew")
		return {
			recommended: [
				{ id: "system.crewInstructions", reason: "crewRules" },
				{ id: "skillLibrary.crew", reason: "scope" },
			],
		}
	if (group === "project")
		return {
			recommended: [
				{ id: "system.projectInstructions", reason: "projectRules" },
				{ id: "system.projectMagic", reason: "projectConfig" },
			],
		}
	return {}
}
