import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin/types"
import type { MentionMediaSource } from "@/pages/superMagic/components/MessageEditor/components/MentionMedia/useMentionMediaSource"
import { useMentionMediaSource } from "@/pages/superMagic/components/MessageEditor/components/MentionMedia/useMentionMediaSource"
import InlineMention from "../InlineMention"
import { openMicroAppTab } from "@/pages/superMagic/components/MessageList/utils/openMicroAppTab"

const mediaSource: MentionMediaSource = {
	mediaType: "image",
	thumbnailUrl: "https://cdn.test/cover.png",
	previewUrl: "https://cdn.test/cover.png",
	audioUrl: null,
	isLoading: false,
	hasError: false,
}

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => false,
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
	initReactI18next: { type: "3rdParty", init: vi.fn() },
}))

vi.mock(
	"@/pages/superMagic/components/MessageEditor/components/MentionMedia/useMentionMediaSource",
	() => ({
		useMentionMediaSource: vi.fn(),
	}),
)

vi.mock(
	"@/pages/superMagic/components/MessageEditor/components/MentionNodes/marker/useTransformedMarkerData",
	() => ({
		useTransformedMarkerData: () => ({ markerData: null, loading: false }),
	}),
)

vi.mock(
	"@/pages/superMagic/components/MessageEditor/components/MentionNodes/marker/useMarkerImageUrl",
	() => ({
		useMarkerImageUrl: () => ({ imageUrl: null }),
	}),
)

vi.mock("@/pages/superMagic/components/MessageEditor/hooks/useMarkerClickHandler", () => ({
	useMarkerClickHandler: () => ({ handleMarkerClick: vi.fn() }),
}))

vi.mock(
	"@/pages/superMagic/components/MessageEditor/components/AtItem/components/MobileImagePreview",
	() => ({ showMobileImagePreview: vi.fn() }),
)

vi.mock("@/pages/superMagic/components/MessageList/utils/openMicroAppTab", () => ({
	openMicroAppTab: vi.fn(),
}))

function createMention(fileName: string, fileExtension: string): TiptapMentionAttributes {
	return {
		type: MentionItemType.PROJECT_FILE,
		data: {
			file_id: "file-1",
			file_name: fileName,
			file_extension: fileExtension,
			file_path: fileName,
		},
	} as TiptapMentionAttributes
}

describe("InlineMention", () => {
	beforeEach(() => {
		vi.mocked(useMentionMediaSource).mockReturnValue(mediaSource)
	})

	it("renders a media icon before the filename and uses the complete mention as tooltip trigger", () => {
		const { container } = render(<InlineMention data={createMention("cover.png", "png")} />)

		expect(screen.getByTestId("inline-file-mention-icon")).toBeInTheDocument()
		expect(screen.getByRole("img")).toHaveAttribute("src", mediaSource.thumbnailUrl)

		const trigger = container.querySelector("[data-media-preview-trigger]") as HTMLElement
		expect(trigger).toHaveTextContent("cover.png")
	})

	it("does not render a media icon for non-media file mentions", () => {
		vi.mocked(useMentionMediaSource).mockReturnValue({
			...mediaSource,
			mediaType: null,
			thumbnailUrl: null,
			previewUrl: null,
		})

		render(<InlineMention data={createMention("README.md", "md")} />)

		expect(screen.queryByTestId("inline-file-mention-icon")).not.toBeInTheDocument()
		expect(screen.getByText("README.md")).toBeInTheDocument()
	})

	it("opens a micro-app tab when a micro-app mention is clicked", () => {
		vi.mocked(useMentionMediaSource).mockReturnValue({
			...mediaSource,
			mediaType: null,
			thumbnailUrl: null,
			previewUrl: null,
		})

		render(
			<InlineMention
				data={{
					type: MentionItemType.MICRO_APP,
					data: { app_id: "app-1", app_name: "深圳卓悦线上内购" },
				}}
			/>,
		)

		fireEvent.click(screen.getByText("@深圳卓悦线上内购"))
		expect(openMicroAppTab).toHaveBeenCalledWith({
			appId: "app-1",
			appName: "深圳卓悦线上内购",
		})
	})
})
