import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import CodeVersionCompareDialog from "../CodeVersionCompareDialog"

vi.mock("antd-style", () => ({
	useThemeMode: () => ({
		appearance: "light",
	}),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/components/base/MagicModal", () => ({
	default: ({ open, title, children }: { open: boolean; title: string; children: ReactNode }) =>
		open ? (
			<div data-testid="mock-magic-modal">
				<div>{title}</div>
				{children}
			</div>
		) : null,
}))

vi.mock("@/lib/monacoEditor", () => ({
	MonacoDiffEditor: ({
		original,
		modified,
		language,
	}: {
		original: string
		modified: string
		language: string
	}) => (
		<div data-testid="mock-monaco-diff-editor">
			<div data-testid="mock-monaco-diff-original">{original}</div>
			<div data-testid="mock-monaco-diff-modified">{modified}</div>
			<div data-testid="mock-monaco-diff-language">{language}</div>
		</div>
	),
}))

describe("CodeVersionCompareDialog", () => {
	it("should render diff viewer with both versions", () => {
		render(
			<CodeVersionCompareDialog
				open={true}
				onOpenChange={vi.fn()}
				currentContent={"<div>local</div>"}
				serverContent={"<div>server</div>"}
				fileName="index.html"
				onUseMyVersion={vi.fn()}
				onUseServerVersion={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("mock-monaco-diff-editor")).toBeInTheDocument()
		expect(screen.getByTestId("mock-monaco-diff-original")).toHaveTextContent(
			"<div>local</div>",
		)
		expect(screen.getByTestId("mock-monaco-diff-modified")).toHaveTextContent(
			"<div>server</div>",
		)
		expect(screen.getByTestId("mock-monaco-diff-language")).toHaveTextContent("html")
	})

	it("should use my version when clicking the primary action", () => {
		const handleUseMyVersion = vi.fn()
		const handleUseServerVersion = vi.fn()
		const handleOpenChange = vi.fn()

		render(
			<CodeVersionCompareDialog
				open={true}
				onOpenChange={handleOpenChange}
				currentContent={"<div>local</div>"}
				serverContent={"<div>server</div>"}
				fileName="index.html"
				onUseMyVersion={handleUseMyVersion}
				onUseServerVersion={handleUseServerVersion}
			/>,
		)

		fireEvent.click(screen.getByTestId("html-code-version-compare-use-my-version-button"))

		expect(handleUseMyVersion).toHaveBeenCalledTimes(1)
		expect(handleUseServerVersion).not.toHaveBeenCalled()
		expect(handleOpenChange).toHaveBeenCalledWith(false)
	})

	it("should use server version when clicking the secondary action", () => {
		const handleUseMyVersion = vi.fn()
		const handleUseServerVersion = vi.fn()
		const handleOpenChange = vi.fn()

		render(
			<CodeVersionCompareDialog
				open={true}
				onOpenChange={handleOpenChange}
				currentContent={"<div>local</div>"}
				serverContent={"<div>server</div>"}
				fileName="index.html"
				onUseMyVersion={handleUseMyVersion}
				onUseServerVersion={handleUseServerVersion}
			/>,
		)

		fireEvent.click(screen.getByTestId("html-code-version-compare-use-server-version-button"))

		expect(handleUseServerVersion).toHaveBeenCalledTimes(1)
		expect(handleUseMyVersion).not.toHaveBeenCalled()
		expect(handleOpenChange).toHaveBeenCalledWith(false)
	})
})
