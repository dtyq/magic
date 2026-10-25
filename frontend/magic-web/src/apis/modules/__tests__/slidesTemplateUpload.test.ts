import { describe, expect, it, vi } from "vitest"
import type { ServiceHttpClient } from "@/infrastructure/network/http/clients"
import { generateSlidesTemplateUploadApi } from "../slidesTemplateUpload"

describe("generateSlidesTemplateUploadApi", () => {
	it("posts a new template code when creating", async () => {
		const post = vi.fn().mockResolvedValue({})
		const api = generateSlidesTemplateUploadApi({ post } as unknown as ServiceHttpClient)

		await api.saveFromFolder({
			projectId: "project-1",
			directoryId: "folder-1",
			code: "SLIDE-ABC12345",
		})

		expect(post).toHaveBeenCalledWith("/api/v1/slides-templates/from-project", {
			project_id: "project-1",
			directory_id: "folder-1",
			code: "SLIDE-ABC12345",
		})
	})

	it("omits code only when the caller explicitly leaves it undefined", async () => {
		const post = vi.fn().mockResolvedValue({})
		const api = generateSlidesTemplateUploadApi({ post } as unknown as ServiceHttpClient)

		await api.saveFromFolder({ projectId: "project-1", directoryId: "folder-1" })

		expect(post).toHaveBeenCalledWith("/api/v1/slides-templates/from-project", {
			project_id: "project-1",
			directory_id: "folder-1",
		})
	})
})
