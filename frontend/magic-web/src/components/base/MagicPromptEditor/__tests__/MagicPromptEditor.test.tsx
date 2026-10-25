import { render, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { JSONContent } from "@/infrastructure/editors/tiptap/react"
import MagicPromptEditor from "../MagicPromptEditor"

vi.mock("react-i18next", () => ({
	initReactI18next: {
		type: "3rdParty",
		init: vi.fn(),
	},
	useTranslation: () => ({
		i18n: { language: "zh_CN" },
		t: (key: string, fallback?: string) => fallback ?? key,
	}),
}))

vi.mock(
	"@/pages/superMagic/components/Detail/components/SelfMediaRootRender/components/SelfMediaInitPanel/components/picker/ModelSelector",
	() => ({
		default: () => null,
	}),
)

vi.mock("@/pages/superMagic/components/MessageEditor/components/VoiceInput", () => ({
	default: () => null,
}))

vi.mock("@/components/business/MentionPanel/tiptap-plugin", () => ({
	default: {
		configure: () => ({}),
	},
}))

vi.mock("@/components/business/MentionPanel/builtin-store", () => ({
	default: {},
}))

vi.mock("../AIPolishButton", () => ({
	default: () => null,
}))

describe("MagicPromptEditor", () => {
	it("syncs editor content when the controlled value changes after mount", async () => {
		const { container, rerender } = render(
			<MagicPromptEditor
				value={undefined}
				onChange={vi.fn()}
				placeholder="Prompt"
				enableMention={false}
			/>,
		)

		rerender(
			<MagicPromptEditor
				value={buildDoc("首开应该出现的复盘指令")}
				onChange={vi.fn()}
				placeholder="Prompt"
				enableMention={false}
			/>,
		)

		await waitFor(() => {
			expect(container.querySelector(".ProseMirror")).toHaveTextContent(
				"首开应该出现的复盘指令",
			)
		})
	})
})

function buildDoc(text: string): JSONContent {
	return {
		type: "doc",
		content: [
			{
				type: "paragraph",
				content: [{ type: "text", text }],
			},
		],
	}
}
