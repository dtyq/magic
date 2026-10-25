import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ElementToolTypeEnum } from "../../../../public/props"
import type { ElementToolResolution } from "../../../../runtime/element-tools"
import BottomActionRenderer from "../BottomActionRenderer"

describe("BottomActionRenderer", () => {
	it("renders final resolution and estimated points without a leading action icon", () => {
		const tool: ElementToolResolution = {
			id: ElementToolTypeEnum.GenerationGenerateFinal,
			execution: "command",
			surface: "bottom",
			visibility: "visible",
			presentation: {
				renderKind: "bottom-action",
				group: "generation",
				order: 40,
				labelFallback: "生成正片",
			},
			data: {
				videoGenerationEstimate: { resolution: "1080P", points: 3190 },
			},
			target: { elementId: "video-1", contentId: "draft-content" },
			execute: vi.fn(),
		}

		const [item] = BottomActionRenderer({ tools: [tool], t: vi.fn() })
		render(<>{item?.label}</>)

		expect(item?.icon).toBeUndefined()
		expect(screen.getByText("生成正片")).toBeInTheDocument()
		expect(screen.getByText("1080P")).toBeInTheDocument()
		const pointsLabel = screen.getByText("3190")
		expect(pointsLabel).toBeInTheDocument()
		expect(
			pointsLabel.closest("[data-video-generation-estimate-points]")?.querySelector("svg"),
		).toHaveAttribute("width", "16")
	})
})
