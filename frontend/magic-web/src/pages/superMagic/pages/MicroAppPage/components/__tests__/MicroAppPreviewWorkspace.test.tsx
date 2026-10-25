import type { ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import MicroAppPreviewWorkspace from "../MicroAppPreviewWorkspace"

const providerMocks = vi.hoisted(() => ({
	props: null as Record<string, unknown> | null,
}))

vi.mock("@/pages/share/microApp/components/PublishedMicroAppConversationProvider", () => ({
	default: ({ children, ...props }: Record<string, unknown> & { children: ReactNode }) => {
		providerMocks.props = props
		return <div data-testid="published-micro-app-conversation-provider">{children}</div>
	},
}))

vi.mock("../MicroAppEntryPreview", () => ({
	default: () => <div data-testid="micro-app-entry-preview" />,
}))

describe("MicroAppPreviewWorkspace", () => {
	beforeEach(() => {
		providerMocks.props = null
	})

	it("forwards the source organization to the conversation provider", () => {
		render(
			<MicroAppPreviewWorkspace
				appId="app-1"
				entryFile={null}
				attachments={[]}
				attachmentList={[]}
				projectId="project-1"
				selectedProject={
					{
						id: "project-1",
						project_name: "Micro App",
					} as never
				}
				sourceOrganizationCode="org-1"
			/>,
		)

		expect(screen.getByTestId("micro-app-runtime-preview-workspace")).toBeInTheDocument()
		expect(providerMocks.props).toEqual(
			expect.objectContaining({
				appId: "app-1",
				appName: "Micro App",
				sourceOrganizationCode: "org-1",
			}),
		)
	})
})
