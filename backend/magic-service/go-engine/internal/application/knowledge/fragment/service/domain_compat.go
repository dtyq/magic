package fragapp

import (
	"maps"

	docentity "magic/internal/domain/knowledge/document/entity"
	documentsplitter "magic/internal/domain/knowledge/document/splitter"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	fragdomain "magic/internal/domain/knowledge/fragment/service"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	"magic/internal/domain/knowledge/shared"
	sharedroute "magic/internal/domain/knowledge/shared/route"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
)

func knowledgeBaseSnapshotFromDomain(kb *kbentity.KnowledgeBase) *sharedsnapshot.KnowledgeBaseRuntimeSnapshot {
	if kb == nil {
		return nil
	}

	snapshot := &sharedsnapshot.KnowledgeBaseRuntimeSnapshot{
		Code:             kb.Code,
		Name:             kb.Name,
		OrganizationCode: kb.OrganizationCode,
		Model:            kb.Model,
		VectorDB:         kb.VectorDB,
		CreatedUID:       kb.CreatedUID,
		UpdatedUID:       kb.UpdatedUID,
		RetrieveConfig:   shared.CloneRetrieveConfig(kb.RetrieveConfig),
		FragmentConfig:   shared.CloneFragmentConfig(kb.FragmentConfig),
		EmbeddingConfig:  shared.CloneEmbeddingConfig(kb.EmbeddingConfig),
		ResolvedRoute:    sharedroute.CloneResolvedRoute(kb.ResolvedRoute),
	}
	return sharedsnapshot.NormalizeKnowledgeBaseSnapshotConfigs(snapshot)
}

func fragDocumentFileFromDomain(file *docentity.File) *fragmodel.DocumentFile {
	if file == nil {
		return nil
	}
	return &fragmodel.DocumentFile{
		Type:            file.Type,
		Name:            file.Name,
		URL:             file.URL,
		FileKey:         file.FileKey,
		Size:            file.Size,
		Extension:       file.Extension,
		ThirdID:         file.ThirdID,
		SourceType:      file.SourceType,
		ThirdFileType:   file.ThirdFileType,
		KnowledgeBaseID: file.KnowledgeBaseID,
	}
}

func domainDocumentFileFromFrag(file *fragmodel.DocumentFile) *docentity.File {
	if file == nil {
		return nil
	}
	return &docentity.File{
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

func fragDocumentFromDomain(doc *docentity.KnowledgeBaseDocument) *fragmodel.KnowledgeBaseDocument {
	if doc == nil {
		return nil
	}
	return &fragmodel.KnowledgeBaseDocument{
		KnowledgeDocumentSnapshot: sharedsnapshot.KnowledgeDocumentSnapshot{
			OrganizationCode:  doc.OrganizationCode,
			KnowledgeBaseCode: doc.KnowledgeBaseCode,
			Name:              doc.Name,
			Code:              doc.Code,
			DocType:           doc.DocType,
			DocMetadata:       cloneDocumentMetadata(doc.DocMetadata),
			FragmentConfig:    shared.CloneFragmentConfig(doc.FragmentConfig),
			UpdatedUID:        doc.UpdatedUID,
		},
		DocumentFile:      fragDocumentFileFromDomain(doc.DocumentFile),
		ThirdPlatformType: doc.ThirdPlatformType,
		ThirdFileID:       doc.ThirdFileID,
		SyncStatus:        doc.SyncStatus,
		EmbeddingModel:    doc.EmbeddingModel,
		VectorDB:          doc.VectorDB,
		RetrieveConfig:    shared.CloneRetrieveConfig(doc.RetrieveConfig),
		EmbeddingConfig:   shared.CloneEmbeddingConfig(doc.EmbeddingConfig),
		WordCount:         doc.WordCount,
		CreatedUID:        doc.CreatedUID,
		CreatedAt:         doc.CreatedAt,
		UpdatedAt:         doc.UpdatedAt,
	}
}

func domainDocumentFromFrag(doc *fragmodel.KnowledgeBaseDocument) *docentity.KnowledgeBaseDocument {
	if doc == nil {
		return nil
	}
	return &docentity.KnowledgeBaseDocument{
		OrganizationCode:  doc.OrganizationCode,
		KnowledgeBaseCode: doc.KnowledgeBaseCode,
		Name:              doc.Name,
		Code:              doc.Code,
		DocType:           doc.DocType,
		DocMetadata:       cloneDocumentMetadata(doc.DocMetadata),
		DocumentFile:      domainDocumentFileFromFrag(doc.DocumentFile),
		ThirdPlatformType: doc.ThirdPlatformType,
		ThirdFileID:       doc.ThirdFileID,
		SyncStatus:        doc.SyncStatus,
		EmbeddingModel:    doc.EmbeddingModel,
		VectorDB:          doc.VectorDB,
		RetrieveConfig:    shared.CloneRetrieveConfig(doc.RetrieveConfig),
		FragmentConfig:    shared.CloneFragmentConfig(doc.FragmentConfig),
		EmbeddingConfig:   shared.CloneEmbeddingConfig(doc.EmbeddingConfig),
		WordCount:         doc.WordCount,
		CreatedUID:        doc.CreatedUID,
		UpdatedUID:        doc.UpdatedUID,
		CreatedAt:         doc.CreatedAt,
		UpdatedAt:         doc.UpdatedAt,
	}
}

func cloneDocumentMetadata(metadata map[string]any) map[string]any {
	if len(metadata) == 0 {
		return nil
	}
	return maps.Clone(metadata)
}

func previewSegmentConfigToSplitter(cfg fragdomain.PreviewSegmentConfig) documentsplitter.PreviewSegmentConfig {
	return documentsplitter.PreviewSegmentConfig{
		ChunkSize:          cfg.ChunkSize,
		ChunkOverlap:       cfg.ChunkOverlap,
		Separator:          cfg.Separator,
		TextPreprocessRule: append([]int(nil), cfg.TextPreprocessRule...),
	}
}
