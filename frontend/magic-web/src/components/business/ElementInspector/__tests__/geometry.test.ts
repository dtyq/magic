import { describe, expect, it } from "vitest"

import {
	fromInspectorOverlayRect,
	toInspectorOverlayRect,
	toInspectorOverlayVisualRect,
} from "../geometry"

describe("ElementInspector overlay geometry", () => {
	it("does not apply the phone-shell scale twice", () => {
		const scale = 0.8738636
		const rect = toInspectorOverlayRect(
			{ top: 339.5, left: 40, width: 321, height: 43 },
			{
				iframeRect: {
					top: 192.9273,
					left: 648.181,
					width: 350.4193115234375,
					height: 686.8568115234375,
				},
				iframeSize: { width: 401, height: 786 },
				containerRect: {
					top: 192.9273,
					left: 648.181,
					width: 350.4193115234375,
					height: 686.8568115234375,
				},
				containerSize: { width: 401, height: 786 },
				fallbackScale: scale,
			},
		)

		expect(rect).toEqual({ top: 339.5, left: 40, width: 321, height: 43 })
	})

	it("applies an iframe-only scale in overlay coordinates", () => {
		const rect = toInspectorOverlayRect(
			{ top: 120, left: 40, width: 320, height: 44 },
			{
				iframeRect: { top: 20, left: 30, width: 200, height: 400 },
				iframeSize: { width: 400, height: 800 },
				containerRect: { top: 0, left: 0, width: 500, height: 900 },
				containerSize: { width: 500, height: 900 },
				fallbackScale: 1,
			},
		)

		expect(rect).toEqual({ top: 80, left: 50, width: 160, height: 22 })
	})

	it("converts the iframe offset into the scaled container coordinates", () => {
		const rect = toInspectorOverlayRect(
			{ top: 60, left: 40, width: 100, height: 20 },
			{
				iframeRect: { top: 120, left: 130, width: 200, height: 400 },
				iframeSize: { width: 400, height: 800 },
				containerRect: { top: 100, left: 100, width: 250, height: 450 },
				containerSize: { width: 500, height: 900 },
				fallbackScale: 1,
			},
		)

		expect(rect).toEqual({ top: 100, left: 100, width: 100, height: 20 })
	})

	it("uses the fallback scale when layout dimensions are unavailable", () => {
		const rect = toInspectorOverlayRect(
			{ top: 20, left: 10, width: 100, height: 40 },
			{
				iframeRect: { top: 30, left: 40, width: 0, height: 0 },
				iframeSize: { width: 0, height: 0 },
				containerRect: { top: 10, left: 10, width: 0, height: 0 },
				containerSize: { width: 0, height: 0 },
				fallbackScale: 0.75,
			},
		)

		expect(rect).toEqual({ top: 35, left: 37.5, width: 75, height: 30 })
	})

	it("converts a drawn overlay region back to iframe coordinates", () => {
		const geometry = {
			iframeRect: { top: 120, left: 130, width: 200, height: 400 },
			iframeSize: { width: 400, height: 800 },
			containerRect: { top: 100, left: 100, width: 250, height: 450 },
			containerSize: { width: 500, height: 900 },
			fallbackScale: 1,
		}

		expect(
			fromInspectorOverlayRect({ top: 100, left: 100, width: 100, height: 20 }, geometry),
		).toEqual({ top: 60, left: 40, width: 100, height: 20 })
	})

	it("maps the iframe visual bounds without applying the iframe zoom again", () => {
		expect(
			toInspectorOverlayVisualRect(
				{ top: 75, left: 150, width: 600, height: 450 },
				{ top: 0, left: 0, width: 1200, height: 900 },
				{ width: 800, height: 600 },
			),
		).toEqual({ top: 50, left: 100, width: 400, height: 300 })
	})
})
