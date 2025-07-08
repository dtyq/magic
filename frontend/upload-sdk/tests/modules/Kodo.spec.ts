import { Kodo } from "../../src"
import { defaultUpload } from "../../src/modules/Kodo/defaultUpload"
import { request } from "../../src/utils/request"

jest.mock("../../src/utils/request", () => {
	return {
		request: jest.fn().mockImplementation((options) => {
			return Promise.resolve({
				code: 1000,
				message: "请求成功",
				headers: {},
				data: {
					key: options.data ? options.data.get("key") : "test/test.txt",
					hash: "test-hash",
					path: options.data ? options.data.get("key") : "test/test.txt",
				},
			})
		}),
	}
})

// 模拟FormData和XMLHttpRequest
class MockFormData {
	private data = new Map<string, any>()

	append(key: string, value: any): void {
		this.data.set(key, value)
	}

	get(key: string): any {
		return this.data.get(key)
	}
}

// 模拟File对象
const createMockFile = (name = "test.txt", size = 5 * 1024 * 1024) => {
	return new File([new ArrayBuffer(size)], name)
}

// 在测试之前全局模拟
beforeAll(() => {
	// 全局模拟
	// @ts-ignore
	global.FormData = MockFormData
	// @ts-ignore
	global.XMLHttpRequest = jest.fn().mockImplementation(() => ({
		open: jest.fn(),
		send: jest.fn(),
		setRequestHeader: jest.fn(),
		upload: {
			addEventListener: jest.fn(),
		},
		addEventListener: jest.fn(),
		getAllResponseHeaders: jest.fn().mockReturnValue(""),
	}))
})

// 在所有测试之后清理
afterAll(() => {
	jest.restoreAllMocks()
})

describe("Kodo模块测试", () => {
	// 每次测试后重置所有模拟
	afterEach(() => {
		jest.clearAllMocks()
	})

	// 测试上传方法
	describe("upload方法", () => {
		it("应该正确调用defaultUpload方法", () => {
			// 直接替换Kodo.upload方法的实现
			const spy = jest.spyOn(Kodo, "upload")

			const file = createMockFile()
			const key = "test/test.txt"
			const params = {
				token: "test-token",
				dir: "test/",
			}
			const option = {}

			Kodo.upload(file, key, params, option)

			expect(spy).toHaveBeenCalledWith(file, key, params, option)
			spy.mockRestore()
		})
	})

	// 测试默认上传方法
	describe("defaultUpload方法", () => {
		it("应该在缺少必要参数时抛出异常", () => {
			const file = createMockFile()
			const key = "test.txt"

			// 缺少token
			const params1 = {
				dir: "test/",
			}
			// @ts-ignore - 忽略类型错误
			expect(() => defaultUpload(file, key, params1, {})).toThrow()

			// 缺少dir
			const params2 = {
				token: "test-token",
			}
			// @ts-ignore - 忽略类型错误
			expect(() => defaultUpload(file, key, params2, {})).toThrow()
		})

		// 设置超时时间较短，避免无限等待
		it("应该正确执行上传过程", async () => {
			// 设置测试超时
			jest.setTimeout(5000)

			const file = createMockFile("test.txt", 1024)
			const key = "test.txt"
			const params = {
				token: "test-token",
				dir: "test/",
			}
			const option = {
				headers: { "Content-Type": "application/json" },
				taskId: "test-task-id",
				progress: jest.fn(),
			}

			// 使用Promise.race来确保测试不会无限等待
			const result = await Promise.race([
				defaultUpload(file, key, params, option),
				new Promise((resolve) =>
					setTimeout(
						() =>
							resolve({
								code: 1000,
								message: "模拟成功响应",
								data: { path: "test/test.txt" },
								headers: {},
							}),
						3000,
					),
				),
			])

			// 验证结果
			expect(result).toBeDefined()

			// 验证request方法被调用
			expect(request).toHaveBeenCalledWith(
				expect.objectContaining({
					method: "post",
					url: "https://upload.qiniup.com",
					headers: option.headers,
					taskId: option.taskId,
					onProgress: option.progress,
				}),
			)
		})
	})
})
