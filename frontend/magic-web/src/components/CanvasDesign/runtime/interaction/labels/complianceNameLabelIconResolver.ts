import Konva from "konva"
import type { NameLabelIconResolver } from "./nameLabelTypes"

const LABEL_ICON_SIZE = 16
const ICON_VIEWBOX_SIZE = 24
const ICON_STROKE_WIDTH = 2
const LABEL_ICON_COLOR = "#737373"
const COMPLIANCE_PASS_ICON_COLOR = "#2563eb"
const COMPLIANCE_FAILED_ICON_COLOR = "#dc2626"

const SHIELD_CHECK_PATHS = [
	"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
	"m9 12 2 2 4-4",
]

const SHIELD_ALERT_PATHS = ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", "M12 8v4", "M12 16h.01"]

const ASSET_LIBRARY_PATH =
	"M879.709091 367.709091c0-74.472727-60.509091-134.981818-134.981818-134.981818h-228.072728l-79.127272-111.709091c-9.309091-9.309091-18.618182-18.618182-32.581818-18.618182h-214.109091c-74.472727 0-134.981818 60.509091-134.981819 134.981818v549.236364c0 74.472727 60.509091 134.981818 134.981819 134.981818h581.818181c60.509091 0 111.709091-41.890909 125.672728-97.745455l69.818182-293.236363c4.654545-13.963636 4.654545-23.272727 4.654545-37.236364 0-55.854545-37.236364-111.709091-93.090909-125.672727z m-749.381818 232.727273v-363.054546c0-32.581818 27.927273-60.509091 60.509091-60.509091h190.836363l83.781818 111.709091c9.309091 13.963636 23.272727 18.618182 37.236364 18.618182h242.036364c32.581818 0 60.509091 23.272727 60.509091 55.854545h-512c-65.163636 0-116.363636 46.545455-130.327273 107.054546l-32.581818 130.327273z m768-83.781819l-74.472728 283.927273v4.654546c0 4.654545 0 4.654545-4.654545 9.309091s-4.654545 9.309091-9.309091 13.963636c-9.309091 9.309091-27.927273 13.963636-41.890909 13.963636h-539.927273c-32.581818 0-60.509091-27.927273-60.509091-60.509091v-13.963636l69.818182-283.927273c4.654545-27.927273 32.581818-46.545455 60.509091-46.545454h544.581818c32.581818 0 60.509091 27.927273 60.509091 60.509091 0 4.654545 0 9.309091-4.654545 18.618181z"
const ASSET_LIBRARY_VIEWBOX_SIZE = 1024

function createIcon(paths: string[], color = LABEL_ICON_COLOR): Konva.Group {
	const scale = LABEL_ICON_SIZE / ICON_VIEWBOX_SIZE
	const group = new Konva.Group({
		width: LABEL_ICON_SIZE,
		height: LABEL_ICON_SIZE,
		listening: false,
	})

	for (const data of paths) {
		group.add(
			new Konva.Path({
				data,
				scaleX: scale,
				scaleY: scale,
				stroke: color,
				strokeWidth: ICON_STROKE_WIDTH,
				lineCap: "round",
				lineJoin: "round",
				fillEnabled: false,
				listening: false,
			}),
		)
	}

	return group
}

function createFillIcon(
	path: string,
	color = LABEL_ICON_COLOR,
	viewboxSize = ASSET_LIBRARY_VIEWBOX_SIZE,
): Konva.Group {
	const scale = LABEL_ICON_SIZE / viewboxSize
	const group = new Konva.Group({
		width: LABEL_ICON_SIZE,
		height: LABEL_ICON_SIZE,
		listening: false,
	})

	group.add(
		new Konva.Path({
			data: path,
			scaleX: scale,
			scaleY: scale,
			fill: color,
			strokeEnabled: false,
			listening: false,
		}),
	)

	return group
}

/** Default CanvasDesign resolver for the shared asset/compliance indicators. */
export const complianceNameLabelIconResolver: NameLabelIconResolver = (context) => {
	if (!context.element.canvas.isSeedanceComplianceEnabled()) {
		if (context.isAssetLibrary) {
			return {
				key: "asset-library",
				width: LABEL_ICON_SIZE,
				height: LABEL_ICON_SIZE,
				create: () => createFillIcon(ASSET_LIBRARY_PATH),
			}
		}
		return null
	}

	if (context.complianceStatus === "PROCESSING") {
		return {
			key: "compliance-processing",
			width: LABEL_ICON_SIZE,
			height: LABEL_ICON_SIZE,
			create: () => createIcon(SHIELD_CHECK_PATHS),
		}
	}

	if (context.complianceStatus === "PASS") {
		return {
			key: "compliance-pass",
			width: LABEL_ICON_SIZE,
			height: LABEL_ICON_SIZE,
			create: () => createIcon(SHIELD_CHECK_PATHS, COMPLIANCE_PASS_ICON_COLOR),
		}
	}

	if (context.complianceStatus === "FAILED") {
		return {
			key: "compliance-failed",
			width: LABEL_ICON_SIZE,
			height: LABEL_ICON_SIZE,
			create: () => createIcon(SHIELD_ALERT_PATHS, COMPLIANCE_FAILED_ICON_COLOR),
		}
	}

	if (context.isAssetLibrary) {
		return {
			key: "asset-library",
			width: LABEL_ICON_SIZE,
			height: LABEL_ICON_SIZE,
			create: () => createFillIcon(ASSET_LIBRARY_PATH),
		}
	}

	return null
}
