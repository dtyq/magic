import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const store = {
	selectStudy: vi.fn(),
	reportTemplates: [],
	studies: [],
	personas: [],
	personaFileCount: 0,
	studyPersonaPicks: [],
	clearStudyPersonaPicks: vi.fn(),
}

vi.mock("react-i18next", async (importOriginal) => ({
	...(await importOriginal<typeof import("react-i18next")>()),
	useTranslation: () => ({ t: (key: string) => key, i18n: { language: "zh_CN" } }),
}))
vi.mock("@/hooks/useIsMobile", () => ({ useIsMobile: () => false }))
vi.mock("@/routes/hooks/useNavigate", () => ({ useNavigate: () => vi.fn() }))
vi.mock("../context", () => ({ usePersonaResearchStore: () => store }))
vi.mock("../hooks/useResearchEditor", () => ({
	useResearchEditor: () => ({ editorContext: {}, editorNodes: {}, fillComposer: vi.fn() }),
}))
vi.mock("../hooks/useResearchTemplates", () => ({ useResearchTemplates: () => [] }))
vi.mock("../hooks/useStudyActions", () => ({
	useStudyActions: () => ({ openStudy: vi.fn(), requestDelete: vi.fn(), deleteDialog: null }),
}))
vi.mock(
	"@/pages/superMagic/components/MainInputContainer/components/editors/DefaultMessageEditorContainer",
	() => ({
		default: () => null,
	}),
)
vi.mock("@/pages/superMagicMobile/pages/ChatPage/components/MobileInputContainer", () => ({
	default: () => null,
}))
vi.mock("../components/ResearchComposerOptions", () => ({ default: () => null }))
vi.mock("../components/ResearchVoiceCard", () => ({ default: () => null }))
vi.mock("../components/StudyListSection", () => ({ default: () => null }))
vi.mock("../components/StudyPersonaPicks", () => ({ default: () => null }))
vi.mock("../onboarding/ResearchOnboarding", () => ({ default: () => null }))
vi.mock("../onboarding/ResearchHelp", () => ({ default: () => null }))
// The sidebar itself is covered by ResearchHistoryFiles.test; here only its open state matters.
vi.mock("../components/ResearchHistoryFiles", () => ({
	default: ({
		open,
		onOpenChange,
		children,
	}: {
		open: boolean
		onOpenChange: (open: boolean) => void
		children: React.ReactNode
	}) => (
		<>
			{children}
			{open ? (
				<aside data-testid="history-sidebar">
					<button type="button" onClick={() => onOpenChange(false)}>
						sidebar-close
					</button>
				</aside>
			) : null}
		</>
	),
}))

const { default: ResearchHomePage } = await import("../pages/ResearchHomePage")

afterEach(cleanup)

describe("research home history files entry", () => {
	it("opens the sidebar from the top-right entry and closes it again from the same entry", () => {
		render(<ResearchHomePage />)
		const entry = screen.getByRole("button", { name: "home.historyFilesLabel" })
		expect(entry.getAttribute("aria-expanded")).toBe("false")
		expect(screen.queryByTestId("history-sidebar")).toBeNull()

		fireEvent.click(entry)
		expect(screen.getByTestId("history-sidebar")).toBeTruthy()
		expect(entry.getAttribute("aria-expanded")).toBe("true")

		fireEvent.click(entry)
		expect(screen.queryByTestId("history-sidebar")).toBeNull()
	})

	it("closes from the sidebar's own close control and returns focus to the entry", async () => {
		render(<ResearchHomePage />)
		const entry = screen.getByRole("button", { name: "home.historyFilesLabel" })
		fireEvent.click(entry)
		fireEvent.click(screen.getByText("sidebar-close"))
		expect(screen.queryByTestId("history-sidebar")).toBeNull()
		await vi.waitFor(() => expect(document.activeElement).toBe(entry))
	})
})
