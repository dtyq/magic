package fragdomain

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
	"magic/internal/domain/knowledge/shared"
	"magic/internal/pkg/filetype"
)

const (
	previewDocumentFileTypeThirdPlatform = "third_platform"
	previewDocumentFileTypeExternal      = "external"

	previewDefaultChunkSize    = 1000
	previewDefaultChunkOverlap = 80
	previewDefaultSeparator    = "\n\n"
	previewKeyBuilderCapacity  = 256
)

// PreviewPlan 描述预览链路的领域策略结果。
type PreviewPlan struct {
	RequestKey       string
	DocumentFile     *fragmodel.DocumentFile
	RequestedMode    shared.FragmentMode
	FragmentConfig   *shared.FragmentConfig
	SegmentConfig    PreviewSegmentConfig
	TryThirdPlatform bool
	AllowURLParse    bool
}

// ResolvePreviewPlan 解析预览所需的领域策略。
func ResolvePreviewPlan(
	documentFile *fragmodel.DocumentFile,
	fragmentConfig *shared.FragmentConfig,
	hasThirdPlatformResolver bool,
) PreviewPlan {
	normalizedFile := NormalizePreviewDocumentFile(documentFile)
	normalizedConfig := shared.NormalizeFragmentConfig(fragmentConfig)
	requestedMode := shared.FragmentModeAuto
	if normalizedConfig != nil {
		requestedMode = normalizePreviewRequestedMode(normalizedConfig.Mode)
	}
	segmentConfig := BuildPreviewSegmentConfig(normalizedConfig)
	return PreviewPlan{
		RequestKey:       BuildPreviewRequestKey(normalizedFile, requestedMode, normalizedConfig, segmentConfig),
		DocumentFile:     normalizedFile,
		RequestedMode:    requestedMode,
		FragmentConfig:   normalizedConfig,
		SegmentConfig:    segmentConfig,
		TryThirdPlatform: IsThirdPlatformPreviewDocument(normalizedFile) && hasThirdPlatformResolver,
		AllowURLParse:    strings.TrimSpace(normalizedFile.URL) != "",
	}
}

// NormalizePreviewDocumentFile 规整预览链路的文件输入。
func NormalizePreviewDocumentFile(file *fragmodel.DocumentFile) *fragmodel.DocumentFile {
	if file == nil {
		return &fragmodel.DocumentFile{}
	}
	normalized := &fragmodel.DocumentFile{
		Type:       normalizePreviewDocumentFileType(file.Type),
		Name:       strings.TrimSpace(file.Name),
		URL:        strings.TrimSpace(file.URL),
		Size:       file.Size,
		Extension:  filetype.NormalizeExtension(strings.TrimSpace(file.Extension)),
		ThirdID:    strings.TrimSpace(file.ThirdID),
		SourceType: strings.TrimSpace(file.SourceType),
	}
	if normalized.Type == "" {
		if normalized.ThirdID != "" || normalized.SourceType != "" {
			normalized.Type = previewDocumentFileTypeThirdPlatform
		} else {
			normalized.Type = previewDocumentFileTypeExternal
		}
	}
	if normalized.Extension == "" {
		normalized.Extension = fragmodel.InferDocumentFileExtensionLight(normalized)
	}
	return normalized
}

// IsThirdPlatformPreviewDocument 判断是否为第三方预览文件。
func IsThirdPlatformPreviewDocument(file *fragmodel.DocumentFile) bool {
	if file == nil {
		return false
	}
	if strings.EqualFold(strings.TrimSpace(file.SourceType), "project") {
		return false
	}
	if strings.EqualFold(file.Type, previewDocumentFileTypeThirdPlatform) {
		return true
	}
	return strings.TrimSpace(file.ThirdID) != "" || strings.TrimSpace(file.SourceType) != ""
}

// BuildPreviewDocumentFilePayload 构造预览第三方解析请求载荷。
func BuildPreviewDocumentFilePayload(file *fragmodel.DocumentFile) map[string]any {
	if file == nil {
		return map[string]any{}
	}
	return map[string]any{
		"type":          file.Type,
		"name":          file.Name,
		"url":           file.URL,
		"size":          file.Size,
		"extension":     file.Extension,
		"third_id":      file.ThirdID,
		"third_file_id": file.ThirdID,
		"source_type":   file.SourceType,
		"platform_type": file.SourceType,
	}
}

// ApplyResolvedPreviewDocumentFile 回填第三方预览解析结果。
func ApplyResolvedPreviewDocumentFile(file *fragmodel.DocumentFile, result map[string]any) {
	if file == nil || len(result) == 0 {
		return
	}
	if typeRaw := normalizePreviewDocumentFileType(stringValue(result["type"])); typeRaw != "" {
		file.Type = typeRaw
	}
	if name := strings.TrimSpace(stringValue(result["name"])); name != "" {
		file.Name = name
	}
	if url := strings.TrimSpace(stringValue(result["url"])); url != "" {
		file.URL = url
	}
	if extension := filetype.NormalizeExtension(strings.TrimSpace(stringValue(result["extension"]))); extension != "" {
		file.Extension = extension
	}
	file.ThirdID = firstNonEmptyString(
		strings.TrimSpace(stringValue(result["third_id"])),
		strings.TrimSpace(stringValue(result["third_file_id"])),
		file.ThirdID,
	)
	file.SourceType = firstNonEmptyString(
		strings.TrimSpace(stringValue(result["source_type"])),
		strings.TrimSpace(stringValue(result["platform_type"])),
		file.SourceType,
	)
	if file.Extension == "" {
		file.Extension = fragmodel.InferDocumentFileExtensionLight(file)
	}
}

// BuildPreviewSegmentConfig 构造预览切片配置。
func BuildPreviewSegmentConfig(cfg *shared.FragmentConfig) PreviewSegmentConfig {
	config := PreviewSegmentConfig{
		ChunkSize:          previewDefaultChunkSize,
		ChunkOverlap:       previewDefaultChunkOverlap,
		Separator:          previewDefaultSeparator,
		TextPreprocessRule: []int{},
	}
	if cfg == nil {
		return config
	}
	var segmentRule *shared.SegmentRule
	if cfg.Normal != nil {
		config.TextPreprocessRule = append(config.TextPreprocessRule, cfg.Normal.TextPreprocessRule...)
		segmentRule = cfg.Normal.SegmentRule
	}
	if segmentRule == nil {
		return config
	}
	effective := shared.ResolveEffectiveSegmentRule(segmentRule, shared.SegmentRuleDefaults{
		Separator:    previewDefaultSeparator,
		ChunkSize:    previewDefaultChunkSize,
		ChunkOverlap: previewDefaultChunkOverlap,
	})
	config.Separator = effective.Separator
	config.ChunkSize = effective.ChunkSize
	config.ChunkOverlap = effective.ChunkOverlap
	return config
}

// BuildPreviewRequestKey 构造预览请求去重键。
func BuildPreviewRequestKey(
	documentFile *fragmodel.DocumentFile,
	requestedMode shared.FragmentMode,
	fragmentConfig *shared.FragmentConfig,
	segmentConfig PreviewSegmentConfig,
) string {
	if documentFile == nil {
		sum := sha256.Sum256([]byte("empty"))
		return hex.EncodeToString(sum[:])
	}

	var builder strings.Builder
	builder.Grow(previewKeyBuilderCapacity)
	builder.WriteString("file_id=")
	builder.WriteString(strings.TrimSpace(documentFile.URL))
	builder.WriteString("|name=")
	builder.WriteString(documentFile.Name)
	builder.WriteString("|extension=")
	builder.WriteString(documentFile.Extension)
	builder.WriteString("|type=")
	builder.WriteString(documentFile.Type)
	builder.WriteString("|third_id=")
	builder.WriteString(documentFile.ThirdID)
	builder.WriteString("|source_type=")
	builder.WriteString(documentFile.SourceType)
	builder.WriteString("|mode=")
	builder.WriteString(strconv.Itoa(int(requestedMode)))
	builder.WriteString("|segment=")
	builder.WriteString(normalizePreviewSegmentConfigKey(segmentConfig))
	builder.WriteString("|config=")
	builder.WriteString(normalizePreviewFragmentConfigKey(fragmentConfig))

	sum := sha256.Sum256([]byte(builder.String()))
	return hex.EncodeToString(sum[:])
}

func normalizePreviewSegmentConfigKey(cfg PreviewSegmentConfig) string {
	var builder strings.Builder
	builder.WriteString("chunk_size=")
	builder.WriteString(strconv.Itoa(cfg.ChunkSize))
	builder.WriteString(",chunk_overlap=")
	builder.WriteString(strconv.Itoa(cfg.ChunkOverlap))
	builder.WriteString(",separator=")
	builder.WriteString(cfg.Separator)
	builder.WriteString(",rules=")
	builder.WriteString(joinPreviewRuleInts(cfg.TextPreprocessRule))
	return builder.String()
}

func normalizePreviewFragmentConfigKey(cfg *shared.FragmentConfig) string {
	if cfg == nil {
		return "nil"
	}

	var builder strings.Builder
	builder.WriteString("normal=")
	if cfg.Normal == nil {
		builder.WriteString("nil")
	} else {
		builder.WriteString("rules:")
		builder.WriteString(joinPreviewRuleInts(cfg.Normal.TextPreprocessRule))
		builder.WriteString(";segment:")
		builder.WriteString(normalizePreviewEntitySegmentRuleKey(cfg.Normal.SegmentRule))
	}

	builder.WriteString("|hierarchy=")
	if cfg.Hierarchy == nil {
		builder.WriteString("nil")
	} else {
		builder.WriteString("max_level:")
		builder.WriteString(strconv.Itoa(max(0, cfg.Hierarchy.MaxLevel)))
		builder.WriteString(";rules:")
		builder.WriteString(joinPreviewRuleInts(cfg.Hierarchy.TextPreprocessRule))
	}
	return builder.String()
}

func normalizePreviewEntitySegmentRuleKey(rule *shared.SegmentRule) string {
	if rule == nil {
		return normalizePreviewSegmentRuleKey(nil)
	}
	return normalizePreviewSegmentRuleKey(rule)
}

func normalizePreviewSegmentRuleKey(rule *shared.SegmentRule) string {
	if rule == nil {
		return fmt.Sprintf(
			"separator:%s,chunk_size:%d,chunk_overlap:%d,chunk_overlap_unit:%s",
			previewDefaultSeparator,
			previewDefaultChunkSize,
			previewDefaultChunkOverlap,
			shared.ChunkOverlapUnitAbsolute,
		)
	}
	separator := shared.DecodeSegmentSeparator(rule.Separator)
	if separator == "" {
		separator = previewDefaultSeparator
	}
	chunkSize := previewDefaultChunkSize
	if rule.ChunkSize > 0 {
		chunkSize = rule.ChunkSize
	}
	chunkOverlap := previewDefaultChunkOverlap
	if rule.ChunkOverlap >= 0 {
		chunkOverlap = rule.ChunkOverlap
	}
	return fmt.Sprintf(
		"separator:%s,chunk_size:%d,chunk_overlap:%d,chunk_overlap_unit:%s",
		separator,
		chunkSize,
		chunkOverlap,
		shared.NormalizeChunkOverlapUnit(rule.ChunkOverlapUnit),
	)
}

func joinPreviewRuleInts(rules []int) string {
	if len(rules) == 0 {
		return ""
	}
	parts := make([]string, 0, len(rules))
	for _, rule := range rules {
		parts = append(parts, strconv.Itoa(rule))
	}
	return strings.Join(parts, ",")
}

func normalizePreviewRequestedMode(mode shared.FragmentMode) shared.FragmentMode {
	switch mode {
	case shared.FragmentModeCustom, shared.FragmentModeAuto, shared.FragmentModeHierarchy:
		return mode
	default:
		return shared.FragmentModeCustom
	}
}

func normalizePreviewDocumentFileType(v string) string {
	normalized := strings.TrimSpace(strings.ToLower(v))
	if normalized != "" {
		switch normalized {
		case "1":
			return previewDocumentFileTypeExternal
		case "2", "third-platform", "thirdplatform":
			return previewDocumentFileTypeThirdPlatform
		default:
			return normalized
		}
	}
	if normalized == "3" {
		return previewDocumentFileTypeExternal
	}
	return normalized
}
