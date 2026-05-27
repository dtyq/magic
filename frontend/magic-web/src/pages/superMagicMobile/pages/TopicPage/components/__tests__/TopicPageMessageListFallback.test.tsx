import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
	resolveTopicPageMessageListFallback,
	TopicPageMessageListFallback,
} from "../TopicPageMessageListFallback"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/styles/font", () => ({
	usePoppinsFont: () => undefined,
}))

vi.mock("@/stores/globalConfig", () => ({
	globalConfigStore: {
		globalConfig: {
			minimal_logo: "",
		},
	},
}))

describe("TopicPageMessageListFallback", () => {
	it("renders the mobile brand hero fallback by default", () => {
		render(<TopicPageMessageListFallback />)

		expect(screen.getByTestId("mobile-topic-page-empty")).toBeInTheDocument()
		expect(screen.getByText("home.sloganSubtitle")).toBeInTheDocument()
		expect(screen.getByText("home.sloganTitle")).toBeInTheDocument()
	})

	it("keeps a caller-provided fallback override", () => {
		render(
			<>{resolveTopicPageMessageListFallback(<div data-testid="custom-topic-fallback" />)}</>,
		)

		expect(screen.getByTestId("custom-topic-fallback")).toBeInTheDocument()
		expect(screen.queryByTestId("mobile-topic-page-empty")).not.toBeInTheDocument()
	})
})