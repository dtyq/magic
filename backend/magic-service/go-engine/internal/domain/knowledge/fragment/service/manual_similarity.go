package fragdomain

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"

	fragmetadata "magic/internal/domain/knowledge/fragment/metadata"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	fragretrieval "magic/internal/domain/knowledge/fragment/retrieval"
	"magic/internal/domain/knowledge/shared"
	"magic/internal/pkg/ctxmeta"
)

const (
	manualFragmentSplitVersion     = "manual_v1"
	defaultSimilarityTopK          = 10
	defaultCandidateScoreThreshold = 0.1
	defaultResultScoreThreshold    = 0.25
)

// ManualFragmentInput 描述手工片段建模输入。
type ManualFragmentInput struct {
	KnowledgeCode    string
	DocumentCode     string
	Content          string
	Metadata         map[string]any
	BusinessID       string
	UserID           string
	OrganizationCode string
}

// SimilarityRequestInput 描述检索策略输入。
type SimilarityRequestInput struct {
	Query          string
	TopK           int
	ScoreThreshold float64
	BusinessParams *ctxmeta.BusinessParams
	Options        *fragretrieval.SimilaritySearchOptions
}

// BuildManualDocument 构造手工片段所属文档。
func BuildManualDocument(kb any, input ManualFragmentInput) *KnowledgeBaseDocument {
	kbSnapshot := snapshotKnowledgeBase(kb)
	doc := NewDocument(
		input.KnowledgeCode,
		input.DocumentCode,
		input.DocumentCode,
		1,
		input.UserID,
		input.OrganizationCode,
	)
	doc.SyncStatus = shared.SyncStatusSynced
	doc.EmbeddingModel = resolveKnowledgeBaseEmbeddingModel(kb)
	doc.VectorDB = kbSnapshot.VectorDB
	doc.RetrieveConfig = kbSnapshot.RetrieveConfig
	doc.FragmentConfig = kbSnapshot.FragmentConfig
	doc.EmbeddingConfig = kbSnapshot.EmbeddingConfig
	doc.DocMetadata = map[string]any{}
	doc.WordCount = 0
	return doc
}

// BuildManualFragment 构造手工新增片段。
func BuildManualFragment(doc *KnowledgeBaseDocument, input ManualFragmentInput) *fragmodel.KnowledgeBaseFragment {
	fragment := fragmodel.NewFragment(
		input.KnowledgeCode,
		doc.Code,
		input.Content,
		input.Metadata,
		input.UserID,
	)
	fragment.BusinessID = strings.TrimSpace(input.BusinessID)
	fragment.OrganizationCode = doc.OrganizationCode
	fragment.DocumentName = doc.Name
	fragment.DocumentType = doc.DocType
	fragment.ContentHash = hashText(fragment.Content)
	fragment.SplitVersion = manualFragmentSplitVersion
	fragment.Metadata = fragmetadata.BuildFragmentSemanticMetadataV1(fragment.Metadata, fragmetadata.FragmentSemanticMetadataDefaults{
		ChunkIndex:           fragment.ChunkIndex,
		ContentHash:          fragment.ContentHash,
		SplitVersion:         fragment.SplitVersion,
		RetrievalTextVersion: fragretrieval.RetrievalTextVersionV1,
		SectionPath:          fragment.SectionPath,
		SectionTitle:         fragment.SectionTitle,
		SectionLevel:         fragment.SectionLevel,
		CreatedAtTS:          fragment.CreatedAt.Unix(),
		DocumentCode:         fragment.DocumentCode,
		DocumentType:         fragment.DocumentType,
		Tags:                 nil,
	}, map[string]any{
		"organization_code": fragment.OrganizationCode,
		"document_name":     fragment.DocumentName,
	})
	return fragment
}

// BuildSimilarityRequest 根据知识库配置构建检索请求。
func BuildSimilarityRequest(kb any, input SimilarityRequestInput) fragretrieval.SimilarityRequest {
	kbSnapshot := snapshotKnowledgeBase(kb)
	resultThreshold := 0.0
	switch {
	case input.ScoreThreshold > 0:
		resultThreshold = input.ScoreThreshold
	case kbSnapshot.RetrieveConfig != nil && kbSnapshot.RetrieveConfig.ScoreThresholdEnabled && kbSnapshot.RetrieveConfig.ScoreThreshold > 0:
		resultThreshold = kbSnapshot.RetrieveConfig.ScoreThreshold
	}

	topK := defaultSimilarityTopK
	switch {
	case input.TopK > 0:
		topK = input.TopK
	case kbSnapshot.RetrieveConfig != nil && kbSnapshot.RetrieveConfig.TopK > 0:
		topK = kbSnapshot.RetrieveConfig.TopK
	}
	resultThreshold = max(defaultResultScoreThreshold, resultThreshold)

	return fragretrieval.SimilarityRequest{
		Query:                   input.Query,
		TopK:                    max(defaultSimilarityTopK, topK),
		CandidateScoreThreshold: defaultCandidateScoreThreshold,
		ResultScoreThreshold:    resultThreshold,
		BusinessParams:          input.BusinessParams,
		Options:                 input.Options,
	}
}

func hashText(text string) string {
	sum := sha256.Sum256([]byte(text))
	return hex.EncodeToString(sum[:])
}
