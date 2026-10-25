import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import AudioRootRender from "./index"

// Keeps the embedded detail test focused on the save callback instead of attachment I/O.
const { detailMock, saveMediaSpeakersMock } = vi.hoisted(() => ({
	detailMock: {
		loading: false,
		refreshing: false,
		error: false,
		fileMap: {
			summaryFiles: [],
			magicProject: { file_id: "mock-magic-project-file" },
			magicProjectConfig: { metadata: { speakers: {} } },
		},
		texts: {
			transcript: { content: "Speaker-mock says hello" },
			magicProject: { fileId: "mock-magic-project-file", content: "export default {}" },
			summary: {},
		},
		audioUrl: "https://example.invalid/mock-audio.mp3",
		attachmentTree: [],
		attachmentList: [],
		refresh: vi.fn(),
	},
	saveMediaSpeakersMock: vi.fn().mockResolvedValue(undefined),
}))
const storageMock = vi.hoisted(() => ({
	getItem: vi.fn(() => null),
	setItem: vi.fn(),
	removeItem: vi.fn(),
	clear: vi.fn(),
	key: vi.fn(() => null),
	length: 0,
}))

vi.hoisted(() => {
	Object.defineProperty(globalThis, "localStorage", {
		value: storageMock,
		configurable: true,
	})
	Object.defineProperty(globalThis, "sessionStorage", {
		value: storageMock,
		configurable: true,
	})
})

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => false,
}))

vi.mock("@/stores/interface", () => ({
	interfaceStore: {},
}))

vi.mock("@dtyq/magic-admin", () => ({
	RouteName: {},
	PlatformPackageRoutes: {},
	AiManageRoutes: {},
	EnterpriseManageRoutes: {},
	otherRoutes: [],
	AiModel: {
		ServiceProvider: new Proxy({}, { get: (_target, key) => String(key) }),
		ServiceProviderCategory: new Proxy({}, { get: (_target, key) => String(key) }),
		ProviderType: new Proxy({}, { get: (_target, key) => String(key) }),
		Status: new Proxy({}, { get: (_target, key) => String(key) }),
		ServiceProviderUrl: {},
	},
}))
vi.mock("@dtyq/magic-admin/components", () => ({}))
vi.mock("@dtyq/magic-admin/provider", () => ({}))

vi.mock("@/assets/locales/locale-adapters", () => ({
	getLocaleModules: () => ({}),
	getAdminLocaleModules: () => ({}),
	loadFallbackLocale: vi.fn(),
	loadMagicFlowLocale: vi.fn(),
}))

vi.mock("@/models/config/stores/theme.store", () => ({
	themeStore: {
		theme: "light",
		setTheme: vi.fn(),
		syncDocumentDarkClass: vi.fn(),
	},
}))

vi.mock("@/pages/superMagic/hooks/useShareRoute", () => ({
	default: () => ({ isShareRoute: false }),
}))

vi.mock("@/pages/superMagic/pages/AudioRecordings/hooks/useShareRecordingDetailData", () => ({
	useShareRecordingDetailData: () => detailMock,
}))

vi.mock("../../contents/HTML/media/utils", () => ({
	saveMediaSpeakersAndMagicProjectJs: saveMediaSpeakersMock,
}))

vi.mock("../../contents/HTML", () => ({
	default: () => <div data-testid="legacy-html" />,
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
	"@/pages/superMagic/pages/AudioRecordings/components/recording-detail/RecordingDetailProvider",
	() => ({
		RecordingDetailProvider: ({ children }: { children: React.ReactNode }) => children,
	}),
)

vi.mock(
	"@/pages/superMagic/pages/AudioRecordings/components/recording-detail/RecordingDetailWorkbench",
	() => ({
		RecordingDetailWorkbench: ({
			left,
			right,
		}: {
			left: React.ReactNode
			right: React.ReactNode
		}) => (
			<div data-testid="recording-detail-workbench">
				{left}
				{right}
			</div>
		),
	}),
)

vi.mock(
	"@/pages/superMagic/pages/AudioRecordings/components/recording-detail/RecordingDetailLeftColumn",
	() => ({
		RecordingDetailLeftColumn: ({
			speakerNameMap,
			onOpenSpeakerSettings,
		}: {
			speakerNameMap: Record<string, string>
			onOpenSpeakerSettings: () => void
		}) => (
			<div>
				<span data-testid="embedded-speaker-name">
					{speakerNameMap["Speaker-mock"] ?? "Speaker-mock"}
				</span>
				<button type="button" onClick={onOpenSpeakerSettings}>
					Open speaker settings
				</button>
			</div>
		),
	}),
)

vi.mock(
	"@/pages/superMagic/pages/AudioRecordings/components/recording-detail/RecordingDetailRightPanel",
	() => ({
		RecordingDetailRightPanel: () => <div data-testid="recording-detail-right-panel" />,
	}),
)

vi.mock(
	"@/pages/superMagic/pages/AudioRecordings/components/recording-detail/RecordingDetailSpeakerDialog",
	() => ({
		RecordingDetailSpeakerDialog: ({
			open,
			onValueChange,
			onConfirm,
		}: {
			open: boolean
			onValueChange: (next: Record<string, string>) => void
			onConfirm: () => void
		}) =>
			open ? (
				<div>
					<button
						type="button"
						onClick={() => onValueChange({ "Speaker-mock": "Updated speaker" })}
					>
						Edit speaker
					</button>
					<button type="button" onClick={onConfirm}>
						Save speakers
					</button>
				</div>
			) : null,
	}),
)

vi.mock("./RecordingArtifactHeader", () => ({
	RecordingArtifactHeader: () => <div data-testid="recording-artifact-header" />,
}))

vi.mock(
	"@/pages/superMagic/pages/AudioRecordings/components/recording-detail/RecordingDetailEmptyState",
	() => ({
		RecordingDetailEmptyState: () => <div data-testid="recording-detail-empty-state" />,
		RecordingDetailPageSkeleton: () => <div data-testid="recording-detail-skeleton" />,
	}),
)

describe("AudioRootRender desktop speaker editing", () => {
	beforeEach(() => {
		detailMock.refresh.mockReset()
		saveMediaSpeakersMock.mockReset()
		saveMediaSpeakersMock.mockResolvedValue(undefined)
	})

	// Desktop embeds should update labels immediately while their attachment snapshot refreshes quietly.
	it("keeps the local speaker override and refreshes the desktop workbench silently", async () => {
		render(
			<AudioRootRender
				projectId="mock-project"
				data={{
					file_id: "mock-recording-folder",
					file_name: "mock-recording",
					display_filename: "Mock recording",
					is_directory: true,
				}}
			/>,
		)

		fireEvent.click(screen.getByRole("button", { name: "Open speaker settings" }))
		fireEvent.click(screen.getByRole("button", { name: "Edit speaker" }))
		fireEvent.click(screen.getByRole("button", { name: "Save speakers" }))

		await waitFor(() => {
			expect(saveMediaSpeakersMock).toHaveBeenCalled()
			expect(detailMock.refresh).toHaveBeenCalledWith({ silent: true })
		})
		expect(screen.getByTestId("embedded-speaker-name")).toHaveTextContent("Updated speaker")
	})
})
