import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { DependencyList, EffectCallback, HTMLAttributes } from "react"
import { forwardRef, useEffect, useRef } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import StartRecordingButton from "../index"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"recordingSummary.superEditorPanel.button.startRecording": "Start recording",
				"recordingSummary.superEditorPanel.button.startFromCurrent": "Start from current",
			}

			return translations[key] || key
		},
	}),
}))

vi.mock("ahooks", () => ({
	useMemoizedFn: <T extends (...args: never[]) => unknown>(fn: T) => fn,
	useSize: () => undefined,
	useUpdateEffect: (effect: EffectCallback, deps?: DependencyList) => {
		const isMountedRef = useRef(false)

		useEffect(() => {
			if (isMountedRef.current) return effect()
			isMountedRef.current = true
		}, deps)
	},
}))

vi.mock("@/components/base/FlexBox", () => ({
	default: forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function MockFlexBox(
		{ children, ...props },
		ref,
	) {
		return (
			<div ref={ref} {...props}>
				{children}
			</div>
		)
	}),
}))

vi.mock("../LoadingIcon", () => ({
	default: () => <span>loading</span>,
}))

vi.mock("../MicrophoneIcon", () => ({
	default: () => <span>microphone</span>,
}))

vi.mock("../styles", () => ({
	useStyles: () => ({
		styles: {
			startButton: "startButton",
			startButtonMobile: "startButtonMobile",
			startButtonContent: "startButtonContent",
			currentItemBg: "currentItemBg",
			activeText: "activeText",
			inactiveText: "inactiveText",
			subButtonMobile: "subButtonMobile",
		},
		cx: (...classNames: Array<string | false | undefined>) =>
			classNames.filter(Boolean).join(" "),
	}),
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => false,
}))

vi.mock("../ProjectSelector/utils/preloadProjectSelector", () => ({
	preloadProjectSelector: vi.fn(),
}))

vi.mock("@/pages/superMagic/components/MessagePanel/components/TopicExamples/SummaryGuide", () => ({
	SummaryGuideDOMId: {
		StartRecordingButton: "start-recording-button",
		SelectProjectButton: "select-project-button",
	},
}))

describe("StartRecordingButton", () => {
	afterEach(() => {
		vi.clearAllMocks()
	})

	it("resets to new mode when select project becomes unavailable", async () => {
		const handleClick = vi.fn()
		const { rerender } = render(
			<StartRecordingButton allowSelectProject={true} onClick={handleClick} />,
		)

		const newButton = screen.getByText("Start recording")
		const currentButton = screen.getByText("Start from current")

		fireEvent.mouseEnter(currentButton)

		await waitFor(() => {
			expect(currentButton).toHaveClass("activeText")
			expect(newButton).toHaveClass("inactiveText")
		})

		rerender(<StartRecordingButton allowSelectProject={false} onClick={handleClick} />)

		await waitFor(() => {
			expect(screen.queryByText("Start from current")).not.toBeInTheDocument()
			expect(screen.getByText("Start recording")).toHaveClass("activeText")
		})
	})
})
