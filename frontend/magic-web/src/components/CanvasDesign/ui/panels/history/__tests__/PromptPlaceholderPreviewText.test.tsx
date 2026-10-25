import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { createTestResourceReferenceResolver } from "../../../../public/__tests__/testResourceReferenceResolver"
import { PromptPlaceholderPreviewText } from "../PromptPlaceholderPreviewText"
import styles from "../PromptPlaceholderPreviewText.module.css"

const tokenConfig = {
	imageLabel: "图片",
	videoLabel: "视频",
	audioLabel: "音频",
	leftWrapper: "[",
	rightWrapper: "]",
}

describe("PromptPlaceholderPreviewText", () => {
	it("marks only the deleted same-name resource and disables its preview", () => {
		const onPreviewMediaResource = vi.fn()
		const resolveResourceReference = createTestResourceReferenceResolver({
			currentCanvasWorkspacePath: "/画布A",
			attachmentsReady: true,
			attachmentPathsByFileId: {
				current: "/画布A/images/截屏.png",
			},
		})

		render(
			<PromptPlaceholderPreviewText
				text="[图片1][图片2]111"
				tokenConfig={tokenConfig}
				placeholderPaths={{
					image: ["/images/images/截屏.png", "./images/截屏.png"],
				}}
				onPreviewMediaResource={onPreviewMediaResource}
				resolveResourceReference={resolveResourceReference}
				deletedSuffix="（已删除）"
			/>,
		)

		expect(screen.getByTestId("deleted-resource-placeholder")).toHaveTextContent(
			"@截屏.png（已删除）",
		)
		const availableMention = screen.getByRole("button", { name: "@截屏.png" })
		fireEvent.click(availableMention)
		expect(onPreviewMediaResource).toHaveBeenCalledWith(
			expect.objectContaining({ path: "./images/截屏.png" }),
		)
	})

	it("does not mark pending attachments as deleted", () => {
		render(
			<PromptPlaceholderPreviewText
				text="[图片1]"
				tokenConfig={tokenConfig}
				placeholderPaths={{ image: ["./images/pending.png"] }}
				onPreviewMediaResource={vi.fn()}
				resolveResourceReference={createTestResourceReferenceResolver({
					attachmentsReady: false,
				})}
				deletedSuffix="（已删除）"
			/>,
		)

		expect(screen.queryByTestId("deleted-resource-placeholder")).not.toBeInTheDocument()
		expect(screen.getByRole("button", { name: "@pending.png" })).toBeInTheDocument()
	})

	it("uses the placeholder media kind for asset paths", () => {
		const onPreviewMediaResource = vi.fn()

		render(
			<PromptPlaceholderPreviewText
				text="[图片1] [视频1] [音频1] [图片2]"
				tokenConfig={tokenConfig}
				placeholderPaths={{
					image: ["asset://image-id"],
					video: ["asset://video-id"],
					audio: ["asset://audio-id"],
				}}
				onPreviewMediaResource={onPreviewMediaResource}
				deletedSuffix="（已删除）"
			/>,
		)

		const imageMention = screen.getByRole("button", { name: "@image-id" })
		expect(imageMention).not.toHaveClass(styles.opaquePlaceholder)
		expect(screen.getByRole("button", { name: "@video-id" })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "@audio-id" })).toBeInTheDocument()
		expect(screen.getByText("[图片2]")).toBeInTheDocument()

		fireEvent.click(imageMention)
		expect(onPreviewMediaResource).toHaveBeenCalledWith(
			expect.objectContaining({ path: "asset://image-id", kind: "image" }),
		)
	})
})
