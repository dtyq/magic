import { render, screen, waitFor } from "@testing-library/react"
import type { ComponentProps, ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

const getMarketSkillDetailViewMock = vi.fn()
const downloadFileContentMock = vi.fn()
const translation = {
	t: (key: string) => key,
	i18n: { language: "en_US" },
}

vi.mock("mobx-react-lite", () => ({
	observer: <T,>(component: T) => component,
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => translation,
}))

vi.mock("lucide-react", () => {
	function Icon() {
		return <span aria-hidden="true" />
	}

	return {
		Award: Icon,
		BadgeInfo: Icon,
		ChevronDown: Icon,
		ChevronsDown: Icon,
		CircleUserRound: Icon,
		Clock3: Icon,
		GalleryHorizontalEnd: Icon,
		Loader2: Icon,
		ShieldCheck: Icon,
		X: Icon,
	}
})

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		error: vi.fn(),
	},
}))

vi.mock("@/components/other/SmartTooltip", () => ({
	default: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}))

vi.mock("@/components/shadcn-ui/button", () => ({
	Button: ({ children, ...props }: ComponentProps<"button">) => (
		<button type="button" {...props}>
			{children}
		</button>
	),
}))

vi.mock("@/components/shadcn-ui/collapsible", () => ({
	Collapsible: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	CollapsibleContent: ({ children, ...props }: ComponentProps<"div">) => (
		<div {...props}>{children}</div>
	),
	CollapsibleTrigger: ({ children }: { children: ReactNode; asChild?: boolean }) => (
		<>{children}</>
	),
}))

vi.mock("@/components/shadcn-ui/dialog", () => ({
	Dialog: ({ children, open }: { children: ReactNode; open: boolean }) =>
		open ? <div>{children}</div> : null,
	DialogContent: ({
		children,
		showCloseButton,
		overlayClassName,
		...props
	}: ComponentProps<"div"> & {
		showCloseButton?: boolean
		overlayClassName?: string
	}) => {
		void showCloseButton
		void overlayClassName

		return <div {...props}>{children}</div>
	},
}))

vi.mock("@/components/shadcn-ui/scroll-area", () => ({
	ScrollArea: ({
		children,
		viewportClassName,
		...props
	}: ComponentProps<"div"> & {
		viewportClassName?: string
	}) => {
		void viewportClassName

		return <div {...props}>{children}</div>
	},
}))

vi.mock("@/components/shadcn-ui/separator", () => ({
	Separator: (props: ComponentProps<"div">) => <div {...props} />,
}))

vi.mock("@/components/shadcn-ui/skeleton", () => ({
	Skeleton: (props: ComponentProps<"div">) => <div {...props} />,
}))

vi.mock("@/pages/superMagic/components/SkillThumbnail", () => ({
	SkillThumbnail: ({ alt }: { alt: string }) => <div>{alt}</div>,
}))

vi.mock("@/pages/superMagic/utils/api", () => ({
	downloadFileContent: (...args: unknown[]) => downloadFileContentMock(...args),
}))

vi.mock("@/services/skills/SkillsService", () => ({
	skillsService: {
		getMarketSkillDetailView: (...args: unknown[]) => getMarketSkillDetailViewMock(...args),
		getUserSkillDetailView: vi.fn(),
	},
}))

vi.mock("@/components/tiptap-templates/simple/simple-editor", () => ({
	SimpleEditor: ({ content }: { content: string }) => <div>{content}</div>,
}))

describe("SkillDetailDialog", () => {
	it("hides the skill file section when skill markdown is empty", async () => {
		getMarketSkillDetailViewMock.mockResolvedValue({
			code: "skill.code",
			name: "Skill Name",
			description: "Skill description",
			logo: "",
			packageName: "skill.package",
			versionCode: "1.0.0",
			updatedAt: "2026-04-09 10:00:00",
			skillFileUrl: "https://example.com/skill.md",
			isFeatured: false,
			publisherType: "OFFICIAL",
			publisherName: "Magic",
		})
		downloadFileContentMock.mockResolvedValue("")

		const { SkillDetailDialog } = await import("../SkillDetailDialog")

		render(
			<SkillDetailDialog
				open={true}
				onOpenChange={vi.fn()}
				skillCode="skill.code"
				detailSource="market"
			/>,
		)

		await waitFor(() => {
			expect(getMarketSkillDetailViewMock).toHaveBeenCalledWith("skill.code")
			expect(downloadFileContentMock).toHaveBeenCalledWith("https://example.com/skill.md", {
				responseType: "text",
			})
		})

		await screen.findByTestId("skill-detail-dialog-content")

		await waitFor(() => {
			expect(screen.queryByTestId("skill-detail-dialog-skill-file")).not.toBeInTheDocument()
		})
	})
})
