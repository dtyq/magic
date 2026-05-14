import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import MobileProjectDetailFilesView from "./MobileProjectDetailFilesView"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
	initReactI18next: {
		type: "3rdParty",
		init: () => {},
	},
}))

vi.mock("mobx-react-lite", () => ({
	observer: <T,>(component: T) => component,
}))

vi.mock("@/components/base-mobile/MagicPopup", () => ({
	default: ({
		visible,
		children,
		headerTitle,
		headerLeadingAction,
		headerTrailingAction,
		title,
	}: any) => {
		if (!visible) return null

		return (
			<div data-testid={`mock-popup-${headerTitle || title || "untitled"}`}>
				{headerLeadingAction ? (
					<button
						type="button"
						onClick={headerLeadingAction.onClick}
						data-testid={headerLeadingAction.testId}
					>
						leading
					</button>
				) : null}
				{headerTrailingAction ? (
					<button
						type="button"
						onClick={headerTrailingAction.onClick}
						disabled={headerTrailingAction.disabled}
						data-testid={headerTrailingAction.testId}
					>
						trailing
					</button>
				) : null}
				<div>{headerTitle || title}</div>
				<div>{children}</div>
			</div>
		)
	},
}))

vi.mock("@/components/shadcn-ui/button", () => ({
	Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}))

vi.mock("@/components/shadcn-ui/input", () => ({
	Input: (props: any) => <input {...props} />,
}))

vi.mock("@/pages/superMagicMobile/components/MobileBottomSearchBar", () => ({
	default: ({ value, onValueChange, placeholder, testIdPrefix }: any) => (
		<input
			value={value}
			placeholder={placeholder}
			onChange={(event) => onValueChange(event.target.value)}
			data-testid={`${testIdPrefix}-input`}
		/>
	),
}))

vi.mock("./MobileFilesSelectionBar", () => ({
	default: () => <div data-testid="project-detail-files-selection-bar" />,
}))

vi.mock("./TopicFileIcon", () => ({
	TopicFileIcon: () => <div data-testid="topic-file-icon" />,
}))

describe("MobileProjectDetailFilesView", () => {
	it("opens a dedicated create sheet for txt files and confirms after a valid name is entered", () => {
		const onCreateFile = vi.fn()

		render(
			<MobileProjectDetailFilesView attachments={[]} allowEdit onCreateFile={onCreateFile} />,
		)

		fireEvent.click(screen.getByTestId("project-detail-files-add-button"))

		expect(screen.getByTestId("project-detail-files-menu-sheet")).toBeInTheDocument()

		fireEvent.click(screen.getByTestId("project-detail-files-create-txt-button"))

		expect(screen.queryByTestId("project-detail-files-menu-sheet")).not.toBeInTheDocument()
		expect(screen.getByTestId("project-detail-files-create-sheet")).toBeInTheDocument()
		expect(screen.getByTestId("project-detail-files-create-confirm-button")).toBeDisabled()

		fireEvent.change(screen.getByTestId("project-detail-files-create-name-input"), {
			target: { value: "lesson-notes" },
		})

		expect(screen.getByTestId("project-detail-files-create-confirm-button")).toBeEnabled()

		fireEvent.click(screen.getByTestId("project-detail-files-create-confirm-button"))

		expect(onCreateFile).toHaveBeenCalledWith("txt", undefined, "lesson-notes")
	})
})
