package document

import (
	"fmt"
	"maps"
	"strings"

	"magic/internal/domain/knowledge/shared"
)

const (
	// SyncFailureResolveThirdPlatform 表示第三方文档解析失败。
	SyncFailureResolveThirdPlatform = "resolve third-platform document failed"
	// SyncFailureDocumentFileEmpty 表示文档内容为空。
	SyncFailureDocumentFileEmpty = "document file is empty"
	// SyncFailureParsing 表示 URL 解析失败。
	SyncFailureParsing = "parsing failed"
	// SyncFailureSplitFragments 表示切片失败。
	SyncFailureSplitFragments = "split fragments failed"
	// SyncFailureIncrementalResync 表示增量重同步失败。
	SyncFailureIncrementalResync = "incremental resync failed"
	// SyncFailureSaveFragments 表示片段落库失败。
	SyncFailureSaveFragments = "save fragments failed"
	// SyncFailureSyncVector 表示向量同步失败。
	SyncFailureSyncVector = "sync vector failed"
)

// SourcePrecheckPlan 描述同步前源校验执行计划。
type SourcePrecheckPlan struct {
	SkipValidation bool
	ValidateURL    string
}

// SyncContentResult 描述内容解析链路输出。
type SyncContentResult struct {
	Parsed  *ParsedDocument
	Content string
}

// BuildSourcePrecheckPlan 构造同步前源校验计划。
func BuildSourcePrecheckPlan(
	doc *KnowledgeBaseDocument,
	override *SourceOverride,
	hasThirdPlatformResolver bool,
) (SourcePrecheckPlan, error) {
	decision := ResolveSourcePreflightPolicy(doc, override, hasThirdPlatformResolver)
	if decision.SkipValidation {
		return SourcePrecheckPlan{SkipValidation: true}, nil
	}
	if !decision.RequireURLSource {
		return SourcePrecheckPlan{}, nil
	}
	if !HasDocumentFileURL(doc) {
		return SourcePrecheckPlan{}, shared.ErrDocumentFileEmpty
	}
	return SourcePrecheckPlan{
		ValidateURL: strings.TrimSpace(doc.DocumentFile.URL),
	}, nil
}

// ApplySourceOverrideForSync 将 source override 应用到文档，并补齐扩展名。
func ApplySourceOverrideForSync(doc *KnowledgeBaseDocument, override *SourceOverride, detectedExtension string) bool {
	if doc == nil || override == nil {
		return false
	}
	changed := doc.ApplySourceOverride(override)
	return ApplyResolvedDocumentFileExtension(doc, detectedExtension) || changed
}

// ApplyResolvedDocumentFileExtension 根据检测结果回填文档扩展名。
func ApplyResolvedDocumentFileExtension(doc *KnowledgeBaseDocument, detectedExtension string) bool {
	if doc == nil || doc.DocumentFile == nil {
		return false
	}
	resolved := ResolveDocumentFileExtension(doc.DocumentFile, detectedExtension)
	if doc.DocumentFile.Extension == resolved {
		return false
	}
	doc.DocumentFile.Extension = resolved
	return true
}

// BuildSyncContentFromSourceOverride 基于 source override 构造同步内容结果。
func BuildSyncContentFromSourceOverride(doc *KnowledgeBaseDocument, override *SourceOverride) (SyncContentResult, error) {
	if override == nil {
		return SyncContentResult{}, shared.ErrDocumentFileEmpty
	}
	parsed, content := BuildParsedDocumentFromContent(doc, override.Content)
	if content == "" {
		return SyncContentResult{}, shared.ErrDocumentFileEmpty
	}
	return SyncContentResult{
		Parsed:  parsed,
		Content: content,
	}, nil
}

// BuildSyncContentFromParsedDocument 基于解析器结果构造同步内容结果。
func BuildSyncContentFromParsedDocument(parsed *ParsedDocument) (SyncContentResult, error) {
	if parsed == nil {
		return SyncContentResult{}, shared.ErrDocumentFileEmpty
	}
	normalized := NormalizeDocumentContent(parsed.BestEffortText())
	if normalized == "" {
		return SyncContentResult{}, shared.ErrDocumentFileEmpty
	}
	return SyncContentResult{
		Parsed:  parsed,
		Content: normalized,
	}, nil
}

// MergeParsedDocumentMeta 将解析得到的文档 metadata 合并回文档实体，保留已有业务 metadata。
func MergeParsedDocumentMeta(doc *KnowledgeBaseDocument, parsed *ParsedDocument) {
	if doc == nil || parsed == nil || len(parsed.DocumentMeta) == 0 {
		return
	}
	if doc.DocMetadata == nil {
		doc.DocMetadata = make(map[string]any, len(parsed.DocumentMeta))
	}
	maps.Copy(doc.DocMetadata, parsed.DocumentMeta)
}

// BuildSyncFailureMessage 构造标准同步失败文案。
func BuildSyncFailureMessage(reason string, err error) string {
	reason = strings.TrimSpace(reason)
	switch {
	case err == nil:
		return reason
	case reason == "":
		return err.Error()
	default:
		return fmt.Sprintf("%s: %v", reason, err)
	}
}

// CountSyncContentWordCount 计算同步完成后写回的标准字数。
func CountSyncContentWordCount(content string) int {
	return len([]rune(strings.TrimSpace(content)))
}
