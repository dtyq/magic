package unixsocket_test

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	autoloadcfg "magic/internal/config/autoload"
	"magic/internal/infrastructure/logging"
	"magic/internal/infrastructure/transport/ipc/unixsocket"
)

func TestNewServerAppliesConfigAndRegisterHandler(t *testing.T) {
	t.Parallel()
	socketPath := filepath.Join(os.TempDir(), "magic_unixsocket_test.sock")
	_ = os.Remove(socketPath)
	defer func() { _ = os.Remove(socketPath) }()
	server := unixsocket.NewServer(&autoloadcfg.IPCConfig{
		EngineSocket:         socketPath,
		ProtocolVersion:      2,
		HandshakeCode:        "token",
		MaxMessageBytes:      2048,
		ReadTimeout:          5,
		WriteTimeout:         6,
		HeartbeatInterval:    7,
		HeartbeatTimeout:     8,
		MaxPendingRequests:   9,
		DiscardCapMultiplier: 10,
		DiscardChunkSize:     11,
		DiscardTimeout:       12,
		OversizeMaxBurst:     13,
	}, logging.New())

	if server.GetRPCClientCount() != 0 {
		t.Fatalf("expected zero RPC clients")
	}
	if _, err := server.CallRPC("demo.echo", map[string]any{"x": 1}); err == nil {
		t.Fatal("expected CallRPC to fail without clients")
	}
	if err := unixsocket.CallRPCTypedWithContext(context.Background(), server, "demo.echo", nil, &map[string]any{}); err == nil {
		t.Fatal("expected typed RPC call to fail without clients")
	}

	if err := server.Start(); err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	if _, err := os.Stat(socketPath); err != nil {
		t.Fatalf("expected socket file to exist: %v", err)
	}
	if err := server.Close(); err != nil {
		t.Fatalf("Close() error = %v", err)
	}
}
