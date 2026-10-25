import { beforeEach, describe, expect, it, vi } from "vitest"
import { generateSpeakerNotes, extractSpeakerNotesContext } from "../generateSpeakerNotes"
import { aiLLMService } from "@/services/ai"
vi.mock("@/services/superMagic/SuperMagicModeService", () => ({
	default: {
		getModelListByMode: () => [{ model_id: "available-model" }],
		fetchDefaultModeModelList: vi.fn(),
	},
}))
vi.mock("@/services/ai", () => ({ aiLLMService: { chat: vi.fn() } }))
const input = () => ({
	action: "polish" as const,
	notes: "原稿",
	rawContent: "<main>业务进展</main>",
	signal: new AbortController().signal,
})
beforeEach(() => vi.mocked(aiLLMService.chat).mockReset())
describe("speaker notes generation", () => {
	it("sends a single request with bounded slide text and the unsaved draft", async () => {
		vi.mocked(aiLLMService.chat).mockResolvedValue({ content: "更新后的讲稿" })
		expect(await generateSpeakerNotes(input())).toBe("更新后的讲稿")
		expect(aiLLMService.chat).toHaveBeenCalledTimes(1)
		const options = vi.mocked(aiLLMService.chat).mock.calls[0][1]
		expect(options?.model).toBe("available-model")
		// Sampling parameters are left to the model's own defaults.
		expect(options?.temperature).toBeUndefined()
		expect(options?.maxTokens).toBeUndefined()
		expect(JSON.parse(vi.mocked(aiLLMService.chat).mock.calls[0][0][0].content)).toEqual({
			slideText: "业务进展",
			notes: "原稿",
		})
	})
	it("adds neighbouring slide text and image descriptions as context", async () => {
		vi.mocked(aiLLMService.chat).mockResolvedValue({ content: "讲稿" })
		await generateSpeakerNotes({
			...input(),
			rawContent: '<main>当前<img alt="渗透率图表"></main>',
			previousRawContent: "<main>上一页</main>",
			nextRawContent: "<main>下一页</main>",
		})
		expect(JSON.parse(vi.mocked(aiLLMService.chat).mock.calls[0][0][0].content)).toEqual({
			slideText: "当前 渗透率图表",
			previousSlideText: "上一页",
			nextSlideText: "下一页",
			notes: "原稿",
		})
	})
	it("sends the user's custom instruction and requires one", async () => {
		vi.mocked(aiLLMService.chat).mockResolvedValue({ content: "新讲稿" })
		await generateSpeakerNotes({ ...input(), action: "custom", instruction: " 语气更轻松 " })
		expect(
			JSON.parse(vi.mocked(aiLLMService.chat).mock.calls[0][0][0].content).userInstruction,
		).toBe("语气更轻松")
		await expect(generateSpeakerNotes({ ...input(), action: "custom" })).rejects.toThrow(
			"Missing instruction",
		)
		expect(aiLLMService.chat).toHaveBeenCalledTimes(1)
	})
	it("excludes scripts, styles, hidden content and stored notes", () => {
		expect(
			extractSpeakerNotesContext(
				"<main>Visible</main><script>secret</script><style>style</style><template>notes</template><p hidden>hidden</p>",
			),
		).toBe("Visible")
	})
	it.each(["", "   ", "<script>alert(1)</script>", "x".repeat(20001)])(
		"rejects invalid responses without retry",
		async (content) => {
			vi.mocked(aiLLMService.chat).mockResolvedValue({ content })
			await expect(generateSpeakerNotes(input())).rejects.toThrow(
				"Invalid speaker notes response",
			)
			expect(aiLLMService.chat).toHaveBeenCalledTimes(1)
		},
	)
	it("does not request after cancellation", async () => {
		const controller = new AbortController()
		controller.abort()
		await expect(
			generateSpeakerNotes({ ...input(), signal: controller.signal }),
		).rejects.toMatchObject({ name: "AbortError" })
		expect(aiLLMService.chat).not.toHaveBeenCalled()
	})
})
