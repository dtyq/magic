import type { ReactNode } from "react"
import { cleanup, renderHook } from "@testing-library/react"
import { createInstance, type i18n } from "i18next"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import enUS from "@/assets/locales/en_US/component.json"
import zhCN from "@/assets/locales/zh_CN/component.json"
import { useMicrophonePermissionI18n } from "../useMicrophonePermissionI18n"

const environment = vi.hoisted(() => ({ isMagicApp: false }))

vi.mock("@/utils/devices", () => ({
	get isMagicApp() {
		return environment.isMagicApp
	},
}))

const resources = {
	zh_CN: { component: zhCN },
	en_US: { component: enUS },
}

afterEach(cleanup)

describe.each(["zh_CN", "en_US"] as const)("useMicrophonePermissionI18n (%s)", (language) => {
	let instance: i18n
	const permission = resources[language].component.voiceInput.permission

	beforeEach(async () => {
		environment.isMagicApp = false
		instance = createInstance()
		await instance.init({
			lng: language,
			fallbackLng: false,
			resources,
		})
	})

	function wrapper({ children }: { children: ReactNode }) {
		return <I18nextProvider i18n={instance}>{children}</I18nextProvider>
	}

	it("preserves the browser modal and every browser instruction", () => {
		const { result } = renderHook(() => useMicrophonePermissionI18n(), { wrapper })

		expect(result.current).toEqual({
			permissionModal: permission.modal.browser,
			permissionInstructions: permission.instructions.browser,
		})
	})

	it("uses app guidance for browser-named fields without exposing missing translation keys", () => {
		environment.isMagicApp = true

		const { result } = renderHook(() => useMicrophonePermissionI18n(), { wrapper })

		expect(result.current).toEqual({
			permissionModal: permission.modal.app,
			permissionInstructions: {
				chrome: permission.instructions.app.default,
				edge: permission.instructions.app.default,
				firefox: permission.instructions.app.default,
				safari: permission.instructions.app.default,
				ios: permission.instructions.app.ios,
				android: permission.instructions.app.android,
				default: permission.instructions.app.default,
			},
		})
	})
})
