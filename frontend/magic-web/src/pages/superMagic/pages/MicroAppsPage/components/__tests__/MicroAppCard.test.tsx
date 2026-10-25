import type { HTMLAttributes, PropsWithChildren } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import MicroAppCard from "../MicroAppCard"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("framer-motion", () => ({
	motion: {
		div: ({ children, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) => {
			const domProps = { ...props } as HTMLAttributes<HTMLDivElement> &
				Record<string, unknown>
			delete domProps.initial
			delete domProps.whileInView
			delete domProps.viewport
			delete domProps.whileHover
			delete domProps.whileTap
			delete domProps.transition
			return <div {...domProps}>{children}</div>
		},
	},
	useReducedMotion: () => true,
}))

const defaultProps = {
	id: "app-1",
	title: "客户跟进助手",
	description: "客户跟进与提醒工具",
	meta: "开发中",
	onClick: vi.fn(),
	testId: "micro-app-card",
	onOpenInNewWindow: vi.fn(),
	onRename: vi.fn(),
	onDelete: vi.fn(),
	canRename: true,
}

describe("MicroAppCard actions", () => {
	it("shows the desktop actions from the right-click menu", async () => {
		const onRename = vi.fn()
		render(<MicroAppCard {...defaultProps} onRename={onRename} />)

		fireEvent.contextMenu(screen.getByTestId("micro-app-card"))
		fireEvent.click(await screen.findByText("microAppsPage.actions.rename"))

		await waitFor(() => expect(onRename).toHaveBeenCalledTimes(1))
	})

	it("shows the mobile actions in a bottom sheet", async () => {
		const onDelete = vi.fn()
		render(<MicroAppCard {...defaultProps} variant="mobile" onDelete={onDelete} />)

		fireEvent.click(screen.getByTestId("micro-app-card-more"))
		expect(screen.queryByText("microAppsPage.actions.openInNewWindow")).not.toBeInTheDocument()
		fireEvent.click(await screen.findByText("microAppsPage.actions.deleteApp"))

		await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1))
	})

	it.each(["desktop", "mobile"] as const)(
		"shows collaborator management only when explicitly allowed on %s",
		async (variant) => {
			const onManageCollaborators = vi.fn()
			render(
				<MicroAppCard
					{...defaultProps}
					variant={variant}
					canManageCollaborators
					onManageCollaborators={onManageCollaborators}
				/>,
			)

			if (variant === "desktop") {
				fireEvent.contextMenu(screen.getByTestId("micro-app-card"))
			} else {
				fireEvent.click(screen.getByTestId("micro-app-card-more"))
			}

			fireEvent.click(await screen.findByText("microAppsPage.actions.manageCollaborators"))
			await waitFor(() => expect(onManageCollaborators).toHaveBeenCalledTimes(1))
		},
	)

	it("hides collaborator management when capability is not available", async () => {
		const onManageCollaborators = vi.fn()
		render(<MicroAppCard {...defaultProps} onManageCollaborators={onManageCollaborators} />)

		fireEvent.contextMenu(screen.getByTestId("micro-app-card"))
		expect(
			screen.queryByText("microAppsPage.actions.manageCollaborators"),
		).not.toBeInTheDocument()
	})

	it.each(["desktop", "mobile"] as const)(
		"hides the delete action on %s when deletion is not allowed",
		async (variant) => {
			render(<MicroAppCard {...defaultProps} variant={variant} canDelete={false} />)

			if (variant === "desktop") {
				fireEvent.contextMenu(screen.getByTestId("micro-app-card"))
			} else {
				fireEvent.click(screen.getByTestId("micro-app-card-more"))
			}

			expect(screen.queryByText("microAppsPage.actions.deleteApp")).not.toBeInTheDocument()
		},
	)

	it.each(["desktop", "mobile"] as const)(
		"hides the rename action on %s when renaming is not allowed",
		async (variant) => {
			render(<MicroAppCard {...defaultProps} variant={variant} canRename={false} />)

			if (variant === "desktop") {
				fireEvent.contextMenu(screen.getByTestId("micro-app-card"))
			} else {
				fireEvent.click(screen.getByTestId("micro-app-card-more"))
			}

			expect(screen.queryByText("microAppsPage.actions.rename")).not.toBeInTheDocument()
		},
	)
})
