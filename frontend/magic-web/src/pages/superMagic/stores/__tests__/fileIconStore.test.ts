import { beforeEach, describe, expect, it, vi } from "vitest"
import { fileIconStore } from "../fileIconStore"
import type { FileAccessContext } from "../../fileAccess/fileAccessContext"

const { download } = vi.hoisted(() => ({ download: vi.fn() }))
vi.mock("@/pages/superMagic/utils/api", () => ({ getTemporaryDownloadUrl: download }))

const share = (token: string): FileAccessContext => ({ kind: "share", token, projectId: "p" })

describe("file icon access isolation", () => {
	beforeEach(() => {
		fileIconStore.clearAll()
		download.mockReset()
	})

	it("caches separately for share tokens and project/session identities", async () => {
		const identities: FileAccessContext[] = [
			share("a"),
			share("b"),
			{ kind: "session", projectId: "p" },
			{ kind: "session", projectId: "other" },
		]
		download.mockImplementation(async ({ access }) => [{ url: JSON.stringify(access) }])
		for (const access of identities) {
			await expect(fileIconStore.getFileIconUrl("icon", access)).resolves.toBe(
				JSON.stringify(access),
			)
		}
		for (const access of identities) await fileIconStore.getFileIconUrl("icon", access)
		expect(download).toHaveBeenCalledTimes(4)
		fileIconStore.invalidate("icon")
		for (const access of identities) await fileIconStore.getFileIconUrl("icon", access)
		expect(download).toHaveBeenCalledTimes(8)
	})

	it("only shares pending requests within the same identity", async () => {
		const resolve: Array<(value: { url: string }[]) => void> = []
		download.mockImplementation(() => new Promise((done) => resolve.push(done)))
		const first = fileIconStore.getFileIconUrl("icon", share("a"))
		const duplicate = fileIconStore.getFileIconUrl("icon", share("a"))
		const second = fileIconStore.getFileIconUrl("icon", share("b"))
		const session = fileIconStore.getFileIconUrl("icon", { kind: "session", projectId: "p" })
		expect(download).toHaveBeenCalledTimes(3)
		resolve.forEach((done, index) => done([{ url: `url-${index}` }]))
		await expect(Promise.all([first, duplicate, second, session])).resolves.toEqual([
			"url-0",
			"url-0",
			"url-1",
			"url-2",
		])
	})

	it.each(["invalidate", "clearAll"] as const)(
		"does not cache an old request after %s",
		async (operation) => {
			const resolve: Array<(value: { url: string }[]) => void> = []
			download.mockImplementation(() => new Promise((done) => resolve.push(done)))
			const old = fileIconStore.getFileIconUrl("icon", share("a"))
			if (operation === "invalidate") fileIconStore.invalidate("icon")
			else fileIconStore.clearAll()
			const current = fileIconStore.getFileIconUrl("icon", share("a"))
			resolve[0]([{ url: "old" }])
			await old
			expect(fileIconStore.stats).toEqual({ cached: 0, pending: 1 })
			resolve[1]([{ url: "current" }])
			await current
			await expect(fileIconStore.getFileIconUrl("icon", share("a"))).resolves.toBe("current")
			expect(download).toHaveBeenCalledTimes(2)
		},
	)
})
