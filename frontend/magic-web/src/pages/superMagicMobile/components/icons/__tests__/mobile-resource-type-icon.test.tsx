import { render, screen } from "@testing-library/react"
import { MessageCircle, MessageSquare } from "lucide-react"
import { describe, expect, it } from "vitest"

import {
	getMobileResourceTypeIconConfig,
	MOBILE_RESOURCE_TYPE_ICON_CONFIG,
	MobileResourceTypeIcon,
} from "../mobile-resource-type-icon"

describe("MOBILE_RESOURCE_TYPE_ICON_CONFIG", () => {
	it("aligns workspace with prototype TrashScreen", () => {
		const config = MOBILE_RESOURCE_TYPE_ICON_CONFIG.workspace
		expect(config.boxClass).toBe("bg-icon-workspace/8")
		expect(config.iconClass).toBe("text-icon-workspace")
	})

	it("aligns project with prototype TrashScreen", () => {
		const config = MOBILE_RESOURCE_TYPE_ICON_CONFIG.project
		expect(config.boxClass).toBe("bg-icon-project/8")
		expect(config.iconClass).toBe("text-icon-project")
	})

	it("uses MessageSquare for recycle bin topic entity", () => {
		const config = MOBILE_RESOURCE_TYPE_ICON_CONFIG.topic
		expect(config.Icon).toBe(MessageSquare)
		expect(config.boxClass).toBe("bg-icon-topic/8")
		expect(config.iconClass).toBe("text-icon-topic")
	})

	it("uses MessageCircle for project topic list rows", () => {
		const config = MOBILE_RESOURCE_TYPE_ICON_CONFIG.projectTopic
		expect(config.Icon).toBe(MessageCircle)
		expect(config.boxClass).toBe("bg-icon-topic/8")
		expect(config.iconClass).toBe("text-icon-topic")
	})

	it("aligns conversation with prototype ChatsScreen", () => {
		const config = MOBILE_RESOURCE_TYPE_ICON_CONFIG.conversation
		expect(config.Icon).toBe(MessageCircle)
		expect(config.boxClass).toBe("bg-icon-chat/8")
		expect(config.iconClass).toBe("text-icon-chat")
	})

	it("aligns file with prototype TrashScreen app-cloud tokens", () => {
		const config = MOBILE_RESOURCE_TYPE_ICON_CONFIG.file
		expect(config.boxClass).toBe("bg-icon-app-cloud/8")
		expect(config.iconClass).toBe("text-icon-app-cloud")
	})
})

describe("getMobileResourceTypeIconConfig", () => {
	it("falls back to file config for unknown types", () => {
		expect(getMobileResourceTypeIconConfig("unknown")).toEqual(
			MOBILE_RESOURCE_TYPE_ICON_CONFIG.file,
		)
	})
})

describe("MobileResourceTypeIcon", () => {
	it("renders list-aligned classes for workspace type", () => {
		const { container } = render(<MobileResourceTypeIcon type="workspace" />)
		const cell = container.firstElementChild
		expect(cell?.className).toContain("bg-icon-workspace/8")
		expect(cell?.className).toContain("size-9")
		expect(cell?.className).toContain("rounded-[10px]")
	})

	it("renders loader when isRunning", () => {
		render(
			<MobileResourceTypeIcon
				type="conversation"
				isRunning
				loadingDataTestId="test-loading"
			/>,
		)
		expect(screen.getByTestId("test-loading")).toBeInTheDocument()
	})
})
