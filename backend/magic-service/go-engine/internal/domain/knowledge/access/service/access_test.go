package access_test

import (
	"context"
	"testing"

	access "magic/internal/domain/knowledge/access/service"
)

var errPermissionWriterBoom = &permissionWriterError{message: "boom"}

func TestServiceBatchOperationsMergesExternalAccess(t *testing.T) {
	t.Parallel()

	svc := access.NewService(
		permissionReaderStub{operations: map[string]string{"kb-local": "read"}},
		nil,
		externalAccessReaderStub{operations: map[string]access.Operation{
			"kb-local":    access.OperationAdmin,
			"kb-external": access.OperationAdmin,
		}},
		nil,
	)

	operations, err := svc.BatchOperations(context.Background(), access.Actor{
		OrganizationCode: "org",
		UserID:           "user",
	}, []string{"kb-local", "kb-external"})
	if err != nil {
		t.Fatalf("BatchOperations() error = %v", err)
	}

	if operations["kb-local"] != access.OperationAdmin {
		t.Fatalf("expected external admin to override local read, got %q", operations["kb-local"])
	}
	if operations["kb-external"] != access.OperationAdmin {
		t.Fatalf("expected external admin for kb-external, got %q", operations["kb-external"])
	}
}

func TestServiceInitializeCleanupAndRebuildDelegateWriter(t *testing.T) {
	t.Parallel()

	writer := &permissionWriterStub{}
	svc := access.NewService(permissionReaderStub{}, writer, nil, nil)

	actor := access.Actor{OrganizationCode: "org", UserID: "operator"}
	if err := svc.Initialize(context.Background(), actor, access.InitializeInput{
		KnowledgeBaseCode: " kb-1 ",
		OwnerUserID:       " owner ",
		BusinessID:        " biz ",
		AdminUserIDs:      []string{" admin-1 ", "admin-1", "", "admin-2"},
	}); err != nil {
		t.Fatalf("Initialize() error = %v", err)
	}
	if err := svc.GrantOwner(context.Background(), actor, " kb-2 ", " owner-2 "); err != nil {
		t.Fatalf("GrantOwner() error = %v", err)
	}
	if err := svc.Cleanup(context.Background(), actor, " kb-3 "); err != nil {
		t.Fatalf("Cleanup() error = %v", err)
	}
	initialized, err := svc.Rebuild(context.Background(), []access.RebuildItem{
		{
			OrganizationCode:  "org",
			CurrentUserID:     "operator",
			KnowledgeBaseCode: "kb-4",
			OwnerUserID:       "owner-4",
		},
	})
	if err != nil {
		t.Fatalf("Rebuild() error = %v", err)
	}

	if initialized != 1 {
		t.Fatalf("expected initialized count 1, got %d", initialized)
	}
	if len(writer.initializeInputs) != 2 {
		t.Fatalf("expected 2 initialize calls, got %d", len(writer.initializeInputs))
	}
	first := writer.initializeInputs[0]
	if first.KnowledgeBaseCode != "kb-1" || first.OwnerUserID != "owner" || first.BusinessID != "biz" {
		t.Fatalf("unexpected normalized initialize input: %+v", first)
	}
	if len(first.AdminUserIDs) != 2 || first.AdminUserIDs[0] != "admin-1" || first.AdminUserIDs[1] != "admin-2" {
		t.Fatalf("unexpected normalized admin ids: %#v", first.AdminUserIDs)
	}
	if len(writer.grantOwnerCalls) != 1 || writer.grantOwnerCalls[0].knowledgeBaseCode != "kb-2" || writer.grantOwnerCalls[0].ownerUserID != "owner-2" {
		t.Fatalf("unexpected grant owner calls: %#v", writer.grantOwnerCalls)
	}
	if len(writer.cleanupCodes) != 1 || writer.cleanupCodes[0] != "kb-3" {
		t.Fatalf("unexpected cleanup codes: %#v", writer.cleanupCodes)
	}
}

func TestServiceBatchOperationsReturnsExternalAccessError(t *testing.T) {
	t.Parallel()

	svc := access.NewService(
		permissionReaderStub{operations: map[string]string{"kb-local": "read"}},
		nil,
		externalAccessReaderStub{err: errPermissionWriterBoom},
		nil,
	)

	_, err := svc.BatchOperations(context.Background(), access.Actor{
		OrganizationCode: "org",
		UserID:           "user",
	}, []string{"kb-local"})
	if err == nil {
		t.Fatal("expected BatchOperations() error, got nil")
	}
}

func TestServiceRebuildReturnsWriterError(t *testing.T) {
	t.Parallel()

	writer := &permissionWriterStub{initializeErr: errPermissionWriterBoom}
	svc := access.NewService(permissionReaderStub{}, writer, nil, nil)

	_, err := svc.Rebuild(context.Background(), []access.RebuildItem{{
		OrganizationCode:  "org",
		CurrentUserID:     "operator",
		KnowledgeBaseCode: "kb-1",
		OwnerUserID:       "owner-1",
	}})
	if err == nil {
		t.Fatal("expected rebuild error, got nil")
	}
}

type permissionReaderStub struct {
	operations map[string]string
}

func (s permissionReaderStub) ListOperations(context.Context, string, string, []string) (map[string]string, error) {
	if s.operations == nil {
		return map[string]string{}, nil
	}
	return s.operations, nil
}

type externalAccessReaderStub struct {
	operations map[string]access.Operation
	err        error
}

func (s externalAccessReaderStub) ListOperations(context.Context, access.Actor, []string) (map[string]access.Operation, error) {
	if s.err != nil {
		return nil, s.err
	}
	if s.operations == nil {
		return map[string]access.Operation{}, nil
	}
	return s.operations, nil
}

type permissionWriterStub struct {
	initializeInputs []access.InitializeInput
	grantOwnerCalls  []struct {
		knowledgeBaseCode string
		ownerUserID       string
	}
	cleanupCodes  []string
	initializeErr error
}

func (s *permissionWriterStub) Initialize(_ context.Context, _ access.Actor, input access.InitializeInput) error {
	if s.initializeErr != nil {
		return s.initializeErr
	}
	s.initializeInputs = append(s.initializeInputs, input)
	return nil
}

func (s *permissionWriterStub) GrantOwner(
	_ context.Context,
	_ access.Actor,
	knowledgeBaseCode string,
	ownerUserID string,
) error {
	s.grantOwnerCalls = append(s.grantOwnerCalls, struct {
		knowledgeBaseCode string
		ownerUserID       string
	}{
		knowledgeBaseCode: knowledgeBaseCode,
		ownerUserID:       ownerUserID,
	})
	return nil
}

func (s *permissionWriterStub) Cleanup(_ context.Context, _ access.Actor, knowledgeBaseCode string) error {
	s.cleanupCodes = append(s.cleanupCodes, knowledgeBaseCode)
	return nil
}

type permissionWriterError struct {
	message string
}

func (e *permissionWriterError) Error() string {
	return e.message
}
