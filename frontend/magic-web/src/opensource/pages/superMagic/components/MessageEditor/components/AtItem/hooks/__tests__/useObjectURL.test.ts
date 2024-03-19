import { renderHook } from "@testing-library/react"
import { describe, it, beforeEach, afterEach, vi, expect } from "vitest"
// @ts-ignore
import useObjectUrl from "../useObjectURL"

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockCreateObjectURL = vi.fn()
const mockRevokeObjectURL = vi.fn()

Object.defineProperty(window.URL, "createObjectURL", {
	writable: true,
	value: mockCreateObjectURL,
})

Object.defineProperty(window.URL, "revokeObjectURL", {
	writable: true,
	value: mockRevokeObjectURL,
})

describe("useObjectUrl", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockCreateObjectURL.mockReturnValue("blob:mock-url")
	})

	afterEach(() => {
		// Clear the WeakMap cache between tests
		vi.clearAllMocks()
	})

	describe("基本功能", () => {
		it("应该为有效的 File 对象返回 object URL", () => {
			const file = new File(["test"], "test.txt", { type: "text/plain" })
			const { result } = renderHook(() => useObjectUrl(file))

			expect(mockCreateObjectURL).toHaveBeenCalledWith(file)
			expect(result.current).toBe("blob:mock-url")
		})

		it("应该为 null 返回 null", () => {
			const { result } = renderHook(() => useObjectUrl(null))

			expect(mockCreateObjectURL).not.toHaveBeenCalled()
			expect(result.current).toBeNull()
		})

		it("应该为非 File 对象返回 null", () => {
			const { result } = renderHook(() => useObjectUrl({} as File))

			expect(mockCreateObjectURL).not.toHaveBeenCalled()
			expect(result.current).toBeNull()
		})
	})

	describe("缓存机制", () => {
		it("应该为同一个 File 对象复用 object URL", () => {
			const file = new File(["test"], "test.txt", { type: "text/plain" })

			// 第一个 hook 实例
			const { result: result1 } = renderHook(() => useObjectUrl(file))
			expect(mockCreateObjectURL).toHaveBeenCalledTimes(1)
			expect(result1.current).toBe("blob:mock-url")

			// 第二个 hook 实例使用同一个文件
			const { result: result2 } = renderHook(() => useObjectUrl(file))
			expect(mockCreateObjectURL).toHaveBeenCalledTimes(1) // 不应该再次创建
			expect(result2.current).toBe("blob:mock-url")
		})

		it("应该为不同的 File 对象创建不同的 object URL", () => {
			const file1 = new File(["test1"], "test1.txt", { type: "text/plain" })
			const file2 = new File(["test2"], "test2.txt", { type: "text/plain" })

			mockCreateObjectURL
				.mockReturnValueOnce("blob:mock-url-1")
				.mockReturnValueOnce("blob:mock-url-2")

			const { result: result1 } = renderHook(() => useObjectUrl(file1))
			const { result: result2 } = renderHook(() => useObjectUrl(file2))

			expect(mockCreateObjectURL).toHaveBeenCalledTimes(2)
			expect(result1.current).toBe("blob:mock-url-1")
			expect(result2.current).toBe("blob:mock-url-2")
		})
	})

	describe("引用计数", () => {
		it("应该正确管理引用计数", () => {
			const file = new File(["test"], "test.txt", { type: "text/plain" })

			// 第一个 hook 实例
			const { unmount: unmount1 } = renderHook(() => useObjectUrl(file))
			expect(mockCreateObjectURL).toHaveBeenCalledTimes(1)

			// 第二个 hook 实例
			const { unmount: unmount2 } = renderHook(() => useObjectUrl(file))
			expect(mockCreateObjectURL).toHaveBeenCalledTimes(1) // 复用，不创建新的

			// 卸载第一个实例
			unmount1()
			expect(mockRevokeObjectURL).not.toHaveBeenCalled() // 还有一个引用，不应该释放

			// 卸载第二个实例
			unmount2()
			expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:mock-url") // 现在应该释放
		})

		it("在所有引用都释放后应该清理缓存", () => {
			const file = new File(["test"], "test.txt", { type: "text/plain" })

			// 创建多个引用
			const { unmount: unmount1 } = renderHook(() => useObjectUrl(file))
			const { unmount: unmount2 } = renderHook(() => useObjectUrl(file))
			const { unmount: unmount3 } = renderHook(() => useObjectUrl(file))

			expect(mockCreateObjectURL).toHaveBeenCalledTimes(1)

			// 逐个卸载
			unmount1()
			unmount2()
			expect(mockRevokeObjectURL).not.toHaveBeenCalled()

			unmount3()
			expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:mock-url")

			// 重新使用同一个文件应该创建新的 URL
			const { result } = renderHook(() => useObjectUrl(file))
			expect(mockCreateObjectURL).toHaveBeenCalledTimes(2)
			expect(result.current).toBe("blob:mock-url")
		})
	})

	describe("文件变更", () => {
		it("应该在文件变更时更新 URL", () => {
			const file1 = new File(["test1"], "test1.txt", { type: "text/plain" })
			const file2 = new File(["test2"], "test2.txt", { type: "text/plain" })

			mockCreateObjectURL
				.mockReturnValueOnce("blob:mock-url-1")
				.mockReturnValueOnce("blob:mock-url-2")

			const { result, rerender } = renderHook(({ file }) => useObjectUrl(file), {
				initialProps: { file: file1 },
			})

			expect(result.current).toBe("blob:mock-url-1")
			expect(mockCreateObjectURL).toHaveBeenCalledWith(file1)

			// 更换文件
			rerender({ file: file2 })

			expect(result.current).toBe("blob:mock-url-2")
			expect(mockCreateObjectURL).toHaveBeenCalledWith(file2)
			expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:mock-url-1")
		})

		it("应该在文件变为 null 时清理 URL", () => {
			const file = new File(["test"], "test.txt", { type: "text/plain" })

			const { result, rerender } = renderHook(
				({ file }: { file: File | null }) => useObjectUrl(file),
				{
					initialProps: { file },
				},
			)

			expect(result.current).toBe("blob:mock-url")

			// 将文件设为 null
			rerender({ file: null as any })

			expect(result.current).toBeNull()
			expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:mock-url")
		})
	})

	describe("边界情况", () => {
		it("应该处理组件快速挂载和卸载", () => {
			const file = new File(["test"], "test.txt", { type: "text/plain" })

			// 快速挂载和卸载多个实例
			for (let i = 0; i < 5; i++) {
				const { unmount } = renderHook(() => useObjectUrl(file))
				unmount()
			}

			// 应该正确清理，最后一次 revoke 应该被调用
			expect(mockRevokeObjectURL).toHaveBeenCalledTimes(5)
		})

		it("应该处理相同内容但不同实例的文件", () => {
			// 创建两个内容相同但实例不同的文件
			const file1 = new File(["test"], "test.txt", { type: "text/plain" })
			const file2 = new File(["test"], "test.txt", { type: "text/plain" })

			mockCreateObjectURL
				.mockReturnValueOnce("blob:mock-url-1")
				.mockReturnValueOnce("blob:mock-url-2")

			const { result: result1 } = renderHook(() => useObjectUrl(file1))
			const { result: result2 } = renderHook(() => useObjectUrl(file2))

			// 应该创建两个不同的 URL，因为是不同的对象实例
			expect(mockCreateObjectURL).toHaveBeenCalledTimes(2)
			expect(result1.current).toBe("blob:mock-url-1")
			expect(result2.current).toBe("blob:mock-url-2")
		})

		it("应该在组件卸载时正确清理状态", () => {
			const file = new File(["test"], "test.txt", { type: "text/plain" })

			const { result, unmount } = renderHook(() => useObjectUrl(file))

			expect(result.current).toBe("blob:mock-url")

			unmount()

			expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:mock-url")
		})
	})

	describe("性能和内存", () => {
		it("应该避免内存泄漏", () => {
			const files = Array.from(
				{ length: 100 },
				(_, i) => new File([`test${i}`], `test${i}.txt`, { type: "text/plain" }),
			)

			// 创建大量 hook 实例
			const hooks = files.map((file) => renderHook(() => useObjectUrl(file)))

			expect(mockCreateObjectURL).toHaveBeenCalledTimes(100)

			// 卸载所有 hook
			hooks.forEach(({ unmount }) => unmount())

			expect(mockRevokeObjectURL).toHaveBeenCalledTimes(100)
		})

		it("WeakMap 应该允许 File 对象被垃圾回收", () => {
			// 这个测试主要是为了文档化预期行为
			// 实际的垃圾回收测试在单元测试环境中很难实现
			let file: File | null = new File(["test"], "test.txt", { type: "text/plain" })

			const { unmount } = renderHook(() => useObjectUrl(file))

			expect(mockCreateObjectURL).toHaveBeenCalledWith(file)

			unmount()
			file = null // 释放对文件的引用

			// WeakMap 应该允许文件对象被垃圾回收
			// 这里我们只能验证 revoke 被正确调用
			expect(mockRevokeObjectURL).toHaveBeenCalledTimes(1)
		})
	})

	describe("错误处理", () => {
		it("应该处理 URL.createObjectURL 抛出的错误", () => {
			const file = new File(["test"], "test.txt", { type: "text/plain" })
			const mockError = new Error("创建 Object URL 失败")
			mockCreateObjectURL.mockImplementationOnce(() => {
				throw mockError
			})

			// 应该不会导致组件崩溃，返回 null
			const { result } = renderHook(() => useObjectUrl(file))
			expect(result.current).toBeNull()
		})

		it("应该处理 URL.revokeObjectURL 抛出的错误", () => {
			const file = new File(["test"], "test.txt", { type: "text/plain" })
			const mockError = new Error("释放 Object URL 失败")
			mockRevokeObjectURL.mockImplementationOnce(() => {
				throw mockError
			})

			const { unmount } = renderHook(() => useObjectUrl(file))

			// 应该不会导致组件崩溃
			expect(() => unmount()).not.toThrow()
		})

		it("应该处理无效的 File 类型", () => {
			const invalidFile = { name: "fake.txt" } as File
			const { result } = renderHook(() => useObjectUrl(invalidFile))

			expect(mockCreateObjectURL).not.toHaveBeenCalled()
			expect(result.current).toBeNull()
		})

		it("应该处理 undefined 输入", () => {
			const { result } = renderHook(() => useObjectUrl(undefined as any))

			expect(mockCreateObjectURL).not.toHaveBeenCalled()
			expect(result.current).toBeNull()
		})
	})

	describe("并发场景", () => {
		it("应该处理并发挂载相同文件的情况", () => {
			const file = new File(["test"], "test.txt", { type: "text/plain" })

			// 同时挂载多个使用相同文件的 hook
			const hooks = Array.from({ length: 10 }, () => renderHook(() => useObjectUrl(file)))

			// 应该只创建一次 Object URL
			expect(mockCreateObjectURL).toHaveBeenCalledTimes(1)

			// 所有 hook 都应该返回相同的 URL
			hooks.forEach(({ result }) => {
				expect(result.current).toBe("blob:mock-url")
			})

			// 卸载前 9 个 hook
			hooks.slice(0, 9).forEach(({ unmount }) => unmount())
			expect(mockRevokeObjectURL).not.toHaveBeenCalled()

			// 卸载最后一个 hook
			hooks[9].unmount()
			expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:mock-url")
		})

		it("应该处理快速文件切换场景", () => {
			const files = [
				new File(["test1"], "test1.txt", { type: "text/plain" }),
				new File(["test2"], "test2.txt", { type: "text/plain" }),
				new File(["test3"], "test3.txt", { type: "text/plain" }),
			]

			mockCreateObjectURL
				.mockReturnValueOnce("blob:url-1")
				.mockReturnValueOnce("blob:url-2")
				.mockReturnValueOnce("blob:url-3")

			const { result, rerender } = renderHook(
				({ file }: { file: File }) => useObjectUrl(file),
				{
					initialProps: { file: files[0] },
				},
			)

			expect(result.current).toBe("blob:url-1")

			// 快速切换文件
			rerender({ file: files[1] })
			expect(result.current).toBe("blob:url-2")
			expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:url-1")

			rerender({ file: files[2] })
			expect(result.current).toBe("blob:url-3")
			expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:url-2")
		})
	})

	describe("内存优化", () => {
		it("应该正确处理大量文件", () => {
			const fileCount = 1000
			const files = Array.from(
				{ length: fileCount },
				(_, i) => new File([`content${i}`], `file${i}.txt`, { type: "text/plain" }),
			)

			// 为每个文件创建唯一的 URL
			files.forEach((_, i) => {
				mockCreateObjectURL.mockReturnValueOnce(`blob:url-${i}`)
			})

			// 创建所有 hook
			const hooks = files.map((file) => renderHook(() => useObjectUrl(file)))

			expect(mockCreateObjectURL).toHaveBeenCalledTimes(fileCount)

			// 验证每个 hook 都有正确的 URL
			hooks.forEach(({ result }, i) => {
				expect(result.current).toBe(`blob:url-${i}`)
			})

			// 清理所有 hook
			hooks.forEach(({ unmount }) => unmount())

			expect(mockRevokeObjectURL).toHaveBeenCalledTimes(fileCount)
		})
	})
})
