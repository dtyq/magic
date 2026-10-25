import { describe, expect, it, vi } from "vitest"
import type { VideoModelItem } from "../../../../public/magic-types"
import type { Canvas } from "../../../core/Canvas"
import { getConnectionMenuActionRecipes } from "../connectionMenuActionRecipes"
import type { SelectionContentSnapshot } from "../selectionContentCollector"

function snapshot(mainVideoSequence: string[]): SelectionContentSnapshot {
	return {
		rootElementIds: ["root-1"],
		items: [],
		imageSequence: [],
		videoSequence: mainVideoSequence,
		mainVideoSequence,
		audioSequence: [],
		counts: { image: 0, video: mainVideoSequence.length, audio: 0, text: 0 },
		boundingRect: { x: 0, y: 0, width: 200, height: 100 },
		selectionRevision: "root-1",
		allRootsCanConnect: true,
	}
}

function canvas(): Canvas {
	return {
		magicConfigManager: {
			config: {
				methods: {
					getRootStorage: vi.fn(() => ({
						defaultGenerateVideoConfig: { model_id: "model-1" },
					})),
				},
			},
		},
	} as unknown as Canvas
}

const frameModel: VideoModelItem = {
	id: "model-1",
	group_id: "group-1",
	model_id: "model-1",
	model_name: "Keyframe",
	provider_model_id: "provider-model-1",
	model_description: "",
	model_icon: "",
	model_status: "normal",
	sort: 0,
	video_generation_config: {
		input_modes: {
			keyframe_guided: {
				supported_fields: ["frames"],
				frame_roles: ["start"],
			},
		},
	},
}

describe("connection menu action recipes", () => {
	it("offers single and batch continuation labels only on the right", () => {
		const currentCanvas = canvas()
		const single = getConnectionMenuActionRecipes({
			canvas: currentCanvas,
			snapshot: snapshot(["video-1"]),
			originSide: "right",
			originKind: "selection",
			videoModelList: [frameModel],
		})
		const batch = getConnectionMenuActionRecipes({
			canvas: currentCanvas,
			snapshot: snapshot(["video-1", "video-2"]),
			originSide: "right",
			originKind: "selection",
			videoModelList: [frameModel],
		})

		expect(single[0]?.getLabel(snapshot(["video-1"]))).toEqual({
			key: "videoContinuation.menu",
			fallback: "续写视频",
		})
		expect(batch[0]?.getLabel(snapshot(["video-1", "video-2"]))).toEqual({
			key: "videoContinuation.batchMenu",
			fallback: "批量续写视频",
		})
		expect(
			getConnectionMenuActionRecipes({
				canvas: currentCanvas,
				snapshot: snapshot(["video-1"]),
				originSide: "left",
				originKind: "selection",
				videoModelList: [frameModel],
			}),
		).toEqual([])
	})

	it("hides continuation when no model supports the start frame", () => {
		const currentCanvas = canvas()
		expect(
			getConnectionMenuActionRecipes({
				canvas: currentCanvas,
				snapshot: snapshot(["video-1"]),
				originSide: "right",
				originKind: "selection",
				videoModelList: [
					{
						...frameModel,
						video_generation_config: {
							input_modes: { standard: { supported_fields: [] } },
						},
					},
				],
			}),
		).toEqual([])
	})
})
