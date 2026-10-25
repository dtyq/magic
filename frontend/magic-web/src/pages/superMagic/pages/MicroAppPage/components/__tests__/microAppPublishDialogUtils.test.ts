import { describe, expect, it } from "vitest"
import { ShareType } from "@/pages/superMagic/components/Share/types"
import {
	buildMicroAppAccessUrl,
	buildMicroAppCopyUrl,
	buildMicroAppPublishPayload,
	buildMicroAppShareText,
	createDefaultMicroAppPublishFormState,
	createFormStateFromPublishedItem,
	getMicroAppPublishValidationError,
	hasMicroAppPublishFormChanged,
	normalizeMicroAppPublishShareType,
	resolveDefaultMicroAppPublishShareType,
} from "../microAppPublishDialogUtils"

describe("microAppPublishDialogUtils", () => {
	it("uses public access as the personal organization default", () => {
		expect(createDefaultMicroAppPublishFormState("Demo App", true)).toMatchObject({
			appName: "Demo App",
			shareType: ShareType.Public,
		})
		expect(createDefaultMicroAppPublishFormState("Demo App", false)).toMatchObject({
			shareType: ShareType.Organization,
		})
	})

	// P0-3: team sharing is hidden by `ShareTypeField` for a free plan, so defaulting to it would
	// leave the dialog showing no option while the publish payload still carried Organization.
	it("uses public access as the free plan default even outside a personal organization", () => {
		expect(resolveDefaultMicroAppPublishShareType(false, true)).toBe(ShareType.Public)
		expect(resolveDefaultMicroAppPublishShareType(true, true)).toBe(ShareType.Public)
		expect(resolveDefaultMicroAppPublishShareType(false, false)).toBe(ShareType.Organization)
		expect(createDefaultMicroAppPublishFormState("Demo App", false, true)).toMatchObject({
			appName: "Demo App",
			shareType: ShareType.Public,
		})
		// An unpublished app without stored data must not fall back to team sharing on a free plan.
		expect(createFormStateFromPublishedItem(null, "Demo App", false, true)).toMatchObject({
			shareType: ShareType.Public,
		})
	})

	// A live share keeps its own method: loading the dialog must not rewrite an existing organization
	// share into public access just because the organization is on a free plan.
	it("keeps an already published share type for a free plan", () => {
		expect(
			createFormStateFromPublishedItem(
				{ share_type: ShareType.Organization, publish_status: "published" },
				"Demo App",
				false,
				true,
			),
		).toMatchObject({ shareType: ShareType.Organization })
		expect(
			createFormStateFromPublishedItem(
				{ share_type: ShareType.PasswordProtected, publish_status: "published" },
				"Demo App",
				false,
				true,
			),
		).toMatchObject({ shareType: ShareType.PasswordProtected })
	})

	it("includes the selected expiry days and restores them from published data", () => {
		const formState = {
			...createDefaultMicroAppPublishFormState("Demo App"),
			shareExpiry: 30,
		}
		expect(buildMicroAppPublishPayload(formState)).toMatchObject({ expire_days: 30 })
		expect(createFormStateFromPublishedItem({ expire_days: 7 }).shareExpiry).toBe(7)
		expect(createFormStateFromPublishedItem({}).shareExpiry).toBeNull()
		expect(hasMicroAppPublishFormChanged(formState, { ...formState, shareExpiry: null })).toBe(
			true,
		)
	})

	it("normalizes organization sharing to public access for personal organizations", () => {
		expect(normalizeMicroAppPublishShareType(ShareType.Organization, true)).toBe(
			ShareType.Public,
		)
		expect(
			buildMicroAppPublishPayload(
				{
					appName: "Demo App",
					shareType: ShareType.Organization,
					shareRange: "designated",
					targets: [],
					password: "123456",
					coverUrl: "",
					fullScreen: false,
				},
				true,
			),
		).toEqual({
			app_name: "Demo App",
			share_type: ShareType.Public,
			extra: { pure_mode: false },
		})
		expect(
			createFormStateFromPublishedItem(
				{ share_type: ShareType.Organization },
				"Demo App",
				true,
			),
		).toMatchObject({ shareType: ShareType.Public })
	})

	it("builds the new app_name publish payload and optional cover", () => {
		expect(
			buildMicroAppPublishPayload({
				appName: "  Demo App  ",
				shareType: ShareType.Public,
				shareRange: "all",
				targets: [],
				password: "123456",
				coverFileKey: "micro-app/covers/demo.png",
				coverUrl: "",
				fullScreen: true,
			}),
		).toEqual({
			app_name: "Demo App",
			share_type: ShareType.Public,
			cover_file_key: "micro-app/covers/demo.png",
			extra: { pure_mode: true },
		})
	})

	it("identifies incomplete publish information", () => {
		expect(
			getMicroAppPublishValidationError({
				appName: "   ",
				shareType: ShareType.Organization,
				shareRange: "all",
				targets: [],
				password: "123456",
				coverUrl: "",
				fullScreen: false,
			}),
		).toBe("projectNameRequired")
	})

	it("does not fabricate a password for an existing protected share", () => {
		expect(
			createFormStateFromPublishedItem({
				share_type: ShareType.PasswordProtected,
				publish_status: "published",
			}),
		).toMatchObject({ password: "" })
	})

	it("generates an initial password for an unpublished protected share", () => {
		const formState = createFormStateFromPublishedItem({
			share_type: ShareType.PasswordProtected,
			publish_status: "unpublished",
		})

		expect(formState.password).toMatch(/^[A-Z0-9]{6}$/)
	})

	it("builds access and share text from the stable app link", () => {
		expect(
			buildMicroAppAccessUrl({ app_id: "app-1", access_url: "https://example.com/app-1" }),
		).toBe("https://example.com/app-1")
		expect(
			buildMicroAppShareText({
				accessUrl: "https://example.com/app-1",
				shareTitle: "You're invited to use the micro app “Demo App”",
				accessHint: "Open the link below to access it:",
				passwordText: "Password: abcd1234",
			}),
		).toBe(
			"You're invited to use the micro app “Demo App”\n\nOpen the link below to access it:\nhttps://example.com/app-1\n\nPassword: abcd1234",
		)
		expect(
			buildMicroAppShareText({
				accessUrl: "https://example.com/app-1",
				shareTitle: "You're invited to use the micro app “Demo App”",
				accessHint: "Open the link below to access it:",
			}),
		).toBe(
			"You're invited to use the micro app “Demo App”\n\nOpen the link below to access it:\nhttps://example.com/app-1",
		)
	})

	it("adds an encoded password to a copied access link", () => {
		expect(
			buildMicroAppCopyUrl("https://example.com/micro-app/app-1?source=publish", "open 1&2"),
		).toBe("https://example.com/micro-app/app-1?source=publish&password=open+1%262")
	})

	it("detects unsaved changes against the published configuration", () => {
		const publishedFormState = createFormStateFromPublishedItem({
			app_name: "Demo App",
			share_type: ShareType.PasswordProtected,
			password: "open1234",
			cover_file_key: "covers/demo.png",
		})

		expect(hasMicroAppPublishFormChanged(publishedFormState, publishedFormState)).toBe(false)
		expect(
			hasMicroAppPublishFormChanged(
				{ ...publishedFormState, password: "next1234" },
				publishedFormState,
			),
		).toBe(true)
		expect(
			hasMicroAppPublishFormChanged(
				{ ...publishedFormState, shareType: ShareType.Public },
				publishedFormState,
			),
		).toBe(true)
		expect(
			hasMicroAppPublishFormChanged(
				{ ...publishedFormState, coverFileKey: null, coverUrl: "" },
				publishedFormState,
			),
		).toBe(true)
		expect(
			hasMicroAppPublishFormChanged(
				{ ...publishedFormState, fullScreen: true },
				publishedFormState,
			),
		).toBe(true)
	})
})
