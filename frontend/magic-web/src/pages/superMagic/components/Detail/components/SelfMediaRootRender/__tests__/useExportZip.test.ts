import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("file-saver", () => ({ saveAs: vi.fn() }))
vi.mock("html-to-image", () => ({
	toPng: vi.fn(async () => "data:image/png;base64,AAAA"),
}))

const { lastZipRef, MockJSZip } = vi.hoisted(() => {
	const lastZipRef: { current: MockInst | null } = { current: null }
	type MockInst = { folders: Record<string, FakeFolder> }
	class FakeFolder {
		files: Record<string, Blob | string> = {}
		file(n: string, c: Blob | string) {
			this.files[n] = c
		}
	}
	class MockJSZip implements MockInst {
		folders: Record<string, FakeFolder> = {}
		constructor() {
			lastZipRef.current = this
		}
		folder(name: string) {
			const f = new FakeFolder()
			this.folders[name] = f
			return f
		}
		async generateAsync() {
			return new Blob(["zip"], { type: "application/zip" })
		}
	}
	return { lastZipRef, MockJSZip }
})

vi.mock("jszip", () => ({ default: MockJSZip }))

import { saveAs } from "file-saver"
import { useExportZip } from "../hooks/useExportZip"

describe("useExportZip", () => {
	beforeEach(() => {
		lastZipRef.current = null
	})

	it("captures cards via iframe self-screenshot and emits a zip", async () => {
		const captureMock = vi.fn(async () => "data:image/png;base64,FFFF")
		const cardRefs = [
			{ capture: captureMock, getIframeElement: () => null },
			{ capture: captureMock, getIframeElement: () => null },
		]
		const { result } = renderHook(() => useExportZip())
		const posts = [
			{
				meta: { id: "p1", title: "First" },
				cards: [{ path: "01.html" }, { path: "02.html" }],
			},
		] as any

		await act(async () => {
			await result.current.exportZip({
				posts,
				zipName: "test",
				getCardRef: (_p, c) => cardRefs[c],
			})
		})
		await waitFor(() => expect(result.current.progress.status).toBe("done"))
		expect(captureMock).toHaveBeenCalledTimes(2)
		expect(captureMock).toHaveBeenCalledWith(expect.objectContaining({ pixelRatio: 2 }))
		expect(saveAs).toHaveBeenCalledTimes(1)
		expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), "test.zip")
		const folder = lastZipRef.current?.folders.First
		expect(folder?.files["01_01.png"]).toBeDefined()
		expect(folder?.files["02_02.png"]).toBeDefined()
	})

	it("names zip from post title when zipName omitted", async () => {
		const captureMock = vi.fn(async () => "data:image/png;base64,FFFF")
		const cardRefs = [{ capture: captureMock, getIframeElement: () => null }]
		const { result } = renderHook(() => useExportZip())
		const posts = [
			{
				meta: { id: "p1", title: "My Article" },
				cards: [{ path: "cards/slide-a.html" }],
			},
		] as any

		await act(async () => {
			await result.current.exportZip({
				posts,
				getCardRef: () => cardRefs[0],
			})
		})
		await waitFor(() => expect(result.current.progress.status).toBe("done"))
		expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), "My Article.zip")
		const folder = lastZipRef.current?.folders["My Article"]
		expect(folder?.files["01_slide-a.png"]).toBeDefined()
	})

	it("forwards the requested pixel ratio to the capture call", async () => {
		const captureMock = vi.fn(async () => "data:image/png;base64,FFFF")
		const cardRefs = [{ capture: captureMock, getIframeElement: () => null }]
		const { result } = renderHook(() => useExportZip())
		const posts = [
			{
				meta: { id: "p1", title: "First" },
				cards: [{ path: "01.html" }],
			},
		] as any

		await act(async () => {
			await result.current.exportZip({
				posts,
				zipName: "test",
				pixelRatio: 4,
				getCardRef: () => cardRefs[0],
			})
		})
		await waitFor(() => expect(result.current.progress.status).toBe("done"))
		expect(captureMock).toHaveBeenCalledWith(expect.objectContaining({ pixelRatio: 4 }))
	})

	it("falls back to the default pixel ratio when input is invalid", async () => {
		const captureMock = vi.fn(async () => "data:image/png;base64,FFFF")
		const cardRefs = [{ capture: captureMock, getIframeElement: () => null }]
		const { result } = renderHook(() => useExportZip())
		const posts = [
			{
				meta: { id: "p1", title: "First" },
				cards: [{ path: "01.html" }],
			},
		] as any

		await act(async () => {
			await result.current.exportZip({
				posts,
				zipName: "test",
				pixelRatio: 0,
				getCardRef: () => cardRefs[0],
			})
		})
		await waitFor(() => expect(result.current.progress.status).toBe("done"))
		expect(captureMock).toHaveBeenCalledWith(expect.objectContaining({ pixelRatio: 2 }))
	})
})
