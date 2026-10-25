import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const topicPageSource = readFileSync(
	resolve(process.cwd(), "src/pages/superMagicMobile/pages/TopicPage/index.tsx"),
	"utf8",
)

describe("TopicPage scroll ownership", () => {
	it("delegates message viewport scrolling and history pagination to MessageList", () => {
		// MessageList must receive the loader while retaining exclusive access to its viewport.
		expect(topicPageSource).toContain("handlePullMoreMessage={handlePullMoreMessage}")
		expect(topicPageSource).not.toMatch(/viewportRef\s*=/)

		// Page-level listeners or height compensation would reintroduce competing scroll owners.
		expect(topicPageSource).not.toContain('addEventListener("scroll"')
		expect(topicPageSource).not.toContain("handlePullMoreMessage(selectedTopic)")
		expect(topicPageSource).not.toContain("scrollHeightRef")
		expect(topicPageSource).not.toContain("scrollTopRef")
	})
})
