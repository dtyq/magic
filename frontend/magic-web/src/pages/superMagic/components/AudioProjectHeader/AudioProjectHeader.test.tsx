import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import AudioProjectHeader from "."

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) =>
			({
				"detail.back": "返回",
				"detail.share": "分享",
				"card.moreActions": "更多操作",
				"card.rename": "重命名",
				"card.moveToGroup": "移动到分组",
				"card.copyToProject": "复制到项目",
				"card.regenerateSummary": "重新总结",
				"actions.deleteTitle": "删除",
			})[key] ?? key,
	}),
}))

vi.mock("@/components/shadcn-ui/dropdown-menu", () => ({
	DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
		<div role="menu">{children}</div>
	),
	DropdownMenuItem: ({ children }: { children: React.ReactNode }) => (
		<div role="menuitem">{children}</div>
	),
}))

function renderHeader() {
	return render(
		<AudioProjectHeader
			title="Mock recording"
			canCopyToProject
			canRename
			canMoveToGroup
			canGenerateSummary
			canDelete
			canShare
			summaryMode="regenerate"
			summarySubmitting={false}
			onBack={vi.fn()}
			onRename={vi.fn(async () => true)}
			onMoveToGroup={vi.fn()}
			onCopyToProject={vi.fn()}
			onGenerateSummary={vi.fn()}
			onShare={vi.fn()}
			onDelete={vi.fn()}
		/>,
	)
}

describe("AudioProjectHeader", () => {
	it("renders the project title and ordinary header actions", () => {
		renderHeader()

		expect(screen.getByTestId("audio-project-header")).toBeInTheDocument()
		expect(screen.getByRole("heading", { name: "Mock recording" })).toBeInTheDocument()
		expect(screen.getByTestId("audio-project-header-back")).toBeInTheDocument()
		expect(screen.getByTestId("audio-project-header-share")).toBeInTheDocument()
	})

	it("hides sharing for read-only headers", () => {
		render(
			<AudioProjectHeader
				title="Mock recording"
				canCopyToProject={false}
				canRename={false}
				canMoveToGroup={false}
				canGenerateSummary={false}
				canDelete={false}
				canShare={false}
				summarySubmitting={false}
				onBack={vi.fn()}
				onRename={vi.fn(async () => true)}
				onMoveToGroup={vi.fn()}
				onCopyToProject={vi.fn()}
				onGenerateSummary={vi.fn()}
				onShare={vi.fn()}
				onDelete={vi.fn()}
			/>,
		)

		expect(screen.queryByTestId("audio-project-header-share")).not.toBeInTheDocument()
	})

	it("exposes recording actions without executing deletion", () => {
		renderHeader()

		expect(screen.getByRole("menuitem", { name: "重命名" })).toBeInTheDocument()
		expect(screen.getByRole("menuitem", { name: "移动到分组" })).toBeInTheDocument()
		expect(screen.getByRole("menuitem", { name: "复制到项目" })).toBeInTheDocument()
		expect(screen.getByRole("menuitem", { name: "重新总结" })).toBeInTheDocument()
		expect(screen.getByRole("menuitem", { name: "删除" })).toBeInTheDocument()
		expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
	})
})
