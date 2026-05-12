import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import type { MessageListContextState } from "../../../context"
import { MessageListProvider } from "../../../context"
import { withNode, type WithNodeProps } from "../withNode"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("mobx-react-lite", () => ({
	observer: <T,>(component: T) => component,
}))

vi.mock("@/stores/globalConfig", () => ({
	globalConfigStore: {
		globalConfig: {
			minimal_logo: "fallback-logo",
		},
	},
}))

vi.mock("@/utils/avatar", () => ({
	getAvatarUrl: vi.fn((url: string) => `resolved:${url}`),
}))

vi.mock("@/pages/superMagic/components/MessageList/components/Card/UserCard", () => ({
	withUserNode: (Component: React.ComponentType<WithNodeProps>) => (props: WithNodeProps) => (
		<Component {...props} />
	),
}))

vi.mock("@/pages/superMagic/components/MessageList/components/Card/AssistantCard", () => ({
	withAssistantCard:
		(Component: React.ComponentType<WithNodeProps>) => (props: WithNodeProps) => (
			<Component {...props} />
		),
}))

function TestWrapper(props: WithNodeProps) {
	return <div data-testid="message-node">{props.role}</div>
}

const WrappedNode = withNode(TestWrapper)

function renderWithProvider(avatar?: ReactNode) {
	const value: MessageListContextState = {
		renderAssistantAvatar: avatar ? () => avatar : undefined,
	}

	return render(
		<MessageListProvider value={value}>
			<WrappedNode
				role="assistant"
				isFirst
				node={{ send_time: 1710000000 }}
				selectedTopic={null}
			/>
		</MessageListProvider>,
	)
}

describe("withNode", () => {
	it("renders custom assistant avatar when provided by context", () => {
		renderWithProvider(<div data-testid="custom-assistant-avatar">avatar</div>)

		expect(screen.getByTestId("custom-assistant-avatar")).toBeInTheDocument()
	})
})
