import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { AttachmentItem } from "../../components/TopicFilesButton/hooks"
import { useSlidesTemplateNavigation } from "../useSlidesTemplateNavigation"

const navigation = vi.hoisted(() => ({ state: null as unknown }))

vi.mock("react-router", () => ({
	useLocation: () => navigation,
}))

function createTemplateRoot(): AttachmentItem {
	return {
		file_id: "template-root",
		is_directory: true,
		file_name: "Quarterly template",
		children: [
			{ file_id: "manifest", file_name: "template.json" },
			{ file_id: "spec", file_name: "visual-spec.md" },
			{ file_id: "theme", file_name: "theme.css" },
			{ file_id: "slides", file_name: "slides", is_directory: true, children: [] },
		],
	}
}

describe("useSlidesTemplateNavigation", () => {
	beforeEach(() => {
		vi.useFakeTimers()
		navigation.state = {
			slidesTemplateProjectId: "project-1",
			slidesTemplateDirectoryId: "template-root",
		}
	})

	afterEach(() => {
		pubsub.clear()
		vi.clearAllTimers()
		vi.useRealTimers()
		navigation.state = null
	})

	it("opens the matching template and publishes its directory location once", () => {
		const openTemplateFile = vi.fn()
		const setUserSelectDetail = vi.fn()
		const locateFile = vi.fn()
		pubsub.subscribe(PubSubEvents.Locate_File_In_Tree, locateFile)

		const { rerender } = renderHook(() =>
			useSlidesTemplateNavigation({
				selectedProjectId: "project-1",
				attachments: [createTemplateRoot()],
				openTemplateFile,
				setUserSelectDetail,
			}),
		)

		expect(openTemplateFile).not.toHaveBeenCalled()

		act(() => {
			vi.advanceTimersByTime(100)
		})

		expect(locateFile).toHaveBeenCalledWith("template-root")
		expect(openTemplateFile).toHaveBeenCalledWith(
			expect.objectContaining({
				file_id: "template-root",
				display_config: { type: "slide-template", source: "project-template" },
			}),
		)
		expect(setUserSelectDetail).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "slides-template",
				currentFileId: "template-root",
			}),
		)

		act(() => rerender())
		expect(openTemplateFile).toHaveBeenCalledTimes(1)
	})

	it("waits when the navigation points to another project", () => {
		const openTemplateFile = vi.fn()

		renderHook(() =>
			useSlidesTemplateNavigation({
				selectedProjectId: "project-2",
				attachments: [createTemplateRoot()],
				openTemplateFile,
				setUserSelectDetail: vi.fn(),
			}),
		)

		act(() => {
			vi.advanceTimersByTime(100)
		})
		expect(openTemplateFile).not.toHaveBeenCalled()
	})
})
