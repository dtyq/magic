import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
import { runInAction } from "mobx"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import MobileComposerModeSelector from "../MobileComposerModeSelector"

interface SyntheticModeItem {
	mode: { identifier: string; name: string }
}

interface SyntheticModeService {
	modeList: SyntheticModeItem[]
	getModeConfigWithLegacy: ReturnType<typeof vi.fn>
}

const modeServiceControl = vi.hoisted(() => ({
	current: null as SyntheticModeService | null,
}))

vi.mock("@/services/superMagic/SuperMagicModeService", async () => {
	const { makeAutoObservable } = await vi.importActual<typeof import("mobx")>("mobx")
	const service: SyntheticModeService = {
		modeList: [],
		/** Resolve the selected crew from the latest synthetic featured-mode response. */
		getModeConfigWithLegacy: vi.fn(
			(topicMode: string, _translation: unknown, _isMobile: boolean, agentCode?: string) => {
				const identifier = topicMode === "custom_agent" ? agentCode : topicMode
				return service.modeList.find((item) => item.mode.identifier === identifier) ?? null
			},
		),
	}
	makeAutoObservable(service, { getModeConfigWithLegacy: false })
	modeServiceControl.current = service

	return { default: service }
})

vi.mock("react-i18next", () => ({
	Trans: ({ children }: { children?: ReactNode }) => <>{children}</>,
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@/components/base-mobile/MagicPopup", () => ({
	default: ({ visible, children }: { visible?: boolean; children?: ReactNode }) =>
		visible ? <div>{children}</div> : null,
}))

vi.mock("@/pages/superMagic/hooks/useFeaturedModeListRefresh", () => ({
	useFeaturedModeListRefreshOnFirstOpen: vi.fn(),
}))

vi.mock("@/pages/superMagic/components/ModeAvatar", () => ({
	default: ({
		mode,
		"data-testid": testId,
	}: {
		mode: { identifier: string }
		iconSize?: number
		"data-testid"?: string
	}) => <div data-testid={testId} data-mode-identifier={mode.identifier} />,
}))

vi.mock("@/pages/superMagic/components/MessageEditor/hooks/useTopicModel", () => ({
	default: () => ({
		modelList: [],
		imageModelList: [],
		videoModelList: [],
		topicModelStore: {
			selectedLanguageModel: null,
			selectedImageModel: null,
			selectedVideoModel: null,
		},
		validateSelectedModels: vi.fn(),
		setSelectedModel: vi.fn(),
		setSelectedImageModel: vi.fn(),
		setSelectedVideoModel: vi.fn(),
	}),
}))

vi.mock("@/pages/superMagic/components/MessageEditor/stores", () => ({
	useOptionalMessageEditorStore: () => null,
}))

vi.mock(
	"@/pages/superMagic/components/MessageEditor/components/ModelSwitch/components/ModelIcon",
	() => ({ default: () => null }),
)

vi.mock(
	"@/pages/superMagic/components/MessageEditor/components/ModelSwitch/components/ModelListContent",
	() => ({ ModelListContent: () => null }),
)

vi.mock(
	"@/pages/superMagic/components/MessageEditor/components/ModelSwitch/components/ModelTabSwitcher",
	() => ({ ModelTabSwitcher: () => null }),
)

vi.mock("@/pages/superMagicMobile/components/DataEmptyState", () => ({
	DataEmptyState: () => null,
}))

vi.mock("@/components/shadcn-ui/button", () => ({
	Button: ({ children }: { children?: ReactNode }) => <button type="button">{children}</button>,
}))

vi.mock("@/utils/pubsub", () => ({
	default: { publish: vi.fn() },
	PubSubEvents: { Create_New_Topic: "create-new-topic" },
}))

vi.mock("../MobileCrewModeList", () => ({
	default: ({
		modes,
		onSelectCrew,
	}: {
		modes: SyntheticModeItem[]
		onSelectCrew: (crew: SyntheticModeItem) => void
	}) => (
		<>
			{modes.map((mode) => (
				<button
					key={mode.mode.identifier}
					type="button"
					data-testid={`synthetic-crew-${mode.mode.identifier}`}
					onClick={() => onSelectCrew(mode)}
				/>
			))}
		</>
	),
}))

/** Return the initialized observable mode service used by this test module. */
function getModeServiceMock(): SyntheticModeService {
	if (!modeServiceControl.current) throw new Error("Synthetic mode service is not initialized")
	return modeServiceControl.current
}

/** Seed the synthetic featured list with the selected crew plus one switch candidate. */
function seedSwitchableModeList(selectedIdentifier: string) {
	const modeServiceMock = getModeServiceMock()
	act(() => {
		runInAction(() => {
			modeServiceMock.modeList = [
				{ mode: { identifier: selectedIdentifier, name: "Selected crew" } },
				{ mode: { identifier: "synthetic-other-crew", name: "Other crew" } },
			]
		})
	})
}

describe("MobileComposerModeSelector", () => {
	beforeEach(() => {
		const modeServiceMock = getModeServiceMock()
		runInAction(() => {
			modeServiceMock.modeList = []
		})
		modeServiceMock.getModeConfigWithLegacy.mockClear()
	})

	it("shows the selected crew after the featured mode list loads asynchronously", async () => {
		const modeServiceMock = getModeServiceMock()
		const props = {
			topicMode: TopicMode.CustomAgent,
			agentCode: "synthetic-agent-code",
		}
		render(<MobileComposerModeSelector {...props} />)

		expect(screen.queryByTestId("mobile-composer-mode-selector-avatar")).toBeNull()

		act(() => {
			runInAction(() => {
				modeServiceMock.modeList = [
					{
						mode: {
							identifier: "synthetic-agent-code",
							name: "Synthetic Crew",
						},
					},
				]
			})
		})

		expect(await screen.findByTestId("mobile-composer-mode-selector-avatar")).toHaveAttribute(
			"data-mode-identifier",
			"synthetic-agent-code",
		)
	})

	it("shows reasoning as its own row next to the model rows, not inside the model list", async () => {
		render(<MobileComposerModeSelector topicMode={TopicMode.General} />)

		fireEvent.click(screen.getByTestId("mobile-composer-mode-selector-trigger"))
		const trigger = screen.getByTestId("mobile-composer-reasoning-trigger-button")
		const languageRow = screen.getByTestId("mobile-composer-language-model-trigger-row")
		expect(languageRow.contains(trigger)).toBe(true)
		expect(screen.getByTestId("mobile-composer-reasoning-value")).toHaveTextContent(
			"messageEditor.modelSwitch.reasoning.default",
		)
		// 没有可选档位时该行不可点，也不挂弹层。
		expect(trigger).toBeDisabled()
		expect(screen.queryByTestId("mobile-reasoning-effort-sheet")).toBeNull()

		fireEvent.click(screen.getByTestId("mobile-composer-language-model-trigger-button"))
		const popup = await screen.findByTestId("mobile-composer-mode-selector-model-popup")
		expect(popup.querySelector("[data-testid='model-switch-reasoning-footer']")).toBeNull()
		expect(
			popup.querySelector("[data-testid='mobile-composer-reasoning-trigger-button']"),
		).toBeNull()
	})

	it("uses the employee selector trigger for the default variant", () => {
		render(
			<MobileComposerModeSelector
				topicMode={TopicMode.CustomAgent}
				agentCode="synthetic-agent-code"
				selectorVariant="default"
			/>,
		)

		expect(screen.getByTestId("mobile-composer-mode-selector-trigger")).toBeInTheDocument()
		expect(
			screen.queryByTestId("mobile-composer-claw-model-selector-trigger"),
		).not.toBeInTheDocument()
	})

	it("keeps a non-empty topic on its own crew instead of switching in place", () => {
		seedSwitchableModeList(TopicMode.General)
		const onModeChange = vi.fn()

		render(
			<MobileComposerModeSelector
				topicMode={TopicMode.General}
				selectedTopic={{ id: "synthetic-topic" } as never}
				messagesLength={2}
				onModeChange={onModeChange}
			/>,
		)

		fireEvent.click(screen.getByTestId("mobile-composer-mode-selector-trigger"))
		fireEvent.click(screen.getByTestId("synthetic-crew-synthetic-other-crew"))

		// Same rule as the desktop ModeToggle: with messages present, picking another crew offers a
		// new topic instead of handing the existing one to an unrelated crew.
		expect(
			screen.getByTestId("mobile-composer-mode-selector-create-topic-dialog"),
		).toBeInTheDocument()
		expect(onModeChange).not.toHaveBeenCalled()
	})

	it("switches crews directly while the topic is still empty", () => {
		seedSwitchableModeList(TopicMode.General)
		const onModeChange = vi.fn()

		render(
			<MobileComposerModeSelector
				topicMode={TopicMode.General}
				selectedTopic={{ id: "synthetic-topic" } as never}
				messagesLength={0}
				onModeChange={onModeChange}
			/>,
		)

		fireEvent.click(screen.getByTestId("mobile-composer-mode-selector-trigger"))
		fireEvent.click(screen.getByTestId("synthetic-crew-synthetic-other-crew"))

		expect(onModeChange).toHaveBeenCalledWith("synthetic-other-crew")
		expect(
			screen.queryByTestId("mobile-composer-mode-selector-create-topic-dialog"),
		).not.toBeInTheDocument()
	})
})
