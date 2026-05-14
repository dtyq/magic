package splitter

import (
	"fmt"

	document "magic/internal/domain/knowledge/document/service"
)

const chunkLimitStageBuildFragments = "build_fragments"

func appendTokenChunkWithLimit(chunks *[]tokenChunk, chunk tokenChunk, maxChunks int) error {
	if err := ensureChunkLimitHasRoom(maxChunks, len(*chunks)); err != nil {
		return err
	}
	*chunks = append(*chunks, chunk)
	return nil
}

func ensureChunkLimitHasRoom(maxChunks, current int) error {
	if maxChunks > 0 && current+1 > maxChunks {
		return newMaxChunksResourceLimitError(maxChunks, current+1)
	}
	return nil
}

func newMaxChunksResourceLimitError(limit, observed int) error {
	return fmt.Errorf("document chunk limit exceeded: %w", document.NewResourceLimitError(
		document.ResourceLimitMaxFragmentsPerDocument,
		int64(limit),
		int64(observed),
		chunkLimitStageBuildFragments,
		"",
	))
}
