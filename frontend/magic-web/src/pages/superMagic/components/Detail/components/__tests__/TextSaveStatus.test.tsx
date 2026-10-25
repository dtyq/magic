import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { TextFileSession } from "../../types"
import { TextSaveStatus } from "../TextSaveStatus"

const queueStage = vi.hoisted(() => ({ value: "idle" as "idle" | "saving" | "saved" }))

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock("../../contents/HTML/hooks/useSaveConfirmation", () => ({
	useSaveConfirmation: () => queueStage.value,
}))

function createSession(saveStage: TextFileSession["saveStage"]): TextFileSession {
	return {
		content: "",
		draft: "",
		loading: false,
		loadError: false,
		saving: false,
		saveStage,
		setDraft: vi.fn(),
		refresh: vi.fn(),
		save: vi.fn(),
	}
}

describe("TextSaveStatus", () => {
	it("shows nothing while the file is idle", () => {
		queueStage.value = "idle"
		render(<TextSaveStatus fileId="file-1" />)
		expect(screen.queryByRole("status")).toBeNull()
	})

	it("shows the top-right saving and saved chip for queued saves", () => {
		queueStage.value = "saving"
		const { rerender } = render(<TextSaveStatus fileId="file-1" />)
		expect(screen.getByRole("status")).toHaveTextContent("detail.fileSave.syncing")
		expect(screen.getByRole("status")).toHaveClass("absolute", "right-3", "top-3")

		queueStage.value = "saved"
		rerender(<TextSaveStatus fileId="file-1" />)
		expect(screen.getByRole("status")).toHaveTextContent("common.saveSuccess")
	})

	it("follows the session stage instead of the queue for standalone sessions", () => {
		queueStage.value = "saved"
		const { rerender } = render(
			<TextSaveStatus fileId="file-1" textFileSession={createSession("idle")} />,
		)
		expect(screen.queryByRole("status")).toBeNull()

		rerender(<TextSaveStatus fileId="file-1" textFileSession={createSession("saved")} />)
		expect(screen.getByRole("status")).toHaveTextContent("common.saveSuccess")
	})
})
