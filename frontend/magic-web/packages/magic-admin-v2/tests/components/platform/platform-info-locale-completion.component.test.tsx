import { act, fireEvent, render, screen } from "@testing-library/react"
import { useForm } from "react-hook-form"
import { describe, expect, it, vi } from "vitest"
import { createEmptyPlatformInfoFormState } from "../../../src/features/platform-info/api"
import { PlatformInfoForm } from "../../../src/features/platform-info/components/platform-info-form"
import { PlatformInfoPreview } from "../../../src/features/platform-info/components/platform-info-preview"
import type { PlatformInfoFormState } from "../../../src/features/platform-info/types"
import type { PlatformInfoSectionId } from "../../../src/features/platform-info/utils"
import { Language } from "../../../src/i18n/resources"

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

function sectionValues() {
	const value = createEmptyPlatformInfoFormState()
	value.title_i18n.zh_CN = "标题"
	value.keywords_i18n.zh_CN = "关键词"
	value.description_i18n.zh_CN = "描述"
	value.footer.copyright_i18n.en_US = "Copyright"
	return value
}

function FormHarness({ section }: { section: PlatformInfoSectionId }) {
	const form = useForm<PlatformInfoFormState>({ defaultValues: sectionValues() })
	return (
		<PlatformInfoForm
			activeSection={section}
			contentLocale={Language.ZhCN}
			form={form}
			onContentLocaleChange={() => {}}
			value={form.watch()}
		/>
	)
}

function expectCompletion(zh: boolean, en: boolean) {
	for (const [language, complete] of [
		["简体中文", zh],
		["English", en],
	] as const) {
		expect(screen.getByRole("tab", { name: new RegExp(language) })).toHaveTextContent(
			complete
				? "platformInfo.contentLanguage.complete"
				: "platformInfo.contentLanguage.incomplete",
		)
	}
}

async function changeField(placeholder: string, value: string) {
	// setValue triggers asynchronous React Hook Form validation as well as the badge update.
	await act(async () => {
		fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } })
	})
}

describe("platform info language badges", () => {
	it("updates preview badges when switching sections without mixing their fields", () => {
		const value = sectionValues()
		const props = { contentLocale: Language.ZhCN, onContentLocaleChange: () => {}, value }
		const { rerender } = render(<PlatformInfoPreview {...props} activeSection="seo" />)
		expectCompletion(true, false)
		rerender(<PlatformInfoPreview {...props} activeSection="agentPrompt" />)
		expectCompletion(false, false)
		rerender(<PlatformInfoPreview {...props} activeSection="footer" />)
		expectCompletion(false, true)
	})

	it("updates editing badges immediately when a field is cleared or filled", async () => {
		const { rerender } = render(<FormHarness section="seo" />)
		expectCompletion(true, false)
		await changeField("platformInfo.placeholder.seoKeywords", " ")
		expectCompletion(false, false)
		await changeField("platformInfo.placeholder.seoKeywords", "关键词")
		expectCompletion(true, false)
		rerender(<FormHarness section="agentPrompt" />)
		expectCompletion(false, false)
		await changeField("platformInfo.placeholder.agentRoleName", "助手")
		await changeField("platformInfo.placeholder.agentRoleDescription", "描述")
		expectCompletion(true, false)
		rerender(<FormHarness section="footer" />)
		expectCompletion(false, true)
		await changeField("platformInfo.placeholder.copyright", "版权")
		expectCompletion(true, true)
	})
})
