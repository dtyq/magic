import { describe, expect, it } from "vitest"
import {
	createSessionFileAccess,
	createShareFileAccess,
	getAccessProjectId,
	getAccessTopicId,
	getShareAccessToken,
	isSharePageLocation,
	resolveAttachmentProjectId,
	resolveTemporaryTokenFromAccess,
	shouldWaitForShareAccess,
} from "../fileAccessContext"

describe("fileAccessContext", () => {
	it("treats omitted access as session without a share token", () => {
		expect(getShareAccessToken()).toBe("")
		expect(resolveTemporaryTokenFromAccess()).toBe("")
		expect(resolveAttachmentProjectId("host-project")).toBe("host-project")
	})

	it("does not inherit a leftover token string as share identity", () => {
		expect(resolveTemporaryTokenFromAccess(undefined, null)).toBe("")
		expect(resolveAttachmentProjectId("host-project", createSessionFileAccess())).toBe(
			"host-project",
		)
	})

	it("rewrites attachment project id only for share access", () => {
		const share = createShareFileAccess({
			token: "share-token",
			projectId: "origin-project",
			topicId: "topic-1",
		})

		expect(getShareAccessToken(share)).toBe("share-token")
		expect(getAccessProjectId(share, "fallback")).toBe("origin-project")
		expect(getAccessTopicId(share, "fallback-topic")).toBe("topic-1")
		expect(resolveAttachmentProjectId("host-project", share)).toBe("0")
		expect(resolveTemporaryTokenFromAccess(share, "ignored")).toBe("share-token")
	})

	it("does not fall back to session ids when share topic is omitted", () => {
		const share = createShareFileAccess({
			token: "share-token",
			projectId: "origin-project",
		})

		expect(getAccessProjectId(share, "fallback-project")).toBe("origin-project")
		expect(getAccessTopicId(share, "fallback-topic")).toBe("")
	})

	it("waits for share access only on share page locations", () => {
		const share = createShareFileAccess({
			token: "share-token",
			projectId: "origin-project",
		})

		expect(isSharePageLocation("/share/files/1")).toBe(true)
		expect(isSharePageLocation("/micro-app/1")).toBe(true)
		expect(isSharePageLocation("/magic-share/project-1/topic-1")).toBe(true)
		expect(isSharePageLocation("/global/super/1/2")).toBe(false)
		expect(isSharePageLocation("/super/micro-app/1")).toBe(false)
		expect(isSharePageLocation("/global/super/micro-app/9575893229010228865")).toBe(false)
		expect(isSharePageLocation("")).toBe(false)
		expect(shouldWaitForShareAccess(null, "/share/files/1")).toBe(true)
		expect(shouldWaitForShareAccess(share, "/share/files/1")).toBe(false)
		expect(
			shouldWaitForShareAccess(
				createSessionFileAccess({ projectId: "runtime-project" }),
				"/micro-app/1",
			),
		).toBe(false)
		expect(shouldWaitForShareAccess(null, "/global/super/1/2")).toBe(false)
		expect(shouldWaitForShareAccess(null, "/global/super/micro-app/9575893229010228865")).toBe(
			false,
		)
	})
})
