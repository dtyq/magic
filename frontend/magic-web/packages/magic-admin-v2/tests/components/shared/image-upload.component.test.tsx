import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AvatarImageUploadField } from "../../../src/components/image-upload/avatar-image-upload-field"
import { ImageUploadField } from "../../../src/components/image-upload/image-upload-field"

const { uploadPublicImage } = vi.hoisted(() => ({
	uploadPublicImage: vi.fn(),
}))

vi.mock("@magic-admin-v2/hooks/use-upload-public-image", () => ({
	useUploadPublicImage: () => uploadPublicImage,
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

const createObjectURL = vi.mocked(URL.createObjectURL)
const revokeObjectURL = vi.mocked(URL.revokeObjectURL)

afterEach(() => {
	uploadPublicImage.mockReset()
	createObjectURL.mockClear()
	revokeObjectURL.mockClear()
})

function getFileInput(container: HTMLElement) {
	const input = container.querySelector<HTMLInputElement>('input[type="file"]')
	if (!input) throw new Error("file input missing")
	return input
}

describe("shared image upload fields", () => {
	it("uploads a card image, shows the local preview, and reports upload state", async () => {
		let resolveUpload: ((value: { path: string; url: string }) => void) | undefined
		uploadPublicImage.mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveUpload = resolve
				}),
		)
		const onUploaded = vi.fn()
		const onUploadingChange = vi.fn()
		const { container } = render(
			<ImageUploadField
				label="Logo"
				onUploaded={onUploaded}
				onUploadingChange={onUploadingChange}
				required
				value=""
			/>,
		)
		const file = new File(["image"], "logo.png", { type: "image/png" })

		fireEvent.change(getFileInput(container), { target: { files: [file] } })

		expect(createObjectURL).toHaveBeenCalledWith(file)
		expect(container.querySelector("img")).toHaveAttribute("src", "blob:mock-url")
		expect(screen.getByRole("button", { name: "common.upload" })).toBeDisabled()
		expect(onUploadingChange).toHaveBeenLastCalledWith(true)

		resolveUpload?.({ path: "public/logo.png", url: "https://example.com/logo.png" })

		await waitFor(() =>
			expect(onUploaded).toHaveBeenCalledWith(
				{ path: "public/logo.png", url: "https://example.com/logo.png" },
				file,
			),
		)
		expect(onUploadingChange.mock.calls.map(([uploading]) => uploading)).toEqual([
			true,
			false,
		])
		expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url")
	})

	it("uses the shared upload error mapping and removes the failed preview", async () => {
		uploadPublicImage.mockRejectedValue(new Error("IMAGE_TOO_LARGE"))
		const { container } = render(
			<ImageUploadField
				onUploaded={vi.fn()}
				value=""
				variant="inline"
			/>,
		)

		fireEvent.change(getFileInput(container), {
			target: { files: [new File(["image"], "large.png", { type: "image/png" })] },
		})

		expect(await screen.findByText("platformInfo.upload.tooLarge")).toBeInTheDocument()
		expect(container.querySelector("img")).not.toBeInTheDocument()
		expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url")
	})

	it("supports avatar replacement and clearing without owning business state", () => {
		const onClear = vi.fn()

		render(
			<AvatarImageUploadField
				clearable
				name="Approval"
				onClear={onClear}
				onUploaded={vi.fn()}
				value="https://example.com/icon.png"
			/>,
		)

		expect(screen.getByRole("button", { name: "common.replace" })).toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "common.clear" }))
		expect(onClear).toHaveBeenCalledTimes(1)
	})

	it("aborts an in-flight upload and releases its preview on unmount", () => {
		let uploadSignal: AbortSignal | undefined
		uploadPublicImage.mockImplementation(
			(_file: File, options?: { signal?: AbortSignal }) =>
				new Promise((_resolve, reject) => {
					uploadSignal = options?.signal
					options?.signal?.addEventListener("abort", () => {
						reject(new DOMException("Aborted", "AbortError"))
					})
				}),
		)
		const onUploadingChange = vi.fn()
		const { container, unmount } = render(
			<ImageUploadField
				onUploaded={vi.fn()}
				onUploadingChange={onUploadingChange}
				value=""
			/>,
		)

		fireEvent.change(getFileInput(container), {
			target: { files: [new File(["image"], "logo.png", { type: "image/png" })] },
		})
		unmount()

		expect(uploadSignal?.aborted).toBe(true)
		expect(onUploadingChange).toHaveBeenLastCalledWith(false)
		expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url")
	})

	it("keeps one uploading interval when a newer file replaces an in-flight upload", async () => {
		const uploadSignals: AbortSignal[] = []
		const uploadResolvers: Array<(value: { path: string; url: string }) => void> = []
		uploadPublicImage.mockImplementation(
			(_file: File, options?: { signal?: AbortSignal }) =>
				new Promise((resolve, reject) => {
					if (options?.signal) uploadSignals.push(options.signal)
					uploadResolvers.push(resolve)
					options?.signal?.addEventListener("abort", () => {
						reject(new DOMException("Aborted", "AbortError"))
					})
				}),
		)
		const onUploaded = vi.fn()
		const onUploadingChange = vi.fn()
		const { container } = render(
			<ImageUploadField
				onUploaded={onUploaded}
				onUploadingChange={onUploadingChange}
				value=""
			/>,
		)
		const input = getFileInput(container)
		const firstFile = new File(["first"], "first.png", { type: "image/png" })
		const secondFile = new File(["second"], "second.png", { type: "image/png" })

		fireEvent.change(input, { target: { files: [firstFile] } })
		fireEvent.change(input, { target: { files: [secondFile] } })

		expect(uploadSignals[0]?.aborted).toBe(true)
		expect(onUploadingChange).toHaveBeenCalledTimes(1)
		expect(onUploadingChange).toHaveBeenLastCalledWith(true)

		uploadResolvers[1]?.({ path: "public/second.png", url: "https://example.com/second.png" })

		await waitFor(() =>
			expect(onUploaded).toHaveBeenCalledWith(
				{ path: "public/second.png", url: "https://example.com/second.png" },
				secondFile,
			),
		)
		expect(onUploaded).toHaveBeenCalledTimes(1)
		expect(onUploadingChange.mock.calls.map(([uploading]) => uploading)).toEqual([
			true,
			false,
		])
	})

	it("keeps the conditional avatar layout compact until an image exists", () => {
		const { rerender } = render(
			<AvatarImageUploadField
				fallbackIcon={<span data-testid="avatar-fallback" />}
				layout="conditional"
				name="Staff"
				onUploaded={vi.fn()}
				showPreviewWhenEmpty={false}
				value=""
			/>,
		)

		expect(screen.queryByTestId("avatar-fallback")).not.toBeInTheDocument()
		expect(screen.getByRole("button", { name: "common.upload" })).toBeInTheDocument()

		rerender(
			<AvatarImageUploadField
				fallbackIcon={<span data-testid="avatar-fallback" />}
				layout="conditional"
				name="Staff"
				onUploaded={vi.fn()}
				showPreviewWhenEmpty={false}
				value="https://example.com/staff.png"
			/>,
		)

		expect(screen.getByRole("img")).toHaveAttribute("src", "https://example.com/staff.png")
		expect(screen.getByRole("button", { name: "common.replace" })).toBeInTheDocument()
	})

	it("supports product-specific upload error handling without rendering a duplicate error", async () => {
		const uploadError = new Error("IMAGE_TOO_LARGE")
		uploadPublicImage.mockRejectedValue(uploadError)
		const onUploadError = vi.fn()
		const { container } = render(
			<AvatarImageUploadField
				getErrorMessage={() => "custom upload error"}
				name="Approval"
				onUploaded={vi.fn()}
				onUploadError={onUploadError}
				showInlineError={false}
				value=""
			/>,
		)

		fireEvent.change(getFileInput(container), {
			target: { files: [new File(["image"], "large.png", { type: "image/png" })] },
		})

		await waitFor(() => expect(onUploadError).toHaveBeenCalledWith(uploadError))
		expect(screen.queryByText("custom upload error")).not.toBeInTheDocument()
	})
})
