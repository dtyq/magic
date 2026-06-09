package document

import (
	"context"
	"io"
	"strings"
	"time"

	docentity "magic/internal/domain/knowledge/document/entity"
	parseddocument "magic/internal/domain/knowledge/shared/parseddocument"
)

const (
	// SyncModeCreate 表示创建后首次同步。
	SyncModeCreate = "create"
	// SyncModeResync 表示重同步。
	SyncModeResync = "resync"
	// AIAbilityCodeKnowledgeBaseVisualUnderstanding 表示知识库视觉理解能力配置。
	AIAbilityCodeKnowledgeBaseVisualUnderstanding = "knowledge_base_visual_understanding"
	// DefaultModelTypeLLM 表示模型网关的默认 LLM 模型类型。
	DefaultModelTypeLLM = "llm"
)

// SourceOverride 表示同步时直接注入的已解析文档内容。
type SourceOverride struct {
	Content            string
	DocType            int
	DocumentFile       map[string]any
	ParsedDocument     *parseddocument.ParsedDocument
	Source             string
	ContentHash        string
	FetchedAtUnixMilli int64
}

// ResolveSyncMode 解析文档同步模式，空值默认创建同步。
func ResolveSyncMode(mode string) string {
	if strings.TrimSpace(mode) == "" {
		return SyncModeCreate
	}
	return mode
}

// ShouldCleanupBeforeSync 判断同步前是否需要先清理旧片段。
func ShouldCleanupBeforeSync(mode string) bool {
	return ResolveSyncMode(mode) != SyncModeResync
}

// Parser 定义文档解析器能力。
type Parser interface {
	Parse(ctx context.Context, fileURL string, file io.Reader, fileType string) (string, error)
	Supports(fileType string) bool
	NeedsResolvedURL() bool
}

// ParserWithOptions 定义支持解析选项的解析器能力。
type ParserWithOptions interface {
	Parser
	ParseWithOptions(ctx context.Context, fileURL string, file io.Reader, fileType string, options ParseOptions) (string, error)
}

// ParserResolvedURLPolicy 定义解析器按当前上下文动态判断是否需要可访问 URL 的能力。
type ParserResolvedURLPolicy interface {
	NeedsResolvedURLForOptions(ctx context.Context, fileType string, options ParseOptions) bool
}

// FileFetcher 定义文档源文件读取能力。
type FileFetcher interface {
	Fetch(ctx context.Context, path string) (io.ReadCloser, error)
	GetLink(ctx context.Context, path, method string, expire time.Duration) (string, error)
	Stat(ctx context.Context, path string) error
}

// FileSizeReader 表示可在 Fetch 前读取源文件大小的能力。
type FileSizeReader interface {
	FileSize(ctx context.Context, path string) (int64, error)
}

// FileUploader 定义文档文件上传能力。
type FileUploader interface {
	Upload(ctx context.Context, path string, data io.Reader) error
}

// OCRClient 定义 OCR 解析能力。
type OCRClient interface {
	OCR(ctx context.Context, fileURL, fileType string) (string, error)
	OCRBytes(ctx context.Context, data []byte, fileType string) (string, error)
}

// OCRSourceClient 定义可基于已下载源文件内容执行 OCR 的能力。
type OCRSourceClient interface {
	OCRClient
	OCRSource(ctx context.Context, fileURL string, file io.Reader, fileType string) (string, error)
}

// VisualTextExtractor 定义图片、PDF 等视觉内容转文字能力。
type VisualTextExtractor interface {
	RecognizeSource(ctx context.Context, fileURL string, file io.Reader, fileType string) (string, error)
	RecognizeBytes(ctx context.Context, data []byte, fileType string) (string, error)
}

// VisualTextExtractorResolvedURLPolicy 定义视觉转文字实现是否需要可访问 URL。
type VisualTextExtractorResolvedURLPolicy interface {
	NeedsResolvedURL(ctx context.Context, fileType string) bool
}

// VisualTextExtractorPDFNativeBypassPolicy 定义 PDF 是否跳过原生文字层提取。
type VisualTextExtractorPDFNativeBypassPolicy interface {
	BypassesNativePDFText(ctx context.Context, fileType string) bool
}

// AIAbilityConfig 是从 PHP 能力管理读取到的通用能力配置。
type AIAbilityConfig struct {
	Code             string
	OrganizationCode string
	Enabled          bool
	Config           map[string]any
}

// ModelCallConfig 是从 PHP 模型网关读取到的通用模型调用配置。
type ModelCallConfig struct {
	ModelID        string
	Model          string
	ProviderCode   string
	AccessToken    string
	RequestBaseURL string
	RawConfig      map[string]any
}

// VisualAbilityConfigProvider 定义视觉理解能力配置读取端口。
type VisualAbilityConfigProvider interface {
	GetVisualAbilityConfig(ctx context.Context, organizationCode, abilityCode string) (AIAbilityConfig, error)
}

// VisualModelCallConfigProvider 定义视觉理解模型调用配置读取端口。
type VisualModelCallConfigProvider interface {
	GetVisualModelCallConfig(ctx context.Context, organizationCode, modelID, modelType string) (ModelCallConfig, error)
}

// StructuredDocumentParser 定义可返回结构化文档的解析器能力。
type StructuredDocumentParser interface {
	Parser
	ParseDocument(ctx context.Context, fileURL string, file io.Reader, fileType string) (*parseddocument.ParsedDocument, error)
}

// StructuredDocumentParserWithOptions 定义支持解析选项的结构化解析器能力。
type StructuredDocumentParserWithOptions interface {
	StructuredDocumentParser
	ParseDocumentWithOptions(
		ctx context.Context,
		fileURL string,
		file io.Reader,
		fileType string,
		options ParseOptions,
	) (*parseddocument.ParsedDocument, error)
}

func newDocument(
	knowledgeBaseCode string,
	name string,
	code string,
	docType docentity.InputKind,
	createdUID string,
	organizationCode string,
) *docentity.KnowledgeBaseDocument {
	return docentity.NewDocument(knowledgeBaseCode, name, code, docType, createdUID, organizationCode)
}
