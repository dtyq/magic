import "@testing-library/jest-dom"
import "fake-indexeddb/auto"
import type { ReactNode } from "react"
import React from "react"
import { vi } from "vitest"

// 添加 module 全局变量 for CommonJS 模块
;(global as any).module = {
	exports: {},
}

// 添加 require 函数 for CommonJS 模块
;(global as any).require = vi.fn(() => ({}))

// Mock URL.createObjectURL
Object.defineProperty(URL, "createObjectURL", {
	writable: true,
	value: vi.fn(() => "blob:mock-url"),
})

// Mock URL.revokeObjectURL
Object.defineProperty(URL, "revokeObjectURL", {
	writable: true,
	value: vi.fn(),
})

// 添加window.matchMedia的模拟实现
Object.defineProperty(window, "matchMedia", {
	writable: true,
	value: vi.fn().mockImplementation((query) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(), // 兼容旧版API
		removeListener: vi.fn(), // 兼容旧版API
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
})

// 添加 ResizeObserver mock for input-otp
global.ResizeObserver = vi.fn().mockImplementation(() => ({
	observe: vi.fn(),
	unobserve: vi.fn(),
	disconnect: vi.fn(),
}))

// 添加对 antd 的最小模拟，避免在测试启动时加载完整 antd 依赖链
vi.mock("antd", () => {
	// 创建一个模拟的消息API
	const mockMessage = {
		success: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		warning: vi.fn(),
		loading: vi.fn(),
	}

	mockMessage.useMessage = vi.fn(() => [mockMessage, React.createElement(React.Fragment)])

	const mockNotification = {
		success: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		warning: vi.fn(),
		open: vi.fn(),
		destroy: vi.fn(),
	}

	mockNotification.useNotification = vi.fn(() => [
		mockNotification,
		React.createElement(React.Fragment),
	])

	const mockModalApi = {
		info: vi.fn(),
		success: vi.fn(),
		error: vi.fn(),
		warning: vi.fn(),
		confirm: vi.fn(),
		destroyAll: vi.fn(),
	}

	mockModalApi.useModal = vi.fn(() => [mockModalApi, React.createElement(React.Fragment)])

	// 创建一个模拟的useApp钩子
	const mockUseApp = vi.fn().mockReturnValue({
		message: mockMessage,
		modal: mockModalApi,
		notification: mockNotification,
	})

	// 创建一个模拟的App组件
	const App = createMockComponent("App")

	// 添加useApp方法
	App.useApp = mockUseApp

	return {
		App,
	}
})
