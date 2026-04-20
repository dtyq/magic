package ipcrpc_test

import (
	"context"
	"encoding/json"
	"io"
	"net"
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
	return jsonrpc.NewSessionForTest(1, &benchConn{}, jsonrpc.NewServer(nil, jsonrpc.DefaultRuntimeConfig()))
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

func BenchmarkRequestIDFromRawJSON(b *testing.B) {
	raw := json.RawMessage(`{"request_id":"bench-request-id","foo":1}`)

	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		_ = jsonrpc.RequestIDFromRawJSONForTest(raw)
	}
}
