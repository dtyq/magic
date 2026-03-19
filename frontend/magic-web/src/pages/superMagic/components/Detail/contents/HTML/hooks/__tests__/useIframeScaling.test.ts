import { renderHook } from "@testing-library/react"
import { useIframeScaling } from "../useIframeScaling"
import { createRef } from "react"

describe("useIframeScaling", () => {
	it("should return default values when not in PPT mode", () => {
		const containerRef = createRef<HTMLDivElement>()
		const iframeRef = createRef<HTMLIFrameElement>()

		const { result } = renderHook(() =>
			useIframeScaling({
				containerRef,
				iframeRef,
				isPptRender: false,
			}),
		)

		expect(result.current.scaleRatio).toBe(1)
		expect(result.current.verticalOffset).toBe(0)
		expect(result.current.horizontalOffset).toBe(0)
		expect(result.current.contentWidth).toBe(1920)
		expect(result.current.contentHeight).toBe(1080)
	})
})
