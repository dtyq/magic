import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
import DesignStyleDialog from "../DesignStyleDialog"
import { designStyleFixture } from "./fixtures"

const { useIsMobile } = vi.hoisted(() => ({ useIsMobile: vi.fn(() => false) }))
vi.mock("antd", () => ({
	// Preserve the desktop modal's lack of Radix context without Antd's theme dependencies.
	Modal: ({ open, children }: { open: boolean; children: ReactNode }) =>
		open ? <div role="dialog">{children}</div> : null,
}))
vi.mock("@/hooks/useIsMobile", () => ({ useIsMobile }))
vi.mock("react-i18next", async (importOriginal) => ({
	...(await importOriginal<typeof import("react-i18next")>()),
	useTranslation: () => ({ i18n: { language: "en" }, t: (key: string) => key }),
}))
vi.mock("@/models/user/hooks", () => ({
	useUserInfo: () => ({ userInfo: { organization_code: "org_1", user_id: "user_1" } }),
}))
vi.mock("@/providers/ThemeProvider", () => ({
	default: ({ children }: { children: ReactNode }) => children,
}))
vi.mock("@/components/base/MagicModal/styles", () => ({
	useStyles: () => ({
		styles: {},
		cx: (...classes: string[]) => classes.filter(Boolean).join(" "),
	}),
}))
vi.mock("../DesignStyleThumbnail", () => ({ default: () => <div /> }))
vi.mock("../DesignStylePreview", () => ({
	default: ({ mode }: { mode: string }) => <div data-testid="preview" data-mode={mode} />,
}))
vi.mock("../catalog", async (importOriginal) => ({
	...(await importOriginal<typeof import("../catalog")>()),
	loadDesignStyleCatalog: vi.fn(async () => ({ styles: [designStyleFixture] })),
}))

describe("DesignStyleDialog context regression", () => {
	it.each([false, true])("opens and applies details with mobile=%s", async (isMobile) => {
		useIsMobile.mockReturnValue(isMobile)
		const onApply = vi.fn()
		render(<DesignStyleDialog open onOpenChange={vi.fn()} onApply={onApply} canApply />)
		const card = await screen.findByTestId(`design-style-card-${designStyleFixture.code}`)
		fireEvent.click(card)
		expect(screen.getByRole("heading", { name: designStyleFixture.title })).toBeInTheDocument()
		expect(screen.getByTestId("design-style-back")).toHaveFocus()
		fireEvent.click(screen.getByRole("button", { name: "htmlEditor.designStyle.rawMode" }))
		expect(screen.getByTestId("preview")).toHaveAttribute("data-mode", "raw")
		fireEvent.click(screen.getByTestId("design-style-back"))
		expect(screen.queryByTestId("preview")).not.toBeInTheDocument()
		expect(card).toHaveFocus()
		fireEvent.click(card)
		fireEvent.click(screen.getByTestId("design-style-apply-button"))
		expect(onApply).toHaveBeenCalledWith(designStyleFixture)
	})
})
