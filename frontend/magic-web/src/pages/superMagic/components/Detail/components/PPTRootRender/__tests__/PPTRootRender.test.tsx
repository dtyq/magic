import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
import PPTRootRender from "../index"

const mockState = vi.hoisted(() => ({
	useFileData: vi.fn(),
	processHtmlContent: vi.fn(),
	getFileContentById: vi.fn(),
}))

vi.mock("ahooks", async () => {
	const React = await import("react")
	return {
		useDeepCompareEffect: React.useEffect,
		useMemoizedFn: <T extends (...args: never[]) => unknown>(fn: T) => fn,
	}
})

vi.mock("antd", () => ({
	Flex: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/base/MagicSpin", () => ({
	default: () => <div data-testid="magic-spin" />,
}))

vi.mock("@/lib/utils", () => ({
	cn: (...classNames: Array<string | false | null | undefined>) =>
		classNames.filter(Boolean).join(" "),
}))

vi.mock("@/pages/superMagic/hooks/useFileData", () => ({
	useFileData: mockState.useFileData,
}))

vi.mock("@/pages/superMagic/utils/api", () => ({
	getFileContentById: mockState.getFileContentById,
}))

vi.mock("../../../contents/HTML/htmlProcessor", () => ({
	processHtmlContent: mockState.processHtmlContent,
}))

vi.mock("../../../contents/HTML/utils/fetchInterceptor", () => ({
	createParentMessageHandler: () => () => undefined,
}))

vi.mock("../../PPTRender", () => ({
	default: ({
		slidePaths,
		onSortSave,
	}: {
		slidePaths?: string[]
		onSortSave?: (slidePaths: string[]) => void
	}) => (
		<div data-testid="ppt-render" data-slide-paths={JSON.stringify(slidePaths || [])}>
			<button
				type="button"
				data-testid="local-insert"
				onClick={() =>
					onSortSave?.([
						"slides/slide-1.html",
						"slides/new-slide.html",
						"slides/slide-2.html",
					])
				}
			/>
		</div>
	),
}))

function createDeckFiles(magicUpdatedAt: string) {
	return [
		{
			file_id: "index-file",
			file_name: "index.html",
			relative_file_path: "deck/index.html",
			parent_id: "deck",
		},
		{
			file_id: "magic-project-file",
			file_name: "magic.project.js",
			relative_file_path: "deck/magic.project.js",
			parent_id: "deck",
			updated_at: magicUpdatedAt,
		},
	]
}

function renderRoot(magicUpdatedAt: string, slides = ["slides/slide-1.html"]) {
	const attachmentList = createDeckFiles(magicUpdatedAt)

	return render(
		<PPTRootRender
			data={{
				file_id: "index-file",
				file_name: "index.html",
			}}
			attachmentList={attachmentList}
			attachments={attachmentList}
			displayConfig={{
				type: "slide",
				slides,
			}}
			activeFileId="index-file"
		/>,
	)
}

describe("PPTRootRender", () => {
	beforeEach(() => {
		mockState.useFileData.mockReturnValue({
			fileData: "<html></html>",
			loading: false,
		})
		mockState.processHtmlContent.mockResolvedValue({
			filePathMapping: new Map(),
			originalSlidesPaths: ["slides/slide-1.html"],
		})
		mockState.getFileContentById.mockReset()
	})

	it("keeps PPTRender mounted while magic.project.js reloads in the background", async () => {
		const pendingReload = new Promise<string>(() => undefined)

		mockState.getFileContentById
			.mockResolvedValueOnce(
				"window.magicProjectConfig = { slides: ['slides/slide-1.html'] }",
			)
			.mockReturnValueOnce(pendingReload)

		const { rerender } = renderRoot("1")

		await waitFor(() => {
			expect(screen.queryByTestId("ppt-render")).not.toBeNull()
		})

		const updatedAttachmentList = createDeckFiles("2")
		rerender(
			<PPTRootRender
				data={{
					file_id: "index-file",
					file_name: "index.html",
				}}
				attachmentList={updatedAttachmentList}
				attachments={updatedAttachmentList}
				displayConfig={{
					type: "slide",
					slides: ["slides/slide-1.html"],
				}}
				activeFileId="index-file"
			/>,
		)

		await waitFor(() => {
			expect(mockState.getFileContentById).toHaveBeenCalledTimes(2)
		})

		expect(screen.queryByTestId("ppt-render")).not.toBeNull()
		expect(screen.queryByTestId("magic-spin")).toBeNull()
	})

	it("does not let stale magic.project.js content roll back a local slide insertion", async () => {
		const oldSlides = ["slides/slide-1.html", "slides/slide-2.html"]
		const insertedSlides = [
			"slides/slide-1.html",
			"slides/new-slide.html",
			"slides/slide-2.html",
		]

		mockState.processHtmlContent.mockImplementation(async () => ({
			filePathMapping: new Map(),
			originalSlidesPaths: oldSlides,
		}))
		mockState.getFileContentById
			.mockResolvedValueOnce("window.magicProjectConfig = { slides: ['slide-1', 'slide-2'] }")
			.mockResolvedValueOnce(
				"window.magicProjectConfig = { slides: ['slide-1', 'slide-2'] }; // stale",
			)

		const { rerender } = renderRoot("1", oldSlides)

		await waitFor(() => {
			expect(screen.getByTestId("ppt-render").dataset.slidePaths).toBe(
				JSON.stringify(oldSlides),
			)
		})

		fireEvent.click(screen.getByTestId("local-insert"))

		await waitFor(() => {
			expect(screen.getByTestId("ppt-render").dataset.slidePaths).toBe(
				JSON.stringify(insertedSlides),
			)
		})

		const updatedAttachmentList = createDeckFiles("2")
		rerender(
			<PPTRootRender
				data={{
					file_id: "index-file",
					file_name: "index.html",
				}}
				attachmentList={updatedAttachmentList}
				attachments={updatedAttachmentList}
				displayConfig={{
					type: "slide",
					slides: oldSlides,
				}}
				activeFileId="index-file"
			/>,
		)

		await waitFor(() => {
			expect(mockState.getFileContentById).toHaveBeenCalledTimes(2)
		})

		await waitFor(() => {
			expect(screen.getByTestId("ppt-render").dataset.slidePaths).toBe(
				JSON.stringify(insertedSlides),
			)
		})
	})
})
