package document

import (
	"crypto/sha256"
	"encoding/hex"
	"path/filepath"
	"strings"

	"magic/internal/domain/knowledge/shared"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
)

const (
	repairDocumentCodePrefix     = "DOCUMENT-"
	repairDocumentCodeHashLength = 22
)

// ThirdFileRepairGroup 描述第三方文件映射修复分组输入。
type ThirdFileRepairGroup struct {
	KnowledgeCode string
	ThirdFileID   string
	DocumentCode  string
	DocumentName  string
	PreviewURL    string
	CreatedUID    string
	UpdatedUID    string
}

// ResolveThirdFileRepairDocumentName 解析修复文档名称。
func ResolveThirdFileRepairDocumentName(group ThirdFileRepairGroup) string {
	if name := strings.TrimSpace(group.DocumentName); name != "" {
		return name
	}
	if name := parseMarkdownLinkTitle(group.PreviewURL); name != "" {
		return name
	}
	return strings.TrimSpace(group.ThirdFileID)
}

// BuildStableThirdFileRepairDocumentCode 生成稳定文档编码。
func BuildStableThirdFileRepairDocumentCode(knowledgeCode, thirdFileID string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(knowledgeCode) + ":" + strings.TrimSpace(thirdFileID)))
	encoded := strings.ToUpper(hex.EncodeToString(sum[:]))
	if len(encoded) > repairDocumentCodeHashLength {
		encoded = encoded[:repairDocumentCodeHashLength]
	}
	return repairDocumentCodePrefix + encoded
}

// InferRepairDocumentType 推断修复链路文档类型。
func InferRepairDocumentType(name string) DocType {
	if inferRepairExtension(name) != "" {
		return DocTypeFile
	}
	return DocTypeText
}

// EnsureThirdFileRepairDocumentFields 对齐修复链路的文档字段。
func EnsureThirdFileRepairDocumentFields(
	doc *KnowledgeBaseDocument,
	kb *sharedsnapshot.KnowledgeBaseRuntimeSnapshot,
	platformType string,
	group ThirdFileRepairGroup,
) bool {
	kb = sharedsnapshot.NormalizeKnowledgeBaseSnapshotConfigs(kb)
	if doc == nil || kb == nil {
		return false
	}
	documentName := ResolveThirdFileRepairDocumentName(group)
	changed := false
	if strings.TrimSpace(doc.Name) != strings.TrimSpace(documentName) {
		doc.Name = strings.TrimSpace(documentName)
		changed = true
	}
	if doc.KnowledgeBaseCode != strings.TrimSpace(kb.Code) {
		doc.KnowledgeBaseCode = strings.TrimSpace(kb.Code)
		changed = true
	}
	if doc.OrganizationCode != strings.TrimSpace(kb.OrganizationCode) {
		doc.OrganizationCode = strings.TrimSpace(kb.OrganizationCode)
		changed = true
	}
	if doc.CreatedUID == "" {
		doc.CreatedUID = firstNonEmptyString(group.CreatedUID, kb.UpdatedUID, kb.CreatedUID)
		changed = true
	}
	if updatedUID := firstNonEmptyString(group.UpdatedUID, doc.CreatedUID); doc.UpdatedUID != updatedUID {
		doc.UpdatedUID = updatedUID
		changed = true
	}
	if doc.SyncStatus != shared.SyncStatusSynced {
		doc.SyncStatus = shared.SyncStatusSynced
		changed = true
	}
	if doc.EmbeddingModel != kb.Model {
		doc.EmbeddingModel = kb.Model
		changed = true
	}
	if doc.VectorDB != kb.VectorDB {
		doc.VectorDB = kb.VectorDB
		changed = true
	}
	if doc.RetrieveConfig != kb.RetrieveConfig {
		doc.RetrieveConfig = kb.RetrieveConfig
		changed = true
	}
	if doc.FragmentConfig != kb.FragmentConfig {
		doc.FragmentConfig = kb.FragmentConfig
		changed = true
	}
	if doc.EmbeddingConfig != kb.EmbeddingConfig {
		doc.EmbeddingConfig = kb.EmbeddingConfig
		changed = true
	}
	if ensureThirdPlatformRepairFields(doc, platformType, group.ThirdFileID, documentName) {
		changed = true
	}
	if doc.DocType <= 0 {
		doc.DocType = int(InferRepairDocumentType(documentName))
		changed = true
	}
	return changed
}

// BuildThirdFileRepairDocument 构造修复链路的新文档。
func BuildThirdFileRepairDocument(
	kb *sharedsnapshot.KnowledgeBaseRuntimeSnapshot,
	platformType string,
	group ThirdFileRepairGroup,
) *KnowledgeBaseDocument {
	kb = sharedsnapshot.NormalizeKnowledgeBaseSnapshotConfigs(kb)
	if kb == nil {
		return nil
	}
	documentName := ResolveThirdFileRepairDocumentName(group)
	createdUID := firstNonEmptyString(group.CreatedUID, kb.UpdatedUID, kb.CreatedUID)
	doc := NewDocument(
		strings.TrimSpace(kb.Code),
		documentName,
		firstNonEmptyString(strings.TrimSpace(group.DocumentCode), BuildStableThirdFileRepairDocumentCode(kb.Code, group.ThirdFileID)),
		InferRepairDocumentType(documentName),
		createdUID,
		strings.TrimSpace(kb.OrganizationCode),
	)
	doc.UpdatedUID = firstNonEmptyString(group.UpdatedUID, createdUID)
	doc.SyncStatus = shared.SyncStatusSynced
	doc.EmbeddingModel = kb.Model
	doc.VectorDB = kb.VectorDB
	doc.RetrieveConfig = kb.RetrieveConfig
	doc.FragmentConfig = kb.FragmentConfig
	doc.EmbeddingConfig = kb.EmbeddingConfig
	doc.WordCount = 0
	_ = EnsureThirdFileRepairDocumentFields(doc, kb, platformType, group)
	return doc
}

func ensureThirdPlatformRepairFields(doc *KnowledgeBaseDocument, platformType, thirdFileID, documentName string) bool {
	if doc == nil {
		return false
	}
	changed := false
	platformType = strings.TrimSpace(platformType)
	thirdFileID = strings.TrimSpace(thirdFileID)
	if doc.ThirdPlatformType != platformType {
		doc.ThirdPlatformType = platformType
		changed = true
	}
	if doc.ThirdFileID != thirdFileID {
		doc.ThirdFileID = thirdFileID
		changed = true
	}
	if doc.DocumentFile == nil {
		doc.DocumentFile = &File{}
	}
	if doc.DocumentFile.Type != "third_platform" {
		doc.DocumentFile.Type = "third_platform"
		changed = true
	}
	if doc.DocumentFile.Name != documentName {
		doc.DocumentFile.Name = documentName
		changed = true
	}
	if doc.DocumentFile.ThirdID != thirdFileID {
		doc.DocumentFile.ThirdID = thirdFileID
		changed = true
	}
	if doc.DocumentFile.SourceType != platformType {
		doc.DocumentFile.SourceType = platformType
		changed = true
	}
	if ext := inferRepairExtension(documentName); ext != "" && doc.DocumentFile.Extension != ext {
		doc.DocumentFile.Extension = ext
		changed = true
	}
	return changed
}

func inferRepairExtension(name string) string {
	return strings.TrimSpace(strings.ToLower(strings.TrimPrefix(filepath.Ext(strings.TrimSpace(name)), ".")))
}

func parseMarkdownLinkTitle(v string) string {
	raw := strings.TrimSpace(v)
	if raw == "" || raw[0] != '[' {
		return ""
	}
	end := strings.Index(raw, "](")
	if end <= 1 {
		return ""
	}
	return strings.TrimSpace(raw[1:end])
}
