import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MobileRecordingAudioPlayer } from "../components/MobileRecordingAudioPlayer"

vi.mock("@/pages/superMagic/pages/AudioRecordings/components/recording-detail/player", () => ({
	RecordingDetailAudioBar: () => <div data-testid="recording-detail-audio-bar" />,
}))

describe("MobileRecordingAudioPlayer", () => {
	const defaultProps = {
		audioRef: { current: null },
		audioUrl: "test.mp3",
		currentSec: 10,
		duration: 125,
		playing: false,
		expanded: false,
		onToggle: vi.fn(),
		onSeek: vi.fn(),
		onExpandedChange: vi.fn(),
		playbackRate: 1.0,
		onPlaybackRateChange: vi.fn(),
	}

	it("renders fixed mobile shell with shared audio bar", () => {
		render(<MobileRecordingAudioPlayer {...defaultProps} />)
		const shell = screen.getByTestId("mobile-recording-audio-player")
		expect(shell).toBeInTheDocument()
		expect(shell).toHaveStyle({
			bottom: "max(24px, var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))",
		})
		expect(shell).toHaveClass("bottom-6")
		expect(screen.getByTestId("recording-detail-audio-bar")).toBeInTheDocument()
	})

	it("returns null when audio url is missing", () => {
		const { container } = render(<MobileRecordingAudioPlayer {...defaultProps} audioUrl="" />)
		expect(container).toBeEmptyDOMElement()
	})
})
