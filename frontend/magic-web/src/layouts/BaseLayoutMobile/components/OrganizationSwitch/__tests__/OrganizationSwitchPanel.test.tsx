import { act, render, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "vitest"

import GlobalSidebarStore from "@/stores/display/GlobalSidebarStore"
import { OrganizationSwitchPanel } from "../index"

const capturedProps = vi.hoisted(() => ({
	onSwitchBefore: undefined as undefined | (() => void),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("ahooks", () => ({
	useMemoizedFn: <T extends (...args: any[]) => any>(fn: T) => fn,
}))

vi.mock("@/components/base-mobile/MagicPopup", () => ({
	default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
		visible ? <div data-testid="magic-popup">{children}</div> : null,
}))

vi.mock("@/components/base/MagicIcon", () => ({
	default: ({
		component: Component,
		size,
	}: {
		component: React.ComponentType<any>
		size: number
	}) => <Component size={size} />,
}))

vi.mock("@/components/base/MagicButton", () => ({
	default: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
		<button type="button" onClick={onClick}>
			{children}
		</button>
	),
}))

vi.mock("@/services/common/FunctionHub", () => ({
	functionHub: {
		execute: vi.fn(),
	},
}))

vi.mock("@/services/common/FunctionHub/registerDefault", () => ({
	DefaultFunction: {
		openAccountModal: "openAccountModal",
	},
}))

vi.mock("@/components/business/RecordingSummary/hooks/useCancelRecord", () => ({
	default: () => ({
		cancelRecord: vi.fn().mockResolvedValue(undefined),
	}),
}))

vi.mock("../styles.panel", () => ({
	useOrganizationSwitchPanelStyles: () => ({
		styles: {
			panelContainer: "panel-container",
			footer: "footer",
		},
	}),
}))

vi.mock("../OrganizationSwitch", () => ({
	default: (props: { onSwitchBefore?: () => void }) => {
		capturedProps.onSwitchBefore = props.onSwitchBefore
		return <div data-testid="organization-switch-body" />
	},
}))

/**
 * 组织切换面板回归测试：从移动端设置页打开时，切换组织只应关闭组织切换层，不应顺手关闭底层设置面板。
 */
describe("OrganizationSwitchPanel", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		capturedProps.onSwitchBefore = undefined
		GlobalSidebarStore.close()
		GlobalSidebarStore.closeOrganizationSwitch()
	})

	test("切换组织前保留全局设置面板开启状态", async () => {
		GlobalSidebarStore.open()
		GlobalSidebarStore.openOrganizationSwitch()

		render(<OrganizationSwitchPanel />)

		await waitFor(() => {
			expect(capturedProps.onSwitchBefore).toBeTypeOf("function")
		})

		act(() => {
			capturedProps.onSwitchBefore?.()
		})

		expect(GlobalSidebarStore.isOpen).toBe(true)
		expect(GlobalSidebarStore.isOrganizationSwitchOpen).toBe(false)
	})
})
