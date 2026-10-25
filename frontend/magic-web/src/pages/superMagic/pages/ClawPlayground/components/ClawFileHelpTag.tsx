import { getClawBrandTranslationValues } from "@/pages/superMagic/utils/clawBrand"
import { useTranslation } from "react-i18next"
import { TopicFileTag } from "@/pages/superMagic/components/TopicFilesButton/components/TopicFileTag"
import {
	useSystemFileHelp,
	createFileHelpPresentation,
	type FileHelpDetail,
	type FileHelpPresentation,
} from "@/pages/superMagic/components/TopicFilesButton/hooks/useSystemFileHelp"
import type { FilePresentation } from "@/pages/superMagic/components/TopicFilesButton/utils/file-presentation"
import { useSkillFileHelp } from "@/pages/superMagic/components/TopicFilesButton/hooks/useSkillFileHelp"

export type ClawFileHelpKind =
	| "scheduledTasks"
	| "installedSkills"
	| "memoryFolder"
	| "skillList"
	| "proactiveExecution"
	| "identityInfo"
	| "guidelines"
	| "toolList"
	| "aboutYou"
	| "initialSetup"
	| "memoryFile"
	| "prompts"

export function useClawFileHelp(
	kind: ClawFileHelpKind | undefined,
	presentation?: FilePresentation,
): FileHelpPresentation | undefined {
	const { t } = useTranslation("super")
	const brand = getClawBrandTranslationValues()
	const system = useSystemFileHelp(
		kind === "prompts"
			? "clawInstructions"
			: kind === "identityInfo"
				? "clawIdentity"
				: kind === "guidelines"
					? "clawSoul"
					: undefined,
		presentation,
	)
	const skill = useSkillFileHelp(
		kind === "installedSkills" ? "library" : undefined,
		presentation,
		"claw",
	)
	if (system || skill) return system ?? skill
	switch (kind) {
		case "scheduledTasks":
			return createFileHelpPresentation(
				"claw.scheduledTasks",
				t("topicFiles.clawPlaygroundTags.scheduledTasks", brand),
				t("topicFiles.clawPlaygroundHelp.scheduledTasks", brand),
				t("topicFiles.clawPlaygroundDetails.scheduledTasks", {
					returnObjects: true,
					...brand,
				}) as FileHelpDetail,
				"flow",
				presentation,
			)
		case "memoryFolder":
			return createFileHelpPresentation(
				"claw.memoryFolder",
				t("topicFiles.clawPlaygroundTags.memoryFolder", brand),
				t("topicFiles.clawPlaygroundHelp.memoryFolder", brand),
				t("topicFiles.clawPlaygroundDetails.memoryFolder", {
					returnObjects: true,
					...brand,
				}) as FileHelpDetail,
				"tree",
				presentation,
			)
		case "skillList":
			return createFileHelpPresentation(
				"claw.skillList",
				t("topicFiles.clawPlaygroundTags.skillList", brand),
				t("topicFiles.clawPlaygroundHelp.skillList", brand),
				t("topicFiles.clawPlaygroundDetails.skillList", {
					returnObjects: true,
					...brand,
				}) as FileHelpDetail,
				"flow",
				presentation,
			)
		case "proactiveExecution":
			return createFileHelpPresentation(
				"claw.proactiveExecution",
				t("topicFiles.clawPlaygroundTags.proactiveExecution", brand),
				t("topicFiles.clawPlaygroundHelp.proactiveExecution", brand),
				t("topicFiles.clawPlaygroundDetails.proactiveExecution", {
					returnObjects: true,
					...brand,
				}) as FileHelpDetail,
				"flow",
				presentation,
			)
		case "toolList":
			return createFileHelpPresentation(
				"claw.toolList",
				t("topicFiles.clawPlaygroundTags.toolList", brand),
				t("topicFiles.clawPlaygroundHelp.toolList", brand),
				t("topicFiles.clawPlaygroundDetails.toolList", {
					returnObjects: true,
					...brand,
				}) as FileHelpDetail,
				"document",
				presentation,
			)
		case "aboutYou":
			return createFileHelpPresentation(
				"claw.aboutYou",
				t("topicFiles.clawPlaygroundTags.aboutYou", brand),
				t("topicFiles.clawPlaygroundHelp.aboutYou", brand),
				t("topicFiles.clawPlaygroundDetails.aboutYou", {
					returnObjects: true,
					...brand,
				}) as FileHelpDetail,
				"document",
				presentation,
			)
		case "initialSetup":
			return createFileHelpPresentation(
				"claw.initialSetup",
				t("topicFiles.clawPlaygroundTags.initialSetup", brand),
				t("topicFiles.clawPlaygroundHelp.initialSetup", brand),
				t("topicFiles.clawPlaygroundDetails.initialSetup", {
					returnObjects: true,
					...brand,
				}) as FileHelpDetail,
				"flow",
				presentation,
			)
		case "memoryFile":
			return createFileHelpPresentation(
				"claw.memoryFile",
				t("topicFiles.clawPlaygroundTags.memoryFile", brand),
				t("topicFiles.clawPlaygroundHelp.memoryFile", brand),
				t("topicFiles.clawPlaygroundDetails.memoryFile", {
					returnObjects: true,
					...brand,
				}) as FileHelpDetail,
				"document",
				presentation,
			)
	}
}

/** 匹配器只决定用途；标签在组件中翻译，语言切换时不保留旧文案。 */
export function ClawFileHelpTag({
	kind,
	presentation,
}: {
	kind: ClawFileHelpKind
	presentation?: FilePresentation
}) {
	const help = useClawFileHelp(kind, presentation)
	return help ? <TopicFileTag {...help} /> : null
}
