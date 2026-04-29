package document

import (
	"errors"
	"fmt"
	"io"
	"unicode/utf8"

	docentity "magic/internal/domain/knowledge/document/entity"
	parseddocument "magic/internal/domain/knowledge/shared/parseddocument"
)

const (
	defaultMaxSourceBytes           int64 = 500 * 1024 * 1024
	defaultMaxTabularRows           int64 = 200_000
	defaultMaxTabularCells          int64 = 2_000_000
	defaultMaxPlainTextChars        int64 = 20_000_000
	defaultMaxParsedBlocks          int64 = 250_000
	defaultMaxFragmentsPerDocument  int64 = 10_000
	defaultSyncMemorySoftLimitBytes int64 = 6 * 1024 * 1024 * 1024
)

const (
	// ResourceLimitMaxSourceBytes 表示源文件大小限制。
	ResourceLimitMaxSourceBytes = "max_source_bytes"
	// ResourceLimitMaxTabularRows 表示表格行数限制。
	ResourceLimitMaxTabularRows = "max_tabular_rows"
	// ResourceLimitMaxTabularCells 表示表格单元格数量限制。
	ResourceLimitMaxTabularCells = "max_tabular_cells"
	// ResourceLimitMaxPlainTextChars 表示解析后文本字符数限制。
	ResourceLimitMaxPlainTextChars = "max_plain_text_chars"
	// ResourceLimitMaxParsedBlocks 表示解析结果块数量限制。
	ResourceLimitMaxParsedBlocks = "max_parsed_blocks"
	// ResourceLimitMaxFragmentsPerDocument 表示单文档片段数量限制。
	ResourceLimitMaxFragmentsPerDocument = "max_fragments_per_document"
	// ResourceLimitSyncMemorySoftLimitBytes 表示同步内存软水位限制。
	ResourceLimitSyncMemorySoftLimitBytes = "sync_memory_soft_limit_bytes"
)

const (
	resourceLimitStageReadSource      = "read_source"
	resourceLimitStageParsedDocument  = "parsed_document"
	resourceLimitStageBuildFragments  = "build_fragments"
	resourceLimitTableTooLargeMessage = "document table is too large: rows or cells exceed limit"
)

// ErrDocumentResourceLimitExceeded 表示文档同步命中资源限制。
var ErrDocumentResourceLimitExceeded = errors.New("document resource limit exceeded")

// ResourceLimits 描述文档同步的资源限制。
type ResourceLimits struct {
	MaxSourceBytes           int64
	MaxTabularRows           int64
	MaxTabularCells          int64
	MaxPlainTextChars        int64
	MaxParsedBlocks          int64
	MaxFragmentsPerDocument  int64
	SyncMemorySoftLimitBytes int64
}

// ResourceLimitError 携带资源限制失败的结构化上下文。
type ResourceLimitError struct {
	LimitName     string
	LimitValue    int64
	ObservedValue int64
	Stage         string
	Message       string
}

func (e *ResourceLimitError) Error() string {
	if e == nil {
		return ErrDocumentResourceLimitExceeded.Error()
	}
	if e.Message != "" {
		return e.Message
	}
	return fmt.Sprintf(
		"%s: %s observed=%d limit=%d stage=%s",
		ErrDocumentResourceLimitExceeded.Error(),
		e.LimitName,
		e.ObservedValue,
		e.LimitValue,
		e.Stage,
	)
}

func (e *ResourceLimitError) Unwrap() error {
	return ErrDocumentResourceLimitExceeded
}

// DefaultResourceLimits 返回默认文档同步资源限制。
func DefaultResourceLimits() ResourceLimits {
	return ResourceLimits{
		MaxSourceBytes:           defaultMaxSourceBytes,
		MaxTabularRows:           defaultMaxTabularRows,
		MaxTabularCells:          defaultMaxTabularCells,
		MaxPlainTextChars:        defaultMaxPlainTextChars,
		MaxParsedBlocks:          defaultMaxParsedBlocks,
		MaxFragmentsPerDocument:  defaultMaxFragmentsPerDocument,
		SyncMemorySoftLimitBytes: defaultSyncMemorySoftLimitBytes,
	}
}

// NormalizeResourceLimits 用默认值补齐未配置的限制。
func NormalizeResourceLimits(limits ResourceLimits) ResourceLimits {
	defaults := DefaultResourceLimits()
	if limits.MaxSourceBytes <= 0 {
		limits.MaxSourceBytes = defaults.MaxSourceBytes
	}
	if limits.MaxTabularRows <= 0 {
		limits.MaxTabularRows = defaults.MaxTabularRows
	}
	if limits.MaxTabularCells <= 0 {
		limits.MaxTabularCells = defaults.MaxTabularCells
	}
	if limits.MaxPlainTextChars <= 0 {
		limits.MaxPlainTextChars = defaults.MaxPlainTextChars
	}
	if limits.MaxParsedBlocks <= 0 {
		limits.MaxParsedBlocks = defaults.MaxParsedBlocks
	}
	if limits.MaxFragmentsPerDocument <= 0 {
		limits.MaxFragmentsPerDocument = defaults.MaxFragmentsPerDocument
	}
	if limits.SyncMemorySoftLimitBytes <= 0 {
		limits.SyncMemorySoftLimitBytes = defaults.SyncMemorySoftLimitBytes
	}
	return limits
}

// CheckDocumentSourceSize 校验已知源文件大小。
func CheckDocumentSourceSize(size int64, limits ResourceLimits) error {
	limits = NormalizeResourceLimits(limits)
	if size <= 0 || size <= limits.MaxSourceBytes {
		return nil
	}
	return NewResourceLimitError(
		ResourceLimitMaxSourceBytes,
		limits.MaxSourceBytes,
		size,
		resourceLimitStageReadSource,
		"document source too large",
	)
}

// CheckDocumentFileSourceSize 校验文档实体中携带的文件大小。
func CheckDocumentFileSourceSize(file *docentity.File, limits ResourceLimits) error {
	if file == nil {
		return nil
	}
	return CheckDocumentSourceSize(file.Size, limits)
}

// CheckTabularSize 校验表格行数和单元格数量。
func CheckTabularSize(rows, cells int64, limits ResourceLimits, stage string) error {
	limits = NormalizeResourceLimits(limits)
	if rows > limits.MaxTabularRows {
		return NewResourceLimitError(
			ResourceLimitMaxTabularRows,
			limits.MaxTabularRows,
			rows,
			stage,
			resourceLimitTableTooLargeMessage,
		)
	}
	if cells > limits.MaxTabularCells {
		return NewResourceLimitError(
			ResourceLimitMaxTabularCells,
			limits.MaxTabularCells,
			cells,
			stage,
			resourceLimitTableTooLargeMessage,
		)
	}
	return nil
}

// CheckParsedResourceLimits 校验解析结果的统一规模限制。
func CheckParsedResourceLimits(parsed *parseddocument.ParsedDocument, limits ResourceLimits) error {
	if parsed == nil {
		return nil
	}
	limits = NormalizeResourceLimits(limits)
	if chars := int64(utf8.RuneCountInString(parsed.PlainText)); chars > limits.MaxPlainTextChars {
		return NewResourceLimitError(
			ResourceLimitMaxPlainTextChars,
			limits.MaxPlainTextChars,
			chars,
			resourceLimitStageParsedDocument,
			"",
		)
	}
	if blocks := int64(len(parsed.Blocks)); blocks > limits.MaxParsedBlocks {
		return NewResourceLimitError(
			ResourceLimitMaxParsedBlocks,
			limits.MaxParsedBlocks,
			blocks,
			resourceLimitStageParsedDocument,
			"",
		)
	}
	rows, cells := countParsedTabularRowsCells(parsed)
	return CheckTabularSize(rows, cells, limits, resourceLimitStageParsedDocument)
}

// CheckFragmentCount 校验单文档片段数。
func CheckFragmentCount(fragmentCount int, limits ResourceLimits) error {
	limits = NormalizeResourceLimits(limits)
	observed := int64(fragmentCount)
	if observed <= limits.MaxFragmentsPerDocument {
		return nil
	}
	return NewResourceLimitError(
		ResourceLimitMaxFragmentsPerDocument,
		limits.MaxFragmentsPerDocument,
		observed,
		resourceLimitStageBuildFragments,
		"",
	)
}

// NewResourceLimitError 构造资源限制错误。
func NewResourceLimitError(limitName string, limitValue, observedValue int64, stage, message string) error {
	return &ResourceLimitError{
		LimitName:     limitName,
		LimitValue:    limitValue,
		ObservedValue: observedValue,
		Stage:         stage,
		Message:       message,
	}
}

// NewSourceSizeLimitedReader 包装 reader，在读取超过 max_source_bytes 时返回资源限制错误。
func NewSourceSizeLimitedReader(reader io.Reader, limits ResourceLimits) io.Reader {
	if reader == nil {
		return nil
	}
	limits = NormalizeResourceLimits(limits)
	if limits.MaxSourceBytes <= 0 {
		return reader
	}
	return &sourceSizeLimitedReader{
		reader: reader,
		limit:  limits.MaxSourceBytes,
	}
}

// NewSourceSizeLimitedReadCloser 包装 read closer，在读取超过 max_source_bytes 时返回资源限制错误。
func NewSourceSizeLimitedReadCloser(reader io.ReadCloser, limits ResourceLimits) io.ReadCloser {
	if reader == nil {
		return nil
	}
	return &sourceSizeLimitedReadCloser{
		Reader: NewSourceSizeLimitedReader(reader, limits),
		closer: reader,
	}
}

type sourceSizeLimitedReader struct {
	reader io.Reader
	limit  int64
	read   int64
}

func (r *sourceSizeLimitedReader) Read(p []byte) (int, error) {
	if r == nil || r.reader == nil {
		return 0, io.EOF
	}
	if r.limit <= 0 {
		n, err := r.reader.Read(p)
		return n, wrapSourceReadError(err)
	}
	maxRead := int64(len(p))
	if remainingWithProbe := r.limit - r.read + 1; remainingWithProbe > 0 && maxRead > remainingWithProbe {
		maxRead = remainingWithProbe
	}
	if maxRead <= 0 {
		maxRead = 1
	}

	n, err := r.reader.Read(p[:maxRead])
	r.read += int64(n)
	if r.read > r.limit {
		return n, NewResourceLimitError(
			ResourceLimitMaxSourceBytes,
			r.limit,
			r.read,
			resourceLimitStageReadSource,
			"document source too large",
		)
	}
	return n, wrapSourceReadError(err)
}

type sourceSizeLimitedReadCloser struct {
	io.Reader
	closer io.Closer
}

func (r *sourceSizeLimitedReadCloser) Close() error {
	if r == nil || r.closer == nil {
		return nil
	}
	if err := r.closer.Close(); err != nil {
		return fmt.Errorf("close source reader: %w", err)
	}
	return nil
}

func wrapSourceReadError(err error) error {
	if err == nil || errors.Is(err, io.EOF) {
		return err
	}
	return fmt.Errorf("read source: %w", err)
}

func countParsedTabularRowsCells(parsed *parseddocument.ParsedDocument) (int64, int64) {
	if parsed == nil || parsed.SourceType != parseddocument.SourceTabular {
		return 0, 0
	}
	var rows int64
	var cells int64
	for _, block := range parsed.Blocks {
		if block.Type != parseddocument.BlockTypeTableRow {
			continue
		}
		rows++
		cells += int64(len(metadataStringSlice(block.Metadata, parseddocument.MetaHeaderPaths)))
	}
	return rows, cells
}

func metadataStringSlice(metadata map[string]any, key string) []string {
	if len(metadata) == 0 {
		return nil
	}
	switch value := metadata[key].(type) {
	case []string:
		return value
	case []any:
		output := make([]string, 0, len(value))
		for _, item := range value {
			text, ok := item.(string)
			if ok {
				output = append(output, text)
			}
		}
		return output
	default:
		return nil
	}
}
