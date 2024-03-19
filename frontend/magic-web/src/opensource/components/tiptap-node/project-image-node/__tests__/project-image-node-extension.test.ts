import { describe, expect, it, vi } from "vitest"
import { ProjectImageNode } from "../project-image-node-extension"

describe("ProjectImageNode", () => {
	const urlResolver = (path: string) => path

	describe("serialize", () => {
		it("should serialize project image with width and height as img tag", () => {
			const node = ProjectImageNode.configure({ urlResolver })
			const storage = node.storage

			const mockState = {
				write: vi.fn(),
				closeBlock: vi.fn(),
			}

			const mockNode = {
				attrs: {
					src: "./images/example.png",
					width: 800,
					height: 600,
					alt: "Example image",
				},
			}

			storage.markdown.serialize(mockState, mockNode)

			expect(mockState.write).toHaveBeenCalledWith(
				'<img src="./images/example.png" alt="Example image" width="800" height="600" />',
			)
			expect(mockState.closeBlock).toHaveBeenCalledWith(mockNode)
		})

		it("should skip nodes without src", () => {
			const node = ProjectImageNode.configure({ urlResolver })
			const storage = node.storage

			const mockState = {
				write: vi.fn(),
				closeBlock: vi.fn(),
			}

			const mockNode = {
				attrs: {
					src: null,
					width: null,
					height: null,
				},
			}

			storage.markdown.serialize(mockState, mockNode)

			expect(mockState.write).not.toHaveBeenCalled()
			expect(mockState.closeBlock).toHaveBeenCalledWith(mockNode)
		})

		it("should serialize project image with width only", () => {
			const node = ProjectImageNode.configure({ urlResolver })
			const storage = node.storage

			const mockState = {
				write: vi.fn(),
				closeBlock: vi.fn(),
			}

			const mockNode = {
				attrs: {
					src: "test.jpg",
					width: 500,
					height: null,
				},
			}

			storage.markdown.serialize(mockState, mockNode)

			expect(mockState.write).toHaveBeenCalledWith('<img src="./test.jpg" width="500" />')
			expect(mockState.closeBlock).toHaveBeenCalledWith(mockNode)
		})

		it("should serialize as markdown format when no dimensions", () => {
			const node = ProjectImageNode.configure({ urlResolver })
			const storage = node.storage

			const mockState = {
				write: vi.fn(),
				closeBlock: vi.fn(),
			}

			const mockNode = {
				attrs: {
					src: "./images/photo.jpg",
					width: null,
					height: null,
					alt: "Photo",
				},
			}

			storage.markdown.serialize(mockState, mockNode)

			expect(mockState.write).toHaveBeenCalledWith("![Photo](./images/photo.jpg)")
		})

		it("should add ./ prefix to relative path when missing", () => {
			const node = ProjectImageNode.configure({ urlResolver })
			const storage = node.storage

			const mockState = {
				write: vi.fn(),
				closeBlock: vi.fn(),
			}

			const mockNode = {
				attrs: {
					src: "images/photo.jpg",
					width: null,
					height: null,
				},
			}

			storage.markdown.serialize(mockState, mockNode)

			expect(mockState.write).toHaveBeenCalledWith("![](./images/photo.jpg)")
		})

		it("should handle path that already starts with ./", () => {
			const node = ProjectImageNode.configure({ urlResolver })
			const storage = node.storage

			const mockState = {
				write: vi.fn(),
				closeBlock: vi.fn(),
			}

			const mockNode = {
				attrs: {
					src: "./already/prefixed.jpg",
					width: null,
					height: null,
					align: "left",
				},
			}

			storage.markdown.serialize(mockState, mockNode)

			expect(mockState.write).toHaveBeenCalledWith(
				'<div style="text-align: left"><img src="./already/prefixed.jpg" /></div>',
			)
		})

		it("should normalize path that starts with /", () => {
			const node = ProjectImageNode.configure({ urlResolver })
			const storage = node.storage

			const mockState = {
				write: vi.fn(),
				closeBlock: vi.fn(),
			}

			const mockNode = {
				attrs: {
					src: "/absolute/path.jpg",
					width: null,
					height: null,
					align: "left",
				},
			}

			storage.markdown.serialize(mockState, mockNode)

			expect(mockState.write).toHaveBeenCalledWith(
				'<div style="text-align: left"><img src="./absolute/path.jpg" /></div>',
			)
		})

		it("should preserve HTTP URLs", () => {
			const node = ProjectImageNode.configure({ urlResolver })
			const storage = node.storage

			const mockState = {
				write: vi.fn(),
				closeBlock: vi.fn(),
			}

			const mockNode = {
				attrs: {
					src: "http://example.com/image.png",
					width: 300,
					height: 200,
				},
			}

			storage.markdown.serialize(mockState, mockNode)

			expect(mockState.write).toHaveBeenCalledWith(
				'<img src="http://example.com/image.png" width="300" height="200" />',
			)
		})

		it("should preserve HTTPS URLs", () => {
			const node = ProjectImageNode.configure({ urlResolver })
			const storage = node.storage

			const mockState = {
				write: vi.fn(),
				closeBlock: vi.fn(),
			}

			const mockNode = {
				attrs: {
					src: "https://cdn.example.com/photo.jpg",
					width: null,
					height: null,
					alt: "External photo",
				},
			}

			storage.markdown.serialize(mockState, mockNode)

			expect(mockState.write).toHaveBeenCalledWith(
				"![External photo](https://cdn.example.com/photo.jpg)",
			)
		})

		it("should serialize aligned image with dimensions", () => {
			const node = ProjectImageNode.configure({ urlResolver })
			const storage = node.storage

			const mockState = {
				write: vi.fn(),
				closeBlock: vi.fn(),
			}

			const mockNode = {
				attrs: {
					src: "./test.png",
					width: 400,
					height: 300,
					align: "center",
					alt: "Centered image",
				},
			}

			storage.markdown.serialize(mockState, mockNode)

			expect(mockState.write).toHaveBeenCalledWith(
				'<div style="text-align: center"><img src="./test.png" alt="Centered image" width="400" height="300" /></div>',
			)
		})

		it("should skip uploading images", () => {
			const node = ProjectImageNode.configure({ urlResolver })
			const storage = node.storage

			const mockState = {
				write: vi.fn(),
				closeBlock: vi.fn(),
			}

			const mockNode = {
				attrs: {
					src: "./test.png",
					uploading: true,
				},
			}

			storage.markdown.serialize(mockState, mockNode)

			expect(mockState.write).not.toHaveBeenCalled()
			expect(mockState.closeBlock).toHaveBeenCalledWith(mockNode)
		})

		it("should skip images with upload errors", () => {
			const node = ProjectImageNode.configure({ urlResolver })
			const storage = node.storage

			const mockState = {
				write: vi.fn(),
				closeBlock: vi.fn(),
			}

			const mockNode = {
				attrs: {
					src: "./test.png",
					uploadError: "Upload failed",
				},
			}

			storage.markdown.serialize(mockState, mockNode)

			expect(mockState.write).not.toHaveBeenCalled()
			expect(mockState.closeBlock).toHaveBeenCalledWith(mockNode)
		})
	})

	describe("parse", () => {
		it("should parse project image markdown with dimensions from title", () => {
			const node = ProjectImageNode.configure({ urlResolver })
			const storage = node.storage

			const mockRule = {
				name: "image",
				getContent: vi.fn(),
			}

			const updatedRule = storage.markdown.parse.updateRule(mockRule)

			const mockTokens = [
				{
					attrs: [
						["alt", "Example image"],
						["src", "./images/example.png"],
						["title", "=800x600"],
					],
				},
			]

			const result = updatedRule.getContent(mockTokens, 0)

			expect(result).toEqual([
				{
					type: "image",
					attrs: {
						src: "./images/example.png",
						width: 800,
						height: 600,
						alt: "Example image",
					},
				},
			])
		})

		it("should parse project image markdown without dimensions", () => {
			const node = ProjectImageNode.configure({ urlResolver })
			const storage = node.storage

			const mockRule = {
				name: "image",
				getContent: vi.fn(),
			}

			const updatedRule = storage.markdown.parse.updateRule(mockRule)

			const mockTokens = [
				{
					attrs: [
						["alt", "Simple image"],
						["src", "./test.jpg"],
					],
				},
			]

			const result = updatedRule.getContent(mockTokens, 0)

			expect(result).toEqual([
				{
					type: "image",
					attrs: {
						src: "./test.jpg",
						width: null,
						height: null,
						alt: "Simple image",
					},
				},
			])
		})

		it("should parse project image markdown with width only", () => {
			const node = ProjectImageNode.configure({ urlResolver })
			const storage = node.storage

			const mockRule = {
				name: "image",
				getContent: vi.fn(),
			}

			const updatedRule = storage.markdown.parse.updateRule(mockRule)

			const mockTokens = [
				{
					attrs: [
						["alt", "Width only"],
						["src", "./image.png"],
						["title", "=500x"],
					],
				},
			]

			const result = updatedRule.getContent(mockTokens, 0)

			expect(result).toEqual([
				{
					type: "image",
					attrs: {
						src: "./image.png",
						width: 500,
						height: null,
						alt: "Width only",
					},
				},
			])
		})

		it("should parse external URLs as project images", () => {
			const node = ProjectImageNode.configure({ urlResolver })
			const storage = node.storage

			const mockRule = {
				name: "image",
				getContent: vi.fn(),
			}

			const updatedRule = storage.markdown.parse.updateRule(mockRule)

			const mockTokens = [
				{
					attrs: [
						["alt", "external image"],
						["src", "https://example.com/image.png"],
					],
				},
			]

			const result = updatedRule.getContent(mockTokens, 0)

			expect(result).toEqual([
				{
					type: "image",
					attrs: {
						src: "https://example.com/image.png",
						width: null,
						height: null,
						alt: "external image",
					},
				},
			])
		})

		it("should parse external URLs with dimensions", () => {
			const node = ProjectImageNode.configure({ urlResolver })
			const storage = node.storage

			const mockRule = {
				name: "image",
				getContent: vi.fn(),
			}

			const updatedRule = storage.markdown.parse.updateRule(mockRule)

			const mockTokens = [
				{
					attrs: [
						["alt", "external image with size"],
						["src", "https://cdn.example.com/photo.jpg"],
						["title", "=800x600"],
					],
				},
			]

			const result = updatedRule.getContent(mockTokens, 0)

			expect(result).toEqual([
				{
					type: "image",
					attrs: {
						src: "https://cdn.example.com/photo.jpg",
						width: 800,
						height: 600,
						alt: "external image with size",
					},
				},
			])
		})

		it("should parse relative path without ./ prefix", () => {
			const node = ProjectImageNode.configure({ urlResolver })
			const storage = node.storage

			const mockRule = {
				name: "image",
				getContent: vi.fn(),
			}

			const updatedRule = storage.markdown.parse.updateRule(mockRule)

			const mockTokens = [
				{
					attrs: [
						["alt", "No prefix"],
						["src", "images/photo.jpg"],
					],
				},
			]

			const result = updatedRule.getContent(mockTokens, 0)

			expect(result).toEqual([
				{
					type: "image",
					attrs: {
						src: "images/photo.jpg",
						width: null,
						height: null,
						alt: "No prefix",
					},
				},
			])
		})

		it("should return original result when rule is not image", () => {
			const node = ProjectImageNode.configure({ urlResolver })
			const storage = node.storage

			const mockRule = {
				name: "paragraph",
				getContent: vi.fn(),
			}

			const result = storage.markdown.parse.updateRule(mockRule)

			expect(result).toBe(mockRule)
		})
	})

	describe("serialize and parse round-trip", () => {
		it("should correctly round-trip image with dimensions", () => {
			const node = ProjectImageNode.configure({ urlResolver })
			const storage = node.storage

			// Serialize
			const mockState = {
				write: vi.fn(),
				closeBlock: vi.fn(),
			}

			const originalAttrs = {
				src: "./images/round-trip.png",
				width: 1024,
				height: 768,
				alt: "Round trip test",
			}

			storage.markdown.serialize(mockState, { attrs: originalAttrs })

			const serialized = mockState.write.mock.calls[0][0]
			expect(serialized).toBe(
				'<img src="./images/round-trip.png" alt="Round trip test" width="1024" height="768" />',
			)
		})

		it("should correctly round-trip simple markdown image", () => {
			const node = ProjectImageNode.configure({ urlResolver })
			const storage = node.storage

			const mockState = {
				write: vi.fn(),
				closeBlock: vi.fn(),
			}

			const originalAttrs = {
				src: "./simple.jpg",
				alt: "Simple",
			}

			storage.markdown.serialize(mockState, { attrs: originalAttrs })

			const serialized = mockState.write.mock.calls[0][0]
			expect(serialized).toBe("![Simple](./simple.jpg)")

			// Parse it back
			const mockRule = {
				name: "image",
				getContent: vi.fn(),
			}

			const updatedRule = storage.markdown.parse.updateRule(mockRule)

			const mockTokens = [
				{
					attrs: [
						["alt", "Simple"],
						["src", "./simple.jpg"],
					],
				},
			]

			const parsedResult = updatedRule.getContent(mockTokens, 0)

			expect(parsedResult).toEqual([
				{
					type: "image",
					attrs: {
						src: "./simple.jpg",
						width: null,
						height: null,
						alt: "Simple",
					},
				},
			])
		})

		it("should correctly round-trip HTTP URL", () => {
			const node = ProjectImageNode.configure({ urlResolver })
			const storage = node.storage

			const mockState = {
				write: vi.fn(),
				closeBlock: vi.fn(),
			}

			const originalAttrs = {
				src: "https://example.com/image.png",
				width: 600,
				height: 400,
				alt: "External",
			}

			storage.markdown.serialize(mockState, { attrs: originalAttrs })

			const serialized = mockState.write.mock.calls[0][0]
			expect(serialized).toBe(
				'<img src="https://example.com/image.png" alt="External" width="600" height="400" />',
			)
		})
	})
})
