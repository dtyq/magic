import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { canHostHomeOnboarding, useCanHostHomeOnboarding } from "../onboardingAvailability"

/**
 * The rule that decides whether new-user onboarding exists here at all.
 *
 * It is asked across facts the feature cannot share state between — the two environment answers
 * speak synchronously and a team organization only once the organization list has landed — so it is
 * stated once, as a predicate, and held here in both halves: the truth table on its own, and the
 * hook that puts the answers together.
 *
 * The organization is mocked rather than taken from the store, because what this file is about is
 * the rule. Whether the store's answer reaches the hook *by itself* is a property of
 * `useOrganization`'s subscription, and is not something a mock of it can be asked.
 */
const { deployment, organization } = vi.hoisted(() => ({
	deployment: { privateDeployment: false, internationalEnv: false },
	organization: { organizationListReady: true, isPersonalOrganization: true },
}))

/*
 * Only the two environment answers are replaced; the rest of the environment module is real so the
 * imports around it keep working.
 */
vi.mock("@/utils/env", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/utils/env")>()),
	isPrivateDeployment: () => deployment.privateDeployment,
	isInternationalEnv: () => deployment.internationalEnv,
}))

vi.mock("@/models/user/hooks", () => ({
	useOrganization: () => organization,
}))

/** The four facts the rule is built from, in the combinations that matter. */
function facts(input: {
	internationalEnv?: boolean
	privateDeployment?: boolean
	organizationListReady?: boolean
	personalOrganization?: boolean
}) {
	return {
		internationalEnv: input.internationalEnv ?? false,
		privateDeployment: input.privateDeployment ?? false,
		organizationListReady: input.organizationListReady ?? true,
		personalOrganization: input.personalOrganization ?? true,
	}
}

beforeEach(() => {
	// The domestic SaaS personal organization: the one environment the feature is for. Every case
	// that wants another one moves exactly the fact it is about.
	deployment.privateDeployment = false
	deployment.internationalEnv = false
	organization.organizationListReady = true
	organization.isPersonalOrganization = true
})

describe("canHostHomeOnboarding", () => {
	it("is off in the international environment whatever the organization says", () => {
		// The feature is not launched there at all, so no account and no organization can bring it
		// back — the same standing as a private deployment, and asked before it.
		expect(canHostHomeOnboarding(facts({ internationalEnv: true }))).toBe(false)
		expect(
			canHostHomeOnboarding(
				facts({
					internationalEnv: true,
					organizationListReady: true,
					personalOrganization: true,
				}),
			),
		).toBe(false)
	})

	it("is off on a private deployment whatever the organization says", () => {
		// The deployment is asked first and it is final: an account on one never gets the feature,
		// so the organization's kind cannot bring it back.
		expect(canHostHomeOnboarding(facts({ privateDeployment: true }))).toBe(false)
		expect(
			canHostHomeOnboarding(
				facts({
					privateDeployment: true,
					organizationListReady: false,
					personalOrganization: false,
				}),
			),
		).toBe(false)
	})

	it("is off in a team organization", () => {
		expect(canHostHomeOnboarding(facts({ personalOrganization: false }))).toBe(false)
	})

	it("waits for the organization list rather than guessing", () => {
		// Before the list lands the store reads `isPersonalOrganization: false` for everybody, so
		// the two rows below are indistinguishable from each other — and the only safe answer to
		// both is to wait.
		expect(
			canHostHomeOnboarding(
				facts({ organizationListReady: false, personalOrganization: false }),
			),
		).toBe(false)
		expect(
			canHostHomeOnboarding(
				facts({ organizationListReady: false, personalOrganization: true }),
			),
		).toBe(false)
	})

	it("is on for a SaaS personal organization", () => {
		expect(canHostHomeOnboarding(facts({}))).toBe(true)
	})
})

describe("useCanHostHomeOnboarding", () => {
	it("answers from the environment and the organization together", () => {
		organization.organizationListReady = false
		organization.isPersonalOrganization = false

		const { result, rerender } = renderHook(() => useCanHostHomeOnboarding())
		expect(result.current).toBe(false)

		// The list lands and says "personal organization": the gate has to open without the page
		// being remounted, because the store is written long after the first paint.
		organization.organizationListReady = true
		organization.isPersonalOrganization = true
		rerender()
		expect(result.current).toBe(true)

		// And it closes again the other way round — the same page, a different organization.
		organization.isPersonalOrganization = false
		rerender()
		expect(result.current).toBe(false)
	})

	it("stays shut on a private deployment even for a personal organization", () => {
		deployment.privateDeployment = true

		const { result } = renderHook(() => useCanHostHomeOnboarding())
		expect(result.current).toBe(false)
	})

	it("stays shut in the international environment, where none of this ships", () => {
		deployment.internationalEnv = true

		const { result } = renderHook(() => useCanHostHomeOnboarding())
		expect(result.current).toBe(false)
	})
})
