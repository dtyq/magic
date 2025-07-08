import { PlatformType } from "../../src"
import PlatformModules from "../../src/modules"

describe("上传SDK模块集成测试", () => {
	describe("平台类型枚举", () => {
		it("应该定义了所有支持的平台类型", () => {
			expect(PlatformType.OSS).toBeDefined()
			expect(PlatformType.TOS).toBeDefined()
			expect(PlatformType.Kodo).toBeDefined()
			expect(PlatformType.OBS).toBeDefined()
		})
	})

	describe("动态加载模块", () => {
		it("应该能够加载所有平台模块", async () => {
			// 阿里云模块
			const OSSModule = PlatformModules[PlatformType.OSS]
			expect(OSSModule).toBeDefined()
			expect(typeof OSSModule.upload).toBe("function")
			expect(typeof OSSModule.defaultUpload).toBe("function")
			expect(typeof OSSModule.MultipartUpload).toBe("function")
			expect(typeof OSSModule.STSUpload).toBe("function")

			// 火山引擎模块
			const TOSModule = PlatformModules[PlatformType.TOS]
			expect(TOSModule).toBeDefined()
			expect(typeof TOSModule.upload).toBe("function")
			expect(typeof TOSModule.defaultUpload).toBe("function")
			expect(typeof TOSModule.MultipartUpload).toBe("function")
			expect(typeof TOSModule.STSUpload).toBe("function")

			// 七牛云模块
			const KodoModule = PlatformModules[PlatformType.Kodo]
			expect(KodoModule).toBeDefined()
			expect(typeof KodoModule.upload).toBe("function")

			// 华为云OBS模块
			const OBSModule = PlatformModules[PlatformType.OBS]
			expect(OBSModule).toBeDefined()
			expect(typeof OBSModule.upload).toBe("function")
			expect(typeof OBSModule.defaultUpload).toBe("function")
			expect(typeof OBSModule.MultipartUpload).toBe("function")
			expect(typeof OBSModule.STSUpload).toBe("function")
		})

		it("对于不支持的平台类型，PlatformModules不应该包含该类型", () => {
			// 使用一个不存在的平台类型
			const invalidPlatformType = "InvalidPlatform" as unknown as PlatformType

			// 检查PlatformModules中是否不存在该类型
			expect(PlatformModules[invalidPlatformType]).toBeUndefined()
		})
	})

	describe("代理模块访问", () => {
		it("应该通过代理访问各平台模块", async () => {
			// 检查所有平台代理是否存在
			expect(PlatformModules[PlatformType.OSS]).toBeDefined()
			expect(PlatformModules[PlatformType.TOS]).toBeDefined()
			expect(PlatformModules[PlatformType.Kodo]).toBeDefined()
			expect(PlatformModules[PlatformType.OBS]).toBeDefined()

			// 验证模块属性可访问
			const mockConsoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {})
			const property = Object.keys(PlatformModules[PlatformType.OSS])[0]

			if (property) {
				// 访问属性会触发懒加载
				const propertyValue = PlatformModules[PlatformType.OSS][property]
				expect(propertyValue).toBeDefined()
			}

			mockConsoleWarn.mockRestore()
		})
	})
})
