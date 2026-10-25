import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

/**
 * The "add account" login is the one flow that ends by reloading the page, and the new-user
 * onboarding hangs off exactly the moment that reload is preparing for: signing in makes the newly
 * added account the active one, and the introduction dialog is a first-visit surface of the
 * account it finds there. It also spends itself on the frame it is painted, so a dialog opened in
 * the beat between the two is shown once and then taken away by the reload, unclickable and
 * unrecoverable — the flag the showing writes is the same flag that keeps it from coming back.
 *
 * The holds themselves are covered by `HomeOnboardingPrelude`, and "a hold keeps the run off the
 * screen" by `GuideTourWrapperGate`. What neither can cover is the one thing this flow has to get
 * right — *when* the hold is taken. It has to be up before the account starts flipping, which is
 * several awaits before the reload, and the reload itself is the only reason it is never released.
 * Both are orderings inside one function, so they are read off the source rather than waited for.
 */
/*
 * The path is resolved from the string rather than through `new URL(...)`: the runtime that hosts
 * these tests replaces the global `URL`, and resolving a relative path against `import.meta.url`
 * through it comes back as an `http://localhost/...` address that `fileURLToPath` rejects.
 */
const dirname = path.dirname(fileURLToPath(import.meta.url))
const source = readFileSync(path.resolve(dirname, "../AccountModal.tsx"), "utf-8")

/** Where a snippet sits in the file, so the claims below can compare positions. */
function at(snippet: string): number {
	const index = source.indexOf(snippet)
	expect(index, `AccountModal.tsx no longer contains \`${snippet}\``).toBeGreaterThan(-1)
	return index
}

describe("AccountModal · add-account login and the onboarding prelude", () => {
	it("在账号上下文开始翻转之前就把 prelude 占住", () => {
		const hold = at('holdHomeOnboardingPrelude("account-context-switch")')

		/*
		 * Each of these is a point at which the tab is already acting as the newly added account —
		 * the token is set, the organization list is written down, the user info has been replaced.
		 * A hold taken after any of them would arrive after the run it is meant to keep off the
		 * screen could already have armed.
		 */
		expect(hold).toBeLessThan(at("userService.setAuthorization(access_token)"))
		expect(hold).toBeLessThan(at("userService.setOrganization("))
		expect(hold).toBeLessThan(at("await loginService.accountSync("))
	})

	it("刷新的那一刻 prelude 仍然被占着", () => {
		expect(at('holdHomeOnboardingPrelude("account-context-switch")')).toBeLessThan(
			at("refreshAccountContextPage()"),
		)
	})

	it("登录失败时在 catch 里把 prelude 还回去，不锁死整个会话", () => {
		const release = at('releaseHomeOnboardingPrelude("account-context-switch")')

		// In the failure branch: after the catch opens, and before the `finally` that closes it —
		// so the success path, which ends at the reload, never gives the screen back.
		expect(release).toBeGreaterThan(at("} catch (error: unknown) {"))
		expect(release).toBeLessThan(at("} finally {"))
	})

	it("只占一次、只还一次，语义不会被第二次调用稀释", () => {
		const occurrences = (snippet: string) => source.split(snippet).length - 1

		expect(occurrences('holdHomeOnboardingPrelude("account-context-switch")')).toBe(1)
		expect(occurrences('releaseHomeOnboardingPrelude("account-context-switch")')).toBe(1)
	})
})
