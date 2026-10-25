import { useTranslation } from "react-i18next"
import { lazy } from "react"
import UserSpaceIcon from "./UserSpaceIcon"
import {
	useSystemFileHelp,
	createFileHelpPresentation,
	type FileHelpPresentation,
	type FileHelpDetail,
} from "../TopicFilesButton/hooks/useSystemFileHelp"
import type { FilePresentation } from "../TopicFilesButton/utils/file-presentation"
import type { UserResourceKind } from "./userSpaceFilePresentation"

const UserSpaceHelpContent = lazy(() => import("./UserSpaceHelpContent"))

/** 总览的文件入口与文章目录共用同一定义，正文仍按需加载。 */
export function useUserSpaceOverviewHelp(): FileHelpPresentation {
	const { t } = useTranslation("super")
	return {
		articleId: "user.overview",
		label: t("userSpace.help.title"),
		help: {
			title: t("userSpace.help.title"),
			tone: "indigo",
			identity: {
				name: t("userSpace.title"),
				scope: t("userSpace.help.personalScope"),
				renderIcon: (size) => <UserSpaceIcon size={size} />,
			},
			summary: t("userSpace.help.tooltip"),
			subtitle: t("userSpace.help.personalScope"),
			renderBody: (reading) => (
				<>
					<UserSpaceHelpContent />
					{reading?.further}
					{reading?.recommended}
				</>
			),
		},
	}
}

/** 用途标签共用文件分类；翻译保留静态键以支持提取和语言切换。 */
export function useUserFileHelp(
	kind: UserResourceKind | undefined,
	presentation?: FilePresentation,
): FileHelpPresentation | undefined {
	const { t } = useTranslation("super")
	const system = useSystemFileHelp(
		kind === "magic" ? "userMagic" : kind === "instructions" ? "instructionFile" : undefined,
		presentation,
	)
	if (!kind || kind === "magic" || kind === "instructions") return system
	switch (kind) {
		case "memory":
			return createFileHelpPresentation(
				"user.memory",
				t("userSpace.fileLabels.memory"),
				t("userSpace.fileHelp.memory"),
				t("userSpace.fileDetails.memory", { returnObjects: true }) as FileHelpDetail,
				"flow",
				presentation,
			)
		case "coreMemory":
			return createFileHelpPresentation(
				"user.coreMemory",
				t("userSpace.fileLabels.coreMemory"),
				t("userSpace.fileHelp.coreMemory"),
				t("userSpace.fileDetails.coreMemory", { returnObjects: true }) as FileHelpDetail,
				"document",
				presentation,
			)
		case "projectCoreMemory":
			return createFileHelpPresentation(
				"user.projectCoreMemory",
				t("userSpace.fileLabels.projectCoreMemory"),
				t("userSpace.fileHelp.projectCoreMemory"),
				t("userSpace.fileDetails.projectCoreMemory", {
					returnObjects: true,
				}) as FileHelpDetail,
				"document",
				presentation,
			)
		case "notes":
			return createFileHelpPresentation(
				"user.notes",
				t("userSpace.fileLabels.notes"),
				t("userSpace.fileHelp.notes"),
				t("userSpace.fileDetails.notes", { returnObjects: true }) as FileHelpDetail,
				"tree",
				presentation,
			)
		case "references":
			return createFileHelpPresentation(
				"user.references",
				t("userSpace.fileLabels.references"),
				t("userSpace.fileHelp.references"),
				t("userSpace.fileDetails.references", { returnObjects: true }) as FileHelpDetail,
				"tree",
				presentation,
			)
		case "subject":
			return createFileHelpPresentation(
				"user.subject",
				t("userSpace.fileLabels.subject"),
				t("userSpace.fileHelp.subject"),
				t("userSpace.fileDetails.subject", { returnObjects: true }) as FileHelpDetail,
				"document",
				presentation,
			)
		case "timeline":
			return createFileHelpPresentation(
				"user.timeline",
				t("userSpace.fileLabels.timeline"),
				t("userSpace.fileHelp.timeline"),
				t("userSpace.fileDetails.timeline", { returnObjects: true }) as FileHelpDetail,
				"flow",
				presentation,
			)
		case "year":
			return createFileHelpPresentation(
				"user.year",
				t("userSpace.fileLabels.year"),
				t("userSpace.fileHelp.year"),
				t("userSpace.fileDetails.year", { returnObjects: true }) as FileHelpDetail,
				"tree",
				presentation,
			)
		case "month":
			return createFileHelpPresentation(
				"user.month",
				t("userSpace.fileLabels.month"),
				t("userSpace.fileHelp.month"),
				t("userSpace.fileDetails.month", { returnObjects: true }) as FileHelpDetail,
				"tree",
				presentation,
			)
		case "event":
			return createFileHelpPresentation(
				"user.event",
				t("userSpace.fileLabels.event"),
				t("userSpace.fileHelp.event"),
				t("userSpace.fileDetails.event", { returnObjects: true }) as FileHelpDetail,
				"document",
				presentation,
			)
		case "index":
			return createFileHelpPresentation(
				"user.index",
				t("userSpace.fileLabels.index"),
				t("userSpace.fileHelp.index"),
				t("userSpace.fileDetails.index", { returnObjects: true }) as FileHelpDetail,
				"flow",
				presentation,
			)
		case "topics":
			return createFileHelpPresentation(
				"user.topics",
				t("userSpace.fileLabels.topics"),
				t("userSpace.fileHelp.topics"),
				t("userSpace.fileDetails.topics", { returnObjects: true }) as FileHelpDetail,
				"document",
				presentation,
			)
		case "dingtalk":
			return createFileHelpPresentation(
				"user.dingtalk",
				t("userSpace.fileLabels.dingtalk"),
				t("userSpace.fileHelp.dingtalk"),
				t("userSpace.fileDetails.dingtalk", { returnObjects: true }) as FileHelpDetail,
				"flow",
				presentation,
			)
		case "lark":
			return createFileHelpPresentation(
				"user.lark",
				t("userSpace.fileLabels.lark"),
				t("userSpace.fileHelp.lark"),
				t("userSpace.fileDetails.lark", { returnObjects: true }) as FileHelpDetail,
				"flow",
				presentation,
			)
		case "teamshare":
			return createFileHelpPresentation(
				"user.teamshare",
				t("userSpace.fileLabels.teamshare"),
				t("userSpace.fileHelp.teamshare"),
				t("userSpace.fileDetails.teamshare", { returnObjects: true }) as FileHelpDetail,
				"flow",
				presentation,
			)
		case "tools":
			return createFileHelpPresentation(
				"user.tools",
				t("userSpace.fileLabels.tools"),
				t("userSpace.fileHelp.tools"),
				t("userSpace.fileDetails.tools", { returnObjects: true }) as FileHelpDetail,
				"tree",
				presentation,
			)
		case "cli":
			return createFileHelpPresentation(
				"user.cli",
				t("userSpace.fileLabels.cli"),
				t("userSpace.fileHelp.cli"),
				t("userSpace.fileDetails.cli", { returnObjects: true }) as FileHelpDetail,
				"flow",
				presentation,
			)
		case "settings":
			return createFileHelpPresentation(
				"user.settings",
				t("userSpace.fileLabels.settings"),
				t("userSpace.fileHelp.settings"),
				t("userSpace.fileDetails.settings", { returnObjects: true }) as FileHelpDetail,
				"document",
				presentation,
			)
	}
}
