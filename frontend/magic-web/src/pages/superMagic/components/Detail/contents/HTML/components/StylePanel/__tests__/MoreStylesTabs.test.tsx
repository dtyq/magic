import type { ButtonHTMLAttributes, ReactNode } from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MoreStylesTabs } from "../MoreStylesTabs"

const tabsContext = vi.hoisted(() => ({
	value: "",
	onValueChange: vi.fn<(value: string) => void>(),
}))

const moreStylesTabCache = vi.hoisted(() => {
	const tabs = new Map<string, string>()
	return {
		tabs,
		getMoreStylesTab: (selector: string) => tabs.get(selector),
		rememberMoreStylesTab: (selector: string, tab: string) => {
			tabs.set(selector, tab)
		},
		reset: () => tabs.clear(),
	}
})

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("../../../iframe-bridge/contexts/StylePanelContext", () => ({
	useStylePanelStore: () => moreStylesTabCache,
}))

vi.mock("@/components/shadcn-ui/scroll-area", () => ({
	ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/shadcn-ui/tabs", () => ({
	Tabs: ({
		value,
		onValueChange,
		children,
	}: {
		value: string
		onValueChange: (value: string) => void
		children: ReactNode
	}) => {
		tabsContext.value = value
		tabsContext.onValueChange = vi.fn(onValueChange)
		return <div>{children}</div>
	},
	TabsList: ({ children, className, ...props }: { children: ReactNode; className?: string }) => (
		<div className={className} {...props}>
			{children}
		</div>
	),
	TabsTrigger: ({
		value,
		children,
		...props
	}: { value: string; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) => (
		<button type="button" onClick={() => tabsContext.onValueChange(value)} {...props}>
			{children}
		</button>
	),
	TabsContent: ({ value, children, ...props }: { value: string; children: ReactNode }) =>
		tabsContext.value === value ? <div {...props}>{children}</div> : null,
}))

vi.mock("../sections/BackgroundSection", () => ({
	default: () => <div data-testid="background-section" />,
}))

vi.mock("../sections/BorderSection", () => ({
	default: () => <div data-testid="border-section" />,
}))

vi.mock("../sections/ShadowSection", () => ({
	default: () => <div data-testid="shadow-section" />,
}))

vi.mock("../sections/BoxModelSection", () => ({
	default: () => <div data-testid="layout-section" />,
}))

vi.mock("../sections/FlexGridSection", () => ({
	default: () => <div data-testid="flex-grid-section" />,
}))

vi.mock("../sections/ImageSection", () => ({
	default: () => <div data-testid="image-section" />,
}))

vi.mock("../sections/AnchorSection", () => ({
	AnchorSection: () => <div data-testid="anchor-section" />,
}))

vi.mock("../sections/CustomCSSSection", () => ({
	CustomCSSSection: () => <div data-testid="custom-css-section" />,
}))

function createSelectedElement(selector: string) {
	return {
		selector,
		tagName: "img",
		isImageElement: true,
		computedStyles: {},
	} as never
}

const baseProps = {
	selectedElement: createSelectedElement("img.hero"),
	editorRef: { current: null } as never,
	disabled: false,
	showTypography: false,
	showFlexGrid: false,
	showImage: true,
	showBackground: true,
	showBorder: true,
	showShadow: true,
	isLink: false,
	fontFamilySelector: null,
	textContentField: null,
	onStyleChange: vi.fn(),
	onBatchStyleChange: vi.fn(),
	onUpdateAttributes: vi.fn().mockResolvedValue(undefined),
}

describe("MoreStylesTabs", () => {
	afterEach(() => {
		moreStylesTabCache.reset()
		cleanup()
	})

	it("keeps background, border, and shadow independent and places layout second to last", () => {
		render(<MoreStylesTabs {...baseProps} />)

		const tabLabels = screen.getAllByRole("button").map((button) => button.textContent)
		expect(tabLabels).toEqual([
			"stylePanel.background",
			"stylePanel.border",
			"stylePanel.shadow",
			"stylePanel.imageSettings",
			"stylePanel.clickLink",
			"stylePanel.layout",
			"stylePanel.customCSS.title",
		])
		expect(tabLabels.at(-2)).toBe("stylePanel.layout")
		expect(screen.getByTestId("style-panel-more-advanced-tab")).toHaveClass(
			"flex-none",
			"shrink-0",
		)
		expect(screen.getByTestId("style-panel-more-tabs-list")).toHaveClass("w-max", "max-w-full")
		expect(screen.getByTestId("style-panel-more-tabs-list")).not.toHaveClass("w-full")

		fireEvent.click(screen.getByRole("button", { name: "stylePanel.border" }))
		expect(screen.getByTestId("border-section")).toBeInTheDocument()
		expect(screen.queryByTestId("background-section")).not.toBeInTheDocument()
	})

	it("restores the last tab when the same element opens More Styles again", () => {
		const { unmount } = render(<MoreStylesTabs {...baseProps} />)

		expect(screen.getByTestId("image-section")).toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "stylePanel.layout" }))
		expect(screen.getByTestId("layout-section")).toBeInTheDocument()

		unmount()
		render(<MoreStylesTabs {...baseProps} />)

		expect(screen.getByTestId("layout-section")).toBeInTheDocument()
		expect(screen.queryByTestId("image-section")).not.toBeInTheDocument()
	})

	it("keeps More Styles tabs independent per element", () => {
		const { rerender } = render(<MoreStylesTabs {...baseProps} />)

		fireEvent.click(screen.getByRole("button", { name: "stylePanel.layout" }))
		expect(screen.getByTestId("layout-section")).toBeInTheDocument()

		rerender(
			<MoreStylesTabs {...baseProps} selectedElement={createSelectedElement("img.cover")} />,
		)

		expect(screen.getByTestId("image-section")).toBeInTheDocument()
		expect(screen.queryByTestId("layout-section")).not.toBeInTheDocument()

		rerender(<MoreStylesTabs {...baseProps} />)

		expect(screen.getByTestId("layout-section")).toBeInTheDocument()
	})

	it("falls back to the first tab after the edit session cache is cleared", () => {
		const { unmount } = render(<MoreStylesTabs {...baseProps} />)

		fireEvent.click(screen.getByRole("button", { name: "stylePanel.layout" }))
		moreStylesTabCache.reset()
		unmount()
		render(<MoreStylesTabs {...baseProps} />)

		expect(screen.getByTestId("image-section")).toBeInTheDocument()
		expect(screen.queryByTestId("layout-section")).not.toBeInTheDocument()
	})

	it("falls back to the first tab when the cached tab is no longer available", () => {
		moreStylesTabCache.rememberMoreStylesTab("img.hero", "image")

		render(<MoreStylesTabs {...baseProps} showImage={false} />)

		expect(screen.getByTestId("background-section")).toBeInTheDocument()
		expect(screen.queryByTestId("image-section")).not.toBeInTheDocument()
	})
})
