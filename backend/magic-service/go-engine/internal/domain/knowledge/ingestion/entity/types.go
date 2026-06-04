// Package entity 定义知识库外部数据接入领域模型。
package entity

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"
)

// DefaultMaxCleanContentBytes 是 cleaned markdown 持久化到 MySQL 的默认正文上限。
const DefaultMaxCleanContentBytes uint64 = 12 * 1024 * 1024

const (
	// ItemTypeDocument 表示可进入知识库的文档项。
	ItemTypeDocument = "document"

	// ContentFormatMarkdown 表示清洗产物是 Markdown。
	ContentFormatMarkdown = "markdown"
	// ContentCharsetUTF8 表示清洗产物正文按 UTF-8 保存。
	ContentCharsetUTF8 = "utf-8"

	// StatusPending 表示 item 尚未完成拉取。
	StatusPending = "pending"
	// StatusPulled 表示 item 已拉取但尚未完成清洗。
	StatusPulled = "pulled"
	// StatusCleaned 表示 item 已完成清洗且可读取正文。
	StatusCleaned = "cleaned"
	// StatusUnchanged 表示 item 本次同步未变化且可读取历史正文。
	StatusUnchanged = "unchanged"
	// StatusFailed 表示 item 拉取或清洗失败。
	StatusFailed = "failed"
	// StatusUnavailable 表示外部来源暂不可用。
	StatusUnavailable = "unavailable"

	// RunTypeManual 表示人工触发同步。
	RunTypeManual = "manual"
	// RunTypeScheduled 表示定时触发同步。
	RunTypeScheduled = "scheduled"
	// RunStatusRunning 表示同步执行中。
	RunStatusRunning = "running"
	// RunStatusSuccess 表示同步成功完成。
	RunStatusSuccess = "success"
	// RunStatusPartialSuccess 表示同步完成但存在单文档失败。
	RunStatusPartialSuccess = "partial_success"
	// RunStatusFailed 表示同步失败。
	RunStatusFailed = "failed"

	// DefaultCleanerVersion 是通用清洗规则版本。
	DefaultCleanerVersion = "default_cleaner_v1"
	// DefaultExtension 是 cleaned markdown 的默认扩展名。
	DefaultExtension = "md"

	// AttachmentParseStatusPending 表示附件尚未解析。
	AttachmentParseStatusPending = "pending"
	// AttachmentParseStatusParsed 表示附件已成功解析出正文。
	AttachmentParseStatusParsed = "parsed"
	// AttachmentParseStatusFailed 表示附件下载或解析失败。
	AttachmentParseStatusFailed = "failed"
	// AttachmentParseStatusSkipped 表示附件被策略跳过。
	AttachmentParseStatusSkipped = "skipped"

	thirdFileIDSeparator = ":"
)

var (
	// ErrOrganizationRequired 表示缺少组织编码。
	ErrOrganizationRequired = errors.New("organization code is required")
	// ErrProviderRequired 表示缺少接入 provider。
	ErrProviderRequired = errors.New("ingestion provider is required")
	// ErrSourceCodeRequired 表示缺少来源编码。
	ErrSourceCodeRequired = errors.New("ingestion source code is required")
	// ErrItemRefRequired 表示缺少外部资源稳定 ID。
	ErrItemRefRequired = errors.New("ingestion item ref is required")
	// ErrTitleRequired 表示缺少文档标题。
	ErrTitleRequired = errors.New("ingestion title is required")
	// ErrCleanContentRequired 表示缺少清洗后的正文。
	ErrCleanContentRequired = errors.New("ingestion cleaned content is required")
	// ErrCleanContentTooLarge 表示清洗后的正文超过 MySQL 持久化上限。
	ErrCleanContentTooLarge = errors.New("ingestion cleaned content is too large")
	// ErrInvalidThirdFileID 表示 third_file_id 不符合 source_code:item_ref 格式。
	ErrInvalidThirdFileID = errors.New("invalid ingestion third file id")
	// ErrIngestionContentNotReady 表示 item 尚不可供解析器读取。
	ErrIngestionContentNotReady = errors.New("ingestion content is not ready")
	// ErrIngestionContentMismatch 表示 item 元信息和正文 hash 不一致。
	ErrIngestionContentMismatch = errors.New("ingestion content hash mismatch")
)

// Source 描述一个可同步的数据源配置。
type Source struct {
	ID               int64
	OrganizationCode string
	Provider         string
	SourceCode       string
	Name             string
	Enabled          bool
	CredentialRef    string
	Config           map[string]any
	SyncCursor       map[string]any
	LastSyncStatus   string
	LastSyncError    string
	LastSyncedAt     *time.Time
	CreatedUID       string
	UpdatedUID       string
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

// Item 描述外部来源里的一个稳定资源项。
type Item struct {
	ID               int64
	OrganizationCode string
	Provider         string
	SourceCode       string
	ItemRef          string
	ItemType         string
	Title            string
	SourceURL        string
	Extension        string
	RawHash          string
	CleanHash        string
	CleanSize        uint64
	CleanerVersion   string
	Status           string
	SnapshotMeta     map[string]any
	LastError        string
	LastPulledAt     *time.Time
	LastCleanedAt    *time.Time
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

// ItemContent 保存清洗后的正文。
type ItemContent struct {
	ItemID           int64
	OrganizationCode string
	Provider         string
	SourceCode       string
	ItemRef          string
	CleanHash        string
	Content          string
	ContentFormat    string
	ContentCharset   string
	ContentSize      uint64
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

// Run 描述一次同步执行记录。
type Run struct {
	ID               int64
	OrganizationCode string
	Provider         string
	SourceCode       string
	RunType          string
	Status           string
	PulledCount      uint32
	ChangedCount     uint32
	CleanedCount     uint32
	SkippedCount     uint32
	FailedCount      uint32
	ErrorSummary     string
	StartedAt        time.Time
	FinishedAt       *time.Time
}

// CleanedDocument 是接入流程写入 MySQL 的最小清洗产物。
type CleanedDocument struct {
	OrganizationCode string
	Provider         string
	SourceCode       string
	ItemRef          string
	ItemType         string
	Title            string
	SourceURL        string
	Extension        string
	RawHash          string
	CleanHash        string
	CleanerVersion   string
	Content          string
	SnapshotMeta     map[string]any
	PulledAt         time.Time
	CleanedAt        time.Time
}

// FailedDocument 是接入流程记录单文档失败的最小元信息。
type FailedDocument struct {
	OrganizationCode string
	Provider         string
	SourceCode       string
	ItemRef          string
	ItemType         string
	Title            string
	SourceURL        string
	Extension        string
	RawHash          string
	SnapshotMeta     map[string]any
	LastError        string
	PulledAt         time.Time
}

// PulledDocument 表示外部 provider 拉取到的原始文档快照。
type PulledDocument struct {
	OrganizationCode string
	Provider         string
	SourceCode       string
	ItemRef          string
	Title            string
	SourceURL        string
	Raw              map[string]any
	Detail           map[string]any
	Attachments      []PulledAttachment
	PulledAt         time.Time
	LastError        string
}

// ProviderFetchOptions 控制 provider 列表页后续详情拉取行为。
type ProviderFetchOptions struct {
	DetailConcurrency  int
	ProcessDocument    func(ctx context.Context, source Source, document PulledDocument) PulledDocument
	SkipExistingDocIDs func(
		ctx context.Context,
		source Source,
		itemRefs []string,
	) (map[string]bool, error)
}

// ProviderFetchResult 表示 provider 拉取详情后的结果和预跳过统计。
type ProviderFetchResult struct {
	Documents            []PulledDocument
	SkippedExistingCount int
}

// ProviderListOptions 控制 provider 列表扫描行为。
type ProviderListOptions struct {
	SkipExistingDocIDs func(
		ctx context.Context,
		source Source,
		itemRefs []string,
	) (map[string]bool, error)
}

// ProviderListResult 表示只扫描列表页后的资源 ID 结果。
type ProviderListResult struct {
	ItemRefs             []string
	ListedCount          int
	SkippedExistingCount int
	FailedCount          int
	Failures             []string
}

// PulledAttachment 表示外部文档里的一个附件及其解析结果。
type PulledAttachment struct {
	Group       string
	FileName    string
	FileURL     string
	DownloadURL string
	FileType    string
	FileSize    uint64
	FileTime    string
	Extension   string
	ContentHash string
	ParsedText  string
	ParseStatus string
	ParseError  string
}

// NormalizeProvider 统一 provider。
func NormalizeProvider(provider string) string {
	return strings.ToLower(strings.TrimSpace(provider))
}

// NormalizeSourceCode 统一 source_code。
func NormalizeSourceCode(sourceCode string) string {
	return strings.TrimSpace(sourceCode)
}

// NormalizeItemRef 统一外部资源 ID。
func NormalizeItemRef(itemRef string) string {
	return strings.TrimSpace(itemRef)
}

// BuildThirdFileID 构造 knowledge_base_documents.third_file_id。
func BuildThirdFileID(sourceCode, itemRef string) string {
	sourceCode = NormalizeSourceCode(sourceCode)
	itemRef = NormalizeItemRef(itemRef)
	if sourceCode == "" || itemRef == "" {
		return ""
	}
	return sourceCode + thirdFileIDSeparator + itemRef
}

// ParseThirdFileID 拆解 knowledge_base_documents.third_file_id。
func ParseThirdFileID(thirdFileID string) (string, string, error) {
	thirdFileID = strings.TrimSpace(thirdFileID)
	if thirdFileID == "" {
		return "", "", ErrInvalidThirdFileID
	}
	sourceCode, itemRef, found := strings.Cut(thirdFileID, thirdFileIDSeparator)
	if !found || strings.TrimSpace(sourceCode) == "" || strings.TrimSpace(itemRef) == "" {
		return "", "", fmt.Errorf("%w: %s", ErrInvalidThirdFileID, thirdFileID)
	}
	return strings.TrimSpace(sourceCode), strings.TrimSpace(itemRef), nil
}

// ResolveItemSourceURL 返回 item 可定位到外部源文档的地址。
func ResolveItemSourceURL(item *Item) string {
	if item == nil {
		return ""
	}
	if sourceURL := strings.TrimSpace(item.SourceURL); sourceURL != "" {
		return sourceURL
	}
	if len(item.SnapshotMeta) == 0 {
		return ""
	}
	sourceURL, _ := item.SnapshotMeta["source_url"].(string)
	return strings.TrimSpace(sourceURL)
}

// PrepareCleanedDocument 校验并补齐 cleaned document。
func PrepareCleanedDocument(input CleanedDocument, maxCleanContentBytes uint64, now func() time.Time) (CleanedDocument, error) {
	if maxCleanContentBytes == 0 {
		maxCleanContentBytes = DefaultMaxCleanContentBytes
	}
	if now == nil {
		now = time.Now
	}

	input.OrganizationCode = strings.TrimSpace(input.OrganizationCode)
	input.Provider = NormalizeProvider(input.Provider)
	input.SourceCode = NormalizeSourceCode(input.SourceCode)
	input.ItemRef = NormalizeItemRef(input.ItemRef)
	input.ItemType = strings.ToLower(strings.TrimSpace(input.ItemType))
	if input.ItemType == "" {
		input.ItemType = ItemTypeDocument
	}
	input.Title = strings.TrimSpace(input.Title)
	input.SourceURL = strings.TrimSpace(input.SourceURL)
	input.Extension = strings.Trim(strings.ToLower(strings.TrimSpace(input.Extension)), ".")
	if input.Extension == "" {
		input.Extension = DefaultExtension
	}
	input.RawHash = strings.TrimSpace(input.RawHash)
	input.CleanHash = strings.TrimSpace(input.CleanHash)
	input.CleanerVersion = strings.TrimSpace(input.CleanerVersion)
	if input.CleanerVersion == "" {
		input.CleanerVersion = DefaultCleanerVersion
	}

	if input.OrganizationCode == "" {
		return CleanedDocument{}, ErrOrganizationRequired
	}
	if input.Provider == "" {
		return CleanedDocument{}, ErrProviderRequired
	}
	if input.SourceCode == "" {
		return CleanedDocument{}, ErrSourceCodeRequired
	}
	if input.ItemRef == "" {
		return CleanedDocument{}, ErrItemRefRequired
	}
	if input.Title == "" {
		return CleanedDocument{}, ErrTitleRequired
	}
	if strings.TrimSpace(input.Content) == "" {
		return CleanedDocument{}, ErrCleanContentRequired
	}
	if uint64(len([]byte(input.Content))) > maxCleanContentBytes {
		return CleanedDocument{}, fmt.Errorf(
			"%w: size=%d max=%d",
			ErrCleanContentTooLarge,
			len([]byte(input.Content)),
			maxCleanContentBytes,
		)
	}
	computedCleanHash := HashText(input.Content)
	if input.CleanHash != "" && input.CleanHash != computedCleanHash {
		return CleanedDocument{}, fmt.Errorf(
			"%w: clean_hash=%s computed=%s",
			ErrIngestionContentMismatch,
			input.CleanHash,
			computedCleanHash,
		)
	}
	input.CleanHash = computedCleanHash
	if input.RawHash == "" {
		input.RawHash = input.CleanHash
	}

	current := now()
	if input.PulledAt.IsZero() {
		input.PulledAt = current
	}
	if input.CleanedAt.IsZero() {
		input.CleanedAt = current
	}
	return input, nil
}

// HashText 返回稳定 sha256 hex。
func HashText(text string) string {
	sum := sha256.Sum256([]byte(text))
	return hex.EncodeToString(sum[:])
}
