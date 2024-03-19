import { type TourProps, Flex } from "antd"
import { GuideTourElementId } from "./GuideTourManager"
import { type TFunction } from "i18next"

/**
 * 工作区引导步骤配置
 */
export function getWorkspaceGuideTourSteps(t: TFunction): TourProps["steps"] {
	return [
		{
			title: t("superMagic.title"),
			description: t("superMagic.description"),
			target: document.getElementById(GuideTourElementId.MessagePanel) || null,
		},
		{
			title: t("agent.title"),
			description: (
				<Flex vertical gap={8}>
					<div>{t("agent.description")}</div>
					<div>
						🌟 <span style={{ fontWeight: 600 }}>{t("agent.generalMode")}</span> -
						{t("agent.generalModeDescription")}
					</div>
					<div>
						💬 <span style={{ fontWeight: 600 }}>{t("agent.chatMode")}</span> -
						{t("agent.chatModeDescription")}
					</div>
					<div>
						📊 <span style={{ fontWeight: 600 }}>{t("agent.dataAnalysis")}</span> -
						{t("agent.dataAnalysisDescription")}
					</div>
					<div>
						📑 <span style={{ fontWeight: 600 }}>{t("agent.sildeMode")}</span> -
						{t("agent.sildeModeDescription")}
					</div>
					<div>
						🎧 <span style={{ fontWeight: 600 }}>{t("agent.summaryMode")}</span> -
						{t("agent.summaryModeDescription")}
					</div>
				</Flex>
			),
			target: document.getElementById(GuideTourElementId.TopicModeTabs) || null,
		},
		{
			title: t("mcp.title"),
			description: t("mcp.description"),
			target: document.getElementById(GuideTourElementId.MCPButton) || null,
		},
		{
			title: t("uploadFile.title"),
			description: t("uploadFile.description"),
			target: document.getElementById(GuideTourElementId.UploadFileButton) || null,
		},
		{
			title: t("voiceInput.title"),
			description: t("voiceInput.description"),
			target: document.getElementById(GuideTourElementId.VoiceInputButton) || null,
		},
		{
			title: t("modelSelector.title"),
			description: t("modelSelector.description"),
			target: document.getElementById(GuideTourElementId.ModelSelector) || null,
		},
		{
			title: t("workspace.title"),
			description: t("workspace.description"),
			target: document.getElementById(GuideTourElementId.WorkspaceBreadcrumb) || null,
		},
	]
}

/**
 * 项目引导步骤配置
 */
export function getProjectGuideTourSteps(t: TFunction): TourProps["steps"] {
	return [
		{
			title: t("projectFile.title"),
			description: t("projectFile.description"),
			target: document.getElementById(GuideTourElementId.ProjectFileSider) || null,
			placement: "right",
		},
		{
			title: t("multiThread.title"),
			description: t("multiThread.description"),
			target: document.getElementById(GuideTourElementId.MessageHeaderTopicGroup) || null,
			placement: "right",
		},
		{
			title: t("atButton.title"),
			description: t("atButton.description"),
			target: document.getElementById(GuideTourElementId.MessageEditorAtButton) || null,
			placement: "right",
		},
	]
}
