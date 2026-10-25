import type { VideoModelItem } from "../../../public/magic-types"
import type { Canvas } from "../../core/Canvas"
import {
	canCreateBatchImageVideos,
	createBatchImageVideos,
} from "../connection/imageVideoBatchCreation"
import { resolveVideoContinuationModel } from "../video-continuation/videoContinuationModel"
import {
	collectSelectionContentSnapshot,
	type SelectionContentSnapshot,
} from "./selectionContentCollector"

export interface ConnectionMenuActionContext {
	canvas: Canvas
	snapshot: SelectionContentSnapshot
	originSide: "left" | "right"
	originKind: "element" | "selection"
	videoModelList: VideoModelItem[]
}

export interface ConnectionMenuActionRecipe {
	id: string
	supportedSides: Array<"left" | "right">
	getLabel: (snapshot: SelectionContentSnapshot) => { key: string; fallback: string }
	match: (context: ConnectionMenuActionContext) => boolean
	execute: (context: ConnectionMenuActionContext) => Promise<void>
}

const VIDEO_CONTINUATION_RECIPE: ConnectionMenuActionRecipe = {
	id: "video-continuation",
	supportedSides: ["right"],
	getLabel: (snapshot) =>
		snapshot.mainVideoSequence.length > 1
			? { key: "videoContinuation.batchMenu", fallback: "批量续写视频" }
			: { key: "videoContinuation.menu", fallback: "续写视频" },
	match: ({ canvas, snapshot, videoModelList }) =>
		snapshot.allRootsCanConnect &&
		snapshot.mainVideoSequence.length > 0 &&
		Boolean(resolveVideoContinuationModel(canvas, videoModelList)),
	execute: async ({ canvas, snapshot, videoModelList }) => {
		await canvas.videoContinuationManager.continueVideos({
			sourceVideoIds: snapshot.mainVideoSequence,
			videoModelList,
		})
	},
}

const BATCH_IMAGE_TO_VIDEO_RECIPE: ConnectionMenuActionRecipe = {
	id: "batch-image-to-video",
	supportedSides: ["right"],
	getLabel: () => ({
		key: "imageToVideo.batchMenu",
		fallback: "批量图片生成视频",
	}),
	// 仅多选入口；Frame 右侧走「制作分镜视频」，避免两个动作叠在同一菜单。
	match: ({ canvas, snapshot, originKind, videoModelList }) =>
		originKind === "selection" && canCreateBatchImageVideos(canvas, snapshot, videoModelList),
	execute: async ({ canvas, snapshot, videoModelList }) => {
		// 点击时重新收集图片，避免依赖菜单打开时的旧快照
		const freshSnapshot = collectSelectionContentSnapshot(
			canvas,
			snapshot.rootElementIds,
			snapshot.boundingRect,
		)
		createBatchImageVideos({
			canvas,
			snapshot: freshSnapshot,
			videoModelList,
		})
	},
}

const CONNECTION_MENU_ACTION_RECIPES: readonly ConnectionMenuActionRecipe[] = [
	VIDEO_CONTINUATION_RECIPE,
	BATCH_IMAGE_TO_VIDEO_RECIPE,
]

export function getConnectionMenuActionRecipes(
	context: ConnectionMenuActionContext,
): ConnectionMenuActionRecipe[] {
	return CONNECTION_MENU_ACTION_RECIPES.filter(
		(recipe) => recipe.supportedSides.includes(context.originSide) && recipe.match(context),
	)
}
