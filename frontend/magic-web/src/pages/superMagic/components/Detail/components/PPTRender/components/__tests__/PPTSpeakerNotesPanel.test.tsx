import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import PPTSpeakerNotesPanel from "../PPTSpeakerNotesPanel"
import { pptNotesPreferenceStore } from "@/stores/layout/PPTNotesPreferenceStore"
import { unshadow } from "@/utils/shadow"

vi.mock("@/components/shadcn-ui/popover", async () => {
	const { createContext, useContext } = await import("react")
	const OpenContext = createContext(false)
	return {
		Popover: ({ open = false, children }: { open?: boolean; children: React.ReactNode }) => (
			<OpenContext.Provider value={open}>{children}</OpenContext.Provider>
		),
		PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
		PopoverAnchor: ({ children }: { children: React.ReactNode }) => <>{children}</>,
		PopoverContent: ({
			children,
			...props
		}: {
			children: React.ReactNode
			"data-testid"?: string
		}) =>
			useContext(OpenContext) ? (
				<div data-testid={props["data-testid"]}>{children}</div>
			) : null,
	}
})

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/services/superMagic/SuperMagicModeService", () => ({
	default: {
		getModelListByMode: () => [{ model_id: "m1", model_name: "Model 1" }],
		fetchDefaultModeModelList: vi.fn(),
	},
}))

const patchMock = vi.hoisted(() => ({ propose: vi.fn(() => true) }))
beforeEach(() => patchMock.propose.mockClear())
vi.mock("@/components/tiptap-node/ai-patch", () => ({
	AiPatch: {},
	getAiPatchState: () => undefined,
	proposeAiPatchMarkdown: patchMock.propose,
}))

vi.mock("@/components/tiptap-templates/simple/simple-editor", async () => {
	const { forwardRef, useEffect, useRef, useImperativeHandle, useState } = await import("react")
	return {
		SimpleEditor: forwardRef(
			(
				{
					content,
					isEditable,
					onContentChange,
				}: {
					content: string
					isEditable: boolean
					onContentChange: (value: string) => void
				},
				ref,
			) => {
				const [localContent, setLocalContent] = useState(content)
				const latest = useRef(localContent)
				latest.current = localContent
				const fakeEditor = useRef({
					getJSON: () => ({
						type: "doc",
						content: [
							{
								type: "paragraph",
								content: [{ type: "text", text: latest.current || " " }],
							},
						],
					}),
					isDestroyed: false,
					state: {},
					on: vi.fn(),
					off: vi.fn(),
					commands: {
						setContent: (value: string) => setLocalContent(value),
						clearAiPatches: vi.fn(),
					},
					storage: { markdown: { getMarkdown: () => latest.current } },
				})
				useImperativeHandle(ref, () => ({ editor: fakeEditor.current }), [])
				const previousEditable = useRef(isEditable)
				useEffect(() => {
					// Tiptap setEditable emits update even when Markdown has not changed.
					if (previousEditable.current === isEditable) return
					previousEditable.current = isEditable
					onContentChange(localContent)
				}, [isEditable, localContent, onContentChange])
				return (
					<>
						{isEditable ? (
							<textarea
								data-testid="ppt-speaker-notes-editor"
								value={localContent}
								onChange={(event) => {
									setLocalContent(event.target.value)
									onContentChange(event.target.value)
								}}
							/>
						) : (
							<div>{localContent}</div>
						)}
					</>
				)
			},
		),
	}
})

describe("PPTSpeakerNotesPanel", () => {
	beforeEach(() => {
		localStorage.clear()
		pptNotesPreferenceStore.setHeight(144)
		pptNotesPreferenceStore.setFontSize(13)
		pptNotesPreferenceStore.setAutoApply(true)
		pptNotesPreferenceStore.modelHintDismissed = true
		patchMock.propose.mockClear()
	})

	it("shows a dismissible model hint once and remembers the dismissal", async () => {
		const props = {
			slideIndex: 0,
			fileId: "first",
			rawContent: "",
			allowEdit: true,
			onSaved: vi.fn(),
			onGenerate: vi.fn(),
		}
		pptNotesPreferenceStore.modelHintDismissed = false
		const { unmount } = render(<PPTSpeakerNotesPanel {...props} />)
		expect(await screen.findByTestId("ppt-notes-model-hint")).toBeInTheDocument()
		fireEvent.click(screen.getByTestId("ppt-notes-model-hint-dismiss"))
		await waitFor(() => expect(screen.queryByTestId("ppt-notes-model-hint")).toBeNull())
		expect(localStorage.getItem("supermagic-ppt-notes-model-hint-dismissed")).toBe("true")
		unmount()
		render(<PPTSpeakerNotesPanel {...props} />)
		await screen.findByTestId("ppt-notes-settings-trigger")
		expect(screen.queryByTestId("ppt-notes-model-hint")).toBeNull()
	})

	it("keeps the model hint hidden while the notes panel is collapsed", async () => {
		pptNotesPreferenceStore.modelHintDismissed = false
		const props = {
			slideIndex: 0,
			fileId: "first",
			rawContent: "",
			allowEdit: true,
			onSaved: vi.fn(),
			onGenerate: vi.fn(),
		}
		const { rerender } = render(<PPTSpeakerNotesPanel {...props} visible={false} />)
		await screen.findByTestId("ppt-notes-settings-trigger")
		expect(screen.queryByTestId("ppt-notes-model-hint")).toBeNull()
		rerender(<PPTSpeakerNotesPanel {...props} visible />)
		expect(await screen.findByTestId("ppt-notes-model-hint")).toBeInTheDocument()
	})

	it("dismisses the model hint when the settings are opened", async () => {
		pptNotesPreferenceStore.modelHintDismissed = false
		render(
			<PPTSpeakerNotesPanel
				slideIndex={0}
				fileId="first"
				rawContent=""
				allowEdit
				onSaved={vi.fn()}
				onGenerate={vi.fn()}
			/>,
		)
		await screen.findByTestId("ppt-notes-model-hint")
		fireEvent.click(screen.getByTestId("ppt-notes-settings-trigger"))
		await waitFor(() => expect(screen.queryByTestId("ppt-notes-model-hint")).toBeNull())
		expect(pptNotesPreferenceStore.modelHintDismissed).toBe(true)
	})

	it("keeps inactive drafts pending and clears protection when the user restores original notes", async () => {
		const onPendingChangesChange = vi.fn()
		const props = {
			slideIndex: 0,
			fileId: "first",
			rawContent: "",
			allowEdit: true,
			onSaved: vi.fn(),
			onPendingChangesChange,
			slides: [
				{ key: "first", fileId: "first", slideIndex: 0, rawContent: "" },
				{ key: "second", fileId: "second", slideIndex: 1, rawContent: "" },
			],
		}
		const { rerender } = render(<PPTSpeakerNotesPanel {...props} />)
		fireEvent.change(await screen.findByTestId("ppt-speaker-notes-editor"), {
			target: { value: "Draft on first page" },
		})
		await waitFor(() => expect(onPendingChangesChange).toHaveBeenLastCalledWith(true))
		rerender(<PPTSpeakerNotesPanel {...props} fileId="second" slideIndex={1} />)
		await waitFor(() => expect(screen.getByTestId("ppt-speaker-notes-editor")).toHaveValue(""))
		expect(onPendingChangesChange).toHaveBeenLastCalledWith(true)
		rerender(<PPTSpeakerNotesPanel {...props} />)
		fireEvent.change(await screen.findByTestId("ppt-speaker-notes-editor"), {
			target: { value: "" },
		})
		await waitFor(() => expect(onPendingChangesChange).toHaveBeenLastCalledWith(false))
	})

	it("discards an AI result after navigating to another slide", async () => {
		let finish!: (value: string) => void
		const onGenerate = vi.fn(
			() =>
				new Promise<string>((resolve) => {
					finish = resolve
				}),
		)
		const input = {
			slideIndex: 0,
			fileId: "first",
			rawContent: "",
			allowEdit: true,
			onGenerate,
			onSaved: vi.fn(),
		}
		const { rerender } = render(<PPTSpeakerNotesPanel {...input} />)
		fireEvent.change(await screen.findByTestId("ppt-speaker-notes-editor"), {
			target: { value: "First draft" },
		})
		fireEvent.click(screen.getByText("ppt.speakerNotes.polish"))
		expect(onGenerate).toHaveBeenCalledTimes(1)
		rerender(<PPTSpeakerNotesPanel {...input} fileId="second" slideIndex={1} />)
		await act(async () => finish("Late AI result"))
		expect(patchMock.propose).not.toHaveBeenCalled()
		expect(onGenerate.mock.calls[0][3].aborted).toBe(true)
	})

	it.each(["reorder", "replace", "unmount"])(
		"handles %s while a note save is pending",
		async (change) => {
			let finishSave!: (value: boolean) => void
			const getLatestRawContent = vi.fn(() => "<main>Original</main>")
			const props = {
				slideIndex: 0,
				fileId: "first",
				rawContent: "<main>Original</main>",
				allowEdit: true,
				getLatestRawContent,
				onSaved: vi.fn().mockResolvedValue(undefined),
				saveEditContent: vi.fn(
					() =>
						new Promise<boolean>((resolve) => {
							finishSave = resolve
						}),
				),
			}
			const { rerender, unmount } = render(<PPTSpeakerNotesPanel {...props} />)
			fireEvent.change(await screen.findByTestId("ppt-speaker-notes-editor"), {
				target: { value: "Saved note" },
			})
			fireEvent.click(screen.getByText("ppt.speakerNotes.save"))
			if (change === "unmount") unmount()
			else
				rerender(
					<PPTSpeakerNotesPanel
						{...props}
						slideIndex={1}
						fileId={change === "replace" ? "second" : "first"}
					/>,
				)
			await act(async () => finishSave(true))
			if (change === "reorder") {
				expect(props.onSaved).toHaveBeenCalledWith(
					expect.stringContaining("Saved note"),
					"first",
				)
				expect(getLatestRawContent).toHaveBeenLastCalledWith("first")
			} else {
				expect(props.onSaved).not.toHaveBeenCalled()
				expect(getLatestRawContent).toHaveBeenCalledTimes(1)
			}
			expect(props.saveEditContent).toHaveBeenCalledTimes(1)
		},
	)

	it("disables polish and shorten for empty notes", () => {
		render(
			<PPTSpeakerNotesPanel
				slideIndex={0}
				fileId="empty"
				rawContent=""
				allowEdit
				onGenerate={vi.fn()}
				onSaved={vi.fn()}
			/>,
		)
		expect(screen.getByText("ppt.speakerNotes.generate")).toBeEnabled()
		expect(screen.getByText("ppt.speakerNotes.polish")).toBeDisabled()
		expect(screen.getByText("ppt.speakerNotes.shorten")).toBeDisabled()
	})

	it.each(["generate", "polish", "shorten"] as const)(
		"sends the current unsaved draft directly to %s",
		async (action) => {
			const onGenerate = vi.fn().mockResolvedValue("AI notes")
			const onSaved = vi.fn().mockResolvedValue(undefined)
			render(
				<PPTSpeakerNotesPanel
					slideIndex={0}
					fileId="draft"
					rawContent=""
					allowEdit
					onGenerate={onGenerate}
					onSaved={onSaved}
					saveEditContent={vi.fn().mockResolvedValue(true)}
				/>,
			)
			const editor = await screen.findByTestId("ppt-speaker-notes-editor")
			fireEvent.change(editor, { target: { value: "**Current draft**" } })
			const button = screen.getByText(`ppt.speakerNotes.${action}`)
			fireEvent.blur(editor, { relatedTarget: button })
			expect(onSaved).not.toHaveBeenCalled()
			fireEvent.click(button)
			await waitFor(() =>
				expect(onGenerate).toHaveBeenCalledWith(
					action,
					"draft",
					"**Current draft**",
					expect.any(AbortSignal),
				),
			)
			expect(onSaved).not.toHaveBeenCalled()
			expect(patchMock.propose).toHaveBeenCalled()
		},
	)

	it("preserves the current draft when AI generation fails", async () => {
		const onGenerate = vi.fn().mockRejectedValue(new Error("offline"))
		render(
			<PPTSpeakerNotesPanel
				slideIndex={0}
				fileId="draft"
				rawContent=""
				allowEdit
				onGenerate={onGenerate}
				onSaved={vi.fn()}
				saveEditContent={vi.fn().mockResolvedValue(false)}
			/>,
		)
		fireEvent.change(await screen.findByTestId("ppt-speaker-notes-editor"), {
			target: { value: "Do not lose this" },
		})
		fireEvent.click(screen.getByText("ppt.speakerNotes.polish"))
		await screen.findByText("ppt.speakerNotes.generationFailed")
		expect(onGenerate).toHaveBeenCalledTimes(1)
		expect(screen.getByTestId("ppt-speaker-notes-editor")).toHaveValue("Do not lose this")
	})

	it("keeps unsaved drafts on their own slide when navigating while collapsed", async () => {
		const props = {
			slideIndex: 0,
			rawContent: "",
			fileId: "slide-1",
			allowEdit: true,
			onSaved: vi.fn(),
		}
		const { rerender } = render(<PPTSpeakerNotesPanel {...props} />)
		await screen.findByTestId("ppt-speaker-notes-editor")
		fireEvent.change(screen.getByTestId("ppt-speaker-notes-editor"), {
			target: { value: "Page one draft" },
		})
		rerender(<PPTSpeakerNotesPanel {...props} visible={false} />)
		rerender(
			<PPTSpeakerNotesPanel {...props} fileId="slide-2" slideIndex={1} visible={false} />,
		)
		rerender(<PPTSpeakerNotesPanel {...props} fileId="slide-2" slideIndex={1} />)
		expect(screen.getByTestId("ppt-speaker-notes-content")).not.toHaveTextContent(
			"Page one draft",
		)
		rerender(<PPTSpeakerNotesPanel {...props} />)
		expect(await screen.findByTestId("ppt-speaker-notes-editor")).toHaveValue("Page one draft")
	})

	it("retains a failed draft while collapsed and retries after reopening", async () => {
		const saveEditContent = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true)
		const props = {
			slideIndex: 0,
			rawContent: "<main>Slide</main>",
			fileId: "slide-1",
			allowEdit: true,
			saveEditContent,
			onSaved: vi.fn().mockResolvedValue(undefined),
		}
		const { rerender } = render(<PPTSpeakerNotesPanel {...props} />)
		await screen.findByTestId("ppt-speaker-notes-editor")
		fireEvent.change(screen.getByTestId("ppt-speaker-notes-editor"), {
			target: { value: "Keep this draft" },
		})
		fireEvent.blur(screen.getByTestId("ppt-speaker-notes-editor"))
		await screen.findByText("ppt.speakerNotes.saveFailed")
		rerender(<PPTSpeakerNotesPanel {...props} visible={false} />)
		expect(screen.getByTestId("ppt-speaker-notes-panel")).not.toBeVisible()
		rerender(<PPTSpeakerNotesPanel {...props} visible />)
		expect(screen.getByTestId("ppt-speaker-notes-editor")).toHaveValue("Keep this draft")
		fireEvent.click(screen.getByText("ppt.speakerNotes.save"))
		await waitFor(() => expect(props.onSaved).toHaveBeenCalled())
	})

	it("allows keyboard resizing without editing the notes", () => {
		render(
			<PPTSpeakerNotesPanel
				slideIndex={0}
				rawContent=""
				fileId="slide-1"
				allowEdit
				onSaved={vi.fn()}
			/>,
		)
		fireEvent.keyDown(screen.getByRole("button", { name: "ppt.speakerNotes.resize" }), {
			key: "ArrowUp",
		})
		expect(screen.getByTestId("ppt-speaker-notes-panel")).toHaveStyle({ height: "164px" })
	})

	it("stays in document flow below the overlay threshold", () => {
		render(
			<PPTSpeakerNotesPanel
				slideIndex={0}
				rawContent=""
				fileId="slide-1"
				allowEdit
				onSaved={vi.fn()}
			/>,
		)
		expect(screen.getByTestId("ppt-speaker-notes-panel")).not.toHaveAttribute("data-overlay")
		expect(screen.queryByTestId("ppt-speaker-notes-spacer")).not.toBeInTheDocument()
	})

	it("overlays the slide after notes exceed the in-flow threshold", () => {
		pptNotesPreferenceStore.setHeight(300)
		render(
			<PPTSpeakerNotesPanel
				slideIndex={0}
				rawContent=""
				fileId="slide-1"
				allowEdit
				onSaved={vi.fn()}
			/>,
		)
		const panel = screen.getByTestId("ppt-speaker-notes-panel")
		expect(panel).toHaveAttribute("data-overlay", "true")
		expect(panel.className).toContain("absolute")
		expect(panel.className).toContain("z-[5]")
		expect(screen.getByTestId("ppt-speaker-notes-spacer")).toHaveStyle({ height: "260px" })
	})

	it("can grow past the former 40% cap onto the slide", () => {
		pptNotesPreferenceStore.setHeight(250)
		render(
			<PPTSpeakerNotesPanel
				slideIndex={0}
				rawContent=""
				fileId="slide-1"
				allowEdit
				onSaved={vi.fn()}
			/>,
		)
		fireEvent.keyDown(screen.getByRole("button", { name: "ppt.speakerNotes.resize" }), {
			key: "ArrowUp",
		})
		const panel = screen.getByTestId("ppt-speaker-notes-panel")
		expect(panel).toHaveAttribute("data-overlay", "true")
		expect(panel).toHaveStyle({ height: "270px" })
		expect(screen.getByTestId("ppt-speaker-notes-spacer")).toHaveStyle({ height: "260px" })
	})

	it("edits directly and saves on blur while the slide remains outside PPT edit mode", async () => {
		const saveEditContent = vi.fn().mockResolvedValue(true)
		const onSaved = vi.fn().mockResolvedValue(undefined)

		render(
			<PPTSpeakerNotesPanel
				slideIndex={0}
				rawContent="<main>Slide</main>"
				fileId="slide-1"
				allowEdit
				saveEditContent={saveEditContent}
				onSaved={onSaved}
			/>,
		)

		await screen.findByTestId("ppt-speaker-notes-editor")
		const editor = screen.getByTestId("ppt-speaker-notes-editor")
		fireEvent.change(editor, { target: { value: "Introduce the key point." } })
		fireEvent.blur(editor)

		await waitFor(() => expect(saveEditContent).toHaveBeenCalledTimes(1))
		const savedContent = unshadow(saveEditContent.mock.calls[0][0])
		expect(savedContent).toContain("data-magic-slide-notes")
		expect(saveEditContent.mock.calls[0].slice(1)).toEqual([
			"slide-1",
			true,
			undefined,
			true,
			false,
			{ silent: true },
		])
		expect(onSaved).toHaveBeenCalledWith(
			expect.stringContaining("Introduce the key point."),
			"slide-1",
		)
		expect(screen.getByTestId("ppt-speaker-notes-editor")).toHaveValue(
			"Introduce the key point.",
		)
	})

	it("keeps the panel read-only when editing is disabled", () => {
		render(
			<PPTSpeakerNotesPanel
				slideIndex={0}
				rawContent="<template data-magic-slide-notes>Read only</template>"
				fileId="slide-1"
				allowEdit={false}
				onSaved={vi.fn().mockResolvedValue(undefined)}
			/>,
		)

		expect(screen.getByTestId("ppt-speaker-notes-panel")).toHaveTextContent("Read only")
		expect(screen.queryByTestId("ppt-speaker-notes-editor")).not.toBeInTheDocument()
	})

	it("keeps presenter reading size across slides without saving note content", () => {
		const saveEditContent = vi.fn()
		const props = {
			layout: "presenter" as const,
			slideIndex: 0,
			fileId: "one",
			rawContent: "<template data-magic-slide-notes>Notes</template>",
			allowEdit: false,
			onSaved: vi.fn(),
			saveEditContent,
		}
		const view = render(<PPTSpeakerNotesPanel {...props} />)
		fireEvent.click(screen.getByLabelText("ppt.speakerNotes.increaseFontSize"))
		const zoom = screen.getByTestId("ppt-speaker-notes-content").style.zoom
		expect(Number(zoom)).toBeGreaterThan(1)
		view.rerender(<PPTSpeakerNotesPanel {...props} slideIndex={1} fileId="two" />)
		expect(screen.getByTestId("ppt-speaker-notes-content").style.zoom).toBe(zoom)
		for (let i = 0; i < 20; i++)
			fireEvent.click(screen.getByLabelText("ppt.speakerNotes.decreaseFontSize"))
		expect(screen.getByLabelText("ppt.speakerNotes.decreaseFontSize")).toBeDisabled()
		expect(saveEditContent).not.toHaveBeenCalled()
	})

	it("fills the dedicated presenter panel without resize or overlay behavior", () => {
		pptNotesPreferenceStore.setHeight(300)
		render(
			<PPTSpeakerNotesPanel
				layout="presenter"
				slideIndex={0}
				rawContent="<template data-magic-slide-notes>Presenter notes</template>"
				fileId="slide-1"
				allowEdit={false}
				onSaved={vi.fn().mockResolvedValue(undefined)}
			/>,
		)

		const panel = screen.getByTestId("ppt-speaker-notes-panel")
		expect(panel).toHaveAttribute("data-layout", "presenter")
		expect(panel).toHaveClass("h-full", "col-start-2", "row-start-2")
		expect(panel).not.toHaveAttribute("data-overlay")
		expect(panel).not.toHaveAttribute("style")
		expect(
			screen.queryByRole("button", { name: "ppt.speakerNotes.resize" }),
		).not.toBeInTheDocument()
		expect(screen.queryByTestId("ppt-speaker-notes-spacer")).not.toBeInTheDocument()
	})

	it("merges notes into the latest slide HTML before saving", async () => {
		const saveEditContent = vi.fn().mockResolvedValue(true)
		const onSaved = vi.fn().mockResolvedValue(undefined)
		let latestRawContent = "<main>AI updated slide</main>"

		render(
			<PPTSpeakerNotesPanel
				slideIndex={0}
				rawContent="<main>Original slide</main>"
				fileId="slide-1"
				getLatestRawContent={() => latestRawContent}
				allowEdit
				saveEditContent={saveEditContent}
				onSaved={onSaved}
			/>,
		)

		await screen.findByTestId("ppt-speaker-notes-editor")
		fireEvent.change(screen.getByTestId("ppt-speaker-notes-editor"), {
			target: { value: "Keep this AI change." },
		})
		latestRawContent = "<main>AI changed again</main>"
		fireEvent.blur(screen.getByTestId("ppt-speaker-notes-editor"))

		await waitFor(() => expect(saveEditContent).toHaveBeenCalledTimes(1))
		expect(unshadow(saveEditContent.mock.calls[0][0])).toContain(
			"<main>AI changed again</main>",
		)
	})

	it("retries once when the slide changes during the save request", async () => {
		let resolveFirstSave: ((value: boolean) => void) | undefined
		const saveEditContent = vi
			.fn()
			.mockImplementationOnce(
				() =>
					new Promise<boolean>((resolve) => {
						resolveFirstSave = resolve
					}),
			)
			.mockResolvedValue(true)
		const onSaved = vi.fn().mockResolvedValue(undefined)
		let latestRawContent = "<main>Original slide</main>"

		render(
			<PPTSpeakerNotesPanel
				slideIndex={0}
				rawContent={latestRawContent}
				fileId="slide-1"
				getLatestRawContent={() => latestRawContent}
				allowEdit
				saveEditContent={saveEditContent}
				onSaved={onSaved}
			/>,
		)

		await screen.findByTestId("ppt-speaker-notes-editor")
		fireEvent.change(screen.getByTestId("ppt-speaker-notes-editor"), {
			target: { value: "Keep my notes." },
		})
		fireEvent.blur(screen.getByTestId("ppt-speaker-notes-editor"))
		await waitFor(() => expect(saveEditContent).toHaveBeenCalledTimes(1))

		latestRawContent = "<main>AI updated while saving</main>"
		resolveFirstSave?.(true)

		await waitFor(() => expect(saveEditContent).toHaveBeenCalledTimes(2))
		expect(unshadow(saveEditContent.mock.calls[1][0])).toContain(
			"<main>AI updated while saving</main>",
		)
	})

	it("keeps rebasing until concurrent slide updates stop", async () => {
		let latestRawContent = "<main>Version 1</main>"
		const saveEditContent = vi.fn().mockImplementation(async () => {
			if (saveEditContent.mock.calls.length === 1) {
				latestRawContent = "<main>Version 2</main>"
			} else if (saveEditContent.mock.calls.length === 2) {
				latestRawContent = "<main>Version 3</main>"
			}
			return true
		})

		render(
			<PPTSpeakerNotesPanel
				slideIndex={0}
				rawContent={latestRawContent}
				fileId="slide-1"
				getLatestRawContent={() => latestRawContent}
				allowEdit
				saveEditContent={saveEditContent}
				onSaved={vi.fn().mockResolvedValue(undefined)}
			/>,
		)

		await screen.findByTestId("ppt-speaker-notes-editor")
		fireEvent.change(screen.getByTestId("ppt-speaker-notes-editor"), {
			target: { value: "Stable note" },
		})
		fireEvent.blur(screen.getByTestId("ppt-speaker-notes-editor"))

		await waitFor(() => expect(saveEditContent).toHaveBeenCalledTimes(3))
		expect(unshadow(saveEditContent.mock.calls[2][0])).toContain("<main>Version 3</main>")
	})

	it("stops safely instead of overwriting when the slide never stabilizes", async () => {
		let version = 0
		const saveEditContent = vi.fn().mockImplementation(async () => {
			version += 1
			return true
		})
		const onSaved = vi.fn().mockResolvedValue(undefined)

		render(
			<PPTSpeakerNotesPanel
				slideIndex={0}
				rawContent="<main>Version 0</main>"
				fileId="slide-1"
				getLatestRawContent={() => `<main>Version ${version}</main>`}
				allowEdit
				saveEditContent={saveEditContent}
				onSaved={onSaved}
			/>,
		)

		await screen.findByTestId("ppt-speaker-notes-editor")
		fireEvent.change(screen.getByTestId("ppt-speaker-notes-editor"), {
			target: { value: "Do not lose this note" },
		})
		fireEvent.blur(screen.getByTestId("ppt-speaker-notes-editor"))

		await waitFor(() => expect(saveEditContent).toHaveBeenCalledTimes(4))
		expect(onSaved).not.toHaveBeenCalled()
		expect(screen.getByTestId("ppt-speaker-notes-panel")).toHaveTextContent(
			"ppt.speakerNotes.saveFailed",
		)
	})
})

describe("all-slide notes", () => {
	const slides = [
		{ key: "first", fileId: "first", slideIndex: 0, rawContent: "<main>First</main>" },
		{ key: "second", fileId: "second", slideIndex: 1, rawContent: "<main>Second</main>" },
	]
	function props() {
		return {
			slides,
			fileId: "first",
			slideIndex: 0,
			rawContent: slides[0].rawContent,
			allowEdit: true,
			saveEditContent: vi.fn().mockResolvedValue(true),
			onSaved: vi.fn().mockResolvedValue(undefined),
		}
	}
	const openAll = () =>
		fireEvent.click(screen.getByRole("button", { name: "ppt.speakerNotes.allPages" }))
	const openCurrent = () =>
		fireEvent.click(screen.getByRole("button", { name: "ppt.speakerNotes.currentPage" }))

	it("keeps the resize handle and shared height when switching note views", () => {
		pptNotesPreferenceStore.setHeight(250)
		render(<PPTSpeakerNotesPanel {...props()} />)
		const panel = screen.getByTestId("ppt-speaker-notes-panel")
		const handle = screen.getByRole("button", { name: "ppt.speakerNotes.resize" })
		openAll()
		expect(handle).toBeVisible()
		expect(panel).toHaveStyle({ height: "250px" })
		fireEvent.keyDown(handle, { key: "ArrowUp" })
		expect(panel).toHaveStyle({ height: "270px" })
		expect(panel).toHaveAttribute("data-overlay", "true")
		expect(pptNotesPreferenceStore.height).toBe(270)
		openCurrent()
		expect(panel).toHaveStyle({ height: "270px" })
		openAll()
		fireEvent.keyDown(handle, { key: "ArrowDown" })
		expect(panel).toHaveStyle({ height: "250px" })
		expect(panel).not.toHaveAttribute("data-overlay")
	})

	it("restores overview and unsaved drafts after leaving presenter layout", () => {
		const input = props()
		const { rerender } = render(<PPTSpeakerNotesPanel {...input} />)
		openAll()
		const editors = screen.getAllByTestId("ppt-speaker-notes-editor")
		fireEvent.change(editors[1], { target: { value: "Retain this draft" } })
		rerender(<PPTSpeakerNotesPanel {...input} layout="presenter" allowEdit={false} />)
		expect(
			screen.queryByRole("button", { name: "ppt.speakerNotes.allPages" }),
		).not.toBeInTheDocument()
		expect(editors[1]).not.toBeVisible()
		rerender(<PPTSpeakerNotesPanel {...input} />)
		expect(screen.getByRole("button", { name: "ppt.speakerNotes.allPages" })).toHaveAttribute(
			"aria-pressed",
			"true",
		)
		expect(screen.getAllByTestId("ppt-speaker-notes-editor")[1]).toBeVisible()
		expect(screen.getAllByTestId("ppt-speaker-notes-editor")[1]).toHaveValue(
			"Retain this draft",
		)
	})

	it("reports silent save progress beside the editor toolbar and keeps success after content sync", async () => {
		const input = props()
		let finish!: (value: boolean) => void
		input.saveEditContent.mockImplementation(
			() =>
				new Promise((resolve) => {
					finish = resolve
				}),
		)
		const { rerender } = render(<PPTSpeakerNotesPanel {...input} />)
		fireEvent.change(screen.getByTestId("ppt-speaker-notes-editor"), {
			target: { value: "New notes" },
		})
		expect(screen.queryByTestId("ppt-notes-save-status")).toBeNull()
		fireEvent.click(screen.getByRole("button", { name: "ppt.speakerNotes.save" }))
		expect(screen.getByTestId("ppt-notes-save-status")).toHaveTextContent(
			"ppt.speakerNotes.saving",
		)
		expect(input.saveEditContent.mock.calls[0].slice(-2)).toEqual([false, { silent: true }])
		await act(async () => finish(true))
		const content = input.onSaved.mock.calls[0][0]
		rerender(
			<PPTSpeakerNotesPanel
				{...input}
				rawContent={content}
				slides={[{ ...slides[0], rawContent: content }, slides[1]]}
			/>,
		)
		expect(screen.getByTestId("ppt-notes-save-status")).toHaveTextContent(
			"ppt.speakerNotes.saved",
		)
		expect(
			screen.getByTestId("ppt-notes-save-status").closest("[data-notes-editor]"),
		).not.toBeNull()
	})

	it("sends overview AI actions to the hovered file rather than the canvas", async () => {
		const input = props()
		const onGenerate = vi.fn().mockResolvedValue("New script")
		render(<PPTSpeakerNotesPanel {...input} onGenerate={onGenerate} />)
		openAll()
		fireEvent.change(screen.getAllByTestId("ppt-speaker-notes-editor")[1], {
			target: { value: "Second page script" },
		})
		fireEvent.click(screen.getAllByRole("button", { name: "ppt.speakerNotes.polish" })[1])
		await waitFor(() =>
			expect(onGenerate).toHaveBeenCalledWith(
				"polish",
				"second",
				"Second page script",
				expect.any(AbortSignal),
			),
		)
		expect(input.saveEditContent).not.toHaveBeenCalled()
	})

	it("does not expose overview AI actions in read-only mode", () => {
		render(<PPTSpeakerNotesPanel {...props()} allowEdit={false} onGenerate={vi.fn()} />)
		openAll()
		expect(
			screen.queryByRole("button", { name: "ppt.speakerNotes.generate" }),
		).not.toBeInTheDocument()
	})

	it("shares drafts across views and saves another page by file identity", async () => {
		const input = props()
		render(<PPTSpeakerNotesPanel {...input} />)
		const original = screen.getByTestId("ppt-speaker-notes-editor")
		fireEvent.change(original, { target: { value: "First draft" } })
		openAll()
		const editors = screen.getAllByTestId("ppt-speaker-notes-editor")
		expect(editors[0]).toBe(original)
		expect(editors[0]).toHaveValue("First draft")
		fireEvent.change(editors[1], { target: { value: "Second draft" } })
		fireEvent.blur(editors[1], { relatedTarget: editors[0] })
		await waitFor(() =>
			expect(input.onSaved).toHaveBeenCalledWith(
				expect.stringContaining("Second draft"),
				"second",
			),
		)
		expect(unshadow(input.saveEditContent.mock.calls[0][0])).toContain("<main>Second</main>")
		openCurrent()
		expect(original).toBeVisible()
		expect(original).toHaveValue("First draft")
	})

	it("retains a failed non-current draft and permits retry after reopening", async () => {
		const input = props()
		input.saveEditContent.mockResolvedValueOnce(false)
		render(<PPTSpeakerNotesPanel {...input} />)
		openAll()
		const editor = screen.getAllByTestId("ppt-speaker-notes-editor")[1]
		fireEvent.change(editor, { target: { value: "Keep second draft" } })
		fireEvent.blur(editor)
		await screen.findByText("ppt.speakerNotes.saveFailed")
		openCurrent()
		expect(editor).not.toBeVisible()
		openAll()
		expect(screen.getAllByTestId("ppt-speaker-notes-editor")[1]).toBeVisible()
		expect(screen.getAllByTestId("ppt-speaker-notes-editor")[1]).toHaveValue(
			"Keep second draft",
		)
		fireEvent.click(screen.getByRole("button", { name: "ppt.speakerNotes.save" }))
		await waitFor(() =>
			expect(input.onSaved).toHaveBeenCalledWith(
				expect.stringContaining("Keep second draft"),
				"second",
			),
		)
	})

	it("finishes a pending save against its original file after view changes and reordering", async () => {
		const input = props()
		let finish!: (value: boolean) => void
		input.saveEditContent.mockImplementation(
			() =>
				new Promise((resolve) => {
					finish = resolve
				}),
		)
		const { rerender } = render(<PPTSpeakerNotesPanel {...input} />)
		openAll()
		fireEvent.change(screen.getAllByTestId("ppt-speaker-notes-editor")[1], {
			target: { value: "Reordered note" },
		})
		fireEvent.blur(screen.getAllByTestId("ppt-speaker-notes-editor")[1])
		openCurrent()
		rerender(
			<PPTSpeakerNotesPanel
				{...input}
				slideIndex={1}
				slides={[
					{ ...slides[1], slideIndex: 0 },
					{ ...slides[0], slideIndex: 1 },
				]}
			/>,
		)
		await act(async () => finish(true))
		expect(input.onSaved).toHaveBeenCalledWith(
			expect.stringContaining("Reordered note"),
			"second",
		)
	})

	it("loads only when opened and retries unavailable pages without allowing empty edits", async () => {
		const input = props()
		const onLoadSlide = vi.fn().mockResolvedValue(false)
		const pending = [slides[0], { ...slides[1], rawContent: undefined }]
		const { rerender } = render(
			<PPTSpeakerNotesPanel {...input} slides={pending} onLoadSlide={onLoadSlide} />,
		)
		expect(onLoadSlide).not.toHaveBeenCalled()
		openAll()
		await screen.findByText("ppt.speakerNotes.loadFailed")
		expect(screen.getAllByTestId("ppt-speaker-notes-editor")).toHaveLength(1)
		expect(onLoadSlide).toHaveBeenCalledWith("second")
		fireEvent.click(screen.getByRole("button", { name: "ppt.speakerNotes.retry" }))
		await waitFor(() => expect(onLoadSlide).toHaveBeenCalledTimes(2))
		rerender(<PPTSpeakerNotesPanel {...input} onLoadSlide={onLoadSlide} />)
		expect(screen.getAllByTestId("ppt-speaker-notes-editor")).toHaveLength(2)
	})

	it("keeps all notes read-only in shared previews", () => {
		render(<PPTSpeakerNotesPanel {...props()} allowEdit={false} />)
		openAll()
		expect(screen.queryByTestId("ppt-speaker-notes-editor")).not.toBeInTheDocument()
		expect(screen.getAllByText("ppt.speakerNotes.empty")).toHaveLength(2)
		expect(
			screen.queryByRole("button", { name: "ppt.speakerNotes.save" }),
		).not.toBeInTheDocument()
	})

	it("discards pending AI when an overview editor becomes hidden", async () => {
		const input = props()
		let finish!: (value: string) => void
		const onGenerate = vi.fn(
			() =>
				new Promise<string>((resolve) => {
					finish = resolve
				}),
		)
		const { rerender } = render(<PPTSpeakerNotesPanel {...input} onGenerate={onGenerate} />)
		openAll()
		openCurrent()
		fireEvent.change(screen.getAllByTestId("ppt-speaker-notes-editor")[0], {
			target: { value: "First draft" },
		})
		fireEvent.click(screen.getByRole("button", { name: "ppt.speakerNotes.polish" }))
		rerender(
			<PPTSpeakerNotesPanel
				{...input}
				fileId="second"
				slideIndex={1}
				rawContent={slides[1].rawContent}
				onGenerate={onGenerate}
			/>,
		)
		await act(async () => finish("Late result"))
		expect(patchMock.propose).not.toHaveBeenCalled()
	})
})
