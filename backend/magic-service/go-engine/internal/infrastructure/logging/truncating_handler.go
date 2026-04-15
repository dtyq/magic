package logging

import (
	"context"
	"fmt"
	"log/slog"
)

type truncatingHandler struct {
	next     slog.Handler
	maxRunes int
}

func newTruncatingHandler(next slog.Handler, maxRunes int) slog.Handler {
	if next == nil {
		return nil
	}
	return &truncatingHandler{
		next:     next,
		maxRunes: maxRunes,
	}
}

func (h *truncatingHandler) Enabled(ctx context.Context, level slog.Level) bool {
	return h.next.Enabled(ctx, level)
}

func (h *truncatingHandler) Handle(ctx context.Context, rec slog.Record) error {
	truncatedRecord := slog.NewRecord(rec.Time, rec.Level, truncateString(rec.Message, h.maxRunes), rec.PC)
	rec.Attrs(func(attr slog.Attr) bool {
		truncatedRecord.AddAttrs(truncateAttr(attr, h.maxRunes))
		return true
	})
	if err := h.next.Handle(ctx, truncatedRecord); err != nil {
		return fmt.Errorf("handle truncated log: %w", err)
	}
	return nil
}

func (h *truncatingHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	truncatedAttrs := make([]slog.Attr, 0, len(attrs))
	for _, attr := range attrs {
		truncatedAttrs = append(truncatedAttrs, truncateAttr(attr, h.maxRunes))
	}
	return &truncatingHandler{
		next:     h.next.WithAttrs(truncatedAttrs),
		maxRunes: h.maxRunes,
	}
}

func (h *truncatingHandler) WithGroup(name string) slog.Handler {
	return &truncatingHandler{
		next:     h.next.WithGroup(name),
		maxRunes: h.maxRunes,
	}
}
