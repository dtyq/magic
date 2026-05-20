import { beforeEach, describe, expect, it, vi } from "vitest"
import type { OpenSettingPanelOptions } from "@/components/business/SettingPanel/openSettingPanel"
import type { PropsWithChildren } from "react"

const mocks = vi.hoisted(() => {
	const events: string[] = []
	let namespaceLoaded = false

	return {
		events,
		setNamespaceLoaded(value: boolean) {
			namespaceLoaded = value
		},
		isNamespaceLoaded() {
			return namespaceLoaded
		},
		loadNamespaces: vi.fn(async (namespace: string | string[]) => {
			events.push(`load:${Array.isArray(namespace) ? namespace.join(",") : namespace}`)
			namespaceLoaded = true
		}),
		t: vi.fn((key: string, options?: { ns?: string }) => {
			events.push(`t:${options?.ns}:${key}:${namespaceLoaded ? "loaded" : "pending"}`)
			return namespaceLoaded ? `${options?.ns}:${key}` : `pending:${options?.ns}:${key}`
		}),
		openSettingPanel: vi.fn((options: OpenSettingPanelOptions) => options),
		getAccountSettingMenuItems: vi.fn((t: (key: string) => string) => [
			{
				key: "myAccount",
				label: t("myAccount"),
				component: null,
			},
		]),
	}
})

vi.mock("react-i18next", () => ({
	getI18n: () => ({
		loadNamespaces: mocks.loadNamespaces,
		t: mocks.t,
	}),
}))

vi.mock("antd", () => ({
	Flex: ({ children }: PropsWithChildren) => children,
}))

vi.mock("@/components/base/MagicSpin", () => ({
	default: () => null,
}))

vi.mock("@/components/business/SettingPanel/openSettingPanel", () => ({
	openSettingPanel: mocks.openSettingPanel,
}))

vi.mock("../config", () => ({
	getAccountSettingMenuItems: mocks.getAccountSettingMenuItems,
}))

import { openAccountSetting } from "../openAccountSetting"

describe("openAccountSetting", () => {
	beforeEach(() => {
		mocks.events.length = 0
		mocks.setNamespaceLoaded(false)
		vi.clearAllMocks()
	})

	it("loads accountSetting namespace before building menu items", async () => {
		await openAccountSetting()

		expect(mocks.loadNamespaces).toHaveBeenCalledWith("accountSetting")
		expect(mocks.getAccountSettingMenuItems).toHaveBeenCalledOnce()
		expect(mocks.openSettingPanel).toHaveBeenCalledOnce()
		expect(mocks.events).toEqual(["load:accountSetting", "t:accountSetting:myAccount:loaded"])

		const [options] = mocks.openSettingPanel.mock.calls[0] ?? []
		expect(options.menuItems[0]?.label).toBe("accountSetting:myAccount")
	})
})
