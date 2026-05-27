import { describe, expect, it } from "vitest"
import { ShareType } from "@/pages/superMagic/components/Share/types"
import {
	buildDetailMetaLabel,
	getShareTypeDescriptionKey,
	getShareTypeVisualMeta,
} from "../shareTypeVisual"

describe("shareTypeVisual", () => {
	it("maps share types to prototype semantic color classes", () => {
		expect(getShareTypeVisualMeta(ShareType.Public).cardClassName).toBe("bg-info/10")
		expect(getShareTypeVisualMeta(ShareType.Organization).iconClassName).toBe(
			"bg-success/15 text-success",
		)
		expect(getShareTypeVisualMeta(ShareType.PasswordProtected).cardClassName).toBe(
			"bg-warning/10",
		)
	})

	it("builds detail meta label with expiry prefix when expire_at exists", () => {
		const label = buildDetailMetaLabel({
			share: { expire_at: "2026/05/14 12:00:00" },
			createdAtLabel: "刚刚",
			t: (key) => (key === "projectShare.expiresOn" ? "到期于" : "永久有效"),
		})

		expect(label).toBe("到期于 2026/05/14 12:00 · 刚刚")
	})

	it("builds detail meta label with permanent copy when expire_at is missing", () => {
		const label = buildDetailMetaLabel({
			share: {},
			createdAtLabel: "2天前",
			t: (key) => (key === "projectShare.expiresPermanent" ? "永久有效" : key),
		})

		expect(label).toBe("永久有效 · 2天前")
	})

	it("returns description i18n keys per share type", () => {
		expect(getShareTypeDescriptionKey(ShareType.Public)).toBe(
			"projectShare.typePublicDescription",
		)
		expect(getShareTypeDescriptionKey(ShareType.Organization)).toBe(
			"projectShare.typeOrganizationDescription",
		)
		expect(getShareTypeDescriptionKey(ShareType.PasswordProtected)).toBe(
			"projectShare.typePasswordDescription",
		)
	})
})
