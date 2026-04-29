package fragapp

const (
	fragmentMetadataExtKey                = "ext"
	fragmentMetadataContractVersionLegacy = "metadata_contract_version"
)

func sanitizeFragmentResponseMetadata(metadata map[string]any) map[string]any {
	return projectFragmentResponseMetadata(metadata, nil)
}

func sanitizeSimilarityResponseMetadata(metadata map[string]any, debug bool) map[string]any {
	if debug {
		return sanitizeFragmentResponseMetadata(metadata)
	}
	return projectFragmentResponseMetadata(metadata, []string{
		"url",
		"section_title",
		"section_path",
		"title",
		"heading",
		"hit_chunk",
		"word_count",
		"fragment_id",
		"business_id",
	})
}

func projectFragmentResponseMetadata(metadata map[string]any, whitelist []string) map[string]any {
	if len(metadata) == 0 {
		return map[string]any{}
	}

	if len(whitelist) > 0 {
		projected := make(map[string]any, min(len(metadata), len(whitelist)))
		for _, key := range whitelist {
			if key == fragmentMetadataExtKey || key == fragmentMetadataContractVersionLegacy {
				continue
			}
			value, ok := metadata[key]
			if !ok {
				continue
			}
			projected[key] = value
		}
		return projected
	}

	projected := make(map[string]any, len(metadata))
	for key, value := range metadata {
		if key == fragmentMetadataExtKey || key == fragmentMetadataContractVersionLegacy {
			continue
		}
		projected[key] = value
	}
	return projected
}
