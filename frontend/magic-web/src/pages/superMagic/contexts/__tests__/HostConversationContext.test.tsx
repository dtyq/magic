import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { HostConversationProvider, useHostConversation } from "../HostConversationContext"

function HostProbe() {
	const { selectedProject, topicStore } = useHostConversation()

	return (
		<div
			data-testid="host-probe"
			data-host-project-id={selectedProject?.id}
			data-has-topic-store={topicStore ? "true" : "false"}
		/>
	)
}

describe("HostConversationContext", () => {
	it("exposes the host project and topic store from the provider", () => {
		render(
			<HostConversationProvider
				selectedProject={{ id: "project-current" } as never}
				topicStore={{ selectedTopic: { id: "topic-1" } } as never}
			>
				<HostProbe />
			</HostConversationProvider>,
		)

		const probe = screen.getByTestId("host-probe")
		expect(probe).toHaveAttribute("data-host-project-id", "project-current")
		expect(probe).toHaveAttribute("data-has-topic-store", "true")
	})

	it("has no host when the provider is missing", () => {
		render(<HostProbe />)

		const probe = screen.getByTestId("host-probe")
		expect(probe).not.toHaveAttribute("data-host-project-id")
		expect(probe).toHaveAttribute("data-has-topic-store", "false")
	})
})
