import { fireEvent, render, screen, within } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import type { ArticleDetail } from "../components/SelfMediaInitPanel/types"
import { createArticle, globalSettings, StepTopicAndDetail } from "./StepTopicAndDetail.testHarness"

describe("StepTopicAndDetail style shell", () => {
	it("renders the redesigned article workspace shell", () => {
		const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)

		render(
			<StepTopicAndDetail
				articles={[createArticle()]}
				onChange={vi.fn()}
				onArticleUpdate={vi.fn()}
				globalSettings={globalSettings}
			/>,
		)

		expect(screen.getByText("新建文章")).toBeInTheDocument()
		expect(screen.queryByRole("heading", { name: "选题与大纲" })).not.toBeInTheDocument()
		expect(screen.getByText("先生成候选方向，再补标题、材料和大纲。")).toBeInTheDocument()
		expect(screen.queryByText("Creative desk")).not.toBeInTheDocument()
		expect(screen.queryByText("topic radar")).not.toBeInTheDocument()
		expect(screen.getByText("继续完善当前文章")).toBeInTheDocument()
		expect(screen.queryByText("标题与材料优先")).not.toBeInTheDocument()
		expect(screen.getByText("选题看板")).toBeInTheDocument()
		expect(screen.getAllByText("文章：1 篇")).toHaveLength(1)
		expect(screen.getByTestId("ai-topic-assistant")).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "选择小红书选题" })).toHaveAttribute(
			"aria-current",
			"true",
		)
		expect(screen.getByLabelText("收起看板")).toBeInTheDocument()
		expect(screen.getByLabelText("添加选题")).toBeInTheDocument()
		expect(screen.getByLabelText("收起看板")).toHaveClass("flex")
		expect(within(screen.getByLabelText("添加选题")).getByText("添加选题")).toHaveClass(
			"inline",
		)
		expect(screen.getByLabelText("上一篇")).toBeDisabled()
		expect(screen.getByLabelText("下一篇")).toBeDisabled()
		const removeButton = screen.getByLabelText("删除小红书选题")
		expect(removeButton).toBeInTheDocument()
		expect(removeButton).toHaveClass("focus-visible:opacity-100")
		expect(screen.getByTestId("article-card")).toHaveAttribute(
			"data-show-folder-field",
			"false",
		)
		expect(screen.getByTestId("self-media-topic-navigator-panel")).toHaveClass("rounded-[28px]")
		expect(screen.getByTestId("self-media-topic-workspace-header")).toHaveClass("sticky")
		const consoleErrors = consoleErrorSpy.mock.calls.flat().join("\n")
		expect(consoleErrors).not.toContain("validateDOMNesting")
		consoleErrorSpy.mockRestore()
	})

	it("uses the hero action as the empty-topic entry instead of a second empty card", () => {
		render(
			<StepTopicAndDetail
				articles={[]}
				onChange={vi.fn()}
				onArticleUpdate={vi.fn()}
				globalSettings={globalSettings}
			/>,
		)

		expect(screen.queryByText("暂无选题内容")).not.toBeInTheDocument()
		expect(
			screen.queryByText("从一个标题开始，也可以先让 AI 批量生成候选方向。"),
		).not.toBeInTheDocument()
		expect(screen.queryByText("先添加选题")).not.toBeInTheDocument()
		expect(screen.getByRole("button", { name: "添加第一个选题" })).toBeInTheDocument()
		expect(screen.queryByText("手动创建首个大纲")).not.toBeInTheDocument()
		expect(screen.queryByText("文章：0 篇")).not.toBeInTheDocument()
	})

	it("moves focus to the title input after manually adding the first topic", () => {
		function ControlledTopicStep() {
			const [articles, setArticles] = useState<ArticleDetail[]>([])
			return (
				<StepTopicAndDetail
					articles={articles}
					onChange={setArticles}
					onArticleUpdate={(index, article) => {
						setArticles((current) =>
							current.map((item, itemIndex) =>
								itemIndex === index ? article : item,
							),
						)
					}}
					globalSettings={globalSettings}
				/>
			)
		}

		render(<ControlledTopicStep />)

		fireEvent.click(screen.getByRole("button", { name: "添加第一个选题" }))

		expect(screen.getByLabelText("选题标题")).toHaveFocus()
	})

	it("adds a manual article from the redesigned navigator action", () => {
		const onChange = vi.fn()

		render(
			<StepTopicAndDetail
				articles={[createArticle()]}
				onChange={onChange}
				onArticleUpdate={vi.fn()}
				globalSettings={globalSettings}
			/>,
		)

		fireEvent.click(screen.getByLabelText("添加选题"))

		expect(onChange).toHaveBeenCalledWith([
			createArticle(),
			expect.objectContaining({
				title: "",
				platform: "rednote",
			}),
		])
	})

	it("keeps the archive folder synced while it is still auto-generated", () => {
		const onArticleUpdate = vi.fn()

		render(
			<StepTopicAndDetail
				articles={[createArticle({ title: "", folderName: "01-post" })]}
				onChange={vi.fn()}
				onArticleUpdate={onArticleUpdate}
				globalSettings={globalSettings}
			/>,
		)

		expect(screen.getByText("自动")).toBeInTheDocument()

		fireEvent.change(screen.getByPlaceholderText("点击输入选题标题..."), {
			target: { value: "Launch Plan" },
		})

		expect(onArticleUpdate).toHaveBeenCalledWith(
			0,
			expect.objectContaining({
				title: "Launch Plan",
				folderName: "01-launch-plan",
			}),
		)
	})

	it("turns automatic folder sync into subtle completion feedback after title edits", () => {
		function ControlledTopicStep() {
			const [articles, setArticles] = useState([
				createArticle({ title: "", folderName: "01-post" }),
			])
			return (
				<StepTopicAndDetail
					articles={articles}
					onChange={setArticles}
					onArticleUpdate={(index, article) => {
						setArticles((current) =>
							current.map((item, itemIndex) =>
								itemIndex === index ? article : item,
							),
						)
					}}
					globalSettings={globalSettings}
				/>
			)
		}

		render(<ControlledTopicStep />)

		expect(screen.getByText("自动")).toBeInTheDocument()

		fireEvent.change(screen.getByPlaceholderText("点击输入选题标题..."), {
			target: { value: "Launch Plan" },
		})

		expect(screen.getByDisplayValue("01-launch-plan")).toBeInTheDocument()
		expect(screen.queryByText("自动")).not.toBeInTheDocument()
		expect(screen.getByText("已同步目录")).toHaveAttribute("aria-live", "polite")
	})

	it("keeps the tall article workspace from exposing a floating bottom-left corner", () => {
		render(
			<StepTopicAndDetail
				articles={[createArticle()]}
				onChange={vi.fn()}
				onArticleUpdate={vi.fn()}
				globalSettings={globalSettings}
			/>,
		)

		const articleCard = screen.getByTestId("article-card")
		const articleShell = articleCard.parentElement
		const visibleLayoutContainer = articleShell?.parentElement

		expect(articleShell).toHaveClass("rounded-t-[28px]")
		expect(articleShell).toHaveClass("rounded-b-none")
		expect(visibleLayoutContainer).not.toHaveClass("overflow-hidden")
	})

	it("does not overwrite a manually edited archive folder when the title changes", () => {
		const onArticleUpdate = vi.fn()

		render(
			<StepTopicAndDetail
				articles={[createArticle({ title: "Old Title", folderName: "custom-folder" })]}
				onChange={vi.fn()}
				onArticleUpdate={onArticleUpdate}
				globalSettings={globalSettings}
			/>,
		)

		expect(screen.queryByText("自动")).not.toBeInTheDocument()

		fireEvent.change(screen.getByDisplayValue("Old Title"), {
			target: { value: "New Title" },
		})

		expect(onArticleUpdate).toHaveBeenCalledWith(
			0,
			expect.objectContaining({
				title: "New Title",
				folderName: "custom-folder",
			}),
		)
	})

	it("keeps automatic folder sync after deleting a previous topic", () => {
		function ControlledTopicStep() {
			const [articles, setArticles] = useState([
				createArticle({ title: "First Topic", folderName: "01-first-topic" }),
				createArticle({ title: "Second Topic", folderName: "02-second-topic" }),
			])
			return (
				<StepTopicAndDetail
					articles={articles}
					onChange={setArticles}
					onArticleUpdate={(index, article) => {
						setArticles((current) =>
							current.map((item, itemIndex) =>
								itemIndex === index ? article : item,
							),
						)
					}}
					globalSettings={globalSettings}
				/>
			)
		}

		render(<ControlledTopicStep />)

		fireEvent.click(screen.getByLabelText("删除First Topic"))
		fireEvent.click(screen.getByRole("button", { name: "删除" }))

		expect(screen.getByText("已同步目录")).toBeInTheDocument()

		fireEvent.change(screen.getByDisplayValue("Second Topic"), {
			target: { value: "New Title" },
		})

		expect(screen.getByDisplayValue("02-new-title")).toBeInTheDocument()
		expect(screen.getByText("已同步目录")).toBeInTheDocument()
	})

	it("explains manual archive folder ownership without adding visible copy", () => {
		render(
			<StepTopicAndDetail
				articles={[createArticle({ title: "Old Title", folderName: "custom-folder" })]}
				onChange={vi.fn()}
				onArticleUpdate={vi.fn()}
				globalSettings={globalSettings}
			/>,
		)

		expect(screen.getByLabelText("选题标题")).toHaveAccessibleDescription(
			"目录已手动修改，标题变更不会覆盖它",
		)
		expect(screen.getByLabelText("归档目录")).toHaveAccessibleDescription(
			"手动目录会保留，后续标题变更不会覆盖它",
		)
		expect(screen.getByText("目录已手动修改，标题变更不会覆盖它")).toHaveClass("sr-only")
		expect(screen.getByText("手动目录会保留，后续标题变更不会覆盖它")).toHaveClass("sr-only")
	})

	it("keeps the title and archive folder inputs self-explanatory without extra visible copy", () => {
		render(
			<StepTopicAndDetail
				articles={[createArticle({ title: "", folderName: "01-post" })]}
				onChange={vi.fn()}
				onArticleUpdate={vi.fn()}
				globalSettings={globalSettings}
			/>,
		)

		const titleInput = screen.getByLabelText("选题标题")
		const folderInput = screen.getByLabelText("归档目录，当前为自动生成")

		expect(titleInput).toHaveAttribute("title", "输入标题后，归档目录会自动同步生成")
		expect(titleInput).toHaveAttribute("aria-describedby")
		expect(titleInput).toHaveAccessibleDescription("输入标题后，归档目录会自动同步生成")
		expect(folderInput).toHaveAttribute("title", "标题会自动生成归档目录，也可以手动修改")
		expect(folderInput).toHaveAttribute("aria-describedby")
		expect(folderInput).toHaveAccessibleDescription("标题会自动生成归档目录，也可以手动修改")
		expect(screen.getByText("输入标题后，归档目录会自动同步生成")).toHaveClass("sr-only")
		expect(screen.getByText("标题会自动生成归档目录，也可以手动修改")).toHaveClass("sr-only")
	})

	it("keeps the title voice control scoped to the title input row", () => {
		render(
			<StepTopicAndDetail
				articles={[createArticle({ title: "沧桑巨变长时间", folderName: "01-post" })]}
				onChange={vi.fn()}
				onArticleUpdate={vi.fn()}
				globalSettings={globalSettings}
			/>,
		)

		const titleInput = screen.getByLabelText("选题标题")
		const folderInput = screen.getByLabelText("归档目录，当前为自动生成")
		const voiceButton = screen.getByLabelText("voice")
		const voicePositioningRoot = voiceButton.parentElement

		expect(voicePositioningRoot).toContainElement(titleInput)
		expect(voicePositioningRoot).not.toContainElement(folderInput)
	})
})
