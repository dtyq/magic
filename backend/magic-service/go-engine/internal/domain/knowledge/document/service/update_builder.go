package document

import (
	docentity "magic/internal/domain/knowledge/document/entity"
	"magic/internal/domain/knowledge/shared"
)

// UpdateDocumentInput 表示应用层更新文档时传给领域的最小输入。
type UpdateDocumentInput struct {
	Name           string
	Description    string
	Enabled        *bool
	DocType        *int
	DocMetadata    map[string]any
	DocumentFile   *docentity.File
	RetrieveConfig *shared.RetrieveConfig
	FragmentConfig *shared.FragmentConfig
	WordCount      *int
	UpdatedUID     string
}

// BuildUpdatePatch 根据领域输入构造可应用的文档补丁。
func BuildUpdatePatch(input *UpdateDocumentInput) docentity.UpdatePatch {
	if input == nil {
		return docentity.UpdatePatch{}
	}

	return docentity.UpdatePatch{
		Name:           optionalNonEmptyString(input.Name),
		Description:    optionalNonEmptyString(input.Description),
		Enabled:        input.Enabled,
		DocType:        input.DocType,
		DocMetadata:    input.DocMetadata,
		DocumentFile:   cloneFile(input.DocumentFile),
		RetrieveConfig: cloneRetrieveConfig(input.RetrieveConfig),
		FragmentConfig: cloneFragmentConfig(input.FragmentConfig),
		WordCount:      input.WordCount,
		UpdatedUID:     input.UpdatedUID,
	}
}

func optionalNonEmptyString(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}
