export function isCanvasZoomWheel(event: Pick<WheelEvent, "ctrlKey" | "metaKey">): boolean {
	return event.ctrlKey || event.metaKey
}

export function shouldForwardWheelToCanvas(
	event: Pick<WheelEvent, "ctrlKey" | "metaKey">,
	localScrollAvailable: boolean,
): boolean {
	return isCanvasZoomWheel(event) || !localScrollAvailable
}
