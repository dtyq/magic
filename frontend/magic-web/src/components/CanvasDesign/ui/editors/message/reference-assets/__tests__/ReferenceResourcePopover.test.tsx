import { cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import ReferenceResourcePopover from "../ReferenceResourcePopover"

vi.mock("../../../../primitives/shadcn/popover", () => ({
	Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	PopoverTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	PopoverContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("../../../../../app/providers/MagicProvider", () => ({
	useMagic: () => ({ methods: undefined, referenceResourcePanelRenderer: undefined }),
}))

vi.mock("../../../../../app/providers/I18nProvider", () => ({
	useCanvasDesignI18n: () => ({
		t: (_key: string, fallback: string) => fallback,
	}),
}))

vi.mock("../useCanvasReferenceMentionRuntime", () => ({
	useCanvasReferenceMentionRuntime: () => ({ dataService: undefined }),
}))

afterEach(() => cleanup())

function renderPopover(options?: { includeAssetsSource?: boolean; isLimitReached?: boolean }) {
	render(
		<ReferenceResourcePopover
			open
			onOpenChange={vi.fn()}
			onMouseEnter={vi.fn()}
			onMouseLeave={vi.fn()}
			trigger={<button type="button">trigger</button>}
			onSelectSource={vi.fn()}
			includeAssetsSource={options?.includeAssetsSource}
			isReferenceFileLimitReached={options?.isLimitReached}
			referenceResourceType="image"
			referenceFileInfos={[]}
		/>,
	)
}

describe("ReferenceResourcePopover", () => {
	it("keeps existing consumers on local and project sources by default", () => {
		renderPopover()

		expect(screen.getByRole("button", { name: "从本地上传" })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "从项目选择" })).toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "素材库" })).not.toBeInTheDocument()
	})

	it("adds the assets source only when enabled and honors the slot limit", () => {
		renderPopover({ includeAssetsSource: true, isLimitReached: true })

		expect(screen.getByRole("button", { name: "素材库" })).toBeDisabled()
	})
})
