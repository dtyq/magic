import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"
import { TaskStatus } from "@/pages/superMagic/pages/Workspace/types"

/** File contents by file id; a missing id hangs until the read is aborted. */
const contents = new Map<string, string>()
const requested: string[][] = []

vi.mock("@/pages/superMagic/utils/api", () => ({
	getFileContentsByIds: vi.fn(async (ids: string[], options: { signal?: AbortSignal }) => {
		requested.push(ids)
		const successes = new Map<string, string>()
		const failures = new Map<string, Error>()
		const hanging = ids.filter((id) => !contents.has(id))
		for (const id of ids) {
			const content = contents.get(id)
			if (content !== undefined) successes.set(id, content)
		}
		if (hanging.length > 0) {
			await new Promise<void>((resolve) => {
				options.signal?.addEventListener("abort", () => resolve())
			})
			for (const id of hanging) failures.set(id, new Error("aborted"))
		}
		return { successes, failures }
	}),
}))

const { PersonaResearchStore } = await import("../store/research-store")

const file = (path: string, version = "1"): AttachmentItem => ({
	file_id: path,
	file_name: path.split("/").pop(),
	relative_file_path: path,
	is_directory: false,
	updated_at: `2026-10-19 10:00:0${version}`,
})

const study = (topicId: string, title: string) =>
	JSON.stringify({
		schema_version: 1,
		topic_id: topicId,
		title,
		question: "q",
		phase: "interview",
		phases: [],
	})

const persona = (id: string) =>
	JSON.stringify({
		schema_version: 1,
		id,
		name: id,
		tier: "standard",
		dimensions: {},
	})

const topic = (id: string): Topic =>
	({ id, topic_name: id, task_status: TaskStatus.FINISHED }) as unknown as Topic

/** 10 library personas, 2 panels and study s1 (topic t1) using persona p9 only. */
function seed() {
	const files: AttachmentItem[] = []
	for (let index = 0; index < 10; index += 1) {
		const path = `personas/p${index}.json`
		files.push(file(path))
		contents.set(path, persona(`p${index}`))
	}
	for (const path of ["panels/a.json", "panels/b.json"]) {
		files.push(file(path))
		contents.set(
			path,
			JSON.stringify({ schema_version: 1, id: path, name: path, persona_ids: [] }),
		)
	}
	files.push(file("studies/s1/study.json"), file("studies/s2/study.json"))
	contents.set("studies/s1/study.json", study("t1", "S1"))
	contents.set("studies/s2/study.json", study("t2", "S2"))
	files.push(file("studies/s1/panel.json"))
	contents.set(
		"studies/s1/panel.json",
		JSON.stringify({ schema_version: 1, id: "s1", name: "s1", persona_ids: ["p9"] }),
	)
	return files
}

function createStore(files: AttachmentItem[]) {
	const store = new PersonaResearchStore()
	store.topicStore.setTopics([topic("t1"), topic("t2")])
	store.setAttachments(files, files)
	return store
}

const downloaded = () => requested.flat()

describe("PersonaResearchStore content reads", () => {
	beforeEach(() => {
		contents.clear()
		requested.length = 0
	})
	afterEach(() => {
		vi.useRealTimers()
	})

	it("opens a study without downloading any file twice or reading the whole library", async () => {
		const store = createStore(seed())
		// The studio selects its study while the bootstrap read is still running.
		store.selectStudy("t1")
		await store.reloadParsedContent()

		const ids = downloaded()
		expect(new Set(ids).size).toBe(ids.length)
		expect(ids).toContain("personas/p9.json")
		expect(ids).not.toContain("personas/p7.json")
		expect(ids.some((id) => id.startsWith("panels/"))).toBe(false)
		expect(store.loadedStudyTopicId).toBe("t1")
		expect(store.study?.title).toBe("S1")
		expect(store.personaById("p9")?.name).toBe("p9")
		expect(store.personaFileCount).toBe(10)
	})

	it("reads every persona and panel once the library page asks for it", async () => {
		const store = createStore(seed())
		await store.reloadParsedContent()
		expect(store.libraryLoaded).toBe(false)

		store.requestLibrary()
		await store.reloadParsedContent()
		expect(store.libraryLoaded).toBe(true)
		expect(store.personas).toHaveLength(10)
		expect(store.panels).toHaveLength(2)
	})

	it("keeps lists and refs of unchanged files across reads", async () => {
		const files = seed()
		const store = createStore(files)
		store.selectStudy("t1")
		await store.reloadParsedContent()
		const personas = store.personas
		const requestCount = requested.length

		store.setAttachments(files, files)
		await store.reloadParsedContent()
		expect(requested.length).toBe(requestCount)
		expect(store.personas).toBe(personas)
	})

	it("re-downloads only the file whose version changed", async () => {
		const files = seed()
		const store = createStore(files)
		store.selectStudy("t1")
		await store.reloadParsedContent()
		requested.length = 0

		contents.set("studies/s1/study.json", study("t1", "S1 v2"))
		const next = files.map((item) =>
			item.relative_file_path === "studies/s1/study.json"
				? file("studies/s1/study.json", "2")
				: item,
		)
		store.setAttachments(next, next)
		await store.reloadParsedContent()
		expect(downloaded()).toEqual(["studies/s1/study.json"])
		expect(store.study?.title).toBe("S1 v2")
	})

	it("ends the loading state when a download hangs", async () => {
		vi.useFakeTimers()
		const files = seed()
		contents.delete("studies/s1/panel.json")
		const store = createStore(files)
		store.selectStudy("t1")
		const done = store.reloadParsedContent()
		// Two reads run: the bootstrap one and the one for the selected study; each gives the
		// hanging file one timeout, and the failed file is retried by the next read.
		await vi.advanceTimersByTimeAsync(60_000)
		await done
		expect(store.isStudyContentLoading).toBe(false)
		expect(store.study?.title).toBe("S1")
	})

	it("matches list rows to their study through one index", async () => {
		const store = createStore(seed())
		await store.reloadParsedContent()
		expect(store.studyFileOf(topic("t2"))?.title).toBe("S2")
		expect(store.studies.map((item) => item.id).sort()).toEqual(["t1", "t2"])
	})
})
