import type { FileApi } from "@/pages/superMagic/fileAccess/fileApi"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import {
	parseSkillDirFromSkillMdRelativePath,
	parseSkillMdFrontmatter,
} from "@/pages/superMagic/pages/SkillEdit/utils/skill-workspace-manifest"

export interface ProjectSkill {
	id: string
	directory: string
	name: string
	description: string
	content: string
}

export function getSkillFiles(attachmentList: AttachmentItem[]) {
	const filesByDirectory = new Map<string, AttachmentItem>()

	for (const item of attachmentList) {
		if (item.is_directory || item.type === "directory" || !item.file_id) continue
		const directory = parseSkillDirFromSkillMdRelativePath(item.relative_file_path)
		if (directory && !filesByDirectory.has(directory)) filesByDirectory.set(directory, item)
	}

	return [...filesByDirectory.entries()].sort(([left], [right]) => left.localeCompare(right))
}

export function resolveLocalizedText(
	defaultText: string,
	localizedText: string,
	language: string,
): string {
	return language.toLowerCase().startsWith("zh")
		? localizedText || defaultText
		: defaultText || localizedText
}

export async function loadProjectSkills(
	attachmentList: AttachmentItem[],
	language: string,
	fileApi: Pick<FileApi, "getFileContentsByIds">,
): Promise<ProjectSkill[]> {
	const skillFiles = getSkillFiles(attachmentList)
	if (!skillFiles.length) return []

	const { successes, failures } = await fileApi.getFileContentsByIds(
		skillFiles.map(([, file]) => String(file.file_id)),
		{ responseType: "text" },
	)

	// Do not turn unreadable manifests into apparently valid, empty skills.
	if (failures.size) throw failures.values().next().value
	return skillFiles.map(([directory, file]) => {
		const content = String(successes.get(String(file.file_id)) ?? "")
		const manifest = parseSkillMdFrontmatter(content)
		return {
			id: String(file.file_id),
			directory,
			name:
				resolveLocalizedText(manifest.nameDefault, manifest.nameCn, language) ||
				directory.split("/").pop() ||
				directory,
			description: resolveLocalizedText(
				manifest.descriptionDefault,
				manifest.descriptionCn,
				language,
			),
			content,
		}
	})
}
