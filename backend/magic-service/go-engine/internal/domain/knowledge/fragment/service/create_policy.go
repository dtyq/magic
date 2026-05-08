package fragdomain

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
	"magic/internal/domain/knowledge/shared"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
)

// CreateFragmentDocumentStrategy 描述创建片段时文档解析策略。
type CreateFragmentDocumentStrategy string

const (
	legacyDocumentCodePrefix     = "DOCUMENT-"
	legacyDocumentCodeHashLength = 22

	// CreateFragmentDocumentByCode 表示按显式 document code 查找或兜底创建。
	CreateFragmentDocumentByCode CreateFragmentDocumentStrategy = "by_code"
	// CreateFragmentDocumentByLegacyThirdFile 表示按历史第三方 file_id 兼容处理。
	CreateFragmentDocumentByLegacyThirdFile CreateFragmentDocumentStrategy = "legacy_third_file"
)

// CreateFragmentDocumentPlan 描述片段创建前的文档解析计划。
type CreateFragmentDocumentPlan struct {
	Strategy          CreateFragmentDocumentStrategy
	DocumentCode      string
	ManualFallbackDoc *fragmodel.KnowledgeBaseDocument
	ThirdPlatformType string
	ThirdFileID       string
}

// CreateFragmentDocumentPlanInput 描述创建片段时的文档解析输入。
type CreateFragmentDocumentPlanInput struct {
	KnowledgeBase    *sharedsnapshot.KnowledgeBaseRuntimeSnapshot
	KnowledgeCode    string
	DocumentCode     string
	Metadata         map[string]any
	UserID           string
	OrganizationCode string
}

// LegacyThirdPlatformDocumentSpec 描述历史第三方片段兼容文档的领域构造输入。
type LegacyThirdPlatformDocumentSpec struct {
	Name              string
	DocType           int
	DocumentFile      *fragmodel.DocumentFile
	ThirdPlatformType string
	ThirdFileID       string
	UserID            string
	OrganizationCode  string
}

// ResolveCreateFragmentDocumentPlan 解析片段创建时的文档目标策略。
func ResolveCreateFragmentDocumentPlan(input CreateFragmentDocumentPlanInput) (CreateFragmentDocumentPlan, error) {
	documentCode := strings.TrimSpace(input.DocumentCode)
	if documentCode != "" {
		return CreateFragmentDocumentPlan{
			Strategy:     CreateFragmentDocumentByCode,
			DocumentCode: documentCode,
			ManualFallbackDoc: BuildManualDocument(input.KnowledgeBase, ManualFragmentInput{
				KnowledgeCode:    strings.TrimSpace(input.KnowledgeCode),
				DocumentCode:     documentCode,
				UserID:           strings.TrimSpace(input.UserID),
				OrganizationCode: strings.TrimSpace(input.OrganizationCode),
			}),
		}, nil
	}

	thirdFileID := ResolveLegacyThirdPlatformFileID(input.Metadata)
	if thirdFileID == "" {
		return CreateFragmentDocumentPlan{}, shared.ErrFragmentDocumentCodeRequired
	}

	return CreateFragmentDocumentPlan{
		Strategy:          CreateFragmentDocumentByLegacyThirdFile,
		ThirdPlatformType: ResolveLegacyThirdPlatformType(input.Metadata),
		ThirdFileID:       thirdFileID,
	}, nil
}

// ResolveLegacyThirdPlatformFileID 解析历史兼容链路里的第三方文件 ID。
func ResolveLegacyThirdPlatformFileID(metadata map[string]any) string {
	return strings.TrimSpace(stringValue(metadata["file_id"]))
}

// ResolveLegacyThirdPlatformType 解析历史兼容链路里的平台类型。
func ResolveLegacyThirdPlatformType(metadata map[string]any) string {
	return strings.ToLower(strings.TrimSpace(firstNonEmptyString(
		stringValue(metadata["third_platform_type"]),
		stringValue(metadata["platform_type"]),
		stringValue(metadata["source_type"]),
		"teamshare",
	)))
}

// BuildLegacyThirdPlatformDocument 根据 provider 结果构造历史兼容文档。
func BuildLegacyThirdPlatformDocument(
	kb *sharedsnapshot.KnowledgeBaseRuntimeSnapshot,
	spec LegacyThirdPlatformDocumentSpec,
) *fragmodel.KnowledgeBaseDocument {
	kbSnapshot := fragmodel.SnapshotKnowledgeBase(kb)
	doc := fragmodel.NewDocument(
		kbSnapshot.Code,
		strings.TrimSpace(spec.Name),
		BuildLegacyThirdPlatformDocumentCode(kbSnapshot.Code, spec.ThirdPlatformType, spec.ThirdFileID),
		spec.DocType,
		strings.TrimSpace(spec.UserID),
		strings.TrimSpace(spec.OrganizationCode),
	)
	doc.SyncStatus = shared.SyncStatusSynced
	doc.EmbeddingModel = fragmodel.ResolveKnowledgeBaseEmbeddingModel(kb)
	doc.ThirdPlatformType = strings.TrimSpace(spec.ThirdPlatformType)
	doc.ThirdFileID = strings.TrimSpace(spec.ThirdFileID)
	if spec.DocumentFile != nil {
		cloned := *spec.DocumentFile
		doc.DocumentFile = &cloned
	}
	doc.VectorDB = kbSnapshot.VectorDB
	doc.RetrieveConfig = kbSnapshot.RetrieveConfig
	doc.FragmentConfig = kbSnapshot.FragmentConfig
	doc.EmbeddingConfig = kbSnapshot.EmbeddingConfig
	return doc
}

// BuildLegacyThirdPlatformDocumentCode 构造历史第三方片段兼容文档 code。
func BuildLegacyThirdPlatformDocumentCode(knowledgeCode, platformType, thirdFileID string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(knowledgeCode) + ":" + strings.TrimSpace(platformType) + ":" + strings.TrimSpace(thirdFileID)))
	encoded := strings.ToUpper(hex.EncodeToString(sum[:]))
	if len(encoded) > legacyDocumentCodeHashLength {
		encoded = encoded[:legacyDocumentCodeHashLength]
	}
	return legacyDocumentCodePrefix + encoded
}

func stringValue(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}
