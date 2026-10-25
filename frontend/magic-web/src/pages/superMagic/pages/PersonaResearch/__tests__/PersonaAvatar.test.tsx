import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import PersonaAvatar from "../components/PersonaAvatar"

const mocks = vi.hoisted(() => ({
	image: undefined as { file_id: string; updated_at: string } | undefined,
	url: "https://images.example/avatar.webp",
	refresh: vi.fn(),
	scope: "session:project-a",
}))

function photo(container: HTMLElement) {
	const image = container.querySelector("img")
	if (!image) throw new Error("Expected an avatar photograph")
	return image
}

vi.mock("../hooks/usePersonaPortrait", () => ({
	usePersonaPortrait: () => ({ image: mocks.image, accessKey: mocks.scope }),
	subscribePortraitRecovery: () => () => undefined,
}))
vi.mock("@/pages/superMagic/hooks/useFileUrl", () => ({
	useFileUrl: () => ({ fileUrl: mocks.url, refreshFileUrl: mocks.refresh }),
}))

describe("PersonaAvatar generated images", () => {
	beforeEach(() => {
		mocks.image = { file_id: "avatar-1", updated_at: "v1" }
		mocks.scope = "session:project-a"
		mocks.refresh.mockReset().mockResolvedValue({ url: mocks.url })
	})

	it("keeps the deterministic SVG while the photograph loads", () => {
		const { container } = render(<PersonaAvatar id="p_one_a123" name="One" />)
		expect(container.querySelector("svg")).not.toBeNull()
		const image = photo(container)
		expect(image.style.visibility).toBe("hidden")
		fireEvent.load(image)
		expect(image.style.visibility).toBe("visible")
		expect(image.alt).toBe("")
	})

	it("refreshes a failed URL once, then leaves the original fallback", async () => {
		const { container } = render(<PersonaAvatar id="p_one_a123" name="One" />)
		await act(async () => fireEvent.error(photo(container)))
		expect(mocks.refresh).toHaveBeenCalledExactlyOnceWith(true)
		await act(async () => fireEvent.error(photo(container)))
		expect(container.querySelector("img")).toBeNull()
		expect(container.querySelector("svg")).not.toBeNull()
		expect(mocks.refresh).toHaveBeenCalledTimes(1)
	})

	it("resets a failed photograph when the access identity changes", async () => {
		mocks.refresh.mockResolvedValue(null)
		const { container, rerender } = render(<PersonaAvatar id="p_one_a123" name="One" />)
		await act(async () => fireEvent.error(photo(container)))
		expect(container.querySelector("img")).toBeNull()
		mocks.scope = "share:different-token"
		rerender(<PersonaAvatar id="p_one_a123" name="One" className="size-8" />)
		expect(container.querySelector("img")).not.toBeNull()
	})

	it("shows older personas without a bound file using the original SVG", () => {
		mocks.image = undefined
		const { container } = render(<PersonaAvatar id="p_one_a123" name="One" />)
		expect(container.querySelector("img")).toBeNull()
		expect(container.querySelector("svg")).not.toBeNull()
		expect(screen.queryByRole("img")).toBeNull()
	})
})
