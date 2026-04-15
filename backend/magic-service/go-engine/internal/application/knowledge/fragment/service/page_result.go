package fragapp

import (
	fragdto "magic/internal/application/knowledge/fragment/dto"
	fragdomain "magic/internal/domain/knowledge/fragment/service"
)

const fragmentResponseVersion = 1

func buildListItemFromFragmentDTO(fragment *fragdto.FragmentDTO) *fragdto.FragmentListItemDTO {
	if fragment == nil {
		return nil
	}
	metadata := fragment.Metadata
	if metadata == nil {
		metadata = map[string]any{}
	}
	return &fragdto.FragmentListItemDTO{
		ID:                fragment.ID,
		KnowledgeBaseCode: fragment.KnowledgeCode,
		KnowledgeCode:     fragment.KnowledgeCode,
		OrganizationCode:  fragment.OrganizationCode,
		Creator:           fragment.Creator,
		Modifier:          fragment.Modifier,
		CreatedUID:        fragment.CreatedUID,
		UpdatedUID:        fragment.UpdatedUID,
		DocumentCode:      fragment.DocumentCode,
		BusinessID:        fragment.BusinessID,
		DocumentName:      fragment.DocumentName,
		DocumentType:      fragment.DocumentType,
		DocType:           fragment.DocumentType,
		Content:           fragment.Content,
		Metadata:          metadata,
		SyncStatus:        fragment.SyncStatus,
		SyncStatusMessage: fragment.SyncStatusMessage,
		Score:             0,
		WordCount:         fragment.WordCount,
		PointID:           fragment.PointID,
		CreatedAt:         fragment.CreatedAt,
		UpdatedAt:         fragment.UpdatedAt,
		Version:           fragmentResponseVersion,
	}
}

func buildDocumentNodeDTOs(documentTitle string, sources []fragdomain.DocumentNodeSource) []fragdto.DocumentNodeDTO {
	nodes := fragdomain.BuildDocumentNodes(documentTitle, sources)
	result := make([]fragdto.DocumentNodeDTO, 0, len(nodes))
	for _, node := range nodes {
		result = append(result, fragdto.DocumentNodeDTO{
			ID:       node.ID,
			Parent:   node.Parent,
			Children: append([]int{}, node.Children...),
			Text:     node.Text,
			Level:    node.Level,
			Type:     node.Type,
		})
	}
	return result
}
