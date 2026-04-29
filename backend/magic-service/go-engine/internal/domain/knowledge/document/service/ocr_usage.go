package document

import (
	"context"
	"strings"
)

// OCRUsageReporterPort 定义 OCR 实际用量上报能力。
type OCRUsageReporterPort interface {
	ReportOCRUsage(ctx context.Context, usage OCRUsage) error
}

// OCRUsage 描述一次真实 OCR provider 调用的计费用量。
type OCRUsage struct {
	EventID           string
	Provider          string
	OrganizationCode  string
	UserID            string
	PageCount         int
	FileType          string
	BusinessID        string
	SourceID          string
	KnowledgeBaseCode string
	DocumentCode      string
	RequestID         string
	CallType          string
}

// OCRUsageContext 保存文档同步链路中构建 OCR 用量事件所需的业务上下文。
type OCRUsageContext struct {
	OrganizationCode  string
	UserID            string
	KnowledgeBaseCode string
	DocumentCode      string
	BusinessID        string
	SourceID          string
}

type ocrUsageContextKey struct{}

// WithOCRUsageContext 将 OCR 用量上下文写入 context。
func WithOCRUsageContext(ctx context.Context, meta OCRUsageContext) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	meta = normalizeOCRUsageContext(meta)
	if meta.IsEmpty() {
		return ctx
	}
	return context.WithValue(ctx, ocrUsageContextKey{}, meta)
}

// OCRUsageContextFromContext 从 context 读取 OCR 用量上下文。
func OCRUsageContextFromContext(ctx context.Context) (OCRUsageContext, bool) {
	if ctx == nil {
		return OCRUsageContext{}, false
	}
	meta, ok := ctx.Value(ocrUsageContextKey{}).(OCRUsageContext)
	if !ok || meta.IsEmpty() {
		return OCRUsageContext{}, false
	}
	return meta, true
}

// IsEmpty 判断上下文是否为空。
func (c OCRUsageContext) IsEmpty() bool {
	return c.OrganizationCode == "" &&
		c.UserID == "" &&
		c.KnowledgeBaseCode == "" &&
		c.DocumentCode == "" &&
		c.BusinessID == "" &&
		c.SourceID == ""
}

func normalizeOCRUsageContext(meta OCRUsageContext) OCRUsageContext {
	meta.OrganizationCode = strings.TrimSpace(meta.OrganizationCode)
	meta.UserID = strings.TrimSpace(meta.UserID)
	meta.KnowledgeBaseCode = strings.TrimSpace(meta.KnowledgeBaseCode)
	meta.DocumentCode = strings.TrimSpace(meta.DocumentCode)
	meta.BusinessID = strings.TrimSpace(meta.BusinessID)
	meta.SourceID = strings.TrimSpace(meta.SourceID)
	if meta.BusinessID == "" {
		meta.BusinessID = meta.KnowledgeBaseCode
	}
	if meta.SourceID == "" {
		meta.SourceID = meta.DocumentCode
	}
	return meta
}
