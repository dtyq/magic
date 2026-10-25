import type { AttachmentItem } from "../TopicFilesButton/hooks/types"
import { resolveSystemFileHelpKind } from "../TopicFilesButton/utils/magic-system-folder"
import {
	getMemoryProjectId,
	isFixedUserMemoryEntry,
	USER_MEMORY_ROOT,
	USER_MEMORY_NOTES,
} from "../LongTremMemory/components/memoryTreeNodeUtils"

export type UserResourceKind =
	| "magic"
	| "instructions"
	| "memory"
	| "coreMemory"
	| "projectCoreMemory"
	| "notes"
	| "references"
	| "timeline"
	| "year"
	| "month"
	| "index"
	| "subject"
	| "event"
	| "topics"
	| "dingtalk"
	| "lark"
	| "teamshare"
	| "tools"
	| "cli"
	| "settings"

const DIRECTORY_KINDS: Readonly<Record<string, UserResourceKind>> = {
	".dws": "dingtalk",
	".local/share/dws-cli": "dingtalk",
	".lark-cli": "lark",
	".local/share/lark-cli": "lark",
	".magic/teamshare-cli": "teamshare",
	".local": "tools",
	".local/share": "tools",
	".magic/cli": "cli",
}

/** 仅识别已约定的记忆根；普通项目的 notes/references 不获得记忆语义。 */
function getMemoryKind(segments: string[], isDirectory: boolean): UserResourceKind | undefined {
	if (segments[0] !== USER_MEMORY_ROOT[0] || segments[1] !== USER_MEMORY_ROOT[1]) return
	const rootLength =
		segments[2] === "global"
			? 3
			: segments[2] === "projects" && getMemoryProjectId(segments[3] ?? "")
				? 4
				: 0
	if (!rootLength) return
	const path = segments.slice(rootLength)
	if (path.length === 0 && isDirectory) return "memory"
	if (path[0] !== USER_MEMORY_NOTES) return
	if (path.length === 1) return isDirectory ? "notes" : undefined
	const name = path[path.length - 1]
	const isMarkdown = name.endsWith(".md")
	if (path.length === 2 && !isDirectory && name === "index.md") return "index"
	if (path[1] === "references") {
		if (isDirectory) return "references"
		if (path.length > 2 && isMarkdown) return name === "index.md" ? "index" : "subject"
	}
	if (path[1] === "topics") {
		if (isDirectory || (path.length > 2 && isMarkdown))
			return name === "index.md" ? "index" : "topics"
	}
	if (path[1] !== "timeline") return
	if (path.length === 2) return isDirectory ? "timeline" : undefined
	if (path.length === 3 && !isDirectory && name === "undated.md") return "event"
	const datedPath = isDirectory ? path : path.slice(0, -1)
	const year = datedPath[2]
	const month = datedPath[3]
	if (datedPath.length > 4) return
	if (year !== undefined && !/^[1-9][0-9]{3}$/.test(year)) return
	if (month !== undefined && !/^(0[1-9]|1[0-2])$/.test(month)) return
	if (isDirectory) return month ? "month" : "year"
	if (name === "index.md") return "index"
	if (!year || !month || !/^\d{4}-\d{2}-\d{2}\.md$/.test(name)) return
	const date = name.slice(0, -3)
	const parsedDate = new Date(`${date}T00:00:00Z`)
	if (
		date.startsWith(`${year}-${month}-`) &&
		!Number.isNaN(parsedDate.getTime()) &&
		parsedDate.toISOString().startsWith(date)
	)
		return "event"
}

/** 固定目录按用户根下的完整路径识别；例如资料/cli 仍是普通目录。 */
export function getUserResourceKind(item: AttachmentItem): UserResourceKind | undefined {
	const segments = (item.file_reference?.space_relative_path ?? item.relative_file_path ?? "")
		.split("/")
		.filter(Boolean)
	const path = segments.join("/")
	if (item.is_directory && path === ".magic") return "magic"
	if (resolveSystemFileHelpKind(item, path, { kind: "user" }) === "instructionFile")
		return "instructions"
	if (item.is_directory) {
		if (path === ".magic/memory") return "memory"
		const kind = Object.hasOwn(DIRECTORY_KINDS, path) ? DIRECTORY_KINDS[path] : undefined
		if (kind) return kind
	} else {
		if (isFixedUserMemoryEntry(path, false))
			return segments[2] === "projects" ? "projectCoreMemory" : "coreMemory"
		if (path === ".magic/super-magic.env") return "settings"
	}
	return getMemoryKind(segments, Boolean(item.is_directory))
}
