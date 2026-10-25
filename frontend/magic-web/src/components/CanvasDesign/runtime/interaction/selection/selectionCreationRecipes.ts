import type { ImageModelItem } from "../../../public/magic-types"
import type { Canvas } from "../../core/Canvas"
import type { SelectionContentSnapshot } from "./selectionContentCollector"
import {
	createStoryboardFromSelection,
	getStoryboardSelectionCreateSize,
} from "../connection/selectionStoryboardCreation"
import {
	createVideoEditFromSelection,
	getVideoEditSelectionCreateSize,
} from "../connection/selectionVideoEditCreation"

export interface SelectionCreateContext {
	canvas: Canvas
	snapshot: SelectionContentSnapshot
	imageModelList: ImageModelItem[]
	originSide: "left" | "right"
	x: number
	y: number
}

export interface SelectionCreateRecipe {
	id: string
	label: string
	fallbackLabel: string
	icon: "film" | "workflow"
	supportedSides: Array<"left" | "right">
	match: (snapshot: SelectionContentSnapshot) => boolean
	/** 菜单需要在创建前计算落点，因此尺寸也由 Recipe 自己声明。 */
	getSize: () => { width: number; height: number }
	create: (context: SelectionCreateContext) => string | null
}

const VIDEO_EDIT_RECIPE: SelectionCreateRecipe = {
	id: "video-edit",
	label: "videoEditNode.mergeVideos",
	fallbackLabel: "合并视频",
	icon: "film",
	supportedSides: ["right"],
	match: (snapshot) => snapshot.allRootsCanConnect && snapshot.videoSequence.length >= 2,
	getSize: getVideoEditSelectionCreateSize,
	create: createVideoEditFromSelection,
}

const STORYBOARD_RECIPE: SelectionCreateRecipe = {
	id: "storyboard",
	label: "storyboard.menuName",
	fallbackLabel: "制作分镜",
	icon: "workflow",
	supportedSides: ["right"],
	match: (snapshot) => snapshot.allRootsCanConnect && snapshot.imageSequence.length >= 1,
	getSize: getStoryboardSelectionCreateSize,
	create: createStoryboardFromSelection,
}

export const SELECTION_CREATE_RECIPES: readonly SelectionCreateRecipe[] = [
	VIDEO_EDIT_RECIPE,
	STORYBOARD_RECIPE,
]

export function getSelectionCreateRecipes(
	snapshot: SelectionContentSnapshot,
	originSide?: "left" | "right",
): SelectionCreateRecipe[] {
	return SELECTION_CREATE_RECIPES.filter(
		(recipe) =>
			(!originSide || recipe.supportedSides.includes(originSide)) && recipe.match(snapshot),
	)
}
