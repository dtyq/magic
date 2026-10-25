import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

const source = readFileSync("src/layouts/dashboard-layout.tsx", "utf8")
const accountControlsSource = readFileSync(
	"src/layouts/components/shell-account-controls.tsx",
	"utf8",
)
const languageSwitcherSource = readFileSync("src/components/language-switcher.tsx", "utf8")

describe("dashboard mobile sidebar", () => {
	it("uses the shared Sheet/Dialog primitive for mobile navigation", () => {
		assert.match(source, /<Sheet open=\{isMobileSidebarOpen\} onOpenChange=\{setMobileSidebarOpen\}>/)
		assert.match(source, /<SheetContent[\s\S]*side="left"/)
		assert.match(source, /className="w-\[18rem\] p-0 sm:max-w-none"/)
		assert.match(source, /<SheetHeader className="sr-only">/)
		assert.match(source, /<SheetTitle>\{t\("aria\.primaryNavigation"\)\}<\/SheetTitle>/)
		assert.match(source, /<SheetDescription>\{t\("aria\.primaryNavigation"\)\}<\/SheetDescription>/)
	})

	it("lets the shared primitive own overlay lifecycle and closes from navigation", () => {
		assert.doesNotMatch(source, /isMobileSidebarMounted|isMobileSidebarEntered/)
		assert.doesNotMatch(source, /requestAnimationFrame|transition-transform duration-300/)
		assert.match(source, /onCloseMobile=\{\(\) => setMobileSidebarOpen\(false\)\}/)
		assert.match(source, /<AppSidebar[\s\S]*onCloseMobile=/)
	})

	it("keeps organization switching available and account actions compact on mobile", () => {
		assert.match(
			accountControlsSource,
			/className="flex h-9 w-9[^"\n]*sm:w-auto[^"\n]*sm:max-w-\[260px\]/,
		)
		assert.match(accountControlsSource, /hidden min-w-0 max-w-\[188px\][^"\n]*sm:block/)
		assert.match(languageSwitcherSource, /className="inline-flex h-9 w-9[^"\n]*sm:w-auto/)
		assert.match(languageSwitcherSource, /className="hidden sm:inline"/)
		assert.match(languageSwitcherSource, /options\.find\([^\n]+\)\?\.label/)
	})
})
