import i18next from "i18next"
import { TopicMode } from "../pages/Workspace/TopicMode"
import type { ProjectListItem } from "../pages/Workspace/types"

/** AI canvas projects live in the ai-canvas workspace and render the canvas-only project layout. */
export function isAiCanvasProject(project?: Pick<ProjectListItem, "project_mode"> | null): boolean {
	return project?.project_mode === TopicMode.AiCanvas
}

/**
 * Default names a new AI canvas project is saved with ("home.untitled" of the aiCanvas namespace)
 * in each shipped language. The name is stored in the creator's language, so it is matched against
 * all of them, not only the current one, whose namespace may not even be loaded here.
 */
const AI_CANVAS_DEFAULT_PROJECT_NAMES = ["未命名画布", "Untitled canvas"]

/**
 * Whether an AI canvas project still carries its default name, i.e. nobody has named it yet.
 * Such projects take their first topic's generated name, like unnamed ordinary projects.
 */
export function hasAiCanvasDefaultName(
	project?: Pick<ProjectListItem, "project_mode" | "project_name"> | null,
): boolean {
	if (!isAiCanvasProject(project)) return false
	const name = (project?.project_name ?? "").trim()
	if (!name) return true
	const current = i18next.t("home.untitled", { ns: "aiCanvas" })
	return name === current || AI_CANVAS_DEFAULT_PROJECT_NAMES.includes(name)
}
