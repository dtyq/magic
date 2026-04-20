package fragdomain

import (
	"context"
	"time"
)

type batchSyncTracer struct {
	service *FragmentDomainService
	kb      KnowledgeBaseRuntimeSnapshot
}

func newBatchSyncTracer(service *FragmentDomainService, kb KnowledgeBaseRuntimeSnapshot) *batchSyncTracer {
	return &batchSyncTracer{
		service: service,
		kb:      kb,
	}
}

func (t *batchSyncTracer) log(ctx context.Context, stage string, startedAt time.Time, err error, fields ...any) {
	if t == nil || t.service == nil || t.service.logger == nil {
		return
	}

	attrs := make([]any, 0, len(fields))
	attrs = append(attrs, "stage", stage, "duration_ms", time.Since(startedAt).Milliseconds())
	if t.kb.Code != "" {
		attrs = append(attrs, "knowledge_base_code", t.kb.Code)
	}
	if err != nil {
		attrs = append(attrs, "status", "failed", "error", err)
	} else {
		attrs = append(attrs, "status", "ok")
	}
	attrs = append(attrs, fields...)
	t.service.logger.DebugContext(ctx, "Fragment batch sync stage completed", attrs...)
}
