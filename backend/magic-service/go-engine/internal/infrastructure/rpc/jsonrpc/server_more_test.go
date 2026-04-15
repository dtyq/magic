package ipcrpc_test

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"io"
	"net"
	"strings"
	"testing"
	"time"

	autoloadcfg "magic/internal/config/autoload"
	"magic/internal/infrastructure/logging"
	jsonrpc "magic/internal/infrastructure/rpc/jsonrpc"
	"magic/internal/pkg/ctxmeta"
	common "magic/internal/pkg/jsonrpc"
)

func newRPCLogger() *logging.SugaredLogger {
	return logging.NewFromConfig(autoloadcfg.LoggingConfig{
		Level:  autoloadcfg.LogLevelInfo,
		Format: autoloadcfg.LogFormatJSON,
	})
}

func TestServerBasicMethods(t *testing.T) {
	t.Parallel()

	server := jsonrpc.NewServerForTest(newRPCLogger(), nil)
	server.RegisterHandler("demo.echo", func(ctx context.Context, method string, params json.RawMessage) (any, error) {
		return map[string]any{"ok": true}, nil
	})

	if err := server.Serve(nil, ""); err == nil {
		t.Fatal("Serve(nil) should return error")
	}
	if _, err := server.CallRaw(1, "demo.echo", nil); err == nil {
		t.Fatal("CallRaw() should fail for missing client")
	}
	if _, err := jsonrpc.CallByMethodWithNilContextForTest(server, "demo.echo", nil); err == nil {
		t.Fatal("CallByMethodWithContext(nil) should fail")
	}
	if _, err := server.CallByMethod("demo.echo", nil); err == nil {
		t.Fatal("CallByMethod() should fail when no capable client exists")
	}
	if _, err := server.CallFirstRaw("demo.echo", nil); err == nil {
		t.Fatal("CallFirstRaw() should fail when no client exists")
	}
	if got := server.GetClientCount(); got != 0 {
		t.Fatalf("GetClientCount() = %d, want 0", got)
	}

	server.Stop()
}

func TestServerCallSelectionWithClosedCapableClient(t *testing.T) {
	t.Parallel()

	serverConn, clientConn := net.Pipe()
	t.Cleanup(func() {
		_ = serverConn.Close()
		_ = clientConn.Close()
	})

	server := jsonrpc.NewServerForTest(newRPCLogger(), jsonrpc.DefaultRuntimeConfig())
	session := jsonrpc.NewSessionForTest(1, serverConn, server)
	jsonrpc.SetSessionCapabilitiesForTest(session, "demo.echo")
	jsonrpc.AttachSessionForTest(server, session, true)
	jsonrpc.CloseSessionForTest(session)

	if _, err := server.CallByMethodWithContext(context.Background(), "demo.echo", map[string]any{"id": 1}); err == nil {
		t.Fatal("CallByMethodWithContext() should fail for closed session")
	}
	if _, err := server.CallFirstRawWithTimeout("demo.echo", map[string]any{"id": 1}, time.Second); err == nil {
		t.Fatal("CallFirstRawWithTimeout() should fail for closed session")
	}
}

func TestSessionHelpersAndRouting(t *testing.T) {
	t.Parallel()

	serverConn, clientConn := net.Pipe()
	t.Cleanup(func() {
		_ = serverConn.Close()
		_ = clientConn.Close()
	})

	server := jsonrpc.NewServerForTest(newRPCLogger(), jsonrpc.DefaultRuntimeConfig())
	session := jsonrpc.NewSessionForTest(7, serverConn, server)
	jsonrpc.AttachSessionForTest(server, session, false)

	if got := jsonrpc.RequestIDFromRawJSONForTest(json.RawMessage(`{"request_id":"req-1"}`)); got != "req-1" {
		t.Fatalf("RequestIDFromRawJSONForTest() = %q", got)
	}
	if got := jsonrpc.ReadLegacyHandshakeCodeForTest(json.RawMessage(`{"auth_token":123}`)); got != "123" {
		t.Fatalf("ReadLegacyHandshakeCodeForTest() = %q", got)
	}
	if got := len(jsonrpc.BuildCapabilitiesForTest([]string{"demo.echo", "", "demo.echo"})); got != 1 {
		t.Fatalf("BuildCapabilitiesForTest() count = %d", got)
	}

	requestCtx := ctxmeta.WithRequestID(context.Background(), "req-ctx")
	if got := string(jsonrpc.BuildOutboundRequestContextForTest(requestCtx)); got == "" {
		t.Fatal("BuildOutboundRequestContextForTest() should encode request_id")
	}

	key, ok := jsonrpc.PendingKeyForTest(9)
	if !ok {
		t.Fatal("PendingKeyForTest() should return key")
	}
	responseCh := make(chan *common.Response, 1)
	jsonrpc.SetPendingResponseForTest(session, key, responseCh)

	payload, err := json.Marshal(map[string]any{
		"jsonrpc": common.Version,
		"id":      9,
		"result":  map[string]any{"ok": true},
	})
	if err != nil {
		t.Fatalf("json.Marshal() error = %v", err)
	}

	jsonrpc.HandleMessageForTest(context.Background(), session, payload)
	resp := <-responseCh
	if resp == nil || string(resp.Result) == "" {
		t.Fatalf("unexpected response: %#v", resp)
	}
	jsonrpc.DeletePendingResponseForTest(session, key)
}

func TestSessionSendPacketAndCallWithTimeoutBranches(t *testing.T) {
	t.Parallel()

	serverConn, clientConn := net.Pipe()
	t.Cleanup(func() {
		_ = serverConn.Close()
		_ = clientConn.Close()
	})

	server := jsonrpc.NewServerForTest(newRPCLogger(), jsonrpc.DefaultRuntimeConfig())
	session := jsonrpc.NewSessionForTest(11, serverConn, server)

	resp, err := common.NewResponse(1, map[string]any{"ok": true})
	if err != nil {
		t.Fatalf("NewResponse() error = %v", err)
	}
	done := make(chan struct{})
	go func() {
		defer close(done)
		if sendErr := jsonrpc.SendPacketToSessionForTest(session, resp); sendErr != nil {
			t.Errorf("SendPacketToSessionForTest() error = %v", sendErr)
		}
	}()

	header := make([]byte, 4)
	if _, err := io.ReadFull(clientConn, header); err != nil {
		t.Fatalf("read header: %v", err)
	}
	bodyLen := binary.BigEndian.Uint32(header)
	body := make([]byte, bodyLen)
	if _, err := io.ReadFull(clientConn, body); err != nil {
		t.Fatalf("read body: %v", err)
	}
	if _, err := common.DecodeResponse(body); err != nil {
		t.Fatalf("DecodeResponse() error = %v", err)
	}
	<-done

	if _, err := jsonrpc.CallSessionWithNilContextForTest(session, "demo.echo", nil, time.Second); err == nil {
		t.Fatal("CallSessionWithTimeoutForTest(nil ctx) should fail")
	}
	if _, err := jsonrpc.CallSessionWithTimeoutForTest(context.Background(), session, "demo.echo", nil, time.Second); err == nil {
		t.Fatal("CallSessionWithTimeoutForTest(without handshake) should fail")
	}

	jsonrpc.SetSessionCapabilitiesForTest(session, "demo.echo")
	jsonrpc.SetPendingResponseForTest(session, "n:1", make(chan *common.Response, 1))
	serverCfg := jsonrpc.DefaultRuntimeConfig()
	serverCfg.MaxPendingRequests = 1
	server = jsonrpc.NewServerForTest(newRPCLogger(), serverCfg)
	session = jsonrpc.NewSessionForTest(12, serverConn, server)
	jsonrpc.SetSessionCapabilitiesForTest(session, "demo.echo")
	jsonrpc.SetPendingResponseForTest(session, "n:99", make(chan *common.Response, 1))

	if _, err := jsonrpc.CallSessionWithTimeoutForTest(context.Background(), session, "demo.echo", map[string]any{"x": make(chan int)}, time.Second); err == nil {
		t.Fatal("marshal params should fail")
	}

	jsonrpc.CloseSessionForTest(session)
	if _, err := jsonrpc.CallSessionWithTimeoutForTest(context.Background(), session, "demo.echo", nil, time.Second); err == nil {
		t.Fatal("closed session should fail")
	}
}

func TestServerCallByMethodWithNoCapableClient(t *testing.T) {
	t.Parallel()

	serverConn, clientConn := net.Pipe()
	t.Cleanup(func() {
		_ = serverConn.Close()
		_ = clientConn.Close()
	})

	server := jsonrpc.NewServerForTest(newRPCLogger(), jsonrpc.DefaultRuntimeConfig())
	session := jsonrpc.NewSessionForTest(3, serverConn, server)
	jsonrpc.AttachSessionForTest(server, session, true)
	jsonrpc.SetSessionCapabilitiesForTest(session, "demo.other")

	if _, err := server.CallByMethod("demo.echo", nil); err == nil {
		t.Fatal("expected no capable client error")
	}
}

func TestSessionCallWithTimeoutOverloaded(t *testing.T) {
	t.Parallel()

	serverConn, clientConn := net.Pipe()
	t.Cleanup(func() {
		_ = serverConn.Close()
		_ = clientConn.Close()
	})

	cfg := jsonrpc.DefaultRuntimeConfig()
	cfg.MaxPendingRequests = 1
	server := jsonrpc.NewServerForTest(newRPCLogger(), cfg)
	session := jsonrpc.NewSessionForTest(4, serverConn, server)
	jsonrpc.SetSessionCapabilitiesForTest(session, "demo.echo")
	jsonrpc.SetPendingResponseForTest(session, "n:1", make(chan *common.Response, 1))

	_, err := jsonrpc.CallSessionWithTimeoutForTest(context.Background(), session, "demo.echo", map[string]any{"ok": true}, time.Second)
	if err == nil {
		t.Fatal("expected overloaded error")
	}
}

func TestSessionCallWithCanceledContextDoesNotReportTimeout(t *testing.T) {
	t.Parallel()

	server := jsonrpc.NewServerForTest(newRPCLogger(), jsonrpc.DefaultRuntimeConfig())
	session := jsonrpc.NewSessionForTest(5, &benchConn{}, server)
	jsonrpc.SetSessionCapabilitiesForTest(session, "demo.echo")

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_, err := jsonrpc.CallSessionWithTimeoutForTest(ctx, session, "demo.echo", map[string]any{"ok": true}, time.Second)
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context.Canceled, got %v", err)
	}
	if strings.Contains(err.Error(), "timeout") {
		t.Fatalf("expected canceled error instead of timeout, got %v", err)
	}
}
