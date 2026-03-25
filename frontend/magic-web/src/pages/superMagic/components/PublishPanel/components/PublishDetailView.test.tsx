import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import PublishDetailView from "./PublishDetailView"
import { PublishPanelStoreProvider } from "../context"
import { PublishPanelStore } from "../store"
import type { PublishPanelData } from "../types"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, string>) => {
			if (key === "skillEditPage.publishPanel.detail.noContent") return "无内容"
			if (key === "skillEditPage.publishPanel.detail.title")
				return `版本 ${options?.version ?? ""}`
			return key
		},
	}),
}))

function createPanelData(): PublishPanelData {
	return {
		hasUnpublishedChanges: false,
		currentPublisherName: "Username",
		historyRecords: [
			{
				id: "record-v1-0",
				version: "V1.0",
				versionDetails: "",
				status: "published",
				publishTo: "INTERNAL",
				internalTarget: "PRIVATE",
				publisherName: "Username",
				publishedAt: "2026-03-13 12:00:00",
			},
		],
		draft: {
			version: "",
			details: "",
			publishTo: "INTERNAL",
			internalTarget: "PRIVATE",
			specificMembers: [],
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

describe("PublishDetailView", () => {
	it('shows "无内容" when readonly detail is empty', () => {
		const store = new PublishPanelStore({
			initialData: createPanelData(),
		})

		store.openDetailView(store.historyRecords[0]!)

		render(
			<PublishPanelStoreProvider store={store}>
				<PublishDetailView onClose={vi.fn()} />
			</PublishPanelStoreProvider>,
		)

		expect(screen.getByTestId("skill-publish-detail-details-input")).toHaveTextContent("无内容")
	})

	it("shows only private internal target in open-source detail view", () => {
		const store = new PublishPanelStore({
			initialData: createPanelData(),
		})

		store.openDetailView(store.historyRecords[0]!)

		render(
			<PublishPanelStoreProvider store={store}>
				<PublishDetailView onClose={vi.fn()} />
			</PublishPanelStoreProvider>,
		)

		expect(screen.getByTestId("skill-publish-detail-target-private")).toBeInTheDocument()
		expect(
			screen.queryByTestId("skill-publish-detail-target-specific_members"),
		).not.toBeInTheDocument()
		expect(
			screen.queryByTestId("skill-publish-detail-target-organization"),
		).not.toBeInTheDocument()
		expect(
			screen.queryByTestId("skill-publish-detail-specific-members-list"),
		).not.toBeInTheDocument()
	})
})
