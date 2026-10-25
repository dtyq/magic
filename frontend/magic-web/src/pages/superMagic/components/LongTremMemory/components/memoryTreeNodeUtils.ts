// 完整用户空间路径只在本模块定义；展示别名不能参与文件定位或权限判断。
export const USER_MEMORY_ROOT = [".magic", "memory"] as const
export const USER_MEMORY_ENTRY = "MEMORY.md"
export const USER_MEMORY_NOTES = "notes"
export const USER_PROJECT_MEMORIES_PATH = [...USER_MEMORY_ROOT, "projects"] as const

/** 项目目录只解析身份，展示名称不能回写到目录名或文件路径。 */
export function getMemoryProjectId(directoryName: string): string | null {
	return /^p_[1-9][0-9]*$/.test(directoryName) ? directoryName.slice(2) : null
}
export function getUserMemoryPath(projectId?: string | null): string[] {
	return projectId
		? [...USER_MEMORY_ROOT, "projects", `p_${projectId}`]
		: [...USER_MEMORY_ROOT, "global"]
}

/** 保护精确的内置路径；普通目录中的同名文件不受限制。 */
export function isFixedUserMemoryEntry(path: string, isDirectory: boolean): boolean {
	if (path === "") return isDirectory
	const segments = path.split("/")
	if (
		isDirectory &&
		(path === ".magic" || path === ".magic/memory" || path === ".magic/memory/projects")
	)
		return true
	const isGlobal = segments[2] === "global"
	const isProject = segments[2] === "projects" && /^p_[1-9][0-9]*$/.test(segments[3] ?? "")
	if (
		segments[0] !== USER_MEMORY_ROOT[0] ||
		segments[1] !== USER_MEMORY_ROOT[1] ||
		(!isGlobal && !isProject)
	)
		return false
	const containerLength = isGlobal ? 3 : 4
	return isDirectory
		? segments.length === containerLength
		: segments.length === containerLength + 1 && segments[containerLength] === USER_MEMORY_ENTRY
}
