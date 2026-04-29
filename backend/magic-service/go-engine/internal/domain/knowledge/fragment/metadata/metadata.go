// Package metadata 定义片段 metadata contract、展示文本与 payload 投影逻辑。
package metadata

import (
	"cmp"
	"encoding/json"
	"maps"
	"math"
	"slices"
	"strconv"
	"strings"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
)

const (
	// MetadataFallbackFlagsKey 表示 metadata 回填标记字段名。
	MetadataFallbackFlagsKey = "fallback_flags"
	metadataExtKey           = "ext"
)

const (
	manualSplitVersionV1    = "manual_v1"
	retrievalTextVersionV1  = "v1"
	organizationCodeKey     = "organization_code"
	documentNameKey         = "document_name"
	documentTypeKey         = "document_type"
	documentCodeKey         = "document_code"
	sectionPathKey          = "section_path"
	sectionTitleKey         = "section_title"
	sectionLevelKey         = "section_level"
	createdAtTSKey          = "created_at_ts"
	chunkIndexKey           = "chunk_index"
	contentHashKey          = "content_hash"
	splitVersionKey         = "split_version"
	retrievalTextVersionKey = "retrieval_text_version"
	tagsKey                 = "tags"
	fragmentFallbackFlagCap = 8
	payloadFallbackFlagCap  = 6
	contextSectionPathKey   = "context_section_path"
)

// FragmentSemanticMetadata 定义片段语义 metadata 的标准结构。
type FragmentSemanticMetadata struct {
	ChunkIndex           int      `json:"chunk_index"`
	ContentHash          string   `json:"content_hash"`
	SplitVersion         string   `json:"split_version"`
	RetrievalTextVersion string   `json:"retrieval_text_version"`
	SectionPath          string   `json:"section_path"`
	SectionTitle         string   `json:"section_title"`
	SectionLevel         int      `json:"section_level"`
	CreatedAtTS          int64    `json:"created_at_ts"`
	DocumentCode         string   `json:"document_code"`
	DocumentType         int      `json:"document_type"`
	Tags                 []string `json:"tags,omitempty"`
}

// FragmentSemanticMetadataDefaults 定义 metadata 契约补齐时的默认值。
type FragmentSemanticMetadataDefaults struct {
	ChunkIndex           int
	ContentHash          string
	SplitVersion         string
	RetrievalTextVersion string
	SectionPath          string
	SectionTitle         string
	SectionLevel         int
	CreatedAtTS          int64
	DocumentCode         string
	DocumentType         int
	Tags                 []string
}

// FragmentMetadataRestoreResult 表示 metadata 规范化与回填结果。
type FragmentMetadataRestoreResult struct {
	FallbackFlags []string
	Metadata      map[string]any
	Semantic      FragmentSemanticMetadata
}

// BuildFragmentSemanticMetadata 构建并规范化片段 metadata。
func BuildFragmentSemanticMetadata(
	base map[string]any,
	defaults FragmentSemanticMetadataDefaults,
	extra map[string]any,
) map[string]any {
	merged := cloneMetadataMap(base)
	if len(extra) > 0 {
		maps.Copy(merged, extra)
	}
	return NormalizeFragmentSemanticMetadata(merged, defaults).Metadata
}

// NormalizeFragmentSemanticMetadata 将原始 metadata 规范化为标准结构。
func NormalizeFragmentSemanticMetadata(
	raw map[string]any,
	defaults FragmentSemanticMetadataDefaults,
) FragmentMetadataRestoreResult {
	source := cloneMetadataMap(raw)
	ext := metadataNestedMap(source, metadataExtKey)
	semantic := FragmentSemanticMetadata{
		ChunkIndex:           cmp.Or(metadataIntValue(source, ext, chunkIndexKey), defaults.ChunkIndex),
		ContentHash:          cmp.Or(metadataStringValue(source, ext, contentHashKey), strings.TrimSpace(defaults.ContentHash)),
		SplitVersion:         cmp.Or(metadataStringValue(source, ext, splitVersionKey), firstNonEmptyString(defaults.SplitVersion, manualSplitVersionV1)),
		RetrievalTextVersion: cmp.Or(metadataStringValue(source, ext, retrievalTextVersionKey), firstNonEmptyString(defaults.RetrievalTextVersion, retrievalTextVersionV1)),
		SectionPath:          cmp.Or(metadataStringValue(source, ext, sectionPathKey), strings.TrimSpace(defaults.SectionPath)),
		SectionTitle:         cmp.Or(metadataStringValue(source, ext, sectionTitleKey), strings.TrimSpace(defaults.SectionTitle)),
		SectionLevel:         cmp.Or(metadataIntValue(source, ext, sectionLevelKey), defaults.SectionLevel),
		CreatedAtTS:          cmp.Or(metadataInt64Value(source, ext, createdAtTSKey), defaults.CreatedAtTS),
		DocumentCode:         cmp.Or(metadataStringValue(source, ext, documentCodeKey), strings.TrimSpace(defaults.DocumentCode)),
		DocumentType:         cmp.Or(metadataIntValue(source, ext, documentTypeKey), defaults.DocumentType),
		Tags:                 normalizeStringList(firstNonEmptyStringList(metadataStringListValue(source, ext, tagsKey), defaults.Tags)),
	}

	normalized := cloneMetadataMap(source)
	delete(normalized, metadataExtKey)
	for _, key := range metadataAliasKeys() {
		for _, alias := range metadataAliasesFor(key) {
			delete(normalized, alias)
		}
	}
	delete(normalized, "metadata_contract_version")
	delete(normalized, MetadataFallbackFlagsKey)

	normalized[chunkIndexKey] = semantic.ChunkIndex
	normalized[contentHashKey] = semantic.ContentHash
	normalized[splitVersionKey] = semantic.SplitVersion
	normalized[retrievalTextVersionKey] = semantic.RetrievalTextVersion
	normalized[sectionPathKey] = semantic.SectionPath
	normalized[sectionTitleKey] = semantic.SectionTitle
	normalized[sectionLevelKey] = semantic.SectionLevel
	normalized[createdAtTSKey] = semantic.CreatedAtTS
	normalized[documentCodeKey] = semantic.DocumentCode
	normalized[documentTypeKey] = semantic.DocumentType
	if len(semantic.Tags) > 0 {
		normalized[tagsKey] = semantic.Tags
	} else {
		delete(normalized, tagsKey)
	}

	for key, value := range ext {
		if _, ok := normalized[key]; ok {
			continue
		}
		normalized[key] = value
	}

	return FragmentMetadataRestoreResult{
		Metadata: normalized,
		Semantic: semantic,
	}
}

// BuildFragmentPayloadMetadata 将存库 metadata 投影为向量 payload metadata。
func BuildFragmentPayloadMetadata(metadata map[string]any, fallbackFlags []string) map[string]any {
	normalized := NormalizeFragmentSemanticMetadata(metadata, FragmentSemanticMetadataDefaults{})
	payloadMetadata := map[string]any{
		sectionLevelKey: normalized.Semantic.SectionLevel,
		createdAtTSKey:  normalized.Semantic.CreatedAtTS,
	}
	if len(normalized.Semantic.Tags) > 0 {
		payloadMetadata[tagsKey] = normalized.Semantic.Tags
	}
	if len(fallbackFlags) > 0 {
		payloadMetadata[MetadataFallbackFlagsKey] = fallbackFlags
	}

	ext := make(map[string]any)
	for key, value := range normalized.Metadata {
		if isPayloadMetadataFilterableKey(key) {
			continue
		}
		if isPayloadMetadataDuplicateKey(key) {
			continue
		}
		if key == MetadataFallbackFlagsKey {
			continue
		}
		ext[key] = value
	}
	if len(ext) > 0 {
		payloadMetadata[metadataExtKey] = ext
	}
	return payloadMetadata
}

// ApplyFragmentMetadataContract 对片段实体执行 metadata 规范化与字段回填。
func ApplyFragmentMetadataContract(fragment *fragmodel.KnowledgeBaseFragment) FragmentMetadataRestoreResult {
	if fragment == nil {
		return FragmentMetadataRestoreResult{
			Metadata: map[string]any{},
		}
	}

	restore := NormalizeFragmentSemanticMetadata(fragment.Metadata, FragmentSemanticMetadataDefaults{
		ChunkIndex:           fragment.ChunkIndex,
		ContentHash:          strings.TrimSpace(fragment.ContentHash),
		SplitVersion:         strings.TrimSpace(fragment.SplitVersion),
		RetrievalTextVersion: metadataStringValue(fragment.Metadata, nil, retrievalTextVersionKey),
		SectionPath:          strings.TrimSpace(fragment.SectionPath),
		SectionTitle:         strings.TrimSpace(fragment.SectionTitle),
		SectionLevel:         fragment.SectionLevel,
		CreatedAtTS:          fragment.CreatedAt.Unix(),
		DocumentCode:         strings.TrimSpace(fragment.DocumentCode),
		DocumentType:         fragment.DocumentType,
		Tags:                 metadataStringListValue(fragment.Metadata, nil, tagsKey),
	})

	restore.FallbackFlags = applyFragmentMetadataFallbacks(fragment, restore)
	restore.Metadata = cloneMetadataMap(restore.Metadata)
	if len(restore.FallbackFlags) > 0 {
		restore.Metadata[MetadataFallbackFlagsKey] = restore.FallbackFlags
	} else {
		delete(restore.Metadata, MetadataFallbackFlagsKey)
	}
	fragment.Metadata = restore.Metadata
	fragment.FallbackFlags = restore.FallbackFlags

	return restore
}

// BuildFragmentPayload 将片段实体投影为向量存储 payload。
func BuildFragmentPayload(fragment *fragmodel.KnowledgeBaseFragment) *fragmodel.FragmentPayload {
	if fragment == nil {
		return nil
	}

	restore := ApplyFragmentMetadataContract(fragment)
	return &fragmodel.FragmentPayload{
		OrganizationCode: fragment.OrganizationCode,
		KnowledgeCode:    fragment.KnowledgeCode,
		DocumentCode:     fragment.DocumentCode,
		DocumentName:     fragment.DocumentName,
		DocumentType:     fragment.DocumentType,
		FragmentID:       fragment.ID,
		BusinessID:       fragment.BusinessID,
		Content:          fragment.Content,
		Metadata:         BuildFragmentPayloadMetadata(restore.Metadata, restore.FallbackFlags),
		WordCount:        fragment.WordCount,
		ChunkIndex:       fragment.ChunkIndex,
		ContentHash:      fragment.ContentHash,
		SplitVersion:     fragment.SplitVersion,
		SectionPath:      fragment.SectionPath,
		SectionTitle:     fragment.SectionTitle,
	}
}

// ApplyPayloadMetadataContract 使用 payload metadata 回填缺失的热字段。
func ApplyPayloadMetadataContract(payload *fragmodel.FragmentPayload) []string {
	if payload == nil {
		return nil
	}

	restore := NormalizeFragmentSemanticMetadata(payload.Metadata, FragmentSemanticMetadataDefaults{
		ChunkIndex:   payload.ChunkIndex,
		ContentHash:  payload.ContentHash,
		SplitVersion: payload.SplitVersion,
		SectionPath:  payload.SectionPath,
		DocumentCode: payload.DocumentCode,
		DocumentType: payload.DocumentType,
	})

	fallbackFlags := make([]string, 0, payloadFallbackFlagCap)
	if payload.DocumentCode == "" && restore.Semantic.DocumentCode != "" {
		payload.DocumentCode = restore.Semantic.DocumentCode
		fallbackFlags = append(fallbackFlags, documentCodeKey+"_from_metadata")
	}
	if payload.DocumentType == 0 && restore.Semantic.DocumentType != 0 {
		payload.DocumentType = restore.Semantic.DocumentType
		fallbackFlags = append(fallbackFlags, documentTypeKey+"_from_metadata")
	}
	if payload.SectionPath == "" && restore.Semantic.SectionPath != "" {
		payload.SectionPath = restore.Semantic.SectionPath
		fallbackFlags = append(fallbackFlags, sectionPathKey+"_from_metadata")
	}
	if payload.SectionTitle == "" && restore.Semantic.SectionTitle != "" {
		payload.SectionTitle = restore.Semantic.SectionTitle
		fallbackFlags = append(fallbackFlags, sectionTitleKey+"_from_metadata")
	}
	if payload.ContentHash == "" && restore.Semantic.ContentHash != "" {
		payload.ContentHash = restore.Semantic.ContentHash
		fallbackFlags = append(fallbackFlags, contentHashKey+"_from_metadata")
	}
	if payload.SplitVersion == "" && restore.Semantic.SplitVersion != "" {
		payload.SplitVersion = restore.Semantic.SplitVersion
		fallbackFlags = append(fallbackFlags, splitVersionKey+"_from_metadata")
	}
	if payload.ChunkIndex == 0 && metadataHasValue(payload.Metadata, chunkIndexKey) {
		payload.ChunkIndex = restore.Semantic.ChunkIndex
		fallbackFlags = append(fallbackFlags, chunkIndexKey+"_from_metadata")
	}

	payload.Metadata = BuildFragmentPayloadMetadata(restore.Metadata, uniqueStringList(fallbackFlags))
	return uniqueStringList(fallbackFlags)
}

// ResolveFragmentDisplaySection 统一解析片段展示所需的章节路径与标题。
func ResolveFragmentDisplaySection(metadata map[string]any, explicitPath, explicitTitle string) (string, string) {
	sectionPath := strings.TrimSpace(displayMetadataStringValue(metadata, contextSectionPathKey))
	if sectionPath == "" {
		sectionPath = strings.TrimSpace(explicitPath)
	}
	if sectionPath == "" {
		sectionPath = strings.TrimSpace(displayMetadataStringValue(metadata, sectionPathKey))
	}

	sectionTitle := strings.TrimSpace(explicitTitle)
	if sectionTitle == "" {
		sectionTitle = strings.TrimSpace(displayMetadataStringValue(metadata, sectionTitleKey))
	}

	return sectionPath, sectionTitle
}

// BuildFragmentDisplayContent 统一构建片段展示文本。
func BuildFragmentDisplayContent(content string, metadata map[string]any, explicitPath, explicitTitle string) string {
	sectionPath, sectionTitle := ResolveFragmentDisplaySection(metadata, explicitPath, explicitTitle)
	return formatFragmentDisplayContent(content, sectionPath, sectionTitle)
}

// CloneMetadata 返回 metadata 的浅拷贝。
func CloneMetadata(metadata map[string]any) map[string]any {
	if len(metadata) == 0 {
		return map[string]any{}
	}
	return maps.Clone(metadata)
}

func formatFragmentDisplayContent(content, sectionPath, sectionTitle string) string {
	trimmedContent := strings.TrimSpace(content)
	displayParts := make([]string, 0, 3)

	trimmedPath := strings.TrimSpace(sectionPath)
	if trimmedPath != "" {
		displayParts = append(displayParts, trimmedPath)
	}

	trimmedTitle := strings.TrimSpace(sectionTitle)
	if trimmedTitle != "" && !strings.Contains(trimmedPath, trimmedTitle) {
		displayParts = append(displayParts, trimmedTitle)
	}

	if trimmedContent != "" {
		displayParts = append(displayParts, trimmedContent)
	}

	if len(displayParts) == 0 {
		return ""
	}
	return strings.Join(displayParts, "\n\n")
}

func displayMetadataStringValue(metadata map[string]any, key string) string {
	if len(metadata) == 0 {
		return ""
	}
	value, ok := metadata[key].(string)
	if !ok {
		return ""
	}
	return value
}

func applyFragmentMetadataFallbacks(fragment *fragmodel.KnowledgeBaseFragment, restore FragmentMetadataRestoreResult) []string {
	if fragment == nil {
		return nil
	}

	fallbackFlags := make([]string, 0, fragmentFallbackFlagCap)
	appendFallbackString(&fallbackFlags, &fragment.OrganizationCode, metadataStringValue(fragment.Metadata, nil, organizationCodeKey), organizationCodeKey)
	appendFallbackString(&fallbackFlags, &fragment.DocumentName, metadataStringValue(fragment.Metadata, nil, documentNameKey), documentNameKey)
	appendFallbackString(&fallbackFlags, &fragment.DocumentCode, restore.Semantic.DocumentCode, documentCodeKey)
	appendFallbackInt(&fallbackFlags, &fragment.DocumentType, restore.Semantic.DocumentType, documentTypeKey)
	appendFallbackString(&fallbackFlags, &fragment.SectionPath, restore.Semantic.SectionPath, sectionPathKey)
	appendFallbackString(&fallbackFlags, &fragment.SectionTitle, restore.Semantic.SectionTitle, sectionTitleKey)
	appendFallbackInt(&fallbackFlags, &fragment.SectionLevel, restore.Semantic.SectionLevel, sectionLevelKey)
	appendFallbackString(&fallbackFlags, &fragment.ContentHash, restore.Semantic.ContentHash, contentHashKey)
	appendFallbackString(&fallbackFlags, &fragment.SplitVersion, restore.Semantic.SplitVersion, splitVersionKey)
	if fragment.ChunkIndex == 0 && metadataHasValue(fragment.Metadata, chunkIndexKey) {
		fragment.ChunkIndex = restore.Semantic.ChunkIndex
		fallbackFlags = append(fallbackFlags, chunkIndexKey+"_from_metadata")
	}

	return uniqueStringList(fallbackFlags)
}

func appendFallbackString(fallbackFlags *[]string, target *string, candidate, key string) {
	if target == nil || *target != "" || candidate == "" {
		return
	}
	*target = candidate
	*fallbackFlags = append(*fallbackFlags, key+"_from_metadata")
}

func appendFallbackInt(fallbackFlags *[]string, target *int, candidate int, key string) {
	if target == nil || *target != 0 || candidate == 0 {
		return
	}
	*target = candidate
	*fallbackFlags = append(*fallbackFlags, key+"_from_metadata")
}

func metadataNestedMap(source map[string]any, key string) map[string]any {
	if len(source) == 0 {
		return nil
	}
	raw, ok := source[key]
	if !ok || raw == nil {
		return nil
	}
	switch value := raw.(type) {
	case map[string]any:
		return value
	case []byte:
		var decoded map[string]any
		if err := json.Unmarshal(value, &decoded); err == nil {
			return decoded
		}
	case string:
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			return nil
		}
		var decoded map[string]any
		if err := json.Unmarshal([]byte(trimmed), &decoded); err == nil {
			return decoded
		}
	}
	return nil
}

func metadataHasValue(source map[string]any, key string) bool {
	if len(source) == 0 {
		return false
	}
	if _, ok := source[key]; ok {
		return true
	}
	for _, alias := range metadataAliasesFor(key) {
		if _, ok := source[alias]; ok {
			return true
		}
	}
	ext := metadataNestedMap(source, metadataExtKey)
	if len(ext) == 0 {
		return false
	}
	if _, ok := ext[key]; ok {
		return true
	}
	for _, alias := range metadataAliasesFor(key) {
		if _, ok := ext[alias]; ok {
			return true
		}
	}
	return false
}

func metadataStringValue(source, ext map[string]any, key string) string {
	if value, ok := metadataStringFromMap(source, key); ok {
		return value
	}
	for _, alias := range metadataAliasesFor(key) {
		if value, ok := metadataStringFromMap(source, alias); ok {
			return value
		}
	}
	if value, ok := metadataStringFromMap(ext, key); ok {
		return value
	}
	for _, alias := range metadataAliasesFor(key) {
		if value, ok := metadataStringFromMap(ext, alias); ok {
			return value
		}
	}
	return ""
}

func metadataStringFromMap(source map[string]any, key string) (string, bool) {
	if len(source) == 0 {
		return "", false
	}
	raw, ok := source[key]
	if !ok || raw == nil {
		return "", false
	}
	switch value := raw.(type) {
	case string:
		trimmed := strings.TrimSpace(value)
		return trimmed, trimmed != ""
	case json.Number:
		return value.String(), true
	}
	return "", false
}

func metadataIntValue(source, ext map[string]any, key string) int {
	if value, ok := metadataInt64FromMaps(source, ext, key); ok {
		return int(value)
	}
	return 0
}

func metadataInt64Value(source, ext map[string]any, key string) int64 {
	if value, ok := metadataInt64FromMaps(source, ext, key); ok {
		return value
	}
	return 0
}

func metadataInt64FromMaps(source, ext map[string]any, key string) (int64, bool) {
	if value, ok := metadataInt64FromMap(source, key); ok {
		return value, true
	}
	for _, alias := range metadataAliasesFor(key) {
		if value, ok := metadataInt64FromMap(source, alias); ok {
			return value, true
		}
	}
	if value, ok := metadataInt64FromMap(ext, key); ok {
		return value, true
	}
	for _, alias := range metadataAliasesFor(key) {
		if value, ok := metadataInt64FromMap(ext, alias); ok {
			return value, true
		}
	}
	return 0, false
}

func metadataInt64FromMap(source map[string]any, key string) (int64, bool) {
	if len(source) == 0 {
		return 0, false
	}
	raw, ok := source[key]
	if !ok || raw == nil {
		return 0, false
	}
	if value, ok := signedMetadataInt64(raw); ok {
		return value, true
	}
	if value, ok := unsignedMetadataInt64(raw); ok {
		return value, true
	}
	switch value := raw.(type) {
	case float32:
		return int64(value), true
	case float64:
		return int64(value), true
	case json.Number:
		if parsed, err := value.Int64(); err == nil {
			return parsed, true
		}
	case string:
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			return 0, false
		}
		parsed, err := strconv.ParseInt(trimmed, 10, 64)
		if err == nil {
			return parsed, true
		}
	}
	return 0, false
}

func metadataStringListValue(source, ext map[string]any, key string) []string {
	if values := metadataStringListFromMap(source, key); len(values) > 0 {
		return values
	}
	for _, alias := range metadataAliasesFor(key) {
		if values := metadataStringListFromMap(source, alias); len(values) > 0 {
			return values
		}
	}
	if values := metadataStringListFromMap(ext, key); len(values) > 0 {
		return values
	}
	for _, alias := range metadataAliasesFor(key) {
		if values := metadataStringListFromMap(ext, alias); len(values) > 0 {
			return values
		}
	}
	return nil
}

func metadataStringListFromMap(source map[string]any, key string) []string {
	if len(source) == 0 {
		return nil
	}
	raw, ok := source[key]
	if !ok || raw == nil {
		return nil
	}
	switch value := raw.(type) {
	case []string:
		return normalizeStringList(value)
	case []any:
		values := make([]string, 0, len(value))
		for _, item := range value {
			if text, ok := item.(string); ok {
				values = append(values, text)
			}
		}
		return normalizeStringList(values)
	case string:
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			return nil
		}
		return []string{trimmed}
	}
	return nil
}

func normalizeStringList(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	return uniqueStringList(values)
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func firstNonEmptyStringList(values ...[]string) []string {
	for _, value := range values {
		if len(value) > 0 {
			return value
		}
	}
	return nil
}

func uniqueStringList(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		result = append(result, trimmed)
	}
	slices.Sort(result)
	return result
}

func metadataAliasKeys() []string {
	return []string{
		chunkIndexKey,
		contentHashKey,
		splitVersionKey,
		retrievalTextVersionKey,
		sectionPathKey,
		sectionTitleKey,
		sectionLevelKey,
		createdAtTSKey,
		documentCodeKey,
		documentTypeKey,
		tagsKey,
		organizationCodeKey,
		documentNameKey,
	}
}

func metadataAliasesFor(key string) []string {
	switch key {
	case chunkIndexKey:
		return []string{"chunkIndex"}
	case contentHashKey:
		return []string{"contentHash"}
	case splitVersionKey:
		return []string{"splitVersion"}
	case retrievalTextVersionKey:
		return []string{"retrievalTextVersion"}
	case sectionPathKey:
		return []string{"sectionPath"}
	case sectionTitleKey:
		return []string{"sectionTitle"}
	case sectionLevelKey:
		return []string{"sectionLevel"}
	case createdAtTSKey:
		return []string{"createdAtTs"}
	case documentCodeKey:
		return []string{"documentCode"}
	case documentTypeKey:
		return []string{"documentType"}
	case tagsKey:
		return []string{"tag_list", "tagList"}
	case organizationCodeKey:
		return []string{"organizationCode"}
	case documentNameKey:
		return []string{"documentName"}
	default:
		return nil
	}
}

func isPayloadMetadataFilterableKey(key string) bool {
	switch key {
	case sectionLevelKey, createdAtTSKey, tagsKey:
		return true
	default:
		return false
	}
}

func isPayloadMetadataDuplicateKey(key string) bool {
	switch key {
	case organizationCodeKey, "knowledge_code", documentCodeKey, documentNameKey, documentTypeKey, chunkIndexKey, contentHashKey, sectionPathKey, "word_count", "content":
		return true
	default:
		return false
	}
}

func signedMetadataInt64(raw any) (int64, bool) {
	switch value := raw.(type) {
	case int:
		return int64(value), true
	case int8:
		return int64(value), true
	case int16:
		return int64(value), true
	case int32:
		return int64(value), true
	case int64:
		return value, true
	default:
		return 0, false
	}
}

func unsignedMetadataInt64(raw any) (int64, bool) {
	switch value := raw.(type) {
	case uint:
		return safeUint64ToInt64(uint64(value))
	case uint8:
		return int64(value), true
	case uint16:
		return int64(value), true
	case uint32:
		return int64(value), true
	case uint64:
		return safeUint64ToInt64(value)
	default:
		return 0, false
	}
}

func safeUint64ToInt64(value uint64) (int64, bool) {
	if value > math.MaxInt64 {
		return 0, false
	}
	return int64(value), true
}

func cloneMetadataMap(metadata map[string]any) map[string]any {
	if len(metadata) == 0 {
		return make(map[string]any)
	}
	return maps.Clone(metadata)
}
