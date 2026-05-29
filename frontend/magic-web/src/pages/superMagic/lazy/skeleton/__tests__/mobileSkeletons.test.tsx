import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import TopicPageMobileSkeleton from "../TopicPageMobileSkeleton"
import ChatProjectPageMobileSkeleton from "../ChatProjectPageMobileSkeleton"
import ProjectPageMobileSkeleton from "../ProjectPageMobileSkeleton"
import TopicPageMobileSkeletonWithLayout from "../TopicPageMobileSkeletonWithLayout"
import ProjectPageMobileSkeletonWithLayout from "../ProjectPageMobileSkeletonWithLayout"

describe("mobile skeletons", () => {
	it("TopicPageMobileSkeleton uses conversation bubbles without inline header", () => {
		const { container } = render(<TopicPageMobileSkeleton />)

		expect(screen.getByTestId("mobile-conversation-page-skeleton")).toBeInTheDocument()
		expect(screen.getByTestId("mobile-message-bubbles-skeleton")).toBeInTheDocument()
		expect(screen.queryByTestId("mobile-header-skeleton-project-topic")).not.toBeInTheDocument()
		expect(screen.queryByTestId("mobile-header-skeleton-chat-hero")).not.toBeInTheDocument()
		expect(container.innerHTML).not.toContain("NavBarSkeleton")
		expect(container.innerHTML).not.toContain("pb-safe-bottom")
	})

	it("ChatProjectPageMobileSkeleton includes chat hero header on unified mobile background", () => {
		const { container } = render(<ChatProjectPageMobileSkeleton />)

		expect(screen.getByTestId("mobile-header-skeleton-chat-hero")).toBeInTheDocument()
		expect(screen.getByTestId("mobile-message-bubbles-skeleton")).toBeInTheDocument()
		expect(container.innerHTML).not.toContain("pb-safe-bottom")
	})

	it("ProjectPageMobileSkeleton uses topic rows instead of legacy paragraph blocks", () => {
		const { container } = render(<ProjectPageMobileSkeleton />)

		expect(screen.getByTestId("mobile-project-entry-skeleton")).toBeInTheDocument()
		expect(screen.getByTestId("mobile-topic-list-skeleton")).toBeInTheDocument()
		expect(container.innerHTML).not.toContain("pb-safe-bottom")
	})

	it("WithLayout variants render shell header placeholders", () => {
		render(<TopicPageMobileSkeletonWithLayout />)
		expect(screen.getByTestId("mobile-header-skeleton-project-topic")).toBeInTheDocument()

		render(<ProjectPageMobileSkeletonWithLayout />)
		expect(screen.getByTestId("mobile-header-skeleton-project-entry")).toBeInTheDocument()
	})
})
