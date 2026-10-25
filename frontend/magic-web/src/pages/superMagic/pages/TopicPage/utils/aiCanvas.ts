import i18next from "i18next"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import type { MentionListItem } from "@/components/business/MentionPanel/tiptap-plugin/types"
import { getFolderMentionData } from "@/components/business/MentionPanel/utils/directoryMention"
import { normalizeProjectReferencePath } from "@/components/business/MentionPanel/utils/projectReferenceMention"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import {
	createDesignProjectFiles,
	type CreatedDesignProjectFiles,
} from "@/pages/superMagic/components/Detail/contents/Design/utils/designProjectCreation"
import { DESIGN_PROJECT_OVERLAY_TTL_MS } from "@/stores/projectFiles/optimisticDesignProjects"

function getCreatedTime(item: AttachmentItem): number {
	const time = Date.parse(String(item.created_at ?? ""))
	return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time
}

/**
 * Picks the canvas an AI canvas project shows.
 *
 * Only root-level canvas folders count, so a canvas nested elsewhere by the user or the agent
 * never replaces the default one. With several root canvases the earliest created wins; items
 * without a creation time keep their tree order behind dated ones.
 */
export function findAiCanvasFolder(tree: AttachmentItem[]): AttachmentItem | null {
	const canvases = tree.filter(
		(item) => item.is_directory && item.display_config?.type === "design",
	)
	if (canvases.length === 0) return null
	return canvases.reduce((earliest, item) =>
		getCreatedTime(item) < getCreatedTime(earliest) ? item : earliest,
	)
}

/** Builds the same folder mention a user gets by @-referencing the canvas folder. */
export function buildAiCanvasMention(folder: {
	file_id?: string
	name?: string
	file_name?: string
	relative_file_path?: string
	display_config?: unknown
}): MentionListItem {
	const directoryName = folder.file_name || folder.name || ""
	return {
		type: "mention",
		attrs: {
			type: MentionItemType.FOLDER,
			data: getFolderMentionData({
				directoryId: folder.file_id,
				directoryName,
				directoryPath: normalizeProjectReferencePath(
					folder.relative_file_path || directoryName,
				),
				directoryMetadata: folder.display_config ?? { type: "design" },
			}),
		},
	}
}

/**
 * Default name of a new AI canvas project and of its canvas folder ("Untitled canvas"): the two
 * start equal and the canvas then follows project renames (useAiCanvasDocument). Reads the lazily
 * loaded `aiCanvas` namespace; callers outside the AI canvas home load it first (see
 * createAiCanvasDocument).
 */
export function getAiCanvasDefaultFolderName(): string {
	return i18next.t("home.untitled", { ns: "aiCanvas" })
}

/**
 * Canvas folder name that follows the project name, or null while the project has no name yet
 * (the canvas then keeps its default name). Path separators cannot appear in a folder name, so
 * they become dashes.
 */
export function resolveAiCanvasFolderName(projectName?: string | null): string | null {
	const name = (projectName ?? "").trim().replace(/[\\/]+/g, "-")
	return name || null
}

export interface RecentAiCanvasDocument {
	folderId: string
	configFileId: string
	folderName: string
	createdAt: number
}

/**
 * Canvases created in this session, by project id. The backend marks a folder as a canvas
 * (display_config.type "design") asynchronously after its config file is saved, so the project
 * page opened right after creation can load a tree where the new folder still looks plain. It
 * reads this record to recognize the canvas instead of creating a second "Untitled canvas", which
 * the backend rejects as a duplicate name. Entries expire with the optimistic design overlay.
 */
const recentAiCanvasDocuments = new Map<string, RecentAiCanvasDocument>()

export function getRecentAiCanvasDocument(
	projectId: string,
	now = Date.now(),
): RecentAiCanvasDocument | null {
	const entry = recentAiCanvasDocuments.get(projectId)
	if (!entry) return null
	if (now - entry.createdAt > DESIGN_PROJECT_OVERLAY_TTL_MS) {
		recentAiCanvasDocuments.delete(projectId)
		return null
	}
	return entry
}

/** Creates the default root canvas of an AI canvas project with the shared canvas writer. */
export async function createAiCanvasDocument(
	projectId: string,
): Promise<CreatedDesignProjectFiles> {
	// The project page can create the canvas before anything loaded the aiCanvas copy.
	await i18next.loadNamespaces("aiCanvas")
	const folderName = getAiCanvasDefaultFolderName()
	const created = await createDesignProjectFiles({ projectId, folderName })
	recentAiCanvasDocuments.set(projectId, {
		folderId: String(created.folder.file_id),
		configFileId: String(created.magicProjectFile.file_id),
		folderName,
		createdAt: Date.now(),
	})
	return created
}
