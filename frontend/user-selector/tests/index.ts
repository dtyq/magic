import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
	value: () => {
		return {
			fillStyle: "",
			textAlign: "center",
			textBaseline: "middle",
			font: "",
			shadowColor: "",
			shadowBlur: 0,
			shadowOffsetX: 0,
			shadowOffsetY: 0,
			fillRect: () => {},
			fillText: () => {},
		}
	},
})

Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
	value: () => "data:image/png;base64,mock",
})

afterEach(() => {
	cleanup()
})
