import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ElementToolTypeEnum } from "../../../public/props"
import TopCustomToolRenderer from "./TopCustomToolRenderer"

vi.mock("../components/image/ImageConvertHight/index", () => ({
	default: () => <div data-testid="high-config-panel" />,
}))

vi.mock("../components/image/ImageConvertHightButton/index", () => ({
	default: () => <div data-testid="high-action-button" />,
}))

function createTool(operationId?: string) {
	return {
		id: ElementToolTypeEnum.ContentEnhance,
		execution: "command",
		surface: "top",
		visibility: "visible",
		presentation: { renderKind: "top-custom", group: "image-ai", order: 30 },
		target: { elementId: "image-1", contentId: "content-a", operationId },
	} as never
}

describe("TopCustomToolRenderer", () => {
	it("renders the normal high-resolution action without a tool session", () => {
		render(<TopCustomToolRenderer tool={createTool()} />)

		expect(screen.getByTestId("high-action-button")).toBeInTheDocument()
		expect(screen.queryByTestId("high-config-panel")).not.toBeInTheDocument()
	})

	it("renders the high-resolution configuration panel for an active session", () => {
		render(<TopCustomToolRenderer tool={createTool("operation-1")} />)

		expect(screen.getByTestId("high-config-panel")).toBeInTheDocument()
		expect(screen.queryByTestId("high-action-button")).not.toBeInTheDocument()
	})
})
