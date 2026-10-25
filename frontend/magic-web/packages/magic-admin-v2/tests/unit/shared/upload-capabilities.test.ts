import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import type { Upload, UploadCallBack, UploadConfig } from "@dtyq/upload-sdk"
import { BaseRequestUrl } from "../../../src/api/constants/base.ts"
import {
	appendUploadDirectory,
	createUploadCapabilities,
} from "../../../src/capabilities/upload.ts"

type PostCall = {
	data?: unknown
	url: string
}

function createUploadSdk(paths: string[]) {
	const configs: UploadConfig[] = []
	const uploadSdk: Pick<Upload, "upload"> = {
		upload(config) {
			configs.push(config)
			const path = paths.shift()
			const task: UploadCallBack = {
				fail() {},
				success(callback) {
					queueMicrotask(() => callback({ data: { path } } as never))
				},
			}
			return task
		},
	}
	return { configs, uploadSdk }
}

describe("shared upload capabilities", () => {
	it("preserves public/private credential parameters and template directories", async () => {
		const calls: PostCall[] = []
		const { configs, uploadSdk } = createUploadSdk([
			"base/slide-templates/PPT-demo/cover.png",
			"base/slide-templates/PPT-demo/template.zip",
		])
		const client = {
			async post<T>(url: string, data?: unknown) {
				calls.push({ data, url })
				if (url === BaseRequestUrl.temporaryCredential) {
					return {
						platform: "aliyun",
						temporary_credential: { dir: "base/" },
					} as T
				}
				return {
					path: "base/slide-templates/PPT-demo/cover.png",
					url: "https://example.com/cover.png",
				} as T
			},
		}
		const capabilities = createUploadCapabilities({
			client,
			getPublicImageUploadContext: () => ({
				authorization: "token",
				language: "zh_CN",
				organizationCode: "organization",
				uploadUrl: "/api/v1/file/temporary-credential?organization_code=organization",
			}),
			uploadSdk,
		})

		const publicResult = await capabilities.uploadFile(
			new File(["image"], "cover.png", { type: "image/png" }),
			{
				directory: "slide-templates/PPT-demo/",
				storage: "public",
			},
		)
		const privateResult = await capabilities.uploadFile(
			new File(["zip"], "template.zip", { type: "application/zip" }),
			{
				directory: "slide-templates/PPT-demo/",
				storage: "private",
			},
		)

		assert.deepEqual(calls, [
			{
				data: { content_type: "image/png", storage: "public", sts: false },
				url: BaseRequestUrl.temporaryCredential,
			},
			{
				data: { file_key: "base/slide-templates/PPT-demo/cover.png" },
				url: BaseRequestUrl.fileDownload,
			},
			{
				data: { content_type: "application/zip", storage: "private", sts: true },
				url: BaseRequestUrl.temporaryCredential,
			},
		])
		assert.equal(
			configs[0]?.customCredentials?.temporary_credential.dir,
			"base/slide-templates/PPT-demo/",
		)
		assert.equal(
			configs[1]?.customCredentials?.temporary_credential.dir,
			"base/slide-templates/PPT-demo/",
		)
		assert.deepEqual(publicResult, {
			path: "base/slide-templates/PPT-demo/cover.png",
			url: "https://example.com/cover.png",
		})
		assert.deepEqual(privateResult, {
			path: "base/slide-templates/PPT-demo/template.zip",
		})
	})

	it("keeps the legacy public-image request context inside the shared core", async () => {
		const calls: PostCall[] = []
		const { configs, uploadSdk } = createUploadSdk(["public/avatar.png"])
		const client = {
			async post<T>(url: string, data?: unknown) {
				calls.push({ data, url })
				return { path: "public/avatar.png", url: "https://example.com/avatar.png" } as T
			},
		}
		const capabilities = createUploadCapabilities({
			client,
			getPublicImageUploadContext: () => ({
				authorization: "token",
				language: "zh_CN",
				organizationCode: "organization",
				uploadUrl: "/upload?organization_code=organization",
			}),
			uploadSdk,
		})

		const result = await capabilities.uploadPublicImage(
			new File(["image"], "avatar.png", { type: "image/png" }),
		)

		assert.equal(configs[0]?.url, "/upload?organization_code=organization")
		assert.deepEqual(configs[0]?.headers, {
			"Content-Type": "application/json",
			"organization-code": "organization",
			authorization: "token",
			language: "zh_CN",
		})
		assert.deepEqual(JSON.parse(String(configs[0]?.body)), {
			content_type: "image/png",
			storage: "public",
			sts: true,
		})
		assert.deepEqual(calls, [
			{
				data: { file_key: "public/avatar.png" },
				url: BaseRequestUrl.fileDownload,
			},
		])
		assert.deepEqual(result, {
			path: "public/avatar.png",
			url: "https://example.com/avatar.png",
		})
	})

	it("normalizes the credential base directory", () => {
		assert.equal(appendUploadDirectory("base", "slide-templates/PPT-demo/"), "base/slide-templates/PPT-demo/")
		assert.equal(appendUploadDirectory("base/", "/slide-templates/PPT-demo/"), "base/slide-templates/PPT-demo/")
		assert.equal(appendUploadDirectory("base/"), "base/")
	})

	it("keeps embedded and standalone files as thin adapters", () => {
		const core = readFileSync("src/capabilities/upload.ts", "utf8")
		const standalone = readFileSync("src/standalone/upload/createCapabilities.ts", "utf8")
		const embedded = readFileSync("../../src/pages/magicAdminV2/upload.ts", "utf8")

		assert.equal(core.includes('from "@dtyq/upload-sdk"'), true)
		assert.equal(standalone.includes('from "@dtyq/upload-sdk"'), false)
		assert.equal(embedded.includes('from "@dtyq/upload-sdk"'), false)
		assert.equal(standalone.includes("createUploadCapabilities"), true)
		assert.equal(embedded.includes("createUploadCapabilities"), true)
	})
})
