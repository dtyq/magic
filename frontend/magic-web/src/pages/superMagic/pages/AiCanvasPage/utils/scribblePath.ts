type Point = [number, number]

/** A cubic Bézier segment: two control points, then the end point. */
export type CubicSegment = [Point, Point, Point]

export interface Scribble {
	start: Point
	segments: CubicSegment[]
}

interface TaperOptions {
	/** Stroke width where the pen lands. */
	startWidth: number
	/** Stroke width where the pen lifts. */
	endWidth: number
	/** Samples per segment; more samples give smoother edges. */
	samplesPerSegment?: number
}

function cubicPoint(p0: Point, [p1, p2, p3]: CubicSegment, t: number): Point {
	const u = 1 - t
	const a = u * u * u
	const b = 3 * u * u * t
	const c = 3 * u * t * t
	const d = t * t * t
	return [
		a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
		a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
	]
}

function format(value: number) {
	return Number(value.toFixed(2))
}

/** Centerline as SVG path data, used to drive the drawing mask. */
export function scribbleToPathData({ start, segments }: Scribble) {
	return [
		`M${start[0]} ${start[1]}`,
		...segments.map(([c1, c2, end]) => `C${c1.join(" ")} ${c2.join(" ")} ${end.join(" ")}`),
	].join(" ")
}

/**
 * Outline of the scribble as a filled shape whose width shrinks linearly from `startWidth` to
 * `endWidth` along its length, so it reads like a pen stroke that lifts off the paper. SVG
 * strokes have one fixed width, hence the shape: it offsets sampled centerline points along
 * their normals and joins both sides, with a round cap where the pen lands.
 */
export function buildTaperedOutline(
	{ start, segments }: Scribble,
	{ startWidth, endWidth, samplesPerSegment = 24 }: TaperOptions,
) {
	const points: Point[] = [start]
	let segmentStart = start
	for (const segment of segments) {
		for (let step = 1; step <= samplesPerSegment; step += 1) {
			points.push(cubicPoint(segmentStart, segment, step / samplesPerSegment))
		}
		segmentStart = segment[2]
	}

	const distances = [0]
	for (let index = 1; index < points.length; index += 1) {
		const [x0, y0] = points[index - 1]
		const [x1, y1] = points[index]
		distances.push(distances[index - 1] + Math.hypot(x1 - x0, y1 - y0))
	}
	const total = distances[distances.length - 1] || 1

	const left: Point[] = []
	const right: Point[] = []
	points.forEach(([x, y], index) => {
		const [px, py] = points[Math.max(0, index - 1)]
		const [nx, ny] = points[Math.min(points.length - 1, index + 1)]
		const length = Math.hypot(nx - px, ny - py) || 1
		const half = (startWidth + (endWidth - startWidth) * (distances[index] / total)) / 2
		const offsetX = (-(ny - py) / length) * half
		const offsetY = ((nx - px) / length) * half
		left.push([x + offsetX, y + offsetY])
		right.push([x - offsetX, y - offsetY])
	})

	const capRadius = format(startWidth / 2)
	const line = (point: Point) => `L${format(point[0])} ${format(point[1])}`
	return [
		`M${format(right[0][0])} ${format(right[0][1])}`,
		`A${capRadius} ${capRadius} 0 0 0 ${format(left[0][0])} ${format(left[0][1])}`,
		...left.slice(1).map(line),
		...right.reverse().map(line),
		"Z",
	].join(" ")
}
