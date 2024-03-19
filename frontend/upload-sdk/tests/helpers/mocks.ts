import { vi } from "vitest"

/**
 * Create a mock File object for testing
 * @param name - File name
 * @param size - File size in bytes (default: 5MB)
 * @param type - MIME type (default: determined by file extension)
 */
export function createMockFile(name = "test.txt", size = 5 * 1024 * 1024, type?: string): File {
	const content = new Array(size).fill("a").join("")
	const mimeType = type || getMimeType(name)
	return new File([content], name, { type: mimeType })
}

/**
 * Create a small mock File for fast tests
 */
export function createSmallMockFile(name = "test.txt", size = 1024): File {
	return createMockFile(name, size)
}

/**
 * Create a large mock File for multipart upload tests
 */
export function createLargeMockFile(name = "large.txt", size = 10 * 1024 * 1024): File {
	return createMockFile(name, size)
}

/**
 * Get MIME type based on file extension
 */
function getMimeType(filename: string): string {
	if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) return "image/jpeg"
	if (filename.endsWith(".png")) return "image/png"
	if (filename.endsWith(".txt")) return "text/plain"
	if (filename.endsWith(".html")) return "text/html"
	if (filename.endsWith(".pdf")) return "application/pdf"
	return "application/octet-stream"
}

/**
 * Create a mock XMLHttpRequest object
 */
export function createMockXHR(options: {
	status?: number
	response?: any
	headers?: Record<string, string>
	onLoad?: (xhr: any) => void
	onError?: (xhr: any) => void
} = {}) {
	const {
		status = 200,
		response = "{}",
		headers = {},
		onLoad,
		onError,
	} = options

	const mockXhr = {
		open: vi.fn(),
		send: vi.fn(),
		setRequestHeader: vi.fn(),
		upload: {
			addEventListener: vi.fn(),
		},
		addEventListener: vi.fn((event: string, callback: any) => {
			if (event === "load" && onLoad) {
				setTimeout(() => {
					onLoad(mockXhr)
					callback()
				}, 0)
			} else if (event === "error" && onError) {
				setTimeout(() => {
					onError(mockXhr)
					callback()
				}, 0)
			}
		}),
		getResponseHeader: vi.fn((header: string) => headers[header] || null),
		getAllResponseHeaders: vi.fn(() => 
			Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join("\r\n")
		),
		status,
		response,
		responseText: typeof response === "string" ? response : JSON.stringify(response),
	}

	return mockXhr
}

/**
 * Mock successful upload request
 */
export function mockRequestSuccess(data: any = {}) {
	return vi.fn().mockResolvedValue({
		code: 1000,
		message: "Request successful",
		data,
		headers: {},
	})
}

/**
 * Mock failed upload request
 */
export function mockRequestFailure(error: any = new Error("Request failed")) {
	return vi.fn().mockRejectedValue(error)
}

/**
 * Mock FormData for testing
 */
export class MockFormData {
	private data = new Map<string, any>()

	append(key: string, value: any): void {
		this.data.set(key, value)
	}

	get(key: string): any {
		return this.data.get(key)
	}

	getAll(key: string): any[] {
		const value = this.data.get(key)
		return value !== undefined ? [value] : []
	}

	has(key: string): boolean {
		return this.data.has(key)
	}

	delete(key: string): void {
		this.data.delete(key)
	}

	entries(): IterableIterator<[string, any]> {
		return this.data.entries()
	}

	keys(): IterableIterator<string> {
		return this.data.keys()
	}

	values(): IterableIterator<any> {
		return this.data.values()
	}

	forEach(callback: (value: any, key: string, parent: MockFormData) => void): void {
		this.data.forEach((value, key) => callback(value, key, this))
	}
}

/**
 * Setup global mocks for FormData and XMLHttpRequest
 */
export function setupGlobalMocks() {
	// @ts-ignore
	global.FormData = MockFormData
	// @ts-ignore
	global.XMLHttpRequest = vi.fn(() => createMockXHR())
}

/**
 * Reset all global mocks
 */
export function resetGlobalMocks() {
	vi.clearAllMocks()
	vi.clearAllTimers()
}

