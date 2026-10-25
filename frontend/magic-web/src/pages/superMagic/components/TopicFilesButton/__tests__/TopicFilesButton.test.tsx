import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import TopicFilesButton from "../index"

const { infoMock, payloadMock, publishMock } = vi.hoisted(() => ({
	infoMock: vi.fn(),
	payloadMock: { topicMode: "ppt" },
	publishMock: vi.fn(),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("../style", () => ({
	useStyles: () => ({
		cx: (...classes: Array<string | undefined>) => classes.filter(Boolean).join(" "),
		styles: { container: "container" },
	}),
}))

vi.mock("@/hooks/useIsMobile", () => ({ useIsMobile: () => false }))
vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: { error: vi.fn(), info: infoMock, success: vi.fn() },
}))
vi.mock("@/pages/superMagic/services/mySlidesTemplateAdapter", () => ({
	mySlidesTemplateAdapter: { enabled: true, saveEnabled: false },
}))
vi.mock("@/pages/superMagic/utils/slidesTemplateActions", () => ({
	buildConvertToSlidesTemplatePayload: vi.fn(() => payloadMock),
}))
vi.mock("@/utils/pubsub", () => ({
	default: { publish: publishMock },
	PubSubEvents: { Create_New_Topic: "Create_New_Topic" },
}))
vi.mock("../TopicFilesPanel", async () => {
	const { forwardRef } = await import("react")
	return {
		default: forwardRef(
			(
				props: {
					onConvertToSlidesTemplate: (item: {
						file_id: string
						is_directory: boolean
					}) => void
					onSaveSlidesTemplate: (item: { file_id: string; is_directory: boolean }) => void
				},
				ref,
			) => {
				void ref
				return (
					<div>
						<button
							type="button"
							onClick={() =>
								props.onSaveSlidesTemplate({
									file_id: "template-folder",
									is_directory: true,
								})
							}
						>
							save template
						</button>
						<button
							type="button"
							onClick={() =>
								props.onConvertToSlidesTemplate({
									file_id: "slide-project",
									is_directory: true,
								})
							}
						>
							convert template
						</button>
					</div>
				)
			},
		),
	}
})

describe("TopicFilesButton slide template actions", () => {
	it("shows the save dialog when saving without a configured adapter", async () => {
		render(<TopicFilesButton projectId="project-1" />)

		fireEvent.click(screen.getByRole("button", { name: "save template" }))

		expect(await screen.findByText("mySlidesTemplates.saveDialog.title")).toBeInTheDocument()
		expect(screen.getByText("mySlidesTemplates.saveUnavailable")).toBeInTheDocument()
		expect(infoMock).not.toHaveBeenCalled()
	})

	it("publishes Create_New_Topic when converting a slide project", () => {
		render(<TopicFilesButton />)

		fireEvent.click(screen.getByRole("button", { name: "convert template" }))

		expect(publishMock).toHaveBeenCalledWith("Create_New_Topic", payloadMock)
	})
})
