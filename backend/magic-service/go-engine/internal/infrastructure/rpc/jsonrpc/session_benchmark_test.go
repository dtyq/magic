package ipcrpc_test

import (
	"context"
	"encoding/json"
	"io"
	"net"
	"strconv"
	"strings"
	"testing"
	"time"

	jsonrpc "magic/internal/infrastructure/rpc/jsonrpc"
	common "magic/internal/pkg/jsonrpc"
)

type benchAddr string

func (a benchAddr) Network() string { return "bench" }
func (a benchAddr) String() string  { return string(a) }

type benchConn struct{}

func (c *benchConn) Read(_ []byte) (int, error)         { return 0, io.EOF }
func (c *benchConn) Write(p []byte) (int, error)        { return len(p), nil }
func (c *benchConn) Close() error                       { return nil }
func (c *benchConn) LocalAddr() net.Addr                { return benchAddr("local") }
func (c *benchConn) RemoteAddr() net.Addr               { return benchAddr("remote") }
func (c *benchConn) SetDeadline(_ time.Time) error      { return nil }
func (c *benchConn) SetReadDeadline(_ time.Time) error  { return nil }
func (c *benchConn) SetWriteDeadline(_ time.Time) error { return nil }

func newBenchSession() *jsonrpc.Session {
	return jsonrpc.NewSessionForTest(1, &benchConn{}, jsonrpc.NewServerForTest(nil, jsonrpc.DefaultRuntimeConfig()))
}

func BenchmarkHandleMessageRequest(b *testing.B) {
	session := newBenchSession()
	payload := []byte(`{"jsonrpc":"2.0","method":"ipc.ping","params":{}}`)
	ctx := context.Background()

	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		jsonrpc.HandleMessageForTest(ctx, session, payload)
	}
}

func BenchmarkHandleMessageResponse(b *testing.B) {
	session := newBenchSession()
	payload := []byte(`{"jsonrpc":"2.0","id":1,"result":{"ok":true}}`)
	ctx := context.Background()

	respCh := make(chan *common.Response, 1)
	key, _ := jsonrpc.PendingKeyForTest(1)
	jsonrpc.SetPendingResponseForTest(session, key, respCh)
	defer func() {
		jsonrpc.DeletePendingResponseForTest(session, key)
	}()

	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		jsonrpc.HandleMessageForTest(ctx, session, payload)
		<-respCh
	}
}

func BenchmarkSendPacket(b *testing.B) {
	session := newBenchSession()
	resp, err := common.NewResponse(1, map[string]bool{"ok": true})
	if err != nil {
		b.Fatalf("new response: %v", err)
	}

	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		if err := jsonrpc.SendPacketToSessionForTest(session, resp); err != nil {
			b.Fatalf("send packet: %v", err)
		}
	}
}

func BenchmarkSendPacketSimilarityPayload(b *testing.B) {
	session := newBenchSession()
	resp, err := common.NewResponse(1, buildSimilarityBenchmarkResponsePayload(12))
	if err != nil {
		b.Fatalf("new response: %v", err)
	}

	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		if err := jsonrpc.SendPacketToSessionForTest(session, resp); err != nil {
			b.Fatalf("send packet: %v", err)
		}
	}
}

func BenchmarkRequestIDFromRawJSON(b *testing.B) {
	raw := json.RawMessage(`{"request_id":"bench-request-id","foo":1}`)

	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		_ = jsonrpc.RequestIDFromRawJSONForTest(raw)
	}
}

func buildSimilarityBenchmarkResponsePayload(resultCount int) map[string]any {
	results := make([]map[string]any, 0, resultCount)
	for i := range resultCount {
		results = append(results, map[string]any{
			"id":            i + 1,
			"content":       strings.Repeat("录音功能优化讨论会议纪要，重点关注原文显示、录音质量与上传问题。", 8),
			"score":         0.92 - float64(i)*0.01,
			"word_count":    128 + i,
			"business_id":   "BIZ-" + strconv.Itoa(i+1),
			"document_code": "DOC-" + strconv.Itoa(i%4),
			"document_name": "录音功能优化讨论.md",
			"document_type": 1,
			"metadata": map[string]any{
				"url":            "https://example.test/doc/" + strconv.Itoa(i+1),
				"section_title":  "原文显示问题",
				"section_path":   "录音功能优化讨论会议纪要 > 讨论要点及总结 > UI界面与交互体验优化",
				"fragment_id":    i + 1,
				"business_id":    "BIZ-" + strconv.Itoa(i+1),
				"hit_chunk":      strings.Repeat("原文显示存在错位，建议优化 chunk 拼接策略。", 4),
				"word_count":     128 + i,
				"retrieval_rank": i + 1,
			},
		})
	}
	return map[string]any{
		"results": results,
	}
}
