import agentsIcon from "../assets/folder-skill-agents-icon.svg"
import evalInputsIcon from "../assets/folder-skill-eval-inputs-icon.svg"
import evalsIcon from "../assets/folder-skill-evals-icon.svg"
import examplesIcon from "../assets/folder-skill-examples-icon.svg"
import templatesIcon from "../assets/folder-skill-templates-icon.svg"
import libraryIcon from "../assets/folder-skill-library-icon.svg"
import referencesIcon from "../assets/folder-skill-references-icon.svg"
import scriptsIcon from "../assets/folder-skill-scripts-icon.svg"
import assetsIcon from "../assets/folder-skill-assets-icon.svg"
import folderIcon from "../assets/folder-skill-icon.svg"
import type { ReactNode } from "react"
import type { SkillFileKind } from "../utils/skill-file-structure"
import { TopicFileIcon } from "./TopicFileIcon"

interface SkillFileIconProps {
	kind?: SkillFileKind
	isDirectory?: boolean
	size?: number
	className?: string
	fallback?: ReactNode
}

/** 仅入口与约定目录使用用途图标，普通资源保留格式或缩略图。 */
export function hasSkillFileIcon(kind: SkillFileKind | undefined, isDirectory?: boolean): boolean {
	if (kind === "entry") return !isDirectory
	return Boolean(isDirectory && kind && kind !== "support")
}

export function SkillFileIcon({
	kind,
	isDirectory,
	size = 16,
	className,
	fallback = null,
}: SkillFileIconProps) {
	if (!hasSkillFileIcon(kind, isDirectory)) return fallback
	if (kind === "entry")
		return <TopicFileIcon magicVariant="magic-file-skills" size={size} className={className} />
	const folderSources: Partial<Record<SkillFileKind, string>> = {
		library: libraryIcon,
		skill: folderIcon,
		references: referencesIcon,
		scripts: scriptsIcon,
		assets: assetsIcon,
		agents: agentsIcon,
		evalInputs: evalInputsIcon,
		evals: evalsIcon,
		examples: examplesIcon,
		templates: templatesIcon,
	}
	const source = kind ? folderSources[kind] : undefined
	if (source)
		return (
			<img src={source} alt="" width={size} height={size} className={className} aria-hidden />
		)
	return fallback
}
