import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MobileAudioFolderContent } from "./MobileAudioFolderContent"

const { sourcePanelPropsMock } = vi.hoisted(() => ({
	sourcePanelPropsMock: vi.fn(),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("../../contents/HTML/media/utils", () => ({
	saveMediaSpeakersAndMagicProjectJs: vi.fn(),
}))

vi.mock("@/pages/superMagic/pages/AudioRecordings/hooks/useRecordingAudioPlayer", () => ({
	useRecordingAudioPlayer: () => ({
		audioRef: { current: null },
		playing: false,
		currentTime: 0,
		duration: 60,
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

vi.mock(
	"@/pages/superMagicMobile/pages/AudioRecordingDetail/components/MobileRecordingSourcePanel",
	() => ({
		MobileRecordingSourcePanel: (props: Record<string, unknown>) => {
			sourcePanelPropsMock(props)
			return <div data-testid="mobile-source-panel" />
		},
	}),
)

vi.mock(
	"@/pages/superMagicMobile/pages/AudioRecordingDetail/components/MobileRecordingSummaryPanel",
	() => ({
		MobileRecordingSummaryPanel: () => <div data-testid="mobile-summary-panel" />,
	}),
)

vi.mock(
	"@/pages/superMagicMobile/pages/AudioRecordingDetail/components/MobileRecordingAudioPlayer",
	() => ({
		MobileRecordingAudioPlayer: () => <div data-testid="mobile-audio-player" />,
	}),
)

vi.mock(
	"@/pages/superMagicMobile/pages/AudioRecordingDetail/components/MobileRecordingSpeakerSheet",
	() => ({
		MobileRecordingSpeakerSheet: () => null,
	}),
)

vi.mock(
	"@/pages/superMagic/pages/AudioRecordings/components/recording-detail/RecordingDetailEmptyState",
	() => ({
		RecordingDetailEmptyState: () => <div data-testid="empty-state" />,
	}),
)

/** Creates the smallest loaded folder detail needed to exercise tab visibility. */
function createDetail(notesPath?: string) {
	return {
		loading: false,
		refreshing: false,
		error: false,
		fileMap: {
			summaryFiles: [],
			notes: { file_id: "mock-notes-file", file_name: "mock-notes.md" },
			magicProjectConfig: { files: notesPath === undefined ? {} : { notes: notesPath } },
		},
		texts: {
			transcript: { content: "Mock transcript" },
			notes: { content: "Mock notes" },
			summary: {},
		},
		audioUrl: "https://example.invalid/mock-audio.mp3",
		attachmentTree: [],
		attachmentList: [],
		refresh: vi.fn(),
	}
}

describe("MobileAudioFolderContent notes visibility", () => {
	it("shows notes only when configured and falls back to transcript after removal", () => {
		const { rerender } = render(
			<MobileAudioFolderContent
				canEditSpeakers={false}
				detail={createDetail("notes/mock.md") as never}
				showNotesTab
			/>,
		)

		fireEvent.click(screen.getByRole("button", { name: "detail.tabs.notes" }))
		expect(sourcePanelPropsMock).toHaveBeenLastCalledWith(
			expect.objectContaining({ activeTab: "notes" }),
		)

		rerender(
			<MobileAudioFolderContent
				canEditSpeakers={false}
				detail={createDetail() as never}
				showNotesTab
			/>,
		)

		expect(screen.queryByRole("button", { name: "detail.tabs.notes" })).not.toBeInTheDocument()
		expect(sourcePanelPropsMock).toHaveBeenLastCalledWith(
			expect.objectContaining({ activeTab: "transcript" }),
		)
	})

	it("hides configured notes when the share attachment gate denies access", () => {
		render(
			<MobileAudioFolderContent
				canEditSpeakers={false}
				detail={createDetail("notes/mock.md") as never}
				showNotesTab={false}
			/>,
		)

		expect(screen.queryByRole("button", { name: "detail.tabs.notes" })).not.toBeInTheDocument()
	})
})
