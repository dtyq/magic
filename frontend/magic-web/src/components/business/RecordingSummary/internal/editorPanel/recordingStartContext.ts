import type { ModelItem } from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/types"
import type { ProjectListItem, Topic, Workspace } from "@/pages/superMagic/pages/Workspace/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"

export interface RecordingStartContext {
	workspace: Workspace | null
	project: ProjectListItem | null
	topic: Topic | null
	model: ModelItem | null
}

function belongsToWorkspace(
	project: ProjectListItem | null | undefined,
	workspace: Workspace | null | undefined,
): project is ProjectListItem {
	return Boolean(project?.id && workspace?.id && project.workspace_id === workspace.id)
}

function belongsToProject(
	topic: Topic | null | undefined,
	project: ProjectListItem | null | undefined,
): topic is Topic {
	return Boolean(topic?.id && project?.id && topic.project_id === project.id)
}

/** Homepage starts use the current editor selection only. Do not stitch
 * workspace/project/topic/model from an active recording snapshot. */
export function resolveRecordingStartContext({
	selectedWorkspace,
	selectedProject,
	selectedTopic,
	selectedModel,
}: {
	selectedWorkspace?: Workspace | null
	selectedProject?: ProjectListItem | null
	selectedTopic?: Topic | null
	selectedModel?: ModelItem | null
	activeWorkspace?: Workspace | null
	activeProject?: ProjectListItem | null
	activeTopic?: Topic | null
	activeModel?: ModelItem | null
}): RecordingStartContext {
	const workspace = selectedWorkspace ?? null
	const project = belongsToWorkspace(selectedProject, workspace) ? selectedProject : null
	const topic = belongsToProject(selectedTopic, project) ? selectedTopic : null

	return {
		workspace,
		project,
		topic,
		model: selectedModel ?? null,
	}
}

export type HomepageRecordingStartBlocker = "missingWorkspace" | "missingModel"

/** Why a homepage start must not replace an existing recording. */
export function getHomepageRecordingStartBlocker(
	context: RecordingStartContext,
): HomepageRecordingStartBlocker | null {
	if (!context.workspace?.id) return "missingWorkspace"
	if (!context.model?.model_id) return "missingModel"
	return null
}

/**
 * An existing project always gets a record-summary topic. A homepage start with no
 * project uses the caller's topic mode so the new project stays a recording project.
 */
export function resolveEnsuredRecordingTopicMode({
	hasProject,
	recordingNewProjectTopicMode,
	fallbackTopicMode,
}: {
	hasProject: boolean
	recordingNewProjectTopicMode?: TopicMode
	fallbackTopicMode: TopicMode
}): TopicMode {
	if (hasProject) return TopicMode.RecordSummary
	return recordingNewProjectTopicMode ?? fallbackTopicMode
}

/** Homepage recording requires a selected workspace and model. */
export function isHomepageRecordingStartReady(context: RecordingStartContext): boolean {
	return getHomepageRecordingStartBlocker(context) === null
}

/** Resolve the homepage "select project" destination before any override. */
export async function resolveSelectedProjectStartContext({
	openSelector,
	selectedModel,
}: {
	openSelector: () => Promise<{
		project: ProjectListItem | null
		workspace: Workspace | null
	}>
	selectedModel?: ModelItem | null
}): Promise<RecordingStartContext | null> {
	try {
		const selection = await openSelector()
		const startContext = resolveRecordingStartContext({
			selectedWorkspace: selection.workspace,
			selectedProject: selection.project,
			selectedTopic: null,
			selectedModel,
		})
		if (!isHomepageRecordingStartReady(startContext)) return null
		return startContext
	} catch {
		return null
	}
}
