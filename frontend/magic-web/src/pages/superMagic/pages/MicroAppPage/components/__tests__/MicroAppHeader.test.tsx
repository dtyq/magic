import { fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import MicroAppHeader from "../MicroAppHeader"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

const project = {
	id: "project-1",
	project_name: "Demo App",
} as ProjectListItem

function renderHeader(props: Partial<ComponentProps<typeof MicroAppHeader>> = {}) {
	return render(
		<MicroAppHeader
			selectedProject={project}
			hasEntries={false}
			canPublish
			onBack={vi.fn()}
			onPublish={vi.fn()}
			{...props}
		/>,
	)
}

describe("MicroAppHeader", () => {
	it("does not render publish button when there is no root html file", () => {
		renderHeader()

		expect(screen.queryByTestId("micro-app-publish-button")).not.toBeInTheDocument()
	})

	it("renders publish button when root html exists and triggers callback", () => {
		const onPublish = vi.fn()
		renderHeader({
			hasEntries: true,
			onPublish,
		})

		fireEvent.click(screen.getByTestId("micro-app-publish-button"))

		expect(onPublish).toHaveBeenCalledTimes(1)
		expect(screen.getByTestId("micro-app-publish-button")).toHaveClass("h-7")
	})

	it("does not render publish button without publish permission", () => {
		renderHeader({ hasEntries: true, canPublish: false })

		expect(screen.queryByTestId("micro-app-publish-button")).not.toBeInTheDocument()
	})

	it("renders the development and preview mode switch for developers", () => {
		const onPageModeChange = vi.fn()
		renderHeader({
			canUseDevelopment: true,
			pageMode: "development",
			onPageModeChange,
		})

		expect(screen.getByTestId("micro-app-mode-switcher")).toBeInTheDocument()
		fireEvent.click(screen.getByTestId("micro-app-mode-preview"))
		expect(onPageModeChange).toHaveBeenCalledWith("preview")
	})

	it("hides the mode switch when the user cannot edit the app", () => {
		renderHeader({ canUseDevelopment: false, onPageModeChange: vi.fn() })

		expect(screen.queryByTestId("micro-app-mode-switcher")).not.toBeInTheDocument()
	})

	it("shows published status when the micro app is already published", () => {
		renderHeader({ hasEntries: true, isPublished: true })

		expect(screen.getByTestId("micro-app-publish-button")).toHaveTextContent(
			"microAppPage.publish.published",
		)
	})

	it("hides collaborator management when the project is not manageable", () => {
		renderHeader({
			canManageCollaborators: false,
			onManageCollaborators: vi.fn(),
		})

		expect(screen.queryByTestId("micro-app-manage-collaborators")).not.toBeInTheDocument()
	})

	it("opens the HTML permission manager when available", () => {
		const onManageHtmlPermissions = vi.fn()
		renderHeader({
			canManageHtmlPermissions: true,
			onManageHtmlPermissions,
			canUseDevelopment: true,
			onPageModeChange: vi.fn(),
		})

		fireEvent.click(screen.getByTestId("micro-app-permission-manager"))

		expect(onManageHtmlPermissions).toHaveBeenCalledOnce()
		expect(screen.getByTestId("micro-app-permission-manager")).toHaveTextContent(
			"htmlEditor.permissionManager.open",
		)
		const permissionManager = screen.getByTestId("micro-app-permission-manager")
		const modeSwitcher = screen.getByTestId("micro-app-mode-switcher")
		expect(permissionManager).toHaveClass("h-7")
		expect(modeSwitcher).toHaveClass("h-8")
		expect(
			permissionManager.compareDocumentPosition(modeSwitcher) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
	})

	it("hides the HTML permission manager when unavailable", () => {
		renderHeader({ onManageHtmlPermissions: vi.fn() })

		expect(screen.queryByTestId("micro-app-permission-manager")).not.toBeInTheDocument()
	})

	it("renders collaborator management when the project is manageable", () => {
		renderHeader({
			canManageCollaborators: true,
			onManageCollaborators: vi.fn(),
		})

		expect(screen.getByTestId("micro-app-manage-collaborators")).toBeInTheDocument()
	})

	it("renders the details editor entry for editable projects", () => {
		const onEdit = vi.fn()
		renderHeader({ canEdit: true, onEdit })

		fireEvent.click(screen.getByTestId("micro-app-edit-button"))

		expect(onEdit).toHaveBeenCalledOnce()
	})

	it("does not render the details editor entry for read-only projects", () => {
		renderHeader({ canEdit: false, onEdit: vi.fn() })

		expect(screen.queryByTestId("micro-app-edit-button")).not.toBeInTheDocument()
	})
})
