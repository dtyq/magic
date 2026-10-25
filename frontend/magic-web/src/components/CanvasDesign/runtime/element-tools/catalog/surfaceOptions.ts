import type { ElementToolIcon, ElementToolSurfaceOptions } from "../model/ElementToolTypes"

export function topAction(group: string, order: number): ElementToolSurfaceOptions {
	return { renderKind: "top-action", group, order }
}

export function topCustom(group: string, order: number): ElementToolSurfaceOptions {
	return { renderKind: "top-custom", group, order }
}

export function bottomAction(
	icon: ElementToolIcon | undefined,
	labelKey: string,
	labelFallback: string,
	group: string,
	order: number,
): ElementToolSurfaceOptions {
	return {
		renderKind: "bottom-action",
		icon,
		labelKey,
		labelFallback,
		group,
		order,
	}
}

export function bottomVersionControls(order: number): ElementToolSurfaceOptions {
	return { renderKind: "bottom-version-controls", group: "versions", order }
}
