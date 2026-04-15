package logging

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"os"
	"reflect"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/mattn/go-isatty"

	"magic/internal/pkg/ctxmeta"
	"magic/internal/pkg/logkey"
)

const (
	ansiReset  = "\x1b[0m"
	ansiRed    = "\x1b[31m"
	ansiYellow = "\x1b[33m"
	ansiGreen  = "\x1b[32m"
	ansiCyan   = "\x1b[36m"

	defaultAttrCapacity  = 8
	fieldExtraCapacity   = 8
	initialBuilderLength = 256
)

type magicTextHandler struct {
	out       io.Writer
	opts      *slog.HandlerOptions
	attrs     []slog.Attr
	groups    []string
	mu        *sync.Mutex
	useColor  bool
	includeID bool
}

func newMagicTextHandler(out io.Writer, opts *slog.HandlerOptions) slog.Handler {
	hopts := &slog.HandlerOptions{}
	if opts != nil {
		*hopts = *opts
	}
	return &magicTextHandler{
		out:       out,
		opts:      hopts,
		attrs:     make([]slog.Attr, 0, defaultAttrCapacity),
		groups:    nil,
		mu:        &sync.Mutex{},
		useColor:  detectColorSupport(out),
		includeID: true,
	}
}

func (h *magicTextHandler) Enabled(_ context.Context, level slog.Level) bool {
	minLevel := slog.LevelInfo
	if h.opts != nil && h.opts.Level != nil {
		minLevel = h.opts.Level.Level()
	}
	return level >= minLevel
}

func (h *magicTextHandler) Handle(ctx context.Context, rec slog.Record) error {
	fields := h.collectFields(rec)
	line := h.buildLine(ctx, rec, fields)

	h.mu.Lock()
	defer h.mu.Unlock()
	_, err := io.WriteString(h.out, line)
	if err != nil {
		return fmt.Errorf("write magic log: %w", err)
	}
	return nil
}

func (h *magicTextHandler) collectFields(rec slog.Record) map[string]any {
	fields := make(map[string]any, len(h.attrs)+fieldExtraCapacity)
	for _, attr := range h.attrs {
		h.appendAttr(fields, h.groups, attr)
	}
	rec.Attrs(func(attr slog.Attr) bool {
		h.appendAttr(fields, h.groups, attr)
		return true
	})
	return fields
}

func (h *magicTextHandler) buildLine(ctx context.Context, rec slog.Record, fields map[string]any) string {
	requestID, _ := fields[logkey.RequestID].(string)
	if requestID == "" {
		requestID, _ = ctxmeta.RequestIDFromContext(ctx)
	}
	delete(fields, logkey.RequestID)

	traceID, _ := fields["trace_id"].(string)
	delete(fields, "trace_id")

	channel, _ := fields["logger"].(string)
	if channel == "" {
		channel = "app"
	}
	delete(fields, "logger")

	t := rec.Time
	if t.IsZero() {
		t = time.Now()
	}

	var b strings.Builder
	b.Grow(initialBuilderLength)
	b.WriteString(h.renderLevel(levelName(rec.Level)))
	if requestID != "" {
		b.WriteString("[")
		b.WriteString(requestID)
		b.WriteString("]")
	}
	if h.includeID {
		b.WriteString("[")
		b.WriteString(strconv.FormatInt(currentGoroutineID(), 10))
		b.WriteString("]")
	}
	if traceID != "" {
		b.WriteString("[")
		b.WriteString(traceID)
		b.WriteString("]")
	}
	b.WriteString("[")
	b.WriteString(t.Local().Format("2006-01-02 15:04:05"))
	b.WriteString("]")
	b.WriteString("[")
	b.WriteString(channel)
	b.WriteString("]")
	b.WriteString("[")
	b.WriteString(rec.Message)
	b.WriteString("]")

	if len(fields) > 0 {
		if payload, err := json.Marshal(fields); err == nil {
			b.Write(payload)
		} else {
			b.WriteString(`{"error":"failed to marshal context","raw":"`)
			b.WriteString(escapeForJSON(fmt.Sprintf("%v", fields)))
			b.WriteString(`"}`)
		}
	}
	b.WriteByte('\n')
	return b.String()
}

func (h *magicTextHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	next := h.clone()
	next.attrs = append(next.attrs, attrs...)
	return next
}

func (h *magicTextHandler) WithGroup(name string) slog.Handler {
	if strings.TrimSpace(name) == "" {
		return h
	}
	next := h.clone()
	next.groups = append(next.groups, name)
	return next
}

func (h *magicTextHandler) clone() *magicTextHandler {
	attrs := make([]slog.Attr, len(h.attrs))
	copy(attrs, h.attrs)
	groups := make([]string, len(h.groups))
	copy(groups, h.groups)
	return &magicTextHandler{
		out:       h.out,
		opts:      h.opts,
		attrs:     attrs,
		groups:    groups,
		mu:        h.mu,
		useColor:  h.useColor,
		includeID: h.includeID,
	}
}

func (h *magicTextHandler) appendAttr(fields map[string]any, groups []string, attr slog.Attr) {
	if h.opts != nil && h.opts.ReplaceAttr != nil {
		attr = h.opts.ReplaceAttr(groups, attr)
	}
	if attr.Equal(slog.Attr{}) {
		return
	}
	attr.Value = attr.Value.Resolve()

	if attr.Value.Kind() == slog.KindGroup {
		nextGroups := groups
		if attr.Key != "" {
			nextGroups = make([]string, 0, len(groups)+1)
			nextGroups = append(nextGroups, groups...)
			nextGroups = append(nextGroups, attr.Key)
		}
		for _, ga := range attr.Value.Group() {
			h.appendAttr(fields, nextGroups, ga)
		}
		return
	}

	if attr.Key == "" {
		return
	}
	key := attr.Key
	if len(groups) > 0 {
		path := make([]string, 0, len(groups)+1)
		path = append(path, groups...)
		path = append(path, attr.Key)
		key = strings.Join(path, ".")
	}
	fields[key] = normalizeValue(valueToAny(attr.Value))
}

func valueToAny(v slog.Value) any {
	switch v.Kind() {
	case slog.KindString:
		return v.String()
	case slog.KindInt64:
		return v.Int64()
	case slog.KindUint64:
		return v.Uint64()
	case slog.KindFloat64:
		return v.Float64()
	case slog.KindBool:
		return v.Bool()
	case slog.KindTime:
		return v.Time().Format(time.RFC3339Nano)
	case slog.KindDuration:
		return v.Duration().String()
	case slog.KindAny:
		return v.Any()
	default:
		return v.Any()
	}
}

func normalizeValue(v any) any {
	if v == nil {
		return nil
	}
	switch x := v.(type) {
	case error:
		return x.Error()
	case time.Time:
		return x.Format(time.RFC3339Nano)
	case time.Duration:
		return x.String()
	case fmt.Stringer:
		return x.String()
	case []byte:
		return string(x)
	}

	rv := reflect.ValueOf(v)
	switch rv.Kind() {
	case reflect.Map:
		out := make(map[string]any, rv.Len())
		iter := rv.MapRange()
		for iter.Next() {
			k := fmt.Sprintf("%v", iter.Key().Interface())
			out[k] = normalizeValue(iter.Value().Interface())
		}
		return out
	case reflect.Slice, reflect.Array:
		n := rv.Len()
		out := make([]any, n)
		for i := range n {
			out[i] = normalizeValue(rv.Index(i).Interface())
		}
		return out
	case reflect.Func, reflect.Chan, reflect.UnsafePointer:
		return fmt.Sprintf("%v", v)
	default:
		return v
	}
}

func levelName(level slog.Level) string {
	switch {
	case level >= slog.LevelError:
		return "ERROR"
	case level >= slog.LevelWarn:
		return "WARNING"
	case level >= slog.LevelInfo:
		return "INFO"
	default:
		return "DEBUG"
	}
}

func (h *magicTextHandler) renderLevel(name string) string {
	raw := "[" + name + "]"
	if !h.useColor {
		return raw
	}
	return colorPrefix(name) + raw + ansiReset
}

func colorPrefix(levelName string) string {
	switch levelName {
	case "ERROR":
		return ansiRed
	case "WARNING":
		return ansiYellow
	case "INFO":
		return ansiGreen
	default:
		return ansiCyan
	}
}

func detectColorSupport(out io.Writer) bool {
	if os.Getenv("NO_COLOR") != "" {
		return false
	}
	if os.Getenv("CLICOLOR_FORCE") == "1" {
		return true
	}
	f, ok := out.(*os.File)
	if !ok {
		return false
	}
	fd := f.Fd()
	return isatty.IsTerminal(fd) || isatty.IsCygwinTerminal(fd)
}

func currentGoroutineID() int64 {
	var buf [64]byte
	n := runtime.Stack(buf[:], false)
	// format: "goroutine 123 [running]:"
	header := strings.TrimPrefix(string(buf[:n]), "goroutine ")
	idField := strings.Fields(header)
	if len(idField) == 0 {
		return -1
	}
	id, err := strconv.ParseInt(idField[0], 10, 64)
	if err != nil {
		return -1
	}
	return id
}

func escapeForJSON(s string) string {
	replacer := strings.NewReplacer(
		`\\`, `\\\\`,
		`"`, `\"`,
		"\n", `\n`,
		"\r", `\r`,
		"\t", `\t`,
	)
	return replacer.Replace(s)
}
