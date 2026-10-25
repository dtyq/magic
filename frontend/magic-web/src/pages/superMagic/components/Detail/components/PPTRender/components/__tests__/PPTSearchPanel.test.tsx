import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import PPTSearchPanel from "../PPTSearchPanel"
import type { PPTStore } from "../../stores/PPTStore"

const { read } = vi.hoisted(() => ({ read: vi.fn().mockResolvedValue("<p>needle</p>") }))
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
const fileApi = { identityKey: "share:test", getFileContentById: read }
vi.mock("@/pages/superMagic/fileAccess/fileApi", () => ({ useFileApi: () => fileApi }))
vi.mock("../../services/pptFileMutation", () => ({ PPTFileMutationError: class extends Error {} }))

describe("PPTSearchPanel", () => {
	it("renders read-only matches with hidden markers and no replacement controls", async () => {
		const onNavigate = vi.fn().mockResolvedValue(undefined)
		const client = { read: vi.fn(), save: vi.fn() }
		const store = {
			slides: [{ path: "a.html", index: 0 }],
			getFileIdByPath: () => "file-a",
		} as unknown as PPTStore
		render(
			<PPTSearchPanel
				open
				onOpenChange={vi.fn()}
				deckKey="deck"
				store={store}
				selectedIds={new Set()}
				hiddenPaths={new Set(["a.html"])}
				allowEdit={false}
				busy={false}
				client={client}
				runWrite={vi.fn()}
				onNavigate={onNavigate}
			/>,
		)
		fireEvent.change(screen.getByLabelText("ppt.search.query"), { target: { value: "needle" } })
		expect(await screen.findByText("needle")).toBeInTheDocument()
		expect(screen.getByText("ppt.search.hidden")).toBeInTheDocument()
		expect(screen.queryByLabelText("ppt.search.replacement")).not.toBeInTheDocument()
		expect(screen.queryByText("ppt.search.replaceAll")).not.toBeInTheDocument()
		fireEvent.click(screen.getByText("needle"))
		await waitFor(() => expect(onNavigate).toHaveBeenCalledWith(0))
		expect(client.read).not.toHaveBeenCalled()
		expect(client.save).not.toHaveBeenCalled()
	})
})
