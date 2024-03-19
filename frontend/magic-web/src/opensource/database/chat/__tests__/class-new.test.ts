import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import ChatDatabase from "../class-new"

// Mock Dexie
const createMockDb = (name: string) => ({
	name,
	isOpen: vi.fn().mockReturnValue(true),
	close: vi.fn(),
	open: vi.fn().mockResolvedValue(undefined),
	version: vi.fn().mockReturnThis(),
	stores: vi.fn().mockReturnThis(),
	on: vi.fn().mockReturnThis(),
	tables: [],
	verno: 1,
})

vi.mock("dexie", () => {
	return {
		default: vi.fn().mockImplementation((name: string) => createMockDb(name)),
	}
})

// Mock localStorage
const localStorageMock = {
	getItem: vi.fn(),
	setItem: vi.fn(),
	removeItem: vi.fn(),
	clear: vi.fn(),
}
Object.defineProperty(window, "localStorage", {
	value: localStorageMock,
	writable: true,
})

describe("ChatDatabase Connection Management", () => {
	let chatDb: ChatDatabase

	beforeEach(() => {
		vi.clearAllMocks()
		localStorageMock.getItem.mockReturnValue(
			JSON.stringify({
				version: 1,
				schema: {
					conversation: "&id, user_organization_code",
					conversation_dots: "&conversation_id",
				},
			}),
		)
		chatDb = new ChatDatabase()
	})

	afterEach(() => {
		chatDb.close()
	})

	it("should close existing database connection before switching", async () => {
		const magicId1 = "test-magic-id-1"
		const magicId2 = "test-magic-id-2"

		// First switch
		await chatDb.switchDb(magicId1)
		const firstDb = chatDb.db

		// Mock the close method to track calls
		const closeSpy = vi.spyOn(firstDb, "close")

		// Second switch should close the first database
		await chatDb.switchDb(magicId2)

		expect(closeSpy).toHaveBeenCalled()
	})

	it("should handle database blocked events gracefully", async () => {
		const magicId = "test-magic-id"
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

		// Test the console error when database open fails
		const mockDb = createMockDb("test-db")
		mockDb.isOpen.mockReturnValue(false)
		mockDb.open.mockRejectedValue(new Error("Connection failed"))

		// Mock Dexie to return our failing mock
		const DexieMock = vi.mocked((await import("dexie")).default)
		DexieMock.mockReturnValue(mockDb as any)

		try {
			await chatDb.switchDb(magicId)
		} catch (error) {
			// Expected to fail and trigger retry
		}

		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining("Failed to open database, retrying"),
			expect.anything(),
		)

		consoleSpy.mockRestore()
	})

	it("should retry database connection on failure", async () => {
		const magicId = "test-magic-id"
		const retryDbConnectionSpy = vi
			.spyOn(chatDb as any, "retryDbConnection")
			.mockImplementation(() => Promise.resolve())

		// Create a mock that always fails to trigger retry
		const mockDb = createMockDb("test-db")
		mockDb.isOpen.mockReturnValue(false)
		mockDb.open.mockRejectedValue(new Error("Connection failed"))

		// Mock Dexie to return our failing mock
		const DexieMock = vi.mocked((await import("dexie")).default)
		DexieMock.mockReturnValue(mockDb as any)

		try {
			await chatDb.switchDb(magicId)
		} catch (error) {
			// Expected to fail and trigger retry
		}

		// Check if retry was attempted
		expect(retryDbConnectionSpy).toHaveBeenCalled()
		retryDbConnectionSpy.mockRestore()
	})

	it("should properly close database connection", () => {
		// Set up a mock db that is open
		const mockDb = createMockDb("test-db")
		mockDb.isOpen.mockReturnValue(true)
		chatDb.db = mockDb as any

		const closeSpy = vi.spyOn(mockDb, "close")

		chatDb.close()

		expect(closeSpy).toHaveBeenCalled()
	})

	it("should check if database is open", () => {
		const isOpenSpy = vi.spyOn(chatDb.db, "isOpen").mockReturnValue(true)

		const result = chatDb.isOpen()

		expect(isOpenSpy).toHaveBeenCalled()
		expect(result).toBe(true)
	})
})
