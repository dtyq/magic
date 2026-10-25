import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

const { activeAccess, addedAccess, getMCPAccess, useConnectorActions, useConnectorMarket } =
	vi.hoisted(() => {
		const createAccess = () => ({
			initialized: true,
			mcpList: [],
			load: vi.fn().mockResolvedValue(undefined),
			save: vi.fn().mockResolvedValue(undefined),
		})

		return {
			activeAccess: createAccess(),
			addedAccess: createAccess(),
			getMCPAccess: vi.fn(),
			useConnectorActions: vi.fn(() => ({
				selectedItems: [],
				selectedIds: new Set<string>(),
				loadingIds: new Set<string>(),
				authDialog: null,
				handleAuthDialogSuccess: vi.fn(),
				handleAuthDialogRevoked: vi.fn(),
				handleAuthDialogOpenChange: vi.fn(),
				onStatusChange: vi.fn(),
			})),
			useConnectorMarket: vi.fn(() => ({
				list: [] as Array<{
					id: string
					name: string
					description: string
					icon: string
				}>,
				loading: false,
				loadingMoreError: false,
				hasMore: false,
				error: null,
				retry: vi.fn(),
				loadMore: vi.fn(),
			})),
		}
	})

vi.mock("mobx-react-lite", () => ({
	observer: (component: unknown) => component,
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@/components/Agent/MCP/store/mcp-access", () => ({
	getMCPAccess,
	loadMCPWithInstalledConnectorReconciliation: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/pages/superMagic/pages/ConnectorMarket/hooks/useConnectorActions", () => ({
	useConnectorActions,
}))

vi.mock("@/pages/superMagic/pages/ConnectorMarket/hooks/useConnectorMarket", () => ({
	useConnectorMarket,
}))

vi.mock("antd-mobile", () => ({
	InfiniteScroll: ({
		hasMore,
		loadMore,
	}: {
		hasMore: boolean
		loadMore: () => Promise<void>
	}) => (
		<button
			type="button"
			data-testid="mobile-mcp-market-infinite-scroll"
			data-has-more={hasMore}
			onClick={() => void loadMore()}
		/>
	),
}))

vi.mock("@/components/base-mobile/MagicPopup", () => ({
	default: ({ children, visible }: { children: ReactNode; visible: boolean }) =>
		visible ? <div>{children}</div> : null,
}))

vi.mock("@/components/shadcn-ui/smooth-tabs", () => ({
	SmoothTabs: ({
		tabs,
		onChange,
	}: {
		tabs: Array<{ value: string; label: string; testId?: string }>
		onChange: (value: string) => void
	}) => (
		<div>
			{tabs.map((tab) => (
				<button
					type="button"
					key={tab.value}
					data-testid={tab.testId}
					onClick={() => onChange(tab.value)}
				>
					{tab.label}
				</button>
			))}
		</div>
	),
}))

vi.mock("@/pages/superMagicMobile/components/MobileShell", () => ({
	MobileShellIconButton: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/Agent/MCP/AgentSettings/AgentPanel/MCPPanel/helpers", () => ({
	ConnectorAuthDialog: () => null,
}))

vi.mock("@/pages/superMagic/pages/ConnectorMarket/components/ConnectorCreateDialog", () => ({
	default: () => null,
}))

vi.mock("@/pages/superMagic/pages/ConnectorMarket/components/ConnectorDetailDialog", () => ({
	default: () => null,
}))

vi.mock("@/components/base/MagicImage", () => ({
	default: () => null,
}))

import MobileMCPPluginsSheet from "../MobileMCPPluginsSheet"

describe("MobileMCPPluginsSheet", () => {
	it("uses the active input context for connector installation", () => {
		getMCPAccess.mockImplementation(({ storageKey }: { storageKey?: string }) =>
			storageKey === "__added__" ? addedAccess : activeAccess,
		)

		render(<MobileMCPPluginsSheet open onClose={vi.fn()} storageKey="project-1" />)

		expect(getMCPAccess).toHaveBeenCalledWith({
			storageKey: "project-1",
			useTempStorage: false,
		})
		expect(useConnectorActions).toHaveBeenCalledWith({ activeAccess })
	})

	it("loads more pages for official and mine tabs but not the added tab", () => {
		const loadMore = vi.fn().mockResolvedValue(undefined)
		useConnectorMarket.mockReturnValue({
			list: [
				{
					id: "connector-1",
					name: "Connector 1",
					description: "Description",
					icon: "",
				},
			],
			loading: false,
			loadingMoreError: false,
			hasMore: true,
			error: null,
			retry: vi.fn(),
			loadMore,
		})

		render(<MobileMCPPluginsSheet open onClose={vi.fn()} storageKey="project-1" />)

		expect(screen.queryByTestId("mobile-mcp-market-infinite-scroll")).toBeNull()

		fireEvent.click(screen.getByTestId("mobile-mcp-plugins-sheet-official-tab"))
		const officialInfiniteScroll = screen.getByTestId("mobile-mcp-market-infinite-scroll")
		expect(officialInfiniteScroll).toHaveAttribute("data-has-more", "true")
		fireEvent.click(officialInfiniteScroll)
		expect(loadMore).toHaveBeenCalledTimes(1)

		fireEvent.click(screen.getByTestId("mobile-mcp-plugins-sheet-mine-tab"))
		expect(screen.getByTestId("mobile-mcp-market-infinite-scroll")).toBeInTheDocument()
	})
})
