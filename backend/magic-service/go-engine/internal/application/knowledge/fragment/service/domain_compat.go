package fragapp

import (
	documentdomain "magic/internal/domain/knowledge/document/service"
	documentsplitter "magic/internal/domain/knowledge/document/splitter"
	fragdomain "magic/internal/domain/knowledge/fragment/service"
)

func fragDocumentFileFromDomain(file *documentdomain.File) *fragdomain.File {
	if file == nil {
		return nil
	}
	return &fragdomain.File{
		Type:            file.Type,
		Name:            file.Name,
		URL:             file.URL,
		FileKey:         file.FileKey,
		Size:            file.Size,
		Extension:       file.Extension,
		ThirdID:         file.ThirdID,
		SourceType:      file.SourceType,
		KnowledgeBaseID: file.KnowledgeBaseID,
	}
}

func domainDocumentFileFromFrag(file *fragdomain.File) *documentdomain.File {
	if file == nil {
		return nil
	}
	return &documentdomain.File{
		Type:            file.Type,
		Name:            file.Name,
		URL:             file.URL,
		FileKey:         file.FileKey,
		Size:            file.Size,
		Extension:       file.Extension,
		ThirdID:         file.ThirdID,
		SourceType:      file.SourceType,
		KnowledgeBaseID: file.KnowledgeBaseID,
	}
}

func fragDocumentFromDomain(doc *documentdomain.KnowledgeBaseDocument) *fragdomain.KnowledgeBaseDocument {
	if doc == nil {
		return nil
	}
	return &fragdomain.KnowledgeBaseDocument{
		OrganizationCode:  doc.OrganizationCode,
		KnowledgeBaseCode: doc.KnowledgeBaseCode,
		Name:              doc.Name,
		Code:              doc.Code,
		DocType:           doc.DocType,
		DocMetadata:       doc.DocMetadata,
		DocumentFile:      fragDocumentFileFromDomain(doc.DocumentFile),
		ThirdPlatformType: doc.ThirdPlatformType,
		ThirdFileID:       doc.ThirdFileID,
		SyncStatus:        doc.SyncStatus,
		EmbeddingModel:    doc.EmbeddingModel,
		VectorDB:          doc.VectorDB,
		RetrieveConfig:    doc.RetrieveConfig,
		FragmentConfig:    doc.FragmentConfig,
		EmbeddingConfig:   doc.EmbeddingConfig,
		WordCount:         doc.WordCount,
		CreatedUID:        doc.CreatedUID,
		UpdatedUID:        doc.UpdatedUID,
		CreatedAt:         doc.CreatedAt,
		UpdatedAt:         doc.UpdatedAt,
	}
}

func domainDocumentFromFrag(doc *fragdomain.KnowledgeBaseDocument) *documentdomain.KnowledgeBaseDocument {
	if doc == nil {
		return nil
	}
	return &documentdomain.KnowledgeBaseDocument{
		OrganizationCode:  doc.OrganizationCode,
		KnowledgeBaseCode: doc.KnowledgeBaseCode,
		Name:              doc.Name,
		Code:              doc.Code,
		DocType:           doc.DocType,
		DocMetadata:       doc.DocMetadata,
		DocumentFile:      domainDocumentFileFromFrag(doc.DocumentFile),
		ThirdPlatformType: doc.ThirdPlatformType,
		ThirdFileID:       doc.ThirdFileID,
		SyncStatus:        doc.SyncStatus,
		EmbeddingModel:    doc.EmbeddingModel,
		VectorDB:          doc.VectorDB,
		RetrieveConfig:    doc.RetrieveConfig,
		FragmentConfig:    doc.FragmentConfig,
		EmbeddingConfig:   doc.EmbeddingConfig,
		WordCount:         doc.WordCount,
		CreatedUID:        doc.CreatedUID,
		UpdatedUID:        doc.UpdatedUID,
		CreatedAt:         doc.CreatedAt,
		UpdatedAt:         doc.UpdatedAt,
	}
}

func previewSegmentConfigToSplitter(cfg fragdomain.PreviewSegmentConfig) documentsplitter.PreviewSegmentConfig {
	return documentsplitter.PreviewSegmentConfig{
		ChunkSize:          cfg.ChunkSize,
		ChunkOverlap:       cfg.ChunkOverlap,
		Separator:          cfg.Separator,
		TextPreprocessRule: append([]int(nil), cfg.TextPreprocessRule...),
	}
}
