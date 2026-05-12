export function clonePosterCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
	const c = document.createElement("canvas")
	c.width = source.width
	c.height = source.height
	const ctx = c.getContext("2d")
	if (ctx) {
		ctx.drawImage(source, 0, 0)
	}
	return c
}
