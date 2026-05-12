// Package metadata 提供给基础设施层使用的稳定文档契约与解析元数据视图。
package metadata

import (
	"context"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	docentity "magic/internal/domain/knowledge/document/entity"
	docrepo "magic/internal/domain/knowledge/document/repository"
	documentservice "magic/internal/domain/knowledge/document/service"
	parseddocument "magic/internal/domain/knowledge/shared/parseddocument"
	"magic/internal/pkg/filetype"
)

const (
	documentFileTypeExternal      = "external"
	documentFileTypeThirdPlatform = "third_platform"
	maxInt64AsUint64              = uint64(1<<63 - 1)
)

// File 复用稳定文档文件模型。
type File = docentity.File

// DocumentFile 保留旧命名兼容。
type DocumentFile = docentity.DocumentFile

// DocType 复用精确文档类型枚举。
type DocType = docentity.DocType

const (
	// DocTypeUnknown 表示未知类型。
	DocTypeUnknown = docentity.DocTypeUnknown
	// DocTypeText 表示纯文本。
	DocTypeText = docentity.DocTypeText
	// DocTypeMarkdown 表示 Markdown。
	DocTypeMarkdown = docentity.DocTypeMarkdown
	// DocTypePDF 表示 PDF。
	DocTypePDF = docentity.DocTypePDF
	// DocTypeHTML 表示 HTML。
	DocTypeHTML = docentity.DocTypeHTML
	// DocTypeXLSX 表示 XLSX。
	DocTypeXLSX = docentity.DocTypeXLSX
	// DocTypeXLS 表示 XLS。
	DocTypeXLS = docentity.DocTypeXLS
	// DocTypeDOC 表示 DOC。
	DocTypeDOC = docentity.DocTypeDOC
	// DocTypeDOCX 表示 DOCX。
	DocTypeDOCX = docentity.DocTypeDOCX
	// DocTypeCSV 表示 CSV。
	DocTypeCSV = docentity.DocTypeCSV
	// DocTypeXML 表示 XML。
	DocTypeXML = docentity.DocTypeXML
	// DocTypeHTM 表示 HTM。
	DocTypeHTM = docentity.DocTypeHTM
	// DocTypePPT 表示 PPT。
	DocTypePPT = docentity.DocTypePPT
	// DocTypeJSON 表示 JSON。
	DocTypeJSON = docentity.DocTypeJSON
	// DocTypeCloudDocument 表示云文档。
	DocTypeCloudDocument = docentity.DocTypeCloudDocument
	// DocTypeMultiTable 表示多表文档。
	DocTypeMultiTable = docentity.DocTypeMultiTable
)

// ParseOptions 表示文档解析选项。
type ParseOptions = documentservice.ParseOptions

// ResourceLimits 表示文档同步资源限制。
type ResourceLimits = documentservice.ResourceLimits

const (
	// ParseStrategyConfigKey 表示 strategy_config 键。
	ParseStrategyConfigKey = documentservice.ParseStrategyConfigKey
	// ParsingTypeQuick 表示快速解析。
	ParsingTypeQuick = documentservice.ParsingTypeQuick
	// ParsingTypePrecise 表示精细解析。
	ParsingTypePrecise = documentservice.ParsingTypePrecise
)

// ParsedDocument 复用统一解析结果。
type ParsedDocument = parseddocument.ParsedDocument

// ParsedBlock 复用解析块结构。
type ParsedBlock = parseddocument.ParsedBlock

// PDFNativeTextQualityResult 复用 PDF 原生文字层质量评估结果。
type PDFNativeTextQualityResult = documentservice.PDFNativeTextQualityResult

const (
	// ParsedDocumentSourceText 表示普通文本来源。
	ParsedDocumentSourceText = parseddocument.SourceText
	// ParsedDocumentSourceTabular 表示表格来源。
	ParsedDocumentSourceTabular = parseddocument.SourceTabular
	// ParsedBlockTypeTableRow 表示表格行块。
	ParsedBlockTypeTableRow = parseddocument.BlockTypeTableRow
	// ParsedBlockTypeTableSummary 表示表摘要块。
	ParsedBlockTypeTableSummary = parseddocument.BlockTypeTableSummary
	// ParsedMetaSourceFormat 表示来源格式元数据键。
	ParsedMetaSourceFormat = parseddocument.MetaSourceFormat
	// ParsedMetaFileName 表示文件名元数据键。
	ParsedMetaFileName = parseddocument.MetaFileName
	// ParsedMetaChunkType 表示块类型元数据键。
	ParsedMetaChunkType = parseddocument.MetaChunkType
	// ParsedMetaSheetName 表示 sheet 名元数据键。
	ParsedMetaSheetName = parseddocument.MetaSheetName
	// ParsedMetaSheetHidden 表示隐藏 sheet 元数据键。
	ParsedMetaSheetHidden = parseddocument.MetaSheetHidden
	// ParsedMetaTableID 表示表 ID 元数据键。
	ParsedMetaTableID = parseddocument.MetaTableID
	// ParsedMetaTableTitle 表示表标题元数据键。
	ParsedMetaTableTitle = parseddocument.MetaTableTitle
	// ParsedMetaRowIndex 表示行号元数据键。
	ParsedMetaRowIndex = parseddocument.MetaRowIndex
	// ParsedMetaRowSubchunkIndex 表示行子块索引元数据键。
	ParsedMetaRowSubchunkIndex = parseddocument.MetaRowSubchunkIndex
	// ParsedMetaPrimaryKeys 表示主键元数据键。
	ParsedMetaPrimaryKeys = parseddocument.MetaPrimaryKeys
	// ParsedMetaPrimaryKeyHeaders 表示主键列元数据键。
	ParsedMetaPrimaryKeyHeaders = parseddocument.MetaPrimaryKeyHeaders
	// ParsedMetaHeaderPaths 表示字段路径元数据键。
	ParsedMetaHeaderPaths = parseddocument.MetaHeaderPaths
	// ParsedMetaCellRefs 表示单元格引用元数据键。
	ParsedMetaCellRefs = parseddocument.MetaCellRefs
	// ParsedMetaHasFormula 表示公式标记元数据键。
	ParsedMetaHasFormula = parseddocument.MetaHasFormula
	// ParsedMetaTableRowCount 表示表行数元数据键。
	ParsedMetaTableRowCount = parseddocument.MetaTableRowCount
	// ParsedMetaFields 表示字段元数据键。
	ParsedMetaFields = parseddocument.MetaFields
	// ParsedMetaEmbeddedImageCount 表示内嵌图片数量元数据键。
	ParsedMetaEmbeddedImageCount = parseddocument.MetaEmbeddedImageCount
	// ParsedMetaEmbeddedImageOCRSuccessCount 表示 OCR 成功数量元数据键。
	ParsedMetaEmbeddedImageOCRSuccessCount = parseddocument.MetaEmbeddedImageOCRSuccessCount
	// ParsedMetaEmbeddedImageOCRFailedCount 表示 OCR 失败数量元数据键。
	ParsedMetaEmbeddedImageOCRFailedCount = parseddocument.MetaEmbeddedImageOCRFailedCount
	// ParsedMetaEmbeddedImageOCRSkippedCount 表示 OCR 跳过数量元数据键。
	ParsedMetaEmbeddedImageOCRSkippedCount = parseddocument.MetaEmbeddedImageOCRSkippedCount
	// ParsedMetaEmbeddedImageOCRLimitedCount 表示 OCR 因预算受限跳过数量元数据键。
	ParsedMetaEmbeddedImageOCRLimitedCount = parseddocument.MetaEmbeddedImageOCRLimitedCount
	// ParsedMetaEmbeddedImageOCRLimit 表示 OCR 预算上限元数据键。
	ParsedMetaEmbeddedImageOCRLimit = parseddocument.MetaEmbeddedImageOCRLimit
)

// Parser 复用解析器契约。
type Parser = documentservice.Parser

// ParserWithOptions 复用带选项解析器契约。
type ParserWithOptions = documentservice.ParserWithOptions

// StructuredDocumentParser 复用结构化解析器契约。
type StructuredDocumentParser = documentservice.StructuredDocumentParser

// StructuredDocumentParserWithOptions 复用带选项结构化解析器契约。
type StructuredDocumentParserWithOptions = documentservice.StructuredDocumentParserWithOptions

// FileFetcher 定义文件抓取契约。
type FileFetcher interface {
	Fetch(ctx context.Context, path string) (io.ReadCloser, error)
	GetLink(ctx context.Context, path, method string, expire time.Duration) (string, error)
	Stat(ctx context.Context, path string) error
}

// OCRClient 复用 OCR 客户端契约。
type OCRClient = documentservice.OCRClient

// ProjectFileMetadataReader 复用项目文件元数据读取契约。
type ProjectFileMetadataReader = documentservice.ProjectFileMetadataReader

// OCRResultCache 复用 OCR 缓存模型。
type OCRResultCache = docentity.OCRResultCache

// OCRResultCacheRepository 复用 OCR 缓存仓储契约。
type OCRResultCacheRepository = docrepo.OCRResultCacheRepository

// EmbeddedImageOCRStats 复用图片 OCR 统计。
type EmbeddedImageOCRStats = documentservice.EmbeddedImageOCRStats

// EmbeddedImageOCRBudget 复用图片 OCR 预算。
type EmbeddedImageOCRBudget = documentservice.EmbeddedImageOCRBudget

// OCRConfigProviderPort 复用 OCR 配置读取契约。
type OCRConfigProviderPort = documentservice.OCRConfigProviderPort

// OCRUsageReporterPort 复用 OCR 用量上报契约。
type OCRUsageReporterPort = documentservice.OCRUsageReporterPort

// OCRUsage 复用 OCR 实际用量模型。
type OCRUsage = documentservice.OCRUsage

// OCRUsageContext 复用 OCR 用量上下文。
type OCRUsageContext = documentservice.OCRUsageContext

// OCRAbilityConfig 复用 OCR 能力配置。
type OCRAbilityConfig = documentservice.OCRAbilityConfig

// OCRProviderConfig 复用 OCR provider 配置。
type OCRProviderConfig = documentservice.OCRProviderConfig

// Logger 定义解析服务所需的最小日志能力。
type Logger interface {
	InfoContext(ctx context.Context, msg string, keysAndValues ...any)
	KnowledgeWarnContext(ctx context.Context, msg string, keysAndValues ...any)
}

var (
	// ErrDocumentResourceLimitExceeded 表示文档同步命中资源限制。
	ErrDocumentResourceLimitExceeded = documentservice.ErrDocumentResourceLimitExceeded
	// ErrOCRDisabled 表示 OCR 能力关闭。
	ErrOCRDisabled = documentservice.ErrOCRDisabled
	// ErrOCRProviderNotFound 表示未找到启用的 OCR provider。
	ErrOCRProviderNotFound = documentservice.ErrOCRProviderNotFound
	// ErrOCRProviderUnsupported 表示 OCR provider 不受支持。
	ErrOCRProviderUnsupported = documentservice.ErrOCRProviderUnsupported
	// ErrOCRCredentialsIncomplete 表示 OCR 凭证不完整。
	ErrOCRCredentialsIncomplete = documentservice.ErrOCRCredentialsIncomplete
	// ErrUnsupportedOCRFileType 表示 OCR 不支持当前文件类型。
	ErrUnsupportedOCRFileType = documentservice.ErrUnsupportedOCRFileType
	// ErrOCRCacheNotFound 表示 OCR 缓存未命中。
	ErrOCRCacheNotFound = docrepo.ErrOCRCacheNotFound
)

const (
	// OCRProviderVolcengine 表示火山 OCR provider。
	OCRProviderVolcengine = documentservice.OCRProviderVolcengine
)

// WithOCRUsageContext 将 OCR 用量上下文写入 context。
func WithOCRUsageContext(ctx context.Context, meta OCRUsageContext) context.Context {
	return documentservice.WithOCRUsageContext(ctx, meta)
}

// OCRUsageContextFromContext 从 context 读取 OCR 用量上下文。
func OCRUsageContextFromContext(ctx context.Context) (OCRUsageContext, bool) {
	return documentservice.OCRUsageContextFromContext(ctx)
}

// ParseService 复用文档解析服务。
type ParseService = documentservice.ParseService

// DefaultParseOptions 返回默认解析选项。
func DefaultParseOptions() ParseOptions {
	return documentservice.DefaultParseOptions()
}

// DefaultResourceLimits 返回默认文档同步资源限制。
func DefaultResourceLimits() ResourceLimits {
	return documentservice.DefaultResourceLimits()
}

// NormalizeResourceLimits 用默认值补齐资源限制。
func NormalizeResourceLimits(limits ResourceLimits) ResourceLimits {
	return documentservice.NormalizeResourceLimits(limits)
}

// CheckTabularSize 校验表格行数和单元格数量。
func CheckTabularSize(rows, cells int64, limits ResourceLimits, stage string) error {
	if err := documentservice.CheckTabularSize(rows, cells, limits, stage); err != nil {
		return fmt.Errorf("check tabular size: %w", err)
	}
	return nil
}

// NewPlainTextParsedDocument 创建纯文本解析结果。
func NewPlainTextParsedDocument(fileType, content string) *ParsedDocument {
	return parseddocument.NewPlainTextParsedDocument(fileType, content)
}

// DefaultEmbeddedImageOCRLimit 返回默认 OCR 预算。
func DefaultEmbeddedImageOCRLimit() int {
	return documentservice.DefaultEmbeddedImageOCRLimit()
}

// NormalizeEmbeddedImageOCRLimit 归一化 OCR 预算。
func NormalizeEmbeddedImageOCRLimit(limit int) int {
	return documentservice.NormalizeEmbeddedImageOCRLimit(limit)
}

// NewEmbeddedImageOCRBudget 创建图片 OCR 预算。
func NewEmbeddedImageOCRBudget(limit int) *EmbeddedImageOCRBudget {
	return documentservice.NewEmbeddedImageOCRBudget(limit)
}

// OCRSourceClient 复用源文件 OCR 客户端契约。
type OCRSourceClient = documentservice.OCRSourceClient

// OCROverloadedError 复用 OCR 过载错误。
type OCROverloadedError = documentservice.OCROverloadedError

// NewOCROverloadedError 创建 OCR 过载错误。
func NewOCROverloadedError(provider string, err error) error {
	overloaded := documentservice.NewOCROverloadedError(provider, err)
	if overloaded == nil {
		return nil
	}
	return fmt.Errorf("%w", overloaded)
}

// IsOCROverloaded 判断错误链中是否包含 OCR 过载错误。
func IsOCROverloaded(err error) bool {
	return documentservice.IsOCROverloaded(err)
}

// FileFromPayload 将 payload 解析为统一文档文件。
func FileFromPayload(payload map[string]any) (*File, bool) {
	if len(payload) == 0 {
		return nil, false
	}
	file := &docentity.File{
		Type:            normalizeDocumentFileType(payload["type"]),
		Name:            strings.TrimSpace(stringValue(payload["name"])),
		URL:             strings.TrimSpace(stringValue(payload["url"])),
		FileKey:         firstNonEmptyString(strings.TrimSpace(stringValue(payload["file_key"])), strings.TrimSpace(stringValue(payload["key"]))),
		Size:            toInt64(payload["size"]),
		Extension:       filetype.NormalizeExtension(firstNonEmptyString(stringValue(payload["extension"]), stringValue(payload["third_file_extension_name"]))),
		ThirdID:         firstNonEmptyString(strings.TrimSpace(stringValue(payload["third_id"])), strings.TrimSpace(stringValue(payload["third_file_id"]))),
		SourceType:      firstNonEmptyString(strings.TrimSpace(stringValue(payload["source_type"])), strings.TrimSpace(stringValue(payload["platform_type"]))),
		ThirdFileType:   firstNonEmptyString(strings.TrimSpace(stringValue(payload["third_file_type"])), strings.TrimSpace(stringValue(payload["teamshare_file_type"])), strings.TrimSpace(stringValue(payload["file_type"]))),
		KnowledgeBaseID: strings.TrimSpace(stringValue(payload["knowledge_base_id"])),
	}
	if file.Type == "" {
		if file.ThirdID != "" || file.SourceType != "" {
			file.Type = documentFileTypeThirdPlatform
		} else {
			file.Type = documentFileTypeExternal
		}
	}
	if file.Extension == "" {
		file.Extension = inferDocumentFileExtensionLight(file)
	}
	return file, true
}

// EvaluatePDFNativeTextQuality 评估 PDF 原生文字层质量。
func EvaluatePDFNativeTextQuality(content string) PDFNativeTextQualityResult {
	return documentservice.EvaluatePDFNativeTextQuality(content)
}

// DecodeLikelyEscapedMultilineDocumentContent 解码疑似被转义的多行文本。
func DecodeLikelyEscapedMultilineDocumentContent(fileType, content string) string {
	return documentservice.DecodeLikelyEscapedMultilineDocumentContent(fileType, content)
}

// NewParseService 创建解析服务。
func NewParseService(fileFetcher FileFetcher, parsers []Parser, logger Logger) *ParseService {
	return documentservice.NewParseService(fileFetcher, parsers, logger)
}

func normalizeDocumentFileType(v any) string {
	switch value := v.(type) {
	case string:
		normalized := strings.TrimSpace(strings.ToLower(value))
		switch normalized {
		case "1":
			return documentFileTypeExternal
		case "2", "third-platform", "thirdplatform":
			return documentFileTypeThirdPlatform
		default:
			return normalized
		}
	case float64:
		switch int64(value) {
		case 1:
			return documentFileTypeExternal
		case 2:
			return documentFileTypeThirdPlatform
		default:
			return strconv.FormatInt(int64(value), 10)
		}
	case int:
		return normalizeDocumentFileType(int64(value))
	case int64:
		switch value {
		case 1:
			return documentFileTypeExternal
		case 2:
			return documentFileTypeThirdPlatform
		default:
			return strconv.FormatInt(value, 10)
		}
	default:
		return ""
	}
}

func inferDocumentFileExtensionLight(file *docentity.File) string {
	if file == nil {
		return ""
	}
	if ext := filetype.NormalizeExtension(file.Extension); ext != "" {
		return ext
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

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

func stringValue(value any) string {
	switch v := value.(type) {
	case string:
		return v
	case []byte:
		return string(v)
	default:
		return ""
	}
}

func toInt64(value any) int64 {
	switch v := value.(type) {
	case int:
		return int64(v)
	case int8:
		return int64(v)
	case int16:
		return int64(v)
	case int32:
		return int64(v)
	case int64:
		return v
	case uint:
		if uint64(v) > maxInt64AsUint64 {
			return 0
		}
		return int64(v)
	case uint8:
		return int64(v)
	case uint16:
		return int64(v)
	case uint32:
		return int64(v)
	case uint64:
		if v > maxInt64AsUint64 {
			return 0
		}
		return int64(v)
	case float32:
		return int64(v)
	case float64:
		return int64(v)
	default:
		return 0
	}
}
