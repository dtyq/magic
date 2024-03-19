import "@testing-library/jest-dom"
import { vi } from "vitest"

// Mock matchMedia for JSDOM environment
Object.defineProperty(window, "matchMedia", {
	writable: true,
	value: vi.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(), // deprecated
		removeListener: vi.fn(), // deprecated
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
})

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
	observe: vi.fn(),
	unobserve: vi.fn(),
	disconnect: vi.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
	observe: vi.fn(),
	unobserve: vi.fn(),
	disconnect: vi.fn(),
}))

// Mock getComputedStyle for JSDOM environment
Object.defineProperty(window, "getComputedStyle", {
	writable: true,
	value: vi.fn().mockImplementation(() => ({
		getPropertyValue: vi.fn().mockReturnValue("0px"),
	})),
})

// Mock scrollbar size calculation
Object.defineProperty(document.documentElement, "clientWidth", {
	writable: true,
	value: 1024,
})

Object.defineProperty(window, "innerWidth", {
	writable: true,
	value: 1024,
})
