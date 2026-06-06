import { describe, expect, it } from "vitest"
import { parseJsonLargeIntAsString } from "../parse-json-large-int"

/** 18-digit mock snowflake IDs — exceed Number.MAX_SAFE_INTEGER for precision tests */
const MOCK_TOPIC_ID = "900000000000000001"
const MOCK_AUDIO_FILE_ID = "900000000000000002"
const MOCK_PROJECT_ID = "900000000000000003"

describe("parseJsonLargeIntAsString", () => {
	it("preserves snowflake topic_id and audio_file_id from API-shaped payload", () => {
		const apiText = `{"code":1000,"data":{"list":[{"id":"${MOCK_PROJECT_ID}","created_at":1700000000,"extra":{"topic_id":${MOCK_TOPIC_ID},"audio_file_id":${MOCK_AUDIO_FILE_ID},"duration":379,"file_size":15191200}}],"total":1}}`

		const parsed = parseJsonLargeIntAsString(apiText) as {
			data: { list: Array<{ extra: { topic_id: string; audio_file_id: string } }> }
		}

		expect(parsed.data.list[0].extra.topic_id).toBe(MOCK_TOPIC_ID)
		expect(parsed.data.list[0].extra.audio_file_id).toBe(MOCK_AUDIO_FILE_ID)
	})

	it("demonstrates native JSON.parse loses precision for the same payload", () => {
		const apiText = `{"extra":{"topic_id":${MOCK_TOPIC_ID},"audio_file_id":${MOCK_AUDIO_FILE_ID}}}`
		const native = JSON.parse(apiText) as { extra: { topic_id: number; audio_file_id: number } }

		expect(String(native.extra.topic_id)).not.toBe(MOCK_TOPIC_ID)
		expect(String(native.extra.audio_file_id)).not.toBe(MOCK_AUDIO_FILE_ID)
	})

	it("keeps small integers as numbers", () => {
		const parsed = parseJsonLargeIntAsString(
			'{"code":1000,"created_at":1700000000,"duration":379,"file_size":15191200,"total":1}',
		) as Record<string, number>

		expect(parsed.code).toBe(1000)
		expect(parsed.created_at).toBe(1700000000)
		expect(parsed.duration).toBe(379)
		expect(parsed.file_size).toBe(15191200)
		expect(parsed.total).toBe(1)
	})

	it("does not alter numbers inside JSON strings", () => {
		const parsed = parseJsonLargeIntAsString(`{"label":"id:${MOCK_TOPIC_ID}","count":12}`) as {
			label: string
			count: number
		}

		expect(parsed.label).toBe(`id:${MOCK_TOPIC_ID}`)
		expect(parsed.count).toBe(12)
	})
})
