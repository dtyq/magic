package client_test

import (
	"context"
	"errors"
	"testing"

	"magic/internal/infrastructure/logging"
	ipcclient "magic/internal/infrastructure/rpc/jsonrpc/client"
	"magic/internal/infrastructure/transport/ipc/unixsocket"
	"magic/internal/pkg/thirdplatform"
)

func newThirdPlatformDocumentServerForTest() *unixsocket.Server {
	return unixsocket.NewServerForTest(nil, logging.New())
}

func TestPHPThirdPlatformDocumentRPCClientResolveNoClient(t *testing.T) {
	t.Parallel()

	client := ipcclient.NewPHPThirdPlatformDocumentRPCClient(newThirdPlatformDocumentServerForTest(), logging.New(), nil)

	if client == nil {
		t.Fatal("expected client to be created")
	}
	_, err := client.Resolve(context.Background(), thirdplatform.DocumentResolveInput{
		OrganizationCode:  "org-1",
		UserID:            "user-1",
		KnowledgeBaseCode: "kb-1",
		ThirdPlatformType: "feishu",
		ThirdFileID:       "file-1",
		DocumentFile:      map[string]any{"id": "file-1"},
	})
	if !errors.Is(err, ipcclient.ErrNoClientConnected) {
		t.Fatalf("expected ErrNoClientConnected, got %v", err)
	}
}
