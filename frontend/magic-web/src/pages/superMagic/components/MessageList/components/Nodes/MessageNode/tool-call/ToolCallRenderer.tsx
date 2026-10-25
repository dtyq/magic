import { ToolProgressCard } from "../../ToolCall/tools/ToolProgress/ToolProgress"
import { lazy, Suspense } from "react"
import DefaultTool from "./tools/Default"
import KnowledgeSearchTool from "./tools/KnowledgeSearch"
import WriteFileTool from "./tools/WriteFile"
import { MCPTool } from "./tools/MCP"
import type { ToolCallRendererProps } from "./types"
import { isInlineToolDetail } from "@/pages/superMagic/utils/toolDetailDisplay"
import OperationResultList from "../../shared/OperationResultList"
import FileDownloadCard from "../../shared/FileDownloadCard"

const AskUserToolCall = lazy(() => import("./tools/AskUser"))
const MicroAppPlanToolCall = lazy(() => import("./tools/MicroAppPlan"))
const SubagentsTool = lazy(() => import("./tools/Subagents"))
const StudyProgressTool = lazy(() => import("./tools/PersonaResearch/StudyProgressTool"))
const PersonaChatTool = lazy(() => import("./tools/PersonaResearch/PersonaChatTool"))
const StudyPersonasTool = lazy(() => import("./tools/PersonaResearch/StudyPersonasTool"))

/** AI 研究的专用卡片；三者都能在老消息（Markdown detail）上退回默认卡片 */
const PERSONA_RESEARCH_TOOLS = new Map([
	["update_study", StudyProgressTool],
	["persona_chat", PersonaChatTool],
	["save_personas", StudyPersonasTool],
])

export function ToolCallRenderer({
	toolCall,
	toolData,
	loading,
	classNames,
	selectedTopic,
	isShare,
	onClick,
	onSelectDetail,
	onMouseEnter,
	onMouseLeave,
}: ToolCallRendererProps) {
	if (toolCall.function.name === "create_client_side_file_bundle") {
		return (
			<FileDownloadCard
				toolData={toolData}
				loading={loading}
				className={classNames}
				onMouseEnter={onMouseEnter}
				onMouseLeave={onMouseLeave}
			/>
		)
	}

	if (
		isInlineToolDetail(toolData.detail) ||
		(toolCall.function.name === "web_search" && toolData.detail?.type === "search")
	) {
		return (
			<OperationResultList
				toolData={toolData}
				loading={loading}
				onSelectDetail={onSelectDetail}
				className={classNames}
				onMouseEnter={onMouseEnter}
				onMouseLeave={onMouseLeave}
			/>
		)
	}

	if (
		loading &&
		toolData.detail?.type === "text" &&
		[
			"download_from_urls",
			"audio_understanding",
			"audio_understanding_progress",
			"video_generation_progress",
		].includes(toolData.name || "")
	) {
		return (
			<ToolProgressCard
				tool={toolData}
				onClick={onClick}
				onMouseEnter={onMouseEnter}
				onMouseLeave={onMouseLeave}
			/>
		)
	}

	// MCP uses tool.name for the wrapper protocol while function.name identifies the MCP method.
	if (toolCall.tool?.name === "mcp_tool_call") {
		return (
			<MCPTool
				onClick={onClick}
				toolData={toolData}
				loading={loading}
				classNames={classNames ? { markdown: classNames } : undefined}
				onSelectDetail={onSelectDetail}
				onMouseEnter={onMouseEnter}
				onMouseLeave={onMouseLeave}
			/>
		)
	}

	if (toolCall.function.name === "ask_user") {
		return (
			<Suspense fallback={null}>
				<AskUserToolCall
					toolData={toolData}
					loading={loading}
					classNames={classNames}
					selectedTopic={selectedTopic}
					isShare={isShare}
					onSelectDetail={onSelectDetail}
					onMouseEnter={onMouseEnter}
					onMouseLeave={onMouseLeave}
				/>
			</Suspense>
		)
	}

	if (toolCall.function.name === "micro_app_plan") {
		return (
			<Suspense fallback={null}>
				<MicroAppPlanToolCall
					toolData={toolData}
					loading={loading}
					classNames={classNames}
					selectedTopic={selectedTopic}
					isShare={isShare}
					onSelectDetail={onSelectDetail}
					onMouseEnter={onMouseEnter}
					onMouseLeave={onMouseLeave}
				/>
			</Suspense>
		)
	}

	if (toolCall.function.name === "write_file") {
		return (
			<WriteFileTool
				onClick={onClick}
				toolData={toolData}
				loading={loading}
				classNames={classNames}
				onSelectDetail={onSelectDetail}
				onMouseEnter={onMouseEnter}
				onMouseLeave={onMouseLeave}
			/>
		)
	}

	if (toolCall.function.name === "wait_for_subagents") {
		return (
			<Suspense fallback={null}>
				<SubagentsTool
					onClick={onClick}
					toolData={toolData}
					loading={loading}
					classNames={classNames}
					onMouseEnter={onMouseEnter}
					onMouseLeave={onMouseLeave}
				/>
			</Suspense>
		)
	}

	const ResearchTool = PERSONA_RESEARCH_TOOLS.get(toolCall.function.name)
	if (ResearchTool) {
		return (
			<Suspense fallback={null}>
				<ResearchTool
					onClick={onClick}
					toolData={toolData}
					loading={loading}
					classNames={classNames}
					onMouseEnter={onMouseEnter}
					onMouseLeave={onMouseLeave}
				/>
			</Suspense>
		)
	}

	if (
		toolCall.function.name === "search_knowledge" ||
		toolData.detail?.type === "knowledge_search" ||
		toolData.detail?.data?.type === "knowledge_search"
	) {
		return (
			<KnowledgeSearchTool
				onClick={onClick}
				toolData={toolData}
				loading={loading}
				classNames={classNames}
				onMouseEnter={onMouseEnter}
				onMouseLeave={onMouseLeave}
			/>
		)
	}

	return (
		<DefaultTool
			onClick={onClick}
			toolData={toolData}
			loading={loading}
			classNames={classNames}
			onSelectDetail={onSelectDetail}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
		/>
	)
}
