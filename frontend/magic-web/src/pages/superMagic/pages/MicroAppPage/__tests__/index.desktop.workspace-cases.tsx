import type { ReactElement } from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { expect, it, type Mock } from "vitest"

import pubsub, { PubSubEvents } from "@/utils/pubsub"

interface EntryFile {
	file_id: string
	file_name: string
	relative_file_path?: string
	updated_at?: string
}

interface WorkspaceCasesOptions {
	renderPage: () => ReactElement
	controllerMocks: {
		attachmentList: EntryFile[]
		defaultEntryFile: EntryFile | null
	}
	resolverMocks: {
		result: {
			projectId: string
			isPublished: boolean
			setIsPublished: Mock
			loading: boolean
			error: Error | null
		}
	}
	detailMocks: {
		openFileTab: Mock
		render: Mock
	}
	previewMocks: {
		aiEdit: Mock
		devConsoleToggle: Mock
		render: Mock
	}
	previewPopupMocks: {
		open: Mock
	}
}

interface PreviewRenderProps {
	onDevConsoleActiveChange?: (active: boolean) => void
	onOpenFile?: (file: { file_id: string; file_name: string }) => void
}

/** 注册微应用主工作区相关测试，避免入口测试文件继续膨胀。 */
export function registerMicroAppDesktopWorkspaceCases({
	renderPage,
	controllerMocks,
	resolverMocks,
	detailMocks,
	previewMocks,
	previewPopupMocks,
}: WorkspaceCasesOptions) {
	it("shows the generated entry file after the attachment store refreshes", async () => {
		controllerMocks.attachmentList = []
		controllerMocks.defaultEntryFile = null
		const { rerender } = render(renderPage())

		expect(previewMocks.render).toHaveBeenLastCalledWith(
			expect.objectContaining({ entryFile: null }),
		)
		expect(screen.getByTestId("micro-app-preview-more")).toBeDisabled()

		const generatedEntry = {
			file_id: "generated-entry",
			file_name: "index.html",
			relative_file_path: "index.html",
		}
		controllerMocks.attachmentList = [generatedEntry]
		controllerMocks.defaultEntryFile = generatedEntry
		resolverMocks.result = { ...resolverMocks.result, isPublished: false }
		rerender(renderPage())

		await waitFor(() => {
			expect(previewMocks.render).toHaveBeenLastCalledWith(
				expect.objectContaining({
					entryFile: expect.objectContaining({ file_id: "generated-entry" }),
				}),
			)
			expect(screen.getByTestId("micro-app-preview-more")).toBeEnabled()
		})
	})

	it("refreshes the current preview when the same entry file content changes", async () => {
		const initialEntry = {
			file_id: "entry-1",
			file_name: "index.html",
			relative_file_path: "index.html",
			updated_at: "2026-08-03T05:30:00Z",
		}
		controllerMocks.attachmentList = [initialEntry]
		controllerMocks.defaultEntryFile = initialEntry
		const { rerender } = render(renderPage())

		expect(previewMocks.render).toHaveBeenLastCalledWith(
			expect.objectContaining({
				entryFile: expect.objectContaining({
					file_id: "entry-1",
					updated_at: "2026-08-03T05:30:00Z",
				}),
			}),
		)

		const updatedEntry = {
			...initialEntry,
			updated_at: "2026-08-03T05:31:00Z",
		}
		controllerMocks.attachmentList = [updatedEntry]
		controllerMocks.defaultEntryFile = updatedEntry
		resolverMocks.result = { ...resolverMocks.result, isPublished: false }
		rerender(renderPage())

		await waitFor(() => {
			expect(previewMocks.render).toHaveBeenLastCalledWith(
				expect.objectContaining({
					entryFile: expect.objectContaining({
						file_id: "entry-1",
						updated_at: "2026-08-03T05:31:00Z",
					}),
				}),
			)
		})
	})

	it("switches preview, file viewer, and project panels inside the main workspace", async () => {
		render(renderPage())

		expect(screen.getByTestId("micro-app-nav-preview")).toHaveAttribute("aria-current", "page")
		expect(screen.getByTestId("desktop-conversation-panel")).toBeInTheDocument()
		expect(screen.queryByTestId("micro-app-conversation-rail")).not.toBeInTheDocument()
		expect(screen.queryByTestId("micro-app-file-sidebar")).not.toBeInTheDocument()
		expect(screen.getByTestId("desktop-entry-preview")).toBeInTheDocument()
		expect(screen.queryByTestId("desktop-files-viewer")).not.toBeInTheDocument()
		expect(screen.getByRole("tab", { name: "/index.html" })).toHaveAttribute(
			"aria-selected",
			"true",
		)
		expect(previewMocks.render).toHaveBeenLastCalledWith(
			expect.objectContaining({
				viewMode: "desktop",
				refreshKey: 0,
				isBuilding: true,
			}),
		)
		expect(screen.getByTestId("micro-app-database-workspace")).toHaveAttribute(
			"aria-hidden",
			"true",
		)

		fireEvent.click(screen.getByTestId("micro-app-preview-phone"))
		expect(previewMocks.render).toHaveBeenLastCalledWith(
			expect.objectContaining({ viewMode: "phone" }),
		)

		fireEvent.click(screen.getByTestId("micro-app-preview-ai-edit"))
		expect(previewMocks.aiEdit).toHaveBeenCalledTimes(1)

		fireEvent.keyDown(screen.getByTestId("micro-app-preview-more"), { key: "Enter" })
		const debugToggle = await screen.findByTestId("micro-app-preview-debug-toggle")
		expect(debugToggle).toHaveTextContent("microAppPage.previewToolbar.enableDebug")
		fireEvent.click(debugToggle)
		expect(previewMocks.devConsoleToggle).toHaveBeenCalledTimes(1)

		act(() => {
			const props = previewMocks.render.mock.lastCall?.[0] as PreviewRenderProps | undefined
			props?.onDevConsoleActiveChange?.(true)
		})
		fireEvent.keyDown(screen.getByTestId("micro-app-preview-more"), { key: "Enter" })
		expect(await screen.findByTestId("micro-app-preview-debug-toggle")).toHaveTextContent(
			"microAppPage.previewToolbar.disableDebug",
		)

		act(() => {
			const props = previewMocks.render.mock.lastCall?.[0] as PreviewRenderProps | undefined
			props?.onOpenFile?.({
				file_id: "admin-1",
				file_name: "admin.html",
			})
		})
		expect(screen.getByTestId("micro-app-nav-preview")).toHaveAttribute("aria-current", "page")
		expect(screen.getByRole("tab", { name: "/admin.html" })).toHaveAttribute(
			"aria-selected",
			"true",
		)
		expect(screen.queryByTestId("desktop-files-viewer")).not.toBeInTheDocument()
		expect(previewMocks.render).toHaveBeenLastCalledWith(
			expect.objectContaining({
				entryFile: expect.objectContaining({ file_id: "admin-1" }),
			}),
		)

		act(() => {
			const props = previewMocks.render.mock.lastCall?.[0] as PreviewRenderProps | undefined
			props?.onOpenFile?.({ file_id: "entry-1", file_name: "index.html" })
		})
		expect(screen.getByRole("tab", { name: "/index.html" })).toHaveAttribute(
			"aria-selected",
			"true",
		)
		expect(previewMocks.render).toHaveBeenLastCalledWith(
			expect.objectContaining({
				entryFile: expect.objectContaining({ file_id: "entry-1" }),
			}),
		)

		fireEvent.click(screen.getByTestId("micro-app-preview-refresh"))
		expect(previewMocks.render).toHaveBeenLastCalledWith(
			expect.objectContaining({ refreshKey: 3 }),
		)
		fireEvent.focus(screen.getByTestId("micro-app-preview-refresh"))
		expect(await screen.findByRole("tooltip")).toHaveTextContent(
			"microAppPage.previewToolbar.refresh",
		)

		const previewWorkspace = screen.getByTestId("micro-app-preview-workspace")
		fireEvent.click(screen.getByTestId("micro-app-preview-fullscreen"))
		expect(previewWorkspace).toHaveAttribute("data-fullscreen", "true")
		expect(previewWorkspace).toHaveClass("fixed", "z-detail-fullscreen")
		expect(screen.getByTestId("micro-app-preview-fullscreen")).toHaveAttribute(
			"aria-label",
			"microAppPage.previewToolbar.exitFullscreen",
		)

		fireEvent.click(screen.getByTestId("micro-app-preview-fullscreen"))
		expect(previewWorkspace).toHaveAttribute("data-fullscreen", "false")
		expect(previewWorkspace).toHaveClass("absolute")

		fireEvent.click(screen.getByTestId("micro-app-preview-fullscreen"))
		fireEvent.keyDown(document, { key: "Escape" })
		expect(previewWorkspace).toHaveAttribute("data-fullscreen", "false")
		expect(previewWorkspace).toHaveClass("absolute")

		fireEvent.click(screen.getByTestId("micro-app-nav-files"))
		expect(screen.getByTestId("desktop-entry-preview")).toBeInTheDocument()
		expect(screen.getByTestId("micro-app-file-sidebar")).toBeInTheDocument()
		expect(screen.getByTestId("desktop-file-list")).toBeInTheDocument()
		expect(screen.getByTestId("desktop-files-viewer")).toBeInTheDocument()
		expect(detailMocks.render).toHaveBeenLastCalledWith(
			expect.objectContaining({
				showFileHeader: true,
				showFileFooter: false,
			}),
		)
		const latestDetailProps = detailMocks.render.mock.lastCall?.[0] as
			Record<string, unknown> | undefined
		expect(latestDetailProps).not.toHaveProperty("hideTabBar")
		expect(latestDetailProps).not.toHaveProperty("nonClosableFileIds")

		fireEvent.click(screen.getByTestId("micro-app-nav-database"))
		expect(screen.getByTestId("micro-app-preview-workspace")).toHaveClass("hidden")
		expect(screen.getByTestId("micro-app-database-workspace")).toHaveAttribute(
			"aria-hidden",
			"false",
		)
		expect(await screen.findByTestId("desktop-database-panel")).toHaveAttribute(
			"data-active",
			"true",
		)
		expect(screen.queryByTestId("desktop-conversation-panel")).not.toBeInTheDocument()
		expect(screen.getByTestId("micro-app-conversation-rail")).toBeInTheDocument()

		fireEvent.click(screen.getByTestId("micro-app-nav-preview"))
		expect(detailMocks.openFileTab).toHaveBeenCalledWith(
			expect.objectContaining({ file_id: "entry-1" }),
		)
		expect(screen.getByTestId("micro-app-preview-workspace")).toHaveAttribute(
			"aria-hidden",
			"false",
		)
		expect(screen.getByTestId("desktop-entry-preview")).toBeInTheDocument()
		expect(screen.queryByTestId("desktop-files-viewer")).not.toBeInTheDocument()
		expect(screen.getByTestId("desktop-conversation-panel")).toBeInTheDocument()
		expect(screen.queryByTestId("micro-app-conversation-rail")).not.toBeInTheDocument()

		fireEvent.click(screen.getByTestId("micro-app-nav-scheduled-tasks"))
		expect(screen.getByTestId("micro-app-nav-scheduled-tasks")).toHaveAttribute(
			"aria-current",
			"page",
		)
		expect(screen.getByTestId("micro-app-preview-workspace")).toHaveClass("hidden")
		expect(await screen.findByTestId("desktop-scheduled-tasks-panel")).toHaveAttribute(
			"data-workspace-id",
			"workspace-1",
		)
		expect(screen.getByTestId("desktop-scheduled-tasks-panel")).toHaveAttribute(
			"data-project-id",
			"project-1",
		)
		expect(screen.getByTestId("desktop-scheduled-tasks-panel")).toHaveAttribute(
			"data-topic-id",
			"topic-1",
		)
		expect(screen.getByTestId("desktop-scheduled-tasks-panel")).toHaveAttribute(
			"data-workspace-name",
			"Workspace",
		)
		expect(screen.getByTestId("desktop-scheduled-tasks-panel")).toHaveAttribute(
			"data-project-name",
			"Micro App",
		)
		const projectPanelClassName = screen
			.getByTestId("desktop-scheduled-tasks-panel")
			.getAttribute("data-class-name")
		expect(projectPanelClassName).toContain("share-management-content")
		expect(projectPanelClassName).not.toContain("project-panel-content]>div]:gap-0")

		fireEvent.click(screen.getByTestId("micro-app-nav-share-management"))
		expect(await screen.findByTestId("desktop-share-management-panel")).toHaveAttribute(
			"data-project-id",
			"project-1",
		)

		fireEvent.click(screen.getByTestId("micro-app-nav-long-memory"))
		expect(await screen.findByTestId("desktop-long-memory-panel")).toHaveAttribute(
			"data-project-id",
			"project-1",
		)
		expect(screen.getByTestId("micro-app-project-panel-workspace")).toBeInTheDocument()

		fireEvent.click(screen.getByTestId("desktop-long-memory-panel"))
		expect(previewPopupMocks.open).toHaveBeenCalledWith(
			expect.objectContaining({
				currentFileId: "memory-1",
				data: expect.objectContaining({
					file_id: "memory-1",
					display_config: expect.objectContaining({
						previewPolicy: expect.objectContaining({ fileScope: "memory" }),
					}),
				}),
			}),
			expect.any(Array),
			expect.any(Array),
		)
		expect(screen.getByTestId("micro-app-nav-long-memory")).toHaveAttribute(
			"aria-current",
			"page",
		)
		expect(screen.getByTestId("desktop-long-memory-panel")).toHaveAttribute(
			"data-active-file-id",
			"memory-1",
		)
	})

	it("opens a message file reference in the files workspace", async () => {
		const file = {
			file_id: "admin-1",
			file_name: "admin.html",
			relative_file_path: "admin.html",
		}

		render(renderPage())

		act(() => {
			pubsub.publish(PubSubEvents.Open_File_Tab, {
				fileId: file.file_id,
				fileData: file,
			})
		})

		expect(screen.getByTestId("micro-app-nav-files")).toHaveAttribute("aria-current", "page")
		expect(screen.getByTestId("desktop-files-viewer")).toBeInTheDocument()
		await waitFor(() => {
			expect(detailMocks.openFileTab).toHaveBeenCalledWith(file)
		})
	})

	it("does not open file tools in a modal over the entry preview", async () => {
		render(renderPage())
		await screen.findByTestId("desktop-entry-preview")
		fireEvent.click(screen.getByTestId("write-file"))

		expect(previewPopupMocks.open).not.toHaveBeenCalled()
	})

	it("opens file tools in the files workspace instead of a modal", async () => {
		render(renderPage())
		await screen.findByTestId("desktop-entry-preview")
		fireEvent.click(screen.getByTestId("micro-app-nav-files"))
		fireEvent.click(screen.getByTestId("write-file"))

		expect(previewPopupMocks.open).not.toHaveBeenCalled()
		expect(screen.getByTestId("desktop-files-viewer")).toBeInTheDocument()
	})
}
