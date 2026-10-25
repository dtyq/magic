import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import TerminalDisplay from "./TerminalDisplay"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("./style", () => ({
	useStyles: () => ({
		styles: new Proxy({}, { get: (_, key) => key }),
		cx: (...classes: string[]) => classes.filter(Boolean).join(" "),
	}),
}))

vi.mock("./TerminalCommand", () => ({ TerminalCommand: () => null }))
vi.mock("./TerminalOutput", () => ({ TerminalOutput: () => null }))

describe("TerminalDisplay exit status", () => {
	it.each([
		{ exitCode: 0, label: "terminal.returnedNormally", style: "" },
		{ exitCode: 2, label: "terminal.returnedWithNonzeroExitCode", style: "warning" },
		{ exitCode: -1, label: "terminal.returnedWithError", style: "error" },
		{ exitCode: -2, label: "terminal.returnedWithError", style: "error" },
	])("shows $label for exit code $exitCode", ({ exitCode, label, style }) => {
		render(<TerminalDisplay command="printf ok; exit 2" exitCode={exitCode} />)
		const status = screen.getByRole("status")
		expect(status).toHaveTextContent(label)
		if (style) expect(status).toHaveClass(style)
	})
})
