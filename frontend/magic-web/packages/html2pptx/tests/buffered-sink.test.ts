import { createBufferedPptxSink, PPTX_MIME_TYPE } from "../src/packaging/buffered-sink"

describe("createBufferedPptxSink", () => {
	it("preserves streamed bytes and produces a PPTX Blob after close", async () => {
		const buffered = createBufferedPptxSink()
		await buffered.sink.write(Uint8Array.of(1, 2))
		await buffered.sink.write(Uint8Array.of(3, 4))

		expect(buffered.getBytesWritten()).toBe(4)
		await buffered.sink.close()

		const blob = buffered.getBlob()
		expect(blob.type).toBe(PPTX_MIME_TYPE)
		expect(Array.from(new Uint8Array(await blob.arrayBuffer()))).toEqual([1, 2, 3, 4])
	})

	it("clears buffered data when aborted", async () => {
		const buffered = createBufferedPptxSink()
		await buffered.sink.write(Uint8Array.of(1, 2, 3))
		await buffered.sink.abort?.("cancelled")

		expect(buffered.getBytesWritten()).toBe(0)
		expect(() => buffered.getBlob()).toThrow("PPTX buffered sink is not closed")
	})
})
