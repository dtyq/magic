package document

const defaultEmbeddedImageOCRLimit = 20

// DefaultEmbeddedImageOCRLimit 返回单文件图片 OCR 默认预算。
func DefaultEmbeddedImageOCRLimit() int {
	return defaultEmbeddedImageOCRLimit
}

// NormalizeEmbeddedImageOCRLimit 归一化单文件图片 OCR 预算。
func NormalizeEmbeddedImageOCRLimit(limit int) int {
	if limit <= 0 {
		return defaultEmbeddedImageOCRLimit
	}
	return limit
}

// EmbeddedImageOCRStats 记录文档中图片 OCR 的处理统计。
type EmbeddedImageOCRStats struct {
	Total   int
	Success int
	Failed  int
	Skipped int
	Limited int
	Limit   int
}

// EmbeddedImageOCRBudget 表示单文件图片 OCR 调用预算。
type EmbeddedImageOCRBudget struct {
	limit int
	used  int
}

// NewEmbeddedImageOCRBudget 创建新的图片 OCR 预算。
func NewEmbeddedImageOCRBudget(limit int) *EmbeddedImageOCRBudget {
	return &EmbeddedImageOCRBudget{limit: NormalizeEmbeddedImageOCRLimit(limit)}
}

// Consume 尝试消耗一次 OCR 调用预算。
func (b *EmbeddedImageOCRBudget) Consume() bool {
	if b == nil {
		return false
	}
	if b.used >= b.limit {
		return false
	}
	b.used++
	return true
}

// Limit 返回预算上限。
func (b *EmbeddedImageOCRBudget) Limit() int {
	if b == nil {
		return NormalizeEmbeddedImageOCRLimit(0)
	}
	return b.limit
}
