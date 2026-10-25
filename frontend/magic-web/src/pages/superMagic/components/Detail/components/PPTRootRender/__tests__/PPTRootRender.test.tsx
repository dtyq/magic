import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
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

vi.mock("@/utils/cn", () => ({
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
		attachments,
		attachmentList,
		mainFileId,
		isFullscreen,
		isFileFullscreen,
		showRefresh,
		onSortSave,
		onDeckConfigSaved,
		displayConfig,
		openNewTab,
		slideStructureAdapter,
	}: {
		slidePaths?: string[]
		attachments?: Array<{ file_id?: string; relative_file_path?: string }>
		attachmentList?: Array<{ file_id?: string; relative_file_path?: string }>
		mainFileId?: string
		isFullscreen?: boolean
		isFileFullscreen?: boolean
		showRefresh?: boolean
		onSortSave?: (slidePaths: string[]) => void
		onDeckConfigSaved?: (config: Record<string, unknown>) => void
		displayConfig?: { hidden_slides?: string[]; transitions?: unknown }
		openNewTab?: (fileId: string, path: string) => void
		slideStructureAdapter?: unknown
	}) => (
		<div
			data-testid="ppt-render"
			data-hidden-slides={JSON.stringify(displayConfig?.hidden_slides)}
			data-transitions={JSON.stringify(displayConfig?.transitions ?? null)}
			data-show-refresh={String(showRefresh)}
			data-slide-paths={JSON.stringify(slidePaths || [])}
			data-main-relative-path={
				attachments?.find((item) => item.file_id === mainFileId)?.relative_file_path
			}
			data-attachment-root-ids={JSON.stringify(
				attachments?.map((item) => item.file_id) || [],
			)}
			data-attachment-list-ids={JSON.stringify(
				attachmentList?.map((item) => item.file_id) || [],
			)}
			data-has-structure-adapter={String(Boolean(slideStructureAdapter))}
			data-is-fullscreen={String(Boolean(isFullscreen))}
			data-is-file-fullscreen={String(Boolean(isFileFullscreen))}
		>
			<button
				data-testid="local-transition"
				onClick={() =>
					onDeckConfigSaved?.({
						slides: ["slides/slide-1.html"],
						transitions: { default: { effect: "fade", duration_ms: 400 } },
					})
				}
			/>
			<button
				data-testid="local-hide"
				onClick={() =>
					onDeckConfigSaved?.({
						slides: ["slides/slide-1.html"],
						hidden_slides: ["slides/slide-1.html"],
					})
				}
			/>
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
			<button
				type="button"
				data-testid="open-slide-new-tab"
				onClick={() => openNewTab?.("slide-file", "slides/slide-1.html")}
			/>
			<button
				type="button"
				data-testid="open-shell-navigation"
				onClick={() => openNewTab?.("slide-file", "/husky.html")}
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

function renderRoot(
	magicUpdatedAt: string,
	slides = ["slides/slide-1.html"],
	options: { isFullscreen?: boolean; showRefresh?: boolean; hiddenSlides?: string[] } = {},
) {
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
				hidden_slides: options.hiddenSlides,
				slides,
			}}
			isFullscreen={options.isFullscreen}
			showRefresh={options.showRefresh}
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
		mockState.getFileContentById.mockResolvedValue(
			"window.magicProjectConfig = { slides: ['slides/slide-1.html'] }",
		)
	})

	it("takes hidden pages from canonical config and clears stale display metadata", async () => {
		renderRoot("1", ["slides/slide-1.html"], { hiddenSlides: ["slides/slide-1.html"] })
		await waitFor(() =>
			expect(screen.getByTestId("ppt-render")).toHaveAttribute("data-hidden-slides", "[]"),
		)
	})

	it("publishes locally confirmed hidden config immediately without old source overwrite", async () => {
		renderRoot("1")
		await waitFor(() =>
			expect(screen.getByTestId("ppt-render")).toHaveAttribute("data-hidden-slides", "[]"),
		)
		fireEvent.click(screen.getByTestId("local-hide"))
		await waitFor(() =>
			expect(screen.getByTestId("ppt-render")).toHaveAttribute(
				"data-hidden-slides",
				'["slides/slide-1.html"]',
			),
		)
	})

	it("keeps confirmed transitions when an older download finishes after saving, then reads a newer server edit", async () => {
		let resolveOld!: (content: string) => void
		mockState.getFileContentById.mockImplementationOnce(
			() =>
				new Promise<string>((resolve) => {
					resolveOld = resolve
				}),
		)
		const view = renderRoot("1")
		await waitFor(() => expect(mockState.getFileContentById).toHaveBeenCalled())
		fireEvent.click(screen.getByTestId("local-transition"))
		await act(async () => {
			resolveOld("window.magicProjectConfig = { slides: ['slides/slide-1.html'] }")
		})
		await waitFor(() =>
			expect(screen.getByTestId("ppt-render")).toHaveAttribute(
				"data-transitions",
				JSON.stringify({ default: { effect: "fade", duration_ms: 400 } }),
			),
		)
		mockState.getFileContentById.mockResolvedValue(
			"window.magicProjectConfig = { slides: ['slides/slide-1.html'], transitions: { default: { effect: 'none' } } }",
		)
		view.rerender(
			<PPTRootRender
				data={{ file_id: "index-file", file_name: "index.html" }}
				attachmentList={createDeckFiles("2")}
				attachments={createDeckFiles("2")}
				displayConfig={{ slides: ["slides/slide-1.html"] }}
			/>,
		)
		await waitFor(() =>
			expect(screen.getByTestId("ppt-render")).toHaveAttribute(
				"data-transitions",
				JSON.stringify({ default: { effect: "none" } }),
			),
		)
	})

	it("accepts a newer remote update while local confirmed content is still processing", async () => {
		const view = renderRoot("1")
		await waitFor(() =>
			expect(screen.getByTestId("ppt-render")).toHaveAttribute("data-hidden-slides", "[]"),
		)
		let finishLocal!: (value: unknown) => void
		mockState.processHtmlContent.mockImplementation(
			async ({ content }: { content: string }) => {
				if (content.includes('"fade"'))
					return new Promise((resolve) => {
						finishLocal = resolve
					})
				return { filePathMapping: new Map(), originalSlidesPaths: ["slides/slide-1.html"] }
			},
		)
		fireEvent.click(screen.getByTestId("local-transition"))
		await waitFor(() => expect(finishLocal).toBeTypeOf("function"))
		mockState.getFileContentById.mockResolvedValue(
			"window.magicProjectConfig = { slides: ['slides/slide-1.html'], transitions: { default: { effect: 'none' } } }",
		)
		view.rerender(
			<PPTRootRender
				data={{ file_id: "index-file", file_name: "index.html" }}
				attachmentList={createDeckFiles("2")}
				attachments={createDeckFiles("2")}
				displayConfig={{ slides: ["slides/slide-1.html"] }}
			/>,
		)
		await waitFor(() =>
			expect(screen.getByTestId("ppt-render")).toHaveAttribute(
				"data-transitions",
				JSON.stringify({ default: { effect: "none" } }),
			),
		)
		await act(async () =>
			finishLocal({
				filePathMapping: new Map(),
				originalSlidesPaths: ["slides/slide-1.html"],
			}),
		)
		expect(screen.getByTestId("ppt-render")).toHaveAttribute(
			"data-transitions",
			JSON.stringify({ default: { effect: "none" } }),
		)
	})

	it("loads transitions from canonical content on reopen", async () => {
		const transitions = { default: { effect: "wipe", duration_ms: 450, direction: "up" } }
		mockState.getFileContentById.mockResolvedValue(
			`window.magicProjectConfig = ${JSON.stringify({ slides: ["slides/slide-1.html"], transitions })}`,
		)
		const view = renderRoot("1")
		await waitFor(() =>
			expect(screen.getByTestId("ppt-render")).toHaveAttribute(
				"data-transitions",
				JSON.stringify(transitions),
			),
		)
		view.unmount()
		renderRoot("1")
		await waitFor(() =>
			expect(screen.getByTestId("ppt-render")).toHaveAttribute(
				"data-transitions",
				JSON.stringify(transitions),
			),
		)
	})

	it("forwards showRefresh to PPTRender", async () => {
		renderRoot("1", ["slides/slide-1.html"], { showRefresh: false })

		await waitFor(() => {
			expect(screen.getByTestId("ppt-render")).toHaveAttribute("data-show-refresh", "false")
		})
	})

	it("keeps FilesViewer fullscreen separate from PPT presentation fullscreen", async () => {
		renderRoot("1", ["slides/slide-1.html"], { isFullscreen: true })

		expect(screen.getByTestId("ppt-project-preview")).toBeInTheDocument()
		await waitFor(() => {
			expect(screen.getByTestId("ppt-render")).toHaveAttribute("data-is-fullscreen", "false")
			expect(screen.getByTestId("ppt-render")).toHaveAttribute(
				"data-is-file-fullscreen",
				"true",
			)
		})
	})

	it("does not expose the fixed project preview id from an inactive cached tab", async () => {
		const attachmentList = createDeckFiles("1")
		render(
			<PPTRootRender
				data={{ file_id: "index-file", file_name: "index.html" }}
				attachmentList={attachmentList}
				attachments={attachmentList}
				displayConfig={{ type: "slide", slides: ["slides/slide-1.html"] }}
				activeFileId="index-file"
				isTabActive={false}
			/>,
		)

		expect(screen.queryByTestId("ppt-project-preview")).not.toBeInTheDocument()
		await waitFor(() => {
			expect(mockState.processHtmlContent).toHaveBeenCalled()
		})
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

	it("loads magic.project.js when opened from a slide project folder", async () => {
		const magicProject = {
			file_id: "magic-project-file",
			file_name: "magic.project.js",
			relative_file_path: "deck/magic.project.js",
			parent_id: "deck-folder",
			updated_at: "1",
		}
		const folder = {
			file_id: "deck-folder",
			file_name: "2026前沿UI设计盘点",
			is_directory: true,
			relative_file_path: "deck",
			display_config: {
				type: "slide",
				slides: ["slides/slide-1.html"],
			},
			children: [magicProject],
		}

		mockState.getFileContentById.mockResolvedValue(
			"window.magicProjectConfig = { slides: ['slides/slide-1.html'] }",
		)

		render(
			<PPTRootRender
				data={folder}
				attachmentList={[folder]}
				attachments={[folder]}
				displayConfig={folder.display_config}
				activeFileId="deck-folder"
			/>,
		)

		expect(mockState.useFileData).toHaveBeenCalledWith(
			expect.objectContaining({
				file_id: "",
			}),
		)

		await waitFor(() => {
			expect(mockState.getFileContentById).toHaveBeenCalledWith("magic-project-file", {
				responseType: "text",
			})
		})

		await waitFor(() => {
			expect(mockState.processHtmlContent).toHaveBeenCalledWith(
				expect.objectContaining({
					fileId: "magic-project-file",
					fileName: "magic.project.js",
				}),
			)
		})

		expect(screen.getByTestId("ppt-render").dataset.slidePaths).toBe(
			JSON.stringify(["slides/slide-1.html"]),
		)
	})

	it("keeps the complete attachment path when mobile preview data is partial", async () => {
		const folder = {
			file_id: "deck-folder",
			file_name: "X11项目一页汇报",
			is_directory: true,
			relative_file_path: "projects/x11/deck",
			parent_id: "project-root",
			display_config: {
				type: "slide",
				slides: ["slide-1.html"],
			},
			children: [
				{
					file_id: "slide-file",
					file_name: "slide-1.html",
					relative_file_path: "projects/x11/deck/slide-1.html",
				},
			],
		}

		render(
			<PPTRootRender
				data={{
					...folder,
					relative_file_path: undefined,
					parent_id: undefined,
				}}
				attachmentList={[folder]}
				attachments={[folder]}
				displayConfig={folder.display_config}
				activeFileId="deck-folder"
			/>,
		)

		await waitFor(() => {
			expect(screen.getByTestId("ppt-render")).toHaveAttribute(
				"data-main-relative-path",
				"projects/x11/deck",
			)
		})
	})

	it("keeps nested attachments as a tree while providing a flat attachment list", async () => {
		const slideFile = {
			file_id: "slide-file",
			file_name: "slide-1.html",
			relative_file_path: "deck/slides/slide-1.html",
			parent_id: "slides-folder",
		}
		const slidesFolder = {
			file_id: "slides-folder",
			file_name: "slides",
			is_directory: true,
			relative_file_path: "deck/slides",
			parent_id: "deck-folder",
			children: [slideFile],
		}
		const deckFolder = {
			file_id: "deck-folder",
			file_name: "产品方案",
			is_directory: true,
			relative_file_path: "deck",
			display_config: {
				type: "slide",
				slides: ["slides/slide-1.html"],
			},
			children: [slidesFolder],
		}

		render(
			<PPTRootRender
				data={deckFolder}
				attachments={[deckFolder]}
				attachmentList={[deckFolder]}
				displayConfig={deckFolder.display_config}
				activeFileId="deck-folder"
			/>,
		)

		await waitFor(() => {
			expect(screen.getByTestId("ppt-render")).toHaveAttribute(
				"data-attachment-root-ids",
				JSON.stringify(["deck-folder"]),
			)
		})
		expect(screen.getByTestId("ppt-render")).toHaveAttribute(
			"data-attachment-list-ids",
			JSON.stringify(["deck-folder", "slides-folder", "slide-file"]),
		)
	})

	it("opens a slide from displayData children in a new tab", async () => {
		const openFileTab = vi.fn()
		const slideFile = {
			file_id: "slide-file",
			file_name: "slide-1.html",
			relative_file_path: "deck/slides/slide-1.html",
			parent_id: "deck-folder",
		}
		const folder = {
			file_id: "deck-folder",
			file_name: "2026前沿UI设计盘点",
			is_directory: true,
			relative_file_path: "deck",
			display_config: {
				type: "slide",
				slides: ["slides/slide-1.html"],
			},
			children: [slideFile],
		}

		render(
			<PPTRootRender
				data={folder}
				attachmentList={[]}
				attachments={[]}
				displayConfig={folder.display_config}
				activeFileId="deck-folder"
				openFileTab={openFileTab}
			/>,
		)

		await waitFor(() => {
			expect(screen.queryByTestId("ppt-render")).not.toBeNull()
		})
		expect(screen.getByTestId("ppt-render")).toHaveAttribute(
			"data-attachment-root-ids",
			JSON.stringify(["deck-folder"]),
		)

		fireEvent.click(screen.getByTestId("open-slide-new-tab"))

		expect(openFileTab).toHaveBeenCalledWith(slideFile)
	})

	it("does not open the current slide as HTML when navigation is a preview shell rewrite", async () => {
		const openFileTab = vi.fn()
		const slideFile = {
			file_id: "slide-file",
			file_name: "cover.html",
			relative_file_path: "deck/slides/cover.html",
			parent_id: "deck-folder",
		}
		const folder = {
			file_id: "deck-folder",
			file_name: "deck",
			is_directory: true,
			relative_file_path: "deck",
			display_config: {
				type: "slide",
				slides: ["slides/cover.html"],
			},
			children: [slideFile],
		}

		render(
			<PPTRootRender
				data={folder}
				attachmentList={[]}
				attachments={[]}
				displayConfig={folder.display_config}
				activeFileId="deck-folder"
				openFileTab={openFileTab}
			/>,
		)

		await waitFor(() => {
			expect(screen.queryByTestId("ppt-render")).not.toBeNull()
		})

		fireEvent.click(screen.getByTestId("open-shell-navigation"))

		expect(openFileTab).not.toHaveBeenCalled()
	})

	it("renders template slide paths without reading magic.project.js", async () => {
		const slideStructureAdapter = {} as never
		render(
			<PPTRootRender
				data={
					{
						file_id: "template-root",
						file_name: "PPT-template",
						is_directory: true,
						relative_file_path: "PPT-template",
					} as never
				}
				attachments={createDeckFiles("v1")}
				attachmentList={createDeckFiles("v1")}
				displayConfig={{ type: "slide", slides: ["slides/slide-1.html"] }}
				disableMagicProjectLookup
				slideStructureAdapter={slideStructureAdapter}
			/>,
		)

		expect(await screen.findByTestId("ppt-render")).toHaveAttribute(
			"data-slide-paths",
			JSON.stringify(["slides/slide-1.html"]),
		)
		expect(screen.getByTestId("ppt-render")).toHaveAttribute(
			"data-has-structure-adapter",
			"true",
		)
		expect(mockState.getFileContentById).not.toHaveBeenCalled()
	})

	it("preserves the attachment tree while providing a flat lookup list", async () => {
		const childFile = {
			file_id: "image-file",
			file_name: "image.png",
			parent_id: "images-folder",
		}
		const childFolder = {
			file_id: "images-folder",
			file_name: "images",
			parent_id: "template-root",
			is_directory: true,
			children: [childFile],
		}
		const templateRoot = {
			file_id: "template-root",
			file_name: "PPT-template",
			is_directory: true,
			relative_file_path: "PPT-template",
			children: [childFolder],
		}

		render(
			<PPTRootRender
				data={templateRoot}
				attachments={[templateRoot]}
				attachmentList={[templateRoot, childFolder, childFile]}
				displayConfig={{ type: "slide", slides: ["slides/slide-1.html"] }}
				disableMagicProjectLookup
			/>,
		)

		const pptRender = await screen.findByTestId("ppt-render")
		expect(pptRender).toHaveAttribute(
			"data-attachment-root-ids",
			JSON.stringify(["template-root"]),
		)
		expect(pptRender).toHaveAttribute(
			"data-attachment-list-ids",
			JSON.stringify(["template-root", "images-folder", "image-file"]),
		)
	})
})
