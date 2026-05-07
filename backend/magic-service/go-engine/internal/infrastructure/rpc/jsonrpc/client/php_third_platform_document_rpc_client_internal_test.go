package client

import (
	"context"
	"errors"
	"testing"

	"magic/internal/infrastructure/logging"
	"magic/internal/infrastructure/transport/ipc/unixsocket"
	"magic/internal/pkg/thirdplatform"
)

func TestPHPThirdPlatformDocumentRPCClientResolveMapsUnavailableCode(t *testing.T) {
	t.Parallel()

	client := NewPHPThirdPlatformDocumentRPCClient(unixsocket.NewServerForTest(nil, logging.New()), logging.New(), nil)
	client.isClientReady = func() bool { return true }
	client.callResolveRPC = func(
		_ context.Context,
		_ *unixsocket.Server,
		_ map[string]any,
		out *thirdPlatformDocumentResolveResponse,
	) error {
		out.Code = thirdPlatformDocumentUnavailableCode
		out.Message = "resolve third_platform document failed: missing or unsupported file identifiers"
		return nil
	}

	_, err := client.Resolve(context.Background(), thirdplatform.DocumentResolveInput{
		OrganizationCode:  "org-1",
		UserID:            "user-1",
		KnowledgeBaseCode: "kb-1",
		ThirdPlatformType: "teamshare",
		ThirdFileID:       "file-1",
		DocumentFile:      map[string]any{"third_file_id": "file-1"},
	})
	if !errors.Is(err, thirdplatform.ErrDocumentUnavailable) {
		t.Fatalf("expected ErrDocumentUnavailable, got %v", err)
	}
}

func TestPHPThirdPlatformDocumentRPCClientListTreeNodesMapsPermissionError(t *testing.T) {
	t.Parallel()

	client := NewPHPThirdPlatformDocumentRPCClient(unixsocket.NewServerForTest(nil, logging.New()), logging.New(), nil)
	client.isClientReady = func() bool { return true }
	client.callListTreeNodesRPC = func(
		_ context.Context,
		_ *unixsocket.Server,
		_ map[string]any,
		out *thirdPlatformTreeNodeListResponse,
	) error {
		out.Code = 500
		out.Message = "暂无权限 [请求id: magic_69eee1018b6ff]"
		return nil
	}

	_, err := client.ListTreeNodes(context.Background(), thirdplatform.TreeNodeListInput{
		OrganizationCode:              "org-1",
		UserID:                        "user-1",
		ThirdPlatformUserID:           "teamshare-user-1",
		ThirdPlatformOrganizationCode: "teamshare-org-1",
		ParentType:                    "knowledge_base",
		ParentRef:                     "636587207534297089",
	})
	if !errors.Is(err, thirdplatform.ErrPermissionDenied) {
		t.Fatalf("expected ErrPermissionDenied, got %v", err)
	}
}

func TestPHPThirdPlatformDocumentRPCClientResolveMapsPermissionError(t *testing.T) {
	t.Parallel()

	client := NewPHPThirdPlatformDocumentRPCClient(unixsocket.NewServerForTest(nil, logging.New()), logging.New(), nil)
	client.isClientReady = func() bool { return true }
	client.callResolveRPC = func(
		_ context.Context,
		_ *unixsocket.Server,
		_ map[string]any,
		out *thirdPlatformDocumentResolveResponse,
	) error {
		out.Code = 500
		out.Message = "权限不足"
		return nil
	}

	_, err := client.Resolve(context.Background(), thirdplatform.DocumentResolveInput{
		OrganizationCode:  "org-1",
		UserID:            "user-1",
		KnowledgeBaseCode: "kb-1",
		ThirdPlatformType: "teamshare",
		ThirdFileID:       "file-1",
		DocumentFile:      map[string]any{"third_file_id": "file-1"},
	})
	if !errors.Is(err, thirdplatform.ErrPermissionDenied) {
		t.Fatalf("expected ErrPermissionDenied, got %v", err)
	}
}

func TestPHPThirdPlatformDocumentRPCClientListKnowledgeBasesMapsPermissionError(t *testing.T) {
	t.Parallel()

	client := NewPHPThirdPlatformDocumentRPCClient(unixsocket.NewServerForTest(nil, logging.New()), logging.New(), nil)
	client.isClientReady = func() bool { return true }
	client.callListKnowledgeBasesRPC = func(
		_ context.Context,
		_ *unixsocket.Server,
		_ map[string]any,
		out *thirdPlatformKnowledgeBaseListResponse,
	) error {
		out.Code = thirdPlatformPermissionDeniedCode
		out.Message = "权限不足"
		return nil
	}

	_, err := client.ListKnowledgeBases(context.Background(), thirdplatform.KnowledgeBaseListInput{
		OrganizationCode:              "org-1",
		UserID:                        "user-1",
		ThirdPlatformUserID:           "teamshare-user-1",
		ThirdPlatformOrganizationCode: "teamshare-org-1",
	})
	if !errors.Is(err, thirdplatform.ErrPermissionDenied) {
		t.Fatalf("expected ErrPermissionDenied, got %v", err)
	}
}

func TestPHPThirdPlatformDocumentRPCClientResolveForwardsThirdPlatformIdentity(t *testing.T) {
	t.Parallel()

	client := NewPHPThirdPlatformDocumentRPCClient(unixsocket.NewServerForTest(nil, logging.New()), logging.New(), nil)
	client.isClientReady = func() bool { return true }

	var captured map[string]any
	client.callResolveRPC = func(
		_ context.Context,
		_ *unixsocket.Server,
		params map[string]any,
		out *thirdPlatformDocumentResolveResponse,
	) error {
		captured = params
		out.Code = 0
		return nil
	}

	_, err := client.Resolve(context.Background(), thirdplatform.DocumentResolveInput{
		OrganizationCode:              "org-1",
		UserID:                        "user-1",
		ThirdPlatformUserID:           "teamshare-user-1",
		ThirdPlatformOrganizationCode: "000",
		KnowledgeBaseCode:             "kb-1",
		ThirdPlatformType:             "teamshare",
		ThirdFileID:                   "file-1",
		DocumentFile:                  map[string]any{"third_file_id": "file-1"},
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	dataIsolation, ok := captured["data_isolation"].(map[string]any)
	if !ok {
		t.Fatalf("expected data_isolation map, got %#v", captured["data_isolation"])
	}
	if dataIsolation["user_id"] != "user-1" ||
		dataIsolation["third_platform_user_id"] != "teamshare-user-1" ||
		dataIsolation["third_platform_organization_code"] != "000" {
		t.Fatalf("unexpected data_isolation: %#v", dataIsolation)
	}
}

func TestPHPThirdPlatformDocumentRPCClientListTreeNodesForwardsThirdPlatformIdentity(t *testing.T) {
	t.Parallel()

	client := NewPHPThirdPlatformDocumentRPCClient(unixsocket.NewServerForTest(nil, logging.New()), logging.New(), nil)
	client.isClientReady = func() bool { return true }

	var captured map[string]any
	client.callListTreeNodesRPC = func(
		_ context.Context,
		_ *unixsocket.Server,
		params map[string]any,
		out *thirdPlatformTreeNodeListResponse,
	) error {
		captured = params
		out.Code = 0
		return nil
	}

	_, err := client.ListTreeNodes(context.Background(), thirdplatform.TreeNodeListInput{
		OrganizationCode:              "org-1",
		UserID:                        "user-1",
		ThirdPlatformUserID:           "teamshare-user-1",
		ThirdPlatformOrganizationCode: "teamshare-org-1",
		ParentType:                    "knowledge_base",
		ParentRef:                     "kb-1",
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	dataIsolation, ok := captured["data_isolation"].(map[string]any)
	if !ok {
		t.Fatalf("expected data_isolation map, got %#v", captured["data_isolation"])
	}
	if dataIsolation["organization_code"] != "org-1" ||
		dataIsolation["user_id"] != "user-1" ||
		dataIsolation["third_platform_user_id"] != "teamshare-user-1" ||
		dataIsolation["third_platform_organization_code"] != "teamshare-org-1" ||
		captured["parent_type"] != "knowledge_base" ||
		captured["parent_ref"] != "kb-1" {
		t.Fatalf("unexpected tree node params: %#v", captured)
	}
}

func TestPHPThirdPlatformDocumentRPCClientListTreeNodesReturnsIdentityMissing(t *testing.T) {
	t.Parallel()

	client := NewPHPThirdPlatformDocumentRPCClient(unixsocket.NewServerForTest(nil, logging.New()), logging.New(), nil)
	client.isClientReady = func() bool { return true }

	_, err := client.ListTreeNodes(context.Background(), thirdplatform.TreeNodeListInput{
		OrganizationCode: "org-1",
		UserID:           "user-1",
		ParentType:       "knowledge_base",
		ParentRef:        "kb-1",
	})
	if !errors.Is(err, ErrThirdPlatformIdentityMissing) {
		t.Fatalf("expected ErrThirdPlatformIdentityMissing, got %v", err)
	}
}
