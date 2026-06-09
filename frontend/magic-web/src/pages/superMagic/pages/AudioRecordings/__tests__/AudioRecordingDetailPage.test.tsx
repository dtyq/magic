import { describe, expect, it, vi, beforeEach } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import AudioRecordingDetailPage from "../AudioRecordingDetailPage"
import { RouteName } from "@/routes/constants"

const navigateMock = vi.fn()
const initializeStateMock = vi.fn().mockResolvedValue(undefined)
const locationStateMock = vi.hoisted(() => ({
	projectName: "Weekly sync",
	cardStatus: "summarized" as "summarized" | "not_summarized" | "summarizing",
	audioFileId: undefined as string | undefined,
}))

vi.mock("react-router", async () => {
	const actual = await vi.importActual<typeof import("react-router")>("react-router")
	return {
		...actual,
		useParams: () => ({ projectId: "project-alpha" }),
		useLocation: () => ({
			state: locationStateMock,
		}),
	}
})

vi.mock("@/routes/hooks/useNavigate", () => ({
	default: () => navigateMock,
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const labels: Record<string, string> = {
				"detail.back": "Back",
				"detail.loading": "Loading",
				"detail.entryNotFound": "Entry not found",
				"detail.audioNotFound": "Audio not found",
				"detail.openProject": "View project",
				"detail.openingProject": "Opening project",
				"detail.untitled": "Untitled",
			}
			return labels[key] ?? key
		},
	}),
}))

vi.mock("@/pages/superMagic/components/Detail", () => ({
	default: () => <div data-testid="detail-mock" />,
}))

const getAttachmentsByProjectIdMock = vi.fn()

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getAttachmentsByProjectId: (...args: unknown[]) => getAttachmentsByProjectIdMock(...args),
	},
}))

vi.mock("../stores/audio-recordings-store", () => ({
	AudioRecordingsStore: vi.fn().mockImplementation(() => ({
		fetchProjectName: vi.fn().mockResolvedValue(null),
	})),
}))

vi.mock("@/pages/superMagic/services", () => ({
	default: {
		initializeState: (...args: unknown[]) => initializeStateMock(...args),
	},
}))

describe("AudioRecordingDetailPage", () => {
	beforeEach(() => {
		navigateMock.mockReset()
		initializeStateMock.mockClear()
		getAttachmentsByProjectIdMock.mockReset()
		locationStateMock.projectName = "Weekly sync"
		locationStateMock.cardStatus = "summarized"
		locationStateMock.audioFileId = undefined
	})

	it("shows open-project fallback when html entry is missing", async () => {
		getAttachmentsByProjectIdMock.mockResolvedValue({ tree: [], list: [] })

		render(<AudioRecordingDetailPage />)

		expect(await screen.findByText("Entry not found")).toBeInTheDocument()
		expect(screen.getByTestId("audio-recording-detail-open-project")).toBeInTheDocument()
	})

	it("does not show open-project fallback when raw audio is missing", async () => {
		locationStateMock.cardStatus = "not_summarized"
		locationStateMock.audioFileId = "file-missing"
		getAttachmentsByProjectIdMock.mockResolvedValue({ tree: [], list: [] })

		render(<AudioRecordingDetailPage />)

		expect(await screen.findByText("Audio not found")).toBeInTheDocument()
		expect(screen.queryByTestId("audio-recording-detail-open-project")).not.toBeInTheDocument()
	})

	it("initializes Super state then navigates when open-project fallback is clicked", async () => {
		getAttachmentsByProjectIdMock.mockResolvedValue({ tree: [], list: [] })

		render(<AudioRecordingDetailPage />)

		fireEvent.click(await screen.findByTestId("audio-recording-detail-open-project"))

		await vi.waitFor(() => {
			expect(initializeStateMock).toHaveBeenCalledWith({ projectId: "project-alpha" })
		})
		expect(navigateMock).toHaveBeenCalledWith({
			name: RouteName.SuperWorkspaceProjectState,
			params: { projectId: "project-alpha" },
		})
	})
})
