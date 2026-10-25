import { describe, expect, it } from "vitest"
import type { User } from "@/types/user"
import { getAccountOrganizationOptions } from "../organizationOptions"

const first = {
	magic_organization_code: "magic-1",
	third_platform_organization_code: "third-1",
} as User.MagicOrganization
const second = {
	magic_organization_code: "magic-2",
	third_platform_organization_code: "third-2",
} as User.MagicOrganization
const account = (metadata?: User.UserOrganization[]) =>
	({ organizations: [first, second], teamshareOrganizations: metadata }) as User.UserAccount

describe("account organization options", () => {
	it.each([undefined, []])(
		"keeps available organizations without third-party metadata (%s)",
		(metadata) => {
			expect(getAccountOrganizationOptions(account(metadata))).toEqual([
				{ magicOrganization: first },
				{ magicOrganization: second },
			])
		},
	)
	it("preserves metadata and includes organizations without a matching metadata entry", () => {
		const metadata = {
			organization_code: "third-1",
			organization_name: "Team",
		} as User.UserOrganization
		expect(getAccountOrganizationOptions(account([metadata]))).toEqual([
			{ organization: metadata, magicOrganization: first },
			{ magicOrganization: second },
		])
	})
	it("keeps third-party-only rows without inventing a switchable organization", () => {
		const metadata = { organization_code: "unavailable" } as User.UserOrganization
		const result = getAccountOrganizationOptions({
			organizations: [],
			teamshareOrganizations: [metadata],
		} as unknown as User.UserAccount)
		expect(result).toEqual([{ organization: metadata, magicOrganization: undefined }])
	})
})
