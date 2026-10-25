import type { EraserStroke } from "../../interaction/eraser/EraserRenderer"
import {
	encodeEraserStrokeMode,
	type FlattenedEraserStrokes,
} from "../upload/submitImageWorkerProtocol"

export function flattenEraserStrokes(strokes: EraserStroke[]): FlattenedEraserStrokes {
	const meta = new Uint32Array(strokes.length * 3)
	const modes = new Uint8Array(strokes.length)
	let totalPoints = 0

	strokes.forEach((stroke, index) => {
		const pointOffset = totalPoints
		const pointCount = stroke.points.length
		const metaOffset = index * 3

		meta[metaOffset] = pointOffset
		meta[metaOffset + 1] = pointCount
		meta[metaOffset + 2] = Math.max(0, Math.round(stroke.radius))
		modes[index] = encodeEraserStrokeMode(stroke.mode)

		totalPoints += pointCount
	})

	const points = new Float32Array(totalPoints * 2)
	let pointCursor = 0

	strokes.forEach((stroke) => {
		stroke.points.forEach((point) => {
			points[pointCursor] = point.x
			points[pointCursor + 1] = point.y
			pointCursor += 2
		})
	})

	return { meta, modes, points }
}
