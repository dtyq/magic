package fragdomain

import (
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
