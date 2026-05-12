package retrieval

func shouldSkipSectionPathDiversity(metadata map[string]any) bool {
	switch metadataStringValue(metadata, ParsedMetaChunkType) {
	case ParsedBlockTypeTableRow:
		return true
	default:
		return false
	}
}
