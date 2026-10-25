import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import ShareMobileAudioRecordingDetailPage from "../ShareMobileAudioRecordingDetailPage"

const {
	useShareRecordingDetailDataMock,
	sourcePanelPropsMock,
	summaryPanelPropsMock,
	sheetPropsMock,
} = vi.hoisted(() => ({
	useShareRecordingDetailDataMock: vi.fn(),
	sourcePanelPropsMock: vi.fn(),
	summaryPanelPropsMock: vi.fn(),
	sheetPropsMock: vi.fn(),
}))

/** Builds deterministic readonly share data so UI tests never rely on real recording content. */
function createShareDetailData() {
	return {
		loading: false,
		error: null,
		fileMap: {
			audio: { file_id: "audio-share-001", file_name: "share-audio.wav" },
			transcript: { file_id: "transcript-share-001", file_name: "share-transcript.md" },
			notes: { file_id: "notes-share-001", file_name: "share-notes.md" },
			summaryFiles: [{ type: "summary", file: { file_id: "summary-share-001" } }],
			magicProjectConfig: {
				files: { notes: "notes/share-notes.md" },
				metadata: {
					speakers: { "Speaker-1": "Speaker A" },
				},
			},
		},
		texts: {
			transcript: { content: "mock transcript" },
			notes: { content: "mock notes" },
			summary: { summary: { content: "mock summary" }, topics: { content: "" } },
		},
		audioUrl: "https://example.com/mock-audio.wav",
		title: "Mock Share Recording",
		attachmentList: [],
	}
}

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const labels: Record<string, string> = {
				"detail.loading": "Loading",
				"detail.loadFailed": "Load failed",
				"detail.untitled": "Untitled",
				"detail.tabs.source": "Source",
				"detail.tabs.summaryRoot": "Summary",
				"card.moreActions": "More actions",
				"share.copyProject": "Copy project",
				"share.login": "Log in",
			}
			return labels[key] ?? key
		},
	}),
}))

vi.mock("@/pages/superMagic/pages/AudioRecordings/hooks/useShareRecordingDetailData", () => ({
	useShareRecordingDetailData: (...args: unknown[]) => useShareRecordingDetailDataMock(...args),
}))

vi.mock("../hooks/useMobileRecordingAudioPlayer", () => ({
	useMobileRecordingAudioPlayer: () => ({
		audioRef: { current: null },
		playing: false,
		currentTime: 0,
		duration: 180,
		playbackRate: 1,
		toggle: vi.fn(),
		seekTo: vi.fn(),
		playSegment: vi.fn(),
		setPlaybackRate: vi.fn(),
	}),
}))

vi.mock("@/pages/superMagic/pages/AudioRecordings/hooks/useRecordingPlayerCurrentSec", () => ({
	useRecordingPlayerCurrentSec: () => 0,
}))

vi.mock("@/pages/superMagic/pages/AudioRecordings/hooks/useRecordingColorSegments", () => ({
	useRecordingColorSegments: () => [],
}))

vi.mock("@/pages/superMagic/pages/AudioRecordings/utils/download-recording-audio", () => ({
	downloadRecordingAudioFile: vi.fn(),
}))

vi.mock("@/layouts/BaseLayout/components/Header/components/Logo", () => ({
	default: ({ className }: { className?: string }) => (
		<div data-testid="share-mobile-logo" className={className} />
	),
}))

vi.mock("../components/MobileRecordingSourcePanel", () => ({
	MobileRecordingSourcePanel: (props: unknown) => {
		sourcePanelPropsMock(props)
		return <div data-testid="mock-source-panel">Source panel</div>
	},
}))

vi.mock("../components/MobileRecordingSummaryPanel", () => ({
	MobileRecordingSummaryPanel: (props: unknown) => {
		summaryPanelPropsMock(props)
		return <div data-testid="mock-summary-panel">Summary panel</div>
	},
}))

vi.mock("../components/MobileRecordingAudioPlayer", () => ({
	MobileRecordingAudioPlayer: ({
		hidden,
		onExpandedChange,
	}: {
		hidden?: boolean
		onExpandedChange?: (expanded: boolean) => void
	}) => (
		<div data-testid="mock-audio-player" data-hidden={hidden ? "true" : "false"}>
			<button type="button" onClick={() => onExpandedChange?.(true)}>
				Expand player
			</button>
			Player
		</div>
	),
}))

vi.mock("../components/MobileRecordingShareExportSheet", () => ({
	MobileRecordingShareExportSheet: (props: {
		open: boolean
		showShareSection?: boolean
		allowDownload?: boolean
		showCopyProject?: boolean
		copyProjectLabel?: string
		showLogin?: boolean
		loginLabel?: string
		onOpenChange: (open: boolean) => void
		onSearch?: () => void
		onCopyProject?: () => void
		onLogin?: () => void
	}) => {
		sheetPropsMock(props)
		if (!props.open) return null
		return (
			<div data-testid="mobile-recording-share-export-sheet">
				<div>{props.showShareSection ? "Share visible" : "Share hidden"}</div>
				<div>{props.allowDownload ? "Download allowed" : "Download blocked"}</div>
				<button type="button" onClick={() => props.onOpenChange(false)}>
					Close
				</button>
				{props.onSearch ? (
					<button type="button" onClick={props.onSearch}>
						Search content
					</button>
				) : null}
				{props.showCopyProject ? (
					<button type="button" onClick={props.onCopyProject}>
						{props.copyProjectLabel}
					</button>
				) : null}
				{props.showLogin ? (
					<button type="button" onClick={props.onLogin}>
						{props.loginLabel}
					</button>
				) : null}
			</div>
		)
	},
}))

describe("ShareMobileAudioRecordingDetailPage", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		useShareRecordingDetailDataMock.mockReturnValue(createShareDetailData())
	})

	it("requires both config declaration and an authorized notes attachment", () => {
		const configuredDetail = createShareDetailData()
		useShareRecordingDetailDataMock.mockReturnValue(configuredDetail)
		const { rerender } = render(
			<ShareMobileAudioRecordingDetailPage
				projectId="project-share-001"
				resourceName="Mock resource"
				allowDownloadProjectFile
				attachments={{ tree: [], list: [] }}
			/>,
		)
		fireEvent.click(screen.getByText("Source"))
		expect(sourcePanelPropsMock).toHaveBeenLastCalledWith(
			expect.objectContaining({ showNotesTab: true }),
		)

		useShareRecordingDetailDataMock.mockReturnValue({
			...configuredDetail,
			fileMap: { ...configuredDetail.fileMap, notes: undefined },
		})
		rerender(
			<ShareMobileAudioRecordingDetailPage
				projectId="project-share-002"
				resourceName="Mock resource"
				allowDownloadProjectFile
				attachments={{ tree: [], list: [] }}
			/>,
		)
		expect(sourcePanelPropsMock).toHaveBeenLastCalledWith(
			expect.objectContaining({ showNotesTab: false }),
		)
	})

	it("renders the readonly share header with the brand logo and no direct export button", () => {
		render(
			<ShareMobileAudioRecordingDetailPage
				projectId="project-share-001"
				resourceName="Mock resource"
				allowDownloadProjectFile
				attachments={{ tree: [], list: [] }}
			/>,
		)

		expect(screen.getByText("Source")).toBeInTheDocument()
		expect(screen.getByText("Summary")).toBeInTheDocument()
		expect(screen.getByTestId("share-mobile-logo")).toBeInTheDocument()
		expect(screen.getByText("Mock Share Recording")).toBeInTheDocument()
		expect(screen.getByLabelText("More actions")).toBeInTheDocument()
		expect(screen.queryByLabelText("detail.exportSection")).not.toBeInTheDocument()
		expect(screen.getByTestId("mock-summary-panel").parentElement).toHaveClass(
			"flex",
			"min-h-0",
			"flex-1",
			"overflow-hidden",
		)
	})

	it("does not reserve space for the removed outer share header", () => {
		render(
			<ShareMobileAudioRecordingDetailPage
				projectId="project-share-001"
				resourceName="Mock resource"
				allowDownloadProjectFile
				attachments={{ tree: [], list: [] }}
			/>,
		)

		expect(screen.getByTestId("mobile-recording-share-page")).not.toHaveStyle({
			paddingTop: "calc(52px + var(--safe-area-inset-top,0px))",
		})
		expect(screen.getByTestId("mobile-recording-share-sticky-header")).toHaveClass("top-0")
	})

	it("opens the export sheet from the more button and keeps share actions hidden", () => {
		render(
			<ShareMobileAudioRecordingDetailPage
				projectId="project-share-001"
				resourceName="Mock resource"
				allowDownloadProjectFile
				attachments={{ tree: [], list: [] }}
			/>,
		)

		fireEvent.click(screen.getByLabelText("More actions"))

		expect(screen.getByTestId("mobile-recording-share-export-sheet")).toBeInTheDocument()
		expect(screen.getByText("Share hidden")).toBeInTheDocument()
		expect(sheetPropsMock).toHaveBeenLastCalledWith(
			expect.objectContaining({
				open: true,
				showShareSection: false,
				allowDownload: true,
			}),
		)
	})

	it("passes copy and login actions into the more menu", () => {
		const onCopyProject = vi.fn()
		const onLogin = vi.fn()
		render(
			<ShareMobileAudioRecordingDetailPage
				projectId="project-share-001"
				resourceName="Mock resource"
				allowDownloadProjectFile
				showCopyProject
				copyProjectLabel="Copy project"
				showLogin
				loginLabel="Log in"
				onCopyProject={onCopyProject}
				onLogin={onLogin}
				attachments={{ tree: [], list: [] }}
			/>,
		)

		fireEvent.click(screen.getByLabelText("More actions"))
		fireEvent.click(screen.getByRole("button", { name: "Copy project" }))
		expect(onCopyProject).toHaveBeenCalledOnce()

		fireEvent.click(screen.getByLabelText("More actions"))
		fireEvent.click(screen.getByRole("button", { name: "Log in" }))
		expect(onLogin).toHaveBeenCalledOnce()
	})

	it("adds extra bottom reading room on top of the floating player offset", () => {
		render(
			<ShareMobileAudioRecordingDetailPage
				projectId="project-share-001"
				resourceName="Mock resource"
				allowDownloadProjectFile
				attachments={{ tree: [], list: [] }}
			/>,
		)

		expect(summaryPanelPropsMock).toHaveBeenCalledWith(
			expect.objectContaining({
				scrollPaddingBottom:
					"calc(max(24px, var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))) + 40px + 44px)",
			}),
		)

		fireEvent.click(screen.getByRole("button", { name: "Source" }))

		expect(sourcePanelPropsMock).toHaveBeenCalledWith(
			expect.objectContaining({
				scrollPaddingBottom:
					"calc(max(24px, var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))) + 40px + 44px)",
			}),
		)
	})

	it("forwards player expansion to the outer share shell", () => {
		const onPlayerExpandedChange = vi.fn()
		render(
			<ShareMobileAudioRecordingDetailPage
				projectId="project-share-001"
				resourceName="Mock resource"
				allowDownloadProjectFile
				onPlayerExpandedChange={onPlayerExpandedChange}
				attachments={{ tree: [], list: [] }}
			/>,
		)

		fireEvent.click(screen.getByRole("button", { name: "Expand player" }))

		expect(onPlayerExpandedChange).toHaveBeenCalledWith(true)
	})

	it("switches between source and summary tabs without changing readonly behavior", () => {
		render(
			<ShareMobileAudioRecordingDetailPage
				projectId="project-share-001"
				resourceName="Mock resource"
				allowDownloadProjectFile
				attachments={{ tree: [], list: [] }}
			/>,
		)

		expect(screen.getByTestId("mock-summary-panel")).toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "Source" }))
		expect(screen.getByTestId("mock-source-panel")).toBeInTheDocument()
		expect(sourcePanelPropsMock).toHaveBeenLastCalledWith(
			expect.objectContaining({
				availableSpeakerIds: [],
				selectedSpeakerIds: [],
				onSelectedSpeakerIdsChange: expect.any(Function),
			}),
		)
	})

	it("keeps search available when download permission is unavailable", () => {
		render(
			<ShareMobileAudioRecordingDetailPage
				projectId="project-share-001"
				resourceName="Mock resource"
				allowDownloadProjectFile={false}
				attachments={{ tree: [], list: [] }}
			/>,
		)

		fireEvent.click(screen.getByLabelText("More actions"))
		expect(screen.getByText("Download blocked")).toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "Search content" }))
		expect(screen.getByTestId("mobile-recording-share-content-search-root")).toBeInTheDocument()
		expect(screen.getByTestId("mock-audio-player")).toHaveAttribute("data-hidden", "true")
	})
})
