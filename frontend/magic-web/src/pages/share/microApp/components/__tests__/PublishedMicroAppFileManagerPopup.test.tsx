import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import PublishedMicroAppFileManagerPopup from "../PublishedMicroAppFileManagerPopup"

const managerMocks = vi.hoisted(() => ({
	project: vi.fn(),
	user: vi.fn(),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@/components/base/MagicModal", () => ({
	default: function MockModal({
		open,
		title,
		children,
		onCancel,
	}: {
		open?: boolean
		title?: string
		children?: React.ReactNode
		onCancel?: () => void
	}) {
		if (!open) return null
		return (
			<div data-testid="published-micro-app-file-manager-popup">
				<h2>{title}</h2>
				<button
					type="button"
					data-testid="published-micro-app-file-manager-close-button"
					onClick={() => onCancel?.()}
				/>
				{children}
			</div>
		)
	},
}))

vi.mock("@/pages/superMagic/components/TopicFilesButton/components/ProjectFileManager", () => ({
	default: function MockProjectFileManager(props: {
		projectId: string
		selectedProject?: { project_name?: string } | null
		onFileClick: (file: { file_id: string }) => void
	}) {
		managerMocks.project(props)
		return (
			<button
				type="button"
				data-testid="project-file-manager"
				onClick={() => props.onFileClick({ file_id: "managed-1" })}
			/>
		)
	},
}))

vi.mock("@/pages/superMagic/components/UserSpace/UserSpaceFileManager", () => ({
	default: function MockUserSpaceFileManager(props: {
		context: { spaceType: "user"; view: "files" | "memory" }
		onFileClick: (file: { file_id: string }) => void
		onStateChange: (state: unknown) => void
	}) {
		managerMocks.user(props)
		return (
			<button
				type="button"
				data-testid="user-file-manager"
				onClick={() => props.onFileClick({ file_id: "user-1" })}
			/>
		)
	},
}))

describe("PublishedMicroAppFileManagerPopup", () => {
	beforeEach(() => {
		managerMocks.project.mockClear()
		managerMocks.user.mockClear()
	})

	it("renders the project manager and opens files through onOpenFile", async () => {
		const onOpenFile = vi.fn()
		const onClose = vi.fn()
		render(
			<PublishedMicroAppFileManagerPopup
				context={{ spaceType: "project", projectId: "runtime-1" }}
				attachments={[]}
				attachmentLoadState={{ projectId: "runtime-1", status: "ready" }}
				selectedProject={{ id: "runtime-1", user_role: "owner" } as never}
				onOpenFile={onOpenFile}
				onClose={onClose}
			/>,
		)

		expect(screen.getByTestId("published-micro-app-file-manager-popup")).toBeInTheDocument()
		expect(screen.getByText("microAppPage.fileManagerDialog.title")).toBeInTheDocument()
		await waitFor(() =>
			expect(managerMocks.project).toHaveBeenCalledWith(
				expect.objectContaining({ projectId: "runtime-1", allowEdit: true }),
			),
		)
		fireEvent.click(screen.getByTestId("project-file-manager"))
		expect(onOpenFile).toHaveBeenCalledWith({ file_id: "managed-1" })
		fireEvent.click(screen.getByTestId("published-micro-app-file-manager-close-button"))
		expect(onClose).toHaveBeenCalledTimes(1)
	})

	it("uses the generic project label when the runtime name is a system key", async () => {
		render(
			<PublishedMicroAppFileManagerPopup
				context={{ spaceType: "project", projectId: "runtime-1" }}
				attachments={[]}
				selectedProject={
					{
						id: "runtime-1",
						project_name: "micro-app-runtime_957589322901028865",
					} as never
				}
				onOpenFile={vi.fn()}
				onClose={vi.fn()}
			/>,
		)

		await waitFor(() =>
			expect(managerMocks.project).toHaveBeenCalledWith(
				expect.objectContaining({
					selectedProject: expect.objectContaining({
						project_name: "microAppPage.defaultProjectName",
					}),
				}),
			),
		)
	})

	it("keeps a real project title", async () => {
		render(
			<PublishedMicroAppFileManagerPopup
				context={{ spaceType: "project", projectId: "runtime-1" }}
				attachments={[]}
				selectedProject={{ id: "runtime-1", project_name: "内容运营日历" } as never}
				onOpenFile={vi.fn()}
				onClose={vi.fn()}
			/>,
		)

		await waitFor(() =>
			expect(managerMocks.project).toHaveBeenCalledWith(
				expect.objectContaining({
					selectedProject: expect.objectContaining({ project_name: "内容运营日历" }),
				}),
			),
		)
	})

	it("renders the user space manager", async () => {
		render(
			<PublishedMicroAppFileManagerPopup
				context={{ spaceType: "user", view: "files" }}
				attachments={[]}
				onOpenFile={vi.fn()}
				onClose={vi.fn()}
			/>,
		)

		expect(await screen.findByTestId("user-file-manager")).toBeInTheDocument()
		expect(managerMocks.user).toHaveBeenCalledWith(
			expect.objectContaining({
				context: { spaceType: "user", view: "files" },
				projectName: "microAppPage.defaultProjectName",
			}),
		)
	})
})
