import { UserRound, Users, FileText, Headphones, ListChecks } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
	HelpArticle,
	type HelpArticleProps,
} from "@/components/shadcn-composed/context-help/HelpArticle"
import type { HelpDefinition } from "@/components/shadcn-composed/context-help"
import type { FileHelpContext, SystemFileHelpKind } from "../utils/magic-system-folder"
import type { FilePresentation } from "../utils/file-presentation"
import type { AttachmentItem } from "./types"
import { FileResourceIcon } from "../components/FileResourceIcon"
import { FileDirectoryView } from "../components/FileDirectoryView"
import { getClawBrandTranslationValues } from "@/pages/superMagic/utils/clawBrand"
import type { FileHelpArticleId } from "../utils/file-help-catalog"
export type { SystemFileHelpKind } from "../utils/magic-system-folder"

export interface FileHelpPresentation {
	label: string
	shortLabel?: string
	help: HelpDefinition
	articleId?: FileHelpArticleId
	sourceKey?: string
	fileLocation?: { path: string; context: FileHelpContext["kind"] }
}
export interface FileHelpDetail extends Omit<HelpArticleProps, "visual"> {
	shortLabel?: string
	preview?: string[]
	scope?: string
	exampleRoot?: string
	files?: Array<{ path: string; directory?: boolean; description?: string; type?: string }>
}

/** 静态教学目录只适配既有列表的数据结构；不读取用户文件或连接文件操作。 */
function FileHelpDirectory({
	detail,
	presentation,
}: {
	detail: FileHelpDetail
	presentation?: FilePresentation
}) {
	const { t } = useTranslation("super")
	const items: AttachmentItem[] = []
	const nodes = new Map<string, AttachmentItem>()
	const descriptions: Record<string, string> = {}
	for (const file of detail.files ?? []) {
		const segments = file.path.split("/")
		let siblings = items
		for (let i = 0; i < segments.length; i++) {
			const path = segments.slice(0, i + 1).join("/")
			let node = nodes.get(path)
			if (!node) {
				node = {
					file_id: path,
					file_name: segments[i],
					relative_file_path: path,
					is_directory: i < segments.length - 1 || file.directory,
					file_extension: segments[i].split(".").at(-1),
					children: [],
				}
				nodes.set(path, node)
				siblings.push(node)
			}
			if (i === segments.length - 1 && file.type) node.display_config = { type: file.type }
			siblings = node.children ?? []
		}
		descriptions[file.path] = file.description ?? ""
	}
	const exampleRoot = detail.exampleRoot ? nodes.get(detail.exampleRoot) : undefined
	return (
		<section className="space-y-3">
			<h3 className="font-semibold">{detail.guide.diagramTitle}</h3>
			<FileDirectoryView
				mode="example"
				items={exampleRoot ? [exampleRoot] : items}
				rootName={t("topicFiles.helpDirectoryExample")}
				fileHelpContext={presentation?.context ?? { kind: "unknown" }}
				descriptions={descriptions}
			/>
		</section>
	)
}

/** 共同组装文件身份、悬浮要点与延迟正文，通用帮助组件不依赖文件业务。 */
export function createFileHelpPresentation(
	articleId: FileHelpArticleId,
	label: string,
	summary: string,
	detail: FileHelpDetail,
	visual: HelpArticleProps["visual"],
	presentation?: FilePresentation,
): FileHelpPresentation {
	return {
		label,
		// 短名只用于行内标签，帮助标题和文章导航仍保留完整名称。
		shortLabel: detail.shortLabel,
		articleId,
		fileLocation: presentation
			? { path: presentation.path, context: presentation.context.kind }
			: undefined,
		sourceKey: presentation
			? JSON.stringify([
					articleId,
					presentation.context.kind,
					"projectId" in presentation.context ? presentation.context.projectId : "",
					presentation.item.file_id,
					presentation.path,
				])
			: articleId,
		help: {
			title: label,
			summary,
			subtitle: detail.scope,
			points: detail.preview,
			identity: presentation
				? {
						name: presentation.name,
						scope: detail.scope,
						renderIcon: (size) => (
							<FileResourceIcon presentation={presentation} size={size} />
						),
					}
				: undefined,
			renderBody: (reading, identity) => (
				<HelpArticle
					{...detail}
					visual={visual}
					reading={reading}
					guide={{
						...detail.guide,
						steps: detail.guide.steps.map((step, index) => ({
							...step,
							icon:
								articleId === "system.projectInstructions" ? (
									index === 1 ? (
										identity?.renderIcon(24)
									) : index === 0 ? (
										<UserRound size={20} />
									) : (
										<Users size={20} />
									)
								) : articleId === "recording.project" ? (
									index === 0 ? (
										<Headphones size={20} />
									) : index === 1 ? (
										<FileText size={20} />
									) : (
										<ListChecks size={20} />
									)
								) : index === 0 ? (
									identity?.renderIcon(20)
								) : undefined,
						})),
					}}
					illustration={
						detail.files?.length ? (
							<FileHelpDirectory detail={detail} presentation={presentation} />
						) : undefined
					}
					sampleIdentity={
						identity ? (
							<>
								{identity.renderIcon(16)}
								<span>{identity.name}</span>
							</>
						) : undefined
					}
				/>
			),
		},
	}
}

/** 相同交互复用帮助组件；用途、作用范围与读取方式按真实场景区分。 */
export function useSystemFileHelp(
	kind: SystemFileHelpKind | undefined,
	presentation?: FilePresentation,
): FileHelpPresentation | undefined {
	const { t } = useTranslation("super")
	const brand = getClawBrandTranslationValues()
	switch (kind) {
		case "clawSoul":
			return createFileHelpPresentation(
				"system.clawSoul",
				t("topicFiles.clawPlaygroundTags.guidelines", brand),
				t("topicFiles.clawPlaygroundHelp.guidelines", brand),
				t("topicFiles.clawPlaygroundDetails.guidelines", {
					returnObjects: true,
					...brand,
				}) as FileHelpDetail,
				"document",
				presentation,
			)
		case "clawIdentity":
			return createFileHelpPresentation(
				"system.clawIdentity",
				t("topicFiles.clawPlaygroundTags.identityInfo", brand),
				t("topicFiles.clawPlaygroundHelp.identityInfo", brand),
				t("topicFiles.clawPlaygroundDetails.identityInfo", {
					returnObjects: true,
					...brand,
				}) as FileHelpDetail,
				"document",
				presentation,
			)
		case "projectMagic":
			return createFileHelpPresentation(
				"system.projectMagic",
				t("topicFiles.systemFiles.labels.projectMagic", brand),
				t("topicFiles.systemFiles.help.projectMagic", brand),
				t("topicFiles.systemFiles.details.projectMagic", {
					returnObjects: true,
					...brand,
				}) as FileHelpDetail,
				"tree",
				presentation,
			)
		case "userMagic":
			return createFileHelpPresentation(
				"system.userMagic",
				t("topicFiles.systemFiles.labels.userMagic", brand),
				t("topicFiles.systemFiles.help.userMagic", brand),
				t("topicFiles.systemFiles.details.userMagic", {
					returnObjects: true,
					...brand,
				}) as FileHelpDetail,
				"tree",
				presentation,
			)
		case "clawMagic":
			return createFileHelpPresentation(
				"system.clawMagic",
				t("topicFiles.systemFiles.labels.clawMagic", brand),
				t("topicFiles.systemFiles.help.clawMagic", brand),
				t("topicFiles.systemFiles.details.clawMagic", {
					returnObjects: true,
					...brand,
				}) as FileHelpDetail,
				"tree",
				presentation,
			)
		case "crewMagic":
			return createFileHelpPresentation(
				"system.crewMagic",
				t("topicFiles.systemFiles.labels.crewMagic", brand),
				t("topicFiles.systemFiles.help.crewMagic", brand),
				t("topicFiles.systemFiles.details.crewMagic", {
					returnObjects: true,
					...brand,
				}) as FileHelpDetail,
				"tree",
				presentation,
			)
		case "projectInstructions":
			return createFileHelpPresentation(
				"system.projectInstructions",
				t("topicFiles.systemFiles.labels.projectInstructions", brand),
				t("topicFiles.systemFiles.help.projectInstructions", brand),
				t("topicFiles.systemFiles.details.projectInstructions", {
					returnObjects: true,
					...brand,
				}) as FileHelpDetail,
				"flow",
				presentation,
			)
		case "directoryInstructions":
			return createFileHelpPresentation(
				"system.directoryInstructions",
				t("topicFiles.systemFiles.labels.directoryInstructions", brand),
				t("topicFiles.systemFiles.help.directoryInstructions", brand),
				t("topicFiles.systemFiles.details.directoryInstructions", {
					returnObjects: true,
					...brand,
				}) as FileHelpDetail,
				"tree",
				presentation,
			)
		case "clawInstructions":
			return createFileHelpPresentation(
				"system.clawInstructions",
				t("topicFiles.systemFiles.labels.clawInstructions", brand),
				t("topicFiles.systemFiles.help.clawInstructions", brand),
				t("topicFiles.systemFiles.details.clawInstructions", {
					returnObjects: true,
					...brand,
				}) as FileHelpDetail,
				"document",
				presentation,
			)
		case "crewInstructions":
			return createFileHelpPresentation(
				"system.crewInstructions",
				t("topicFiles.systemFiles.labels.crewInstructions", brand),
				t("topicFiles.systemFiles.help.crewInstructions", brand),
				t("topicFiles.systemFiles.details.crewInstructions", {
					returnObjects: true,
					...brand,
				}) as FileHelpDetail,
				"document",
				presentation,
			)
		case "agentInstructions":
			return createFileHelpPresentation(
				"system.agentInstructions",
				t("topicFiles.systemFiles.labels.agentInstructions", brand),
				t("topicFiles.systemFiles.help.agentInstructions", brand),
				t("topicFiles.systemFiles.details.agentInstructions", {
					returnObjects: true,
					...brand,
				}) as FileHelpDetail,
				"document",
				presentation,
			)
		case "instructionFile":
			return createFileHelpPresentation(
				"system.instructionFile",
				t("topicFiles.systemFiles.labels.instructionFile", brand),
				t("topicFiles.systemFiles.help.instructionFile", brand),
				t("topicFiles.systemFiles.details.instructionFile", {
					returnObjects: true,
					...brand,
				}) as FileHelpDetail,
				"document",
				presentation,
			)
		case "crewIdentity":
			return createFileHelpPresentation(
				"system.crewIdentity",
				t("topicFiles.systemFiles.labels.crewIdentity", brand),
				t("topicFiles.systemFiles.help.crewIdentity", brand),
				t("topicFiles.systemFiles.details.crewIdentity", {
					returnObjects: true,
					...brand,
				}) as FileHelpDetail,
				"document",
				presentation,
			)
		case "crewSoul":
			return createFileHelpPresentation(
				"system.crewSoul",
				t("topicFiles.systemFiles.labels.crewSoul", brand),
				t("topicFiles.systemFiles.help.crewSoul", brand),
				t("topicFiles.systemFiles.details.crewSoul", {
					returnObjects: true,
					...brand,
				}) as FileHelpDetail,
				"document",
				presentation,
			)
	}
}
