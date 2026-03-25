import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import PublishCreateView from "./PublishCreateView"
import { PublishPanelStoreProvider } from "../context"
import { PublishPanelStore } from "../store"
import type { PublishPanelData } from "../types"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock(
	"@/pages/superMagic/pages/CrewEdit/components/StepDetailPanel/PlaybookPanel/components/SceneEditPanel/components/LocaleTextInput",
	() => ({
		LocaleTextInput: function MockLocaleTextInput(props: {
			disabled?: boolean
			"data-testid"?: string
		}) {
			return (
				<div>
					<input data-testid={props["data-testid"]} disabled={props.disabled} readOnly />
					<button
						type="button"
						data-testid={
							props["data-testid"] ? `${props["data-testid"]}-globe` : undefined
						}
						disabled={props.disabled}
					/>
				</div>
			)
		},
	}),
)

function createPanelData(): PublishPanelData {
	return {
		hasUnpublishedChanges: true,
		currentPublisherName: "Username",
		historyRecords: [],
		draft: {
			version: "V1.6",
			details: "Release details",
			publishTo: "INTERNAL",
			internalTarget: "MEMBER",
			specificMembers: [
				{
					id: "user-1",
					name: "Alice",
					type: "user",
				},
			],
		},
		marketCopy: {
			publishToLabelKey: "skillEditPage.publishPanel.publishToOptions.skills_library.label",
			publishToDescriptionKey:
				"skillEditPage.publishPanel.publishToOptions.skills_library.description",
			targetLabelKey: "skillEditPage.publishPanel.targets.skills_library.label",
			targetDescriptionKey: "skillEditPage.publishPanel.targets.skills_library.description",
		},
		availablePublishTo: ["INTERNAL", "MARKET"],
		availableInternalTargets: ["PRIVATE", "MEMBER", "ORGANIZATION"],
	}
}

function renderCreateView() {
	const store = new PublishPanelStore({
		initialData: createPanelData(),
	})

	store.openCreateView()
	store.isSubmitting = true

	render(
		<PublishPanelStoreProvider store={store}>
			<PublishCreateView onClose={vi.fn()} />
		</PublishPanelStoreProvider>,
	)
}

describe("PublishCreateView", () => {
	it("marks all required fields", () => {
		const store = new PublishPanelStore({
			initialData: createPanelData(),
		})

		store.openCreateView()

		render(
			<PublishPanelStoreProvider store={store}>
				<PublishCreateView onClose={vi.fn()} />
			</PublishPanelStoreProvider>,
		)

		expect(screen.getByTestId("skill-publish-version-input")).toBeRequired()
		expect(screen.getAllByText("*", { selector: "span" })).toHaveLength(3)
	})

	it("disables editable controls while submitting", () => {
		renderCreateView()

		expect(screen.getByTestId("skill-publish-create-back-button")).toBeDisabled()
		expect(screen.getByTestId("skill-publish-create-close-button")).toBeDisabled()
		expect(screen.getByTestId("skill-publish-version-input")).toBeDisabled()
		expect(screen.getByTestId("skill-publish-details-input")).toBeDisabled()
		expect(screen.getByTestId("skill-publish-details-input-globe")).toBeDisabled()
		expect(screen.getByTestId("skill-publish-create-cancel-button")).toBeDisabled()
		expect(screen.getByTestId("skill-publish-create-submit-button")).toBeDisabled()
		expect(screen.getByTestId("skill-publish-to-internal")).toBeDisabled()
		expect(screen.getByTestId("skill-publish-to-market")).toBeDisabled()
		expect(screen.getByTestId("skill-publish-target-private")).toHaveAttribute(
			"aria-disabled",
			"true",
		)
		expect(
			screen.queryByTestId("skill-publish-target-specific_members"),
		).not.toBeInTheDocument()
		expect(screen.queryByTestId("skill-publish-target-organization")).not.toBeInTheDocument()
		expect(
			screen.queryByTestId("skill-publish-specific-members-trigger"),
		).not.toBeInTheDocument()
	})
})
