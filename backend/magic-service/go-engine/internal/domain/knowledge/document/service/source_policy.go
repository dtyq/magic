package document

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"time"

	docentity "magic/internal/domain/knowledge/document/entity"
	parseddocument "magic/internal/domain/knowledge/shared/parseddocument"
	"magic/internal/pkg/filetype"
)

const docFileTypeThirdParty = "third_platform"

// SourcePreflightDecision 描述同步前的源校验策略。
type SourcePreflightDecision struct {
	SkipValidation   bool
	RequireURLSource bool
}

// ThirdPlatformRedirectDecision 描述重同步时是否改走第三方文件重向量化链路。
type ThirdPlatformRedirectDecision struct {
	Redirect          bool
	IncompleteBinding bool
	Input             *ThirdFileRevectorizeInput
}

// ContentPlan 描述文档内容解析链路的领域决策。
type ContentPlan struct {
	UseSourceOverride bool
	TryThirdPlatform  bool
	AllowURLParse     bool
}

// ThirdPlatformResolveRequest 描述第三方文档读取所需的稳定请求。
type ThirdPlatformResolveRequest struct {
	OrganizationCode              string
	UserID                        string
	ThirdPlatformUserID           string
	ThirdPlatformOrganizationCode string
	KnowledgeBaseCode             string
	ThirdPlatformType             string
	ThirdFileID                   string
	DocumentFile                  map[string]any
}

// NormalizeSourceOverride 规整同步时注入的源覆盖内容。
func NormalizeSourceOverride(override *SourceOverride, now time.Time) *SourceOverride {
	if override == nil {
		return nil
	}
	normalized := *override
	normalized.ParsedDocument = parseddocument.CloneParsedDocument(override.ParsedDocument)
	if normalized.ParsedDocument != nil {
		if result, err := BuildSyncContentFromParsedDocument(normalized.ParsedDocument); err == nil {
			normalized.Content = result.Content
		} else {
			normalized.Content = NormalizeDocumentContentForFileType(resolveSourceOverrideFileType(&normalized), normalized.Content)
		}
	} else {
		normalized.Content = NormalizeDocumentContentForFileType(resolveSourceOverrideFileType(&normalized), normalized.Content)
	}
	if normalized.Content != "" && normalized.ContentHash == "" {
		normalized.ContentHash = hashSourceContent(normalized.Content)
	}
	if normalized.FetchedAtUnixMilli == 0 {
		normalized.FetchedAtUnixMilli = now.UnixMilli()
	}
	return &normalized
}

// NormalizeDocumentContent 归一化文档正文内容。
func NormalizeDocumentContent(content string) string {
	return normalizeSourceContent(content)
}

// NormalizeDocumentContentForFileType 按文件类型归一化文档正文内容。
func NormalizeDocumentContentForFileType(fileType, content string) string {
	return normalizeSourceContent(DecodeLikelyEscapedMultilineDocumentContent(fileType, content))
}

// DecodeLikelyEscapedMultilineDocumentContent 按文件类型解码疑似被转义的多行文本。
func DecodeLikelyEscapedMultilineDocumentContent(fileType, content string) string {
	if !shouldDecodeLikelyEscapedMultilineDocumentContent(fileType) {
		return content
	}
	return decodeLikelyEscapedMultilineContent(content)
}

// ResolveDocumentSourceFileType 解析文档来源对应的标准文件类型。
func ResolveDocumentSourceFileType(doc *docentity.KnowledgeBaseDocument) string {
	if doc == nil || doc.DocumentFile == nil {
		return ""
	}
	return normalizeSourceFileType(doc.DocumentFile.Extension)
}

// HasDocumentFileURL 判断文档是否具备可解析的 URL 源。
func HasDocumentFileURL(doc *docentity.KnowledgeBaseDocument) bool {
	return doc != nil && doc.DocumentFile != nil && strings.TrimSpace(doc.DocumentFile.URL) != ""
}

// ResolveDocumentContentPlan 计算文档内容解析链路。
func ResolveDocumentContentPlan(
	doc *docentity.KnowledgeBaseDocument,
	override *SourceOverride,
	hasThirdPlatformResolver bool,
) ContentPlan {
	if override != nil {
		return ContentPlan{
			UseSourceOverride: true,
			AllowURLParse:     HasDocumentFileURL(doc),
		}
	}
	return ContentPlan{
		TryThirdPlatform: ShouldResolveThirdPlatformDocument(doc) && hasThirdPlatformResolver,
		AllowURLParse:    HasDocumentFileURL(doc),
	}
}

// BuildParsedDocumentFromContent 基于正文内容构造标准解析结果。
func BuildParsedDocumentFromContent(doc *docentity.KnowledgeBaseDocument, content string) (*parseddocument.ParsedDocument, string) {
	fileType := ResolveDocumentSourceFileType(doc)
	normalized := NormalizeDocumentContentForFileType(fileType, content)
	return parseddocument.NewPlainTextParsedDocument(fileType, normalized), normalized
}

// ShouldResolveThirdPlatformDocument 判断文档是否应走第三方解析链路。
func ShouldResolveThirdPlatformDocument(doc *docentity.KnowledgeBaseDocument) bool {
	if doc == nil {
		return false
	}
	if strings.TrimSpace(doc.ThirdFileID) != "" || strings.TrimSpace(doc.ThirdPlatformType) != "" {
		return true
	}
	if doc.DocumentFile == nil {
		return false
	}
	if strings.EqualFold(doc.DocumentFile.Type, docFileTypeThirdParty) {
		return true
	}
	return strings.TrimSpace(doc.DocumentFile.ThirdID) != ""
}

// BuildDocumentFilePayload 构造第三方解析使用的 document_file 载荷。
func BuildDocumentFilePayload(doc *docentity.KnowledgeBaseDocument) map[string]any {
	payload := map[string]any{
		"type": docFileTypeThirdParty,
	}
	if doc == nil {
		return payload
	}

	payload["third_id"] = doc.ThirdFileID
	payload["source_type"] = doc.ThirdPlatformType
	if doc.DocumentFile != nil {
		payload["type"] = doc.DocumentFile.Type
		payload["name"] = doc.DocumentFile.Name
		payload["url"] = doc.DocumentFile.URL
		payload["file_key"] = doc.DocumentFile.FileKey
		payload["size"] = doc.DocumentFile.Size
		payload["extension"] = doc.DocumentFile.Extension
		payload["third_id"] = doc.DocumentFile.ThirdID
		payload["source_type"] = doc.DocumentFile.SourceType
		if strings.TrimSpace(doc.DocumentFile.KnowledgeBaseID) != "" {
			payload["knowledge_base_id"] = doc.DocumentFile.KnowledgeBaseID
		}
	}
	if strings.TrimSpace(doc.ThirdFileID) != "" {
		payload["third_id"] = doc.ThirdFileID
		payload["third_file_id"] = doc.ThirdFileID
	}
	if strings.TrimSpace(doc.ThirdPlatformType) != "" {
		payload["source_type"] = doc.ThirdPlatformType
		payload["platform_type"] = doc.ThirdPlatformType
	}
	if stringValue(payload["type"]) == "" {
		payload["type"] = docFileTypeThirdParty
	}
	return payload
}

// ResolveThirdPlatformUserID 解析第三方读取链路应使用的用户 ID。
func ResolveThirdPlatformUserID(doc *docentity.KnowledgeBaseDocument, userID string) string {
	if strings.TrimSpace(userID) != "" {
		return strings.TrimSpace(userID)
	}
	if doc == nil {
		return ""
	}
	return ResolveMappedDocumentUserID(doc)
}

// BuildThirdPlatformResolveRequest 构造第三方文档读取请求。
func BuildThirdPlatformResolveRequest(
	doc *docentity.KnowledgeBaseDocument,
	userID string,
	thirdPlatformUserID string,
	thirdPlatformOrganizationCode string,
) ThirdPlatformResolveRequest {
	return ThirdPlatformResolveRequest{
		OrganizationCode:              strings.TrimSpace(doc.OrganizationCode),
		UserID:                        ResolveThirdPlatformUserID(doc, userID),
		ThirdPlatformUserID:           strings.TrimSpace(thirdPlatformUserID),
		ThirdPlatformOrganizationCode: strings.TrimSpace(thirdPlatformOrganizationCode),
		KnowledgeBaseCode:             strings.TrimSpace(doc.KnowledgeBaseCode),
		ThirdPlatformType:             strings.TrimSpace(doc.ThirdPlatformType),
		ThirdFileID:                   strings.TrimSpace(doc.ThirdFileID),
		DocumentFile:                  BuildDocumentFilePayload(doc),
	}
}

// ApplyResolvedDocumentResult 将外部解析结果回填到文档实体。
func ApplyResolvedDocumentResult(doc *docentity.KnowledgeBaseDocument, docType int, file map[string]any) {
	if doc == nil {
		return
	}
	if doc.DocumentFile == nil {
		doc.DocumentFile = &docentity.File{}
	}
	// 外部解析返回的是主表精确 doc_type，可能包含企业扩展值 1001/1002；
	// 这里只负责回填文档自身类型，不能据此反推 knowledge_base_type 或 source_type。
	if docType > 0 {
		doc.DocType = docType
	}
	if len(file) == 0 {
		return
	}

	if value := strings.TrimSpace(stringValue(file["type"])); value != "" {
		doc.DocumentFile.Type = value
	}
	if value := strings.TrimSpace(stringValue(file["name"])); value != "" {
		doc.DocumentFile.Name = value
	}
	if value, ok := file["url"].(string); ok {
		doc.DocumentFile.URL = value
	}
	if value := firstNonEmptyString(
		strings.TrimSpace(stringValue(file["file_key"])),
		strings.TrimSpace(stringValue(file["key"])),
	); value != "" {
		doc.DocumentFile.FileKey = value
	}
	if value := strings.TrimSpace(stringValue(file["extension"])); value != "" {
		doc.DocumentFile.Extension = value
	}
	if size := toInt64(file["size"]); size > 0 {
		doc.DocumentFile.Size = size
	}
	if value := strings.TrimSpace(stringValue(file["knowledge_base_id"])); value != "" {
		doc.DocumentFile.KnowledgeBaseID = value
	}
	if value := firstNonEmptyString(
		strings.TrimSpace(stringValue(file["third_file_type"])),
		strings.TrimSpace(stringValue(file["teamshare_file_type"])),
		strings.TrimSpace(stringValue(file["file_type"])),
	); value != "" {
		doc.DocumentFile.ThirdFileType = value
	}

	thirdID := firstNonEmptyString(
		strings.TrimSpace(stringValue(file["third_id"])),
		strings.TrimSpace(stringValue(file["third_file_id"])),
		doc.DocumentFile.ThirdID,
		doc.ThirdFileID,
	)
	doc.DocumentFile.ThirdID = thirdID
	doc.ThirdFileID = thirdID

	platformType := firstNonEmptyString(
		strings.TrimSpace(stringValue(file["source_type"])),
		strings.TrimSpace(stringValue(file["platform_type"])),
		doc.DocumentFile.SourceType,
		doc.ThirdPlatformType,
	)
	doc.DocumentFile.SourceType = platformType
	doc.ThirdPlatformType = platformType
}

// ApplySourceOverride 将源覆盖内容回填到文档并返回是否发生变化。
func ApplySourceOverride(doc *docentity.KnowledgeBaseDocument, override *SourceOverride) bool {
	if doc == nil || override == nil {
		return false
	}

	beforeType := doc.DocType
	beforePlatform := doc.ThirdPlatformType
	beforeFileID := doc.ThirdFileID
	beforeFile := cloneDocumentFile(doc.DocumentFile)

	if override.DocType > 0 {
		doc.DocType = override.DocType
	}
	if len(override.DocumentFile) > 0 {
		ApplyResolvedDocumentResult(doc, override.DocType, override.DocumentFile)
	}
	if doc.DocumentFile == nil {
		doc.DocumentFile = &docentity.File{}
	}

	return beforeType != doc.DocType ||
		beforePlatform != doc.ThirdPlatformType ||
		beforeFileID != doc.ThirdFileID ||
		!sameDocumentFile(beforeFile, doc.DocumentFile)
}

// ResolveSourcePreflightPolicy 计算同步前是否需要源校验。
func ResolveSourcePreflightPolicy(
	doc *docentity.KnowledgeBaseDocument,
	override *SourceOverride,
	hasThirdPlatformResolver bool,
) SourcePreflightDecision {
	if override != nil && strings.TrimSpace(override.Content) != "" {
		return SourcePreflightDecision{SkipValidation: true}
	}
	if ShouldResolveThirdPlatformDocument(doc) && hasThirdPlatformResolver {
		return SourcePreflightDecision{SkipValidation: true}
	}
	return SourcePreflightDecision{RequireURLSource: true}
}

// ResolveThirdPlatformRedirect 计算 resync 是否应重定向到第三方文件重向量化链路。
func ResolveThirdPlatformRedirect(
	doc *docentity.KnowledgeBaseDocument,
	mode string,
	hasSourceOverride bool,
	organizationCode string,
	userID string,
) ThirdPlatformRedirectDecision {
	if ResolveSyncMode(mode) != SyncModeResync || doc == nil || hasSourceOverride {
		return ThirdPlatformRedirectDecision{}
	}

	thirdPlatformType := strings.ToLower(strings.TrimSpace(doc.ThirdPlatformType))
	thirdFileID := strings.TrimSpace(doc.ThirdFileID)
	if thirdPlatformType == "" && thirdFileID == "" {
		return ThirdPlatformRedirectDecision{}
	}
	if thirdPlatformType == "" || thirdFileID == "" {
		return ThirdPlatformRedirectDecision{IncompleteBinding: true}
	}

	if mappedUserID := ResolveMappedDocumentUserID(doc); mappedUserID != "" {
		userID = mappedUserID
	}
	if strings.TrimSpace(organizationCode) == "" {
		organizationCode = strings.TrimSpace(doc.OrganizationCode)
	}

	return ThirdPlatformRedirectDecision{
		Redirect: true,
		Input: &ThirdFileRevectorizeInput{
			OrganizationCode:  strings.TrimSpace(organizationCode),
			UserID:            strings.TrimSpace(userID),
			ThirdPlatformType: thirdPlatformType,
			ThirdFileID:       thirdFileID,
		},
	}
}

// ResolveDocumentFileExtension 根据已有字段、轻量推断和远端识别结果计算最终扩展名。
func ResolveDocumentFileExtension(file *docentity.File, detected string) string {
	if file == nil {
		return ""
	}
	if normalized := filetype.NormalizeExtension(file.Extension); normalized != "" {
		return normalized
	}
	if inferred := inferDocumentFileExtension(file); inferred != "" {
		return inferred
	}
	return filetype.NormalizeExtension(detected)
}

func normalizeSourceFileType(sourceFileType string) string {
	normalized := strings.ToLower(strings.TrimSpace(sourceFileType))
	normalized = strings.TrimPrefix(normalized, ".")
	switch normalized {
	case "markdown":
		return "md"
	default:
		return normalized
	}
}

func normalizeSourceContent(content string) string {
	content = strings.ReplaceAll(content, "\r\n", "\n")
	content = strings.ReplaceAll(content, "\r", "\n")
	lines := strings.Split(content, "\n")
	result := make([]string, 0, len(lines))
	emptyCount := 0
	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			emptyCount++
			if emptyCount > 1 {
				continue
			}
		} else {
			emptyCount = 0
		}
		result = append(result, line)
	}
	return strings.Join(result, "\n")
}

func shouldDecodeLikelyEscapedMultilineDocumentContent(fileType string) bool {
	switch normalizeSourceFileType(fileType) {
	case "md", "txt":
		return true
	default:
		return false
	}
}

func decodeLikelyEscapedMultilineContent(content string) string {
	if content == "" || strings.Contains(content, "\n") || strings.Contains(content, "\r") {
		return content
	}

	escapedBreakCount := strings.Count(content, `\n`) + strings.Count(content, `\r`)
	if escapedBreakCount < 2 {
		return content
	}

	decoded := strings.ReplaceAll(content, `\r\n`, "\n")
	decoded = strings.ReplaceAll(decoded, `\n`, "\n")
	decoded = strings.ReplaceAll(decoded, `\r`, "\n")
	decoded = strings.ReplaceAll(decoded, `\t`, "\t")
	if !strings.Contains(decoded, "\n") {
		return content
	}
	return decoded
}

func resolveSourceOverrideFileType(override *SourceOverride) string {
	if override == nil || len(override.DocumentFile) == 0 {
		return ""
	}
	file, ok := FileFromPayload(override.DocumentFile)
	if !ok || file == nil {
		return ""
	}
	return ResolveDocumentFileExtension(file, "")
}

func inferDocumentFileExtension(file *docentity.File) string {
	if file == nil {
		return ""
	}
	if ext := filetype.ExtractExtension(file.Name); ext != "" {
		return ext
	}
	if ext := filetype.ExtractExtension(file.URL); ext != "" {
		return ext
	}
	if ext := filetype.ExtractExtension(file.FileKey); ext != "" {
		return ext
	}
	return ""
}

func hashSourceContent(content string) string {
	sum := sha256.Sum256([]byte(content))
	return hex.EncodeToString(sum[:])
}

func stringValue(value any) string {
	if text, ok := value.(string); ok {
		return text
	}
	return ""
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func toInt64(value any) int64 {
	switch typed := value.(type) {
	case int64:
		return typed
	case int:
		return int64(typed)
	case float64:
		return int64(typed)
	default:
		return 0
	}
}

func cloneDocumentFile(file *docentity.File) *docentity.File {
	if file == nil {
		return nil
	}
	cloned := *file
	return &cloned
}

func sameDocumentFile(left, right *docentity.File) bool {
	switch {
	case left == nil && right == nil:
		return true
	case left == nil || right == nil:
		return false
	default:
		return *left == *right
	}
}
