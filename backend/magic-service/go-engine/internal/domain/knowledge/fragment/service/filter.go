package fragdomain

import (
	"strings"

	"magic/internal/constants"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
)

func buildDocumentFilter(organizationCode, knowledgeCode, documentCode string) *fragmodel.VectorFilter {
	filter := &fragmodel.VectorFilter{
		Must: []fragmodel.FieldFilter{
			{
				Key: constants.KnowledgeCodeField,
				Match: fragmodel.Match{
					EqString: &knowledgeCode,
				},
			},
			{
				Key: constants.DocumentCodeField,
				Match: fragmodel.Match{
					EqString: &documentCode,
				},
			},
		},
	}
	if organizationCode != "" {
		orgCode := organizationCode
		filter.Must = append(filter.Must, fragmodel.FieldFilter{
			Key: constants.OrganizationCodeField,
			Match: fragmodel.Match{
				EqString: &orgCode,
			},
		})
	}
	return filter
}

func buildDocumentsFilter(organizationCode, knowledgeCode string, documentCodes []string) *fragmodel.VectorFilter {
	normalizedCodes := make([]string, 0, len(documentCodes))
	seen := make(map[string]struct{}, len(documentCodes))
	for _, code := range documentCodes {
		trimmed := strings.TrimSpace(code)
		if trimmed == "" {
			continue
		}
		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		normalizedCodes = append(normalizedCodes, trimmed)
	}
	if len(normalizedCodes) == 0 {
		return nil
	}

	filter := &fragmodel.VectorFilter{
		Must: []fragmodel.FieldFilter{
			{
				Key: constants.KnowledgeCodeField,
				Match: fragmodel.Match{
					EqString: &knowledgeCode,
				},
			},
			{
				Key: constants.DocumentCodeField,
				Match: fragmodel.Match{
					InStrings: normalizedCodes,
				},
			},
		},
	}
	if organizationCode != "" {
		orgCode := organizationCode
		filter.Must = append(filter.Must, fragmodel.FieldFilter{
			Key: constants.OrganizationCodeField,
			Match: fragmodel.Match{
				EqString: &orgCode,
			},
		})
	}
	return filter
}
