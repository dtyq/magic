import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import SlidesTemplateRootRender from "../index"

const MANIFEST = JSON.stringify({
	schema_version: "1.0",
	files: { slides_dir: "slides" },
	slides: [
		{
			file: "slides/slide-1.html",
			title: "One",
			layout: "cover",
			description: "First",
		},
	],
})

function createTemplateData(
	id: string,
	options?: { slideUpdatedAt?: string; extraChild?: Record<string, unknown> },
) {
	return {
		file_id: id,
		file_name: id,
		is_directory: true,
		relative_file_path: id,
		children: [
			{ file_id: `${id}-manifest`, file_name: "template.json", updated_at: "manifest-1" },
			{ file_id: `${id}-spec`, file_name: "visual-spec.md" },
			{ file_id: `${id}-theme`, file_name: "theme.css" },
			{
				file_id: `${id}-slides`,
				file_name: "slides",
				is_directory: true,
				children: [
					{
						file_id: `${id}-slide-1`,
						file_name: "slide-1.html",
						relative_file_path: `${id}/slides/slide-1.html`,
						updated_at: options?.slideUpdatedAt || "slide-1",
					},
				],
			},
			...(options?.extraChild ? [options.extraChild] : []),
		],
	}
}

const mocks = vi.hoisted(() => ({
	getFileContentById: vi.fn(),
	rootProps: vi.fn(),
	isShareRoute: false,
}))

vi.mock("@/pages/superMagic/utils/api", () => ({
	getFileContentById: mocks.getFileContentById,
}))

vi.mock("../../PPTRootRender", () => ({
	default: (props: Record<string, unknown>) => {
		mocks.rootProps(props)
		return <div data-testid="ppt-root-render" />
	},
}))

vi.mock("@/components/base/MagicSpin", () => ({
	default: () => <div data-testid="loading" />,
}))

vi.mock("@/pages/superMagic/hooks/useShareRoute", () => ({
	default: () => ({ isShareRoute: mocks.isShareRoute }),
}))

vi.mock("react-i18next", async (importOriginal) => ({
	...(await importOriginal<typeof import("react-i18next")>()),
	useTranslation: () => ({
		t: (key: string, options?: { reason?: string }) =>
			options?.reason ? `${key}: ${options.reason}` : key,
	}),
}))

describe("SlidesTemplateRootRender", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.isShareRoute = false
	})

	it("loads template.json and passes a slide model to PPTRootRender", async () => {
		mocks.getFileContentById.mockResolvedValue(MANIFEST)

		render(
			<SlidesTemplateRootRender
				data={
					{
						file_id: "root",
						file_name: "PPT-template",
						is_directory: true,
						relative_file_path: "PPT-template",
						children: [
							{ file_id: "manifest", file_name: "template.json" },
							{ file_id: "spec", file_name: "visual-spec.md" },
							{ file_id: "theme", file_name: "theme.css" },
							{
								file_id: "slides-dir",
								file_name: "slides",
								is_directory: true,
								children: [{ file_id: "slide-1", file_name: "slide-1.html" }],
							},
						],
					} as never
				}
				projectId="project-1"
			/>,
		)

		expect(await screen.findByTestId("ppt-root-render")).toBeInTheDocument()
		await waitFor(() => {
			expect(mocks.rootProps).toHaveBeenCalledWith(
				expect.objectContaining({
					disableMagicProjectLookup: true,
					displayConfig: {
						type: "slide",
						slides: ["slides/slide-1.html"],
					},
					slideStructureAdapter: expect.any(Object),
				}),
			)
		})
	})

	it("shows the manifest error that prevented the template from loading", async () => {
		mocks.getFileContentById.mockResolvedValue(
			JSON.stringify({
				version: "1.0.0",
				files: { entry_html: "slides/cover.html" },
				slides: [],
			}),
		)

		render(
			<SlidesTemplateRootRender
				data={
					{
						file_id: "root",
						file_name: "PPT-template",
						is_directory: true,
						children: [
							{ file_id: "manifest", file_name: "template.json" },
							{ file_id: "spec", file_name: "visual-spec.md" },
							{ file_id: "theme", file_name: "theme.css" },
							{ file_id: "slides-dir", file_name: "slides", is_directory: true },
						],
					} as never
				}
			/>,
		)

		expect(await screen.findByTestId("slides-template-load-error-detail")).toHaveTextContent(
			"Unsupported template schema",
		)
	})

	it("keeps the loaded preview when a sibling template is rewritten", async () => {
		mocks.getFileContentById.mockResolvedValue(MANIFEST)
		const finished = createTemplateData("SLIDE-finished")
		const making = createTemplateData("SLIDE-making")
		const { rerender } = render(
			<SlidesTemplateRootRender
				data={finished as never}
				attachments={[finished, making] as never}
				projectId="project-1"
			/>,
		)

		expect(await screen.findByTestId("ppt-root-render")).toBeInTheDocument()
		expect(mocks.getFileContentById).toHaveBeenCalledTimes(1)

		rerender(
			<SlidesTemplateRootRender
				data={
					createTemplateData("SLIDE-finished", {
						slideUpdatedAt: "slide-still-same-id",
					}) as never
				}
				attachments={
					[
						createTemplateData("SLIDE-finished"),
						createTemplateData("SLIDE-making", {
							slideUpdatedAt: "making-rewritten",
							extraChild: {
								file_id: "SLIDE-making-image",
								file_name: "cover.png",
							},
						}),
					] as never
				}
				projectId="project-1"
			/>,
		)

		expect(screen.queryByTestId("loading")).not.toBeInTheDocument()
		expect(screen.getByTestId("ppt-root-render")).toBeInTheDocument()
		expect(mocks.getFileContentById).toHaveBeenCalledTimes(1)
	})

	it("hides template settings and save actions on share routes", async () => {
		mocks.isShareRoute = true
		mocks.getFileContentById.mockResolvedValue(MANIFEST)

		render(
			<SlidesTemplateRootRender
				data={
					{
						file_id: "root",
						file_name: "PPT-template",
						is_directory: true,
						relative_file_path: "PPT-template",
						children: [
							{ file_id: "manifest", file_name: "template.json" },
							{ file_id: "spec", file_name: "visual-spec.md" },
							{ file_id: "theme", file_name: "theme.css" },
							{
								file_id: "slides-dir",
								file_name: "slides",
								is_directory: true,
								children: [{ file_id: "slide-1", file_name: "slide-1.html" }],
							},
						],
					} as never
				}
				projectId="project-1"
			/>,
		)

		expect(await screen.findByTestId("ppt-root-render")).toBeInTheDocument()
		expect(screen.getByTestId("slides-template-preview-header")).toBeInTheDocument()
		expect(
			screen.queryByTestId("slides-template-preview-settings-button"),
		).not.toBeInTheDocument()
		expect(screen.queryByTestId("slides-template-preview-save-button")).not.toBeInTheDocument()
	})
})
