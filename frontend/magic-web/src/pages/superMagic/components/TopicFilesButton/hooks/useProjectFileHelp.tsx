import { useTranslation } from "react-i18next"
import { getMagicProjectType, type MagicProjectKind } from "@/constants/magicProjectTypes"
import type { FilePresentation } from "../utils/file-presentation"
import {
	createFileHelpPresentation,
	type FileHelpDetail,
	type FileHelpPresentation,
} from "./useSystemFileHelp"

export function useProjectTypeNames(): Record<MagicProjectKind, string> {
	const { t } = useTranslation("super")
	return {
		audio: t("topicFiles.fileInfo.type.audio"),
		slide: t("topicFiles.fileInfo.type.slide"),
		dashboard: t("topicFiles.fileInfo.type.dashboard"),
		design: t("topicFiles.fileInfo.type.design"),
		"ai-card": t("topicFiles.fileInfo.type.ai-card"),
		"slide-template": t("topicFiles.fileInfo.type.slide-template"),
		custom: t("topicFiles.fileInfo.type.custom"),
		"micro-app": t("topicFiles.fileInfo.type.micro-app"),
		video: t("topicFiles.fileInfo.type.video"),
		"self-media": t("topicFiles.fileInfo.type.self-media"),
	}
}

/** 标签和目录使用同一篇正文；只组装当前类型，不在文件行加载整份指南。 */
export function useProjectFileHelp(
	kind: MagicProjectKind | undefined,
	presentation?: FilePresentation,
): FileHelpPresentation | undefined {
	const { t } = useTranslation("super")
	const names = useProjectTypeNames()
	if (!kind) return
	const definition = getMagicProjectType(kind)
	if (!definition?.helpKind) return
	let summary: string
	let detail: FileHelpDetail
	switch (kind) {
		case "audio":
			summary = t("topicFiles.recordingProject.summary")
			detail = t("topicFiles.recordingProject.detail", {
				returnObjects: true,
			}) as FileHelpDetail
			break
		case "slide":
			summary = t("topicFiles.projectTypes.slide.summary")
			detail = t("topicFiles.projectTypes.slide.detail", {
				returnObjects: true,
			}) as FileHelpDetail
			break
		case "dashboard":
			summary = t("topicFiles.projectTypes.dashboard.summary")
			detail = t("topicFiles.projectTypes.dashboard.detail", {
				returnObjects: true,
			}) as FileHelpDetail
			break
		case "design":
			summary = t("topicFiles.projectTypes.design.summary")
			detail = t("topicFiles.projectTypes.design.detail", {
				returnObjects: true,
			}) as FileHelpDetail
			break
		case "ai-card":
			summary = t("topicFiles.projectTypes.ai-card.summary")
			detail = t("topicFiles.projectTypes.ai-card.detail", {
				returnObjects: true,
			}) as FileHelpDetail
			break
		case "slide-template":
			summary = t("topicFiles.projectTypes.slide-template.summary")
			detail = t("topicFiles.projectTypes.slide-template.detail", {
				returnObjects: true,
			}) as FileHelpDetail
			break
		case "custom":
			summary = t("topicFiles.projectTypes.custom.summary")
			detail = t("topicFiles.projectTypes.custom.detail", {
				returnObjects: true,
			}) as FileHelpDetail
			break
		case "micro-app":
			summary = t("topicFiles.projectTypes.micro-app.summary")
			detail = t("topicFiles.projectTypes.micro-app.detail", {
				returnObjects: true,
			}) as FileHelpDetail
			break
		case "video":
			summary = t("topicFiles.projectTypes.video.summary")
			detail = t("topicFiles.projectTypes.video.detail", {
				returnObjects: true,
			}) as FileHelpDetail
			break
		default:
			return
	}
	return createFileHelpPresentation(
		definition.helpKind,
		names[kind],
		summary,
		detail,
		"flow",
		presentation,
	)
}
