package document

import (
	"strings"

	"magic/internal/domain/knowledge/shared"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
)

// BuildDocumentForCreate 根据知识库上下文和领域输入构造新文档。
func BuildDocumentForCreate(
	kb *sharedsnapshot.KnowledgeBaseRuntimeSnapshot,
	effectiveModel string,
	input *CreateManagedDocumentInput,
) *KnowledgeBaseDocument {
	if input == nil {
		return nil
	}
	kb = sharedsnapshot.NormalizeKnowledgeBaseSnapshotConfigs(kb)

	doc := NewDocument(
		input.KnowledgeBaseCode,
		input.Name,
		"",
		DocType(input.DocType),
		input.UserID,
		input.OrganizationCode,
	)
	doc.Description = input.Description
	doc.DocMetadata = input.DocMetadata
	doc.SourceBindingID = input.SourceBindingID
	doc.SourceItemID = input.SourceItemID
	doc.ProjectID = input.ProjectID
	doc.ProjectFileID = input.ProjectFileID
	doc.AutoAdded = input.AutoAdded
	doc.ThirdPlatformType = input.ThirdPlatformType
	doc.ThirdFileID = input.ThirdFileID
	doc.EmbeddingModel = strings.TrimSpace(effectiveModel)
	doc.VectorDB = input.VectorDB
	doc.EmbeddingConfig = cloneEmbeddingConfig(input.EmbeddingConfig)
	doc.VectorDBConfig = cloneVectorDBConfig(input.VectorDBConfig)
	doc.DocumentFile = cloneFile(input.DocumentFile)

	if doc.VectorDB == "" && kb != nil {
		doc.VectorDB = kb.VectorDB
	}
	if doc.EmbeddingConfig == nil && kb != nil && kb.EmbeddingConfig != nil {
		doc.EmbeddingConfig = cloneEmbeddingConfig(kb.EmbeddingConfig)
	}
	if input.RetrieveConfig != nil {
		doc.RetrieveConfig = cloneRetrieveConfig(input.RetrieveConfig)
	} else if kb != nil && kb.RetrieveConfig != nil {
		doc.RetrieveConfig = cloneRetrieveConfig(kb.RetrieveConfig)
	}
	if input.FragmentConfig != nil {
		doc.FragmentConfig = cloneFragmentConfig(input.FragmentConfig)
	} else if kb != nil && kb.FragmentConfig != nil {
		doc.FragmentConfig = cloneFragmentConfig(kb.FragmentConfig)
	}

	return doc
}

func cloneFile(file *File) *File {
	if file == nil {
		return nil
	}
	cloned := *file
	return &cloned
}

func cloneRetrieveConfig(cfg *shared.RetrieveConfig) *shared.RetrieveConfig {
	if cfg == nil {
		return nil
	}
	cloned := *cfg
	return &cloned
}

func cloneEmbeddingConfig(cfg *shared.EmbeddingConfig) *shared.EmbeddingConfig {
	if cfg == nil {
		return nil
	}
	cloned := *cfg
	return &cloned
}

func cloneVectorDBConfig(cfg *shared.VectorDBConfig) *shared.VectorDBConfig {
	if cfg == nil {
		return nil
	}
	cloned := *cfg
	return &cloned
}
