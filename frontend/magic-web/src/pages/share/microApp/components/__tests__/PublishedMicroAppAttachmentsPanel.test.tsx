import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import PublishedMicroAppAttachmentsPanel from "../PublishedMicroAppAttachmentsPanel"

const filesMocks = vi.hoisted(() => ({
	allowEdit: undefined as boolean | undefined,
	showFileManager: undefined as boolean | undefined,
	showTitle: undefined as boolean | undefined,
	title: undefined as string | undefined,
	onFileClick: undefined as ((file: unknown) => void) | undefined,
}))

vi.mock("@/pages/superMagic/components/TopicFilesButton", () => ({
	default: function MockTopicFilesButton(props: {
		allowEdit?: boolean
		showFileManager?: boolean
		showTitle?: boolean
		title?: string
		onFileClick?: (file: unknown) => void
	}) {
		filesMocks.allowEdit = props.allowEdit
		filesMocks.showFileManager = props.showFileManager
		filesMocks.showTitle = props.showTitle
		filesMocks.title = props.title
		filesMocks.onFileClick = props.onFileClick
		return <div data-testid="runtime-files" />
	},
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

describe("PublishedMicroAppAttachmentsPanel", () => {
	it("keeps runtime project files read-only when the role is unknown", () => {
		render(
			<PublishedMicroAppAttachmentsPanel
				attachments={[]}
				projectId="runtime-1"
				setUserSelectDetail={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("published-micro-app-attachments-panel")).toBeInTheDocument()
		expect(filesMocks.allowEdit).toBe(false)
	})

	it("lets an owner edit runtime project files", () => {
		render(
			<PublishedMicroAppAttachmentsPanel
				attachments={[]}
				projectId="runtime-1"
				selectedProject={{ user_role: "owner" } as never}
				setUserSelectDetail={vi.fn()}
			/>,
		)

		expect(filesMocks.allowEdit).toBe(true)
	})

	it("enables the project file manager and forwards file opens", () => {
		const onFileClick = vi.fn()
		render(
			<PublishedMicroAppAttachmentsPanel
				attachments={[]}
				projectId="runtime-1"
				setUserSelectDetail={vi.fn()}
				onFileClick={onFileClick}
			/>,
		)

		expect(filesMocks.showFileManager).toBe(true)
		expect(filesMocks.showTitle).toBeUndefined()
		expect(filesMocks.title).toBe("attachmentList.projectFiles")
		expect(filesMocks.onFileClick).toBe(onFileClick)
	})
})
