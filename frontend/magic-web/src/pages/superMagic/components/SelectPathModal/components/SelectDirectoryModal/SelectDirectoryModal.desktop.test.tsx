import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import SelectDirectoryModal from "./SelectDirectoryModal"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => false,
}))

vi.mock("antd", () => ({
	Tooltip: ({ children }: { children: React.ReactNode }) => children,
	Dropdown: ({ children }: { children: React.ReactNode }) => children,
	Menu: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
		Item: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
			<button type="button" onClick={onClick}>
				{children}
			</button>
		),
	}),
}))

vi.mock("@/components/base/MagicSpin", () => ({
	default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/shadcn-ui/button", () => ({
	Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
		<button type="button" {...props}>
			{children}
		</button>
	),
}))

vi.mock("@/components/shadcn-ui/input", () => ({
	Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock("@/pages/superMagic/components/TopicFilesButton/components", () => ({
	InputWithError: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock("@/pages/superMagic/components/SelectPathModal/hooks/useCreateDirectory", () => ({
	useCreateDirectory: () => ({
		loading: false,
		createDirectoryShown: false,
		createDirectoryName: "",
		createDirectoryErrorMessage: "",
		showCreateDirectory: vi.fn(),
		cancelCreateDirectory: vi.fn(),
		onCreateDirectoryInputChange: vi.fn(),
		onCreateDirectoryInputFocus: vi.fn(),
		submitCreateDirectory: vi.fn(),
		onCreateDirectoryInputKeyDown: vi.fn(),
	}),
}))

vi.mock("@/components/base/MagicEllipseWithTooltip/MagicEllipseWithTooltip", () => ({
	default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("../BaseModal", () => ({
	default: ({
		visible,
		title,
		content,
		footer,
	}: {
		visible: boolean
		title?: React.ReactNode
		content: React.ReactNode
		footer?: React.ReactNode
	}) => {
		if (!visible) return null

		return (
			<div data-testid="mock-base-modal">
				<div>{title}</div>
				<div>{content}</div>
				{footer ? <div data-testid="mock-base-modal-footer" /> : null}
			</div>
		)
	},
}))

describe("SelectDirectoryModal desktop", () => {
	const onClose = vi.fn()
	const onSubmit = vi.fn()

	beforeEach(() => {
		onClose.mockReset()
		onSubmit.mockReset()
	})

	/**
	 * 桌面 smoke test 只验证这次移动端拆分后，工具栏和桌面内容区域仍然能够正常挂载。
	 */
	function renderModal() {
		return render(
			<SelectDirectoryModal
				visible
				projectId="project-1"
				title="移动文件"
				attachments={[
					{
						file_id: "folder-a",
						name: "Folder A",
						is_directory: true,
						children: [],
					},
				]}
				onClose={onClose}
				onSubmit={onSubmit}
			/>,
		)
	}

	it("keeps the desktop toolbar actions available", () => {
		renderModal()

		expect(screen.getByTestId("select-directory-modal-toolbar")).toBeInTheDocument()
		expect(screen.getByTestId("select-directory-modal-search-toggle")).toBeInTheDocument()
		expect(screen.getByTestId("select-directory-modal-create-folder")).toBeInTheDocument()
		expect(screen.queryByTestId("select-directory-mobile-sheet-root")).not.toBeInTheDocument()
	})
})
