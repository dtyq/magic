package sharedaccess_test

import (
	"context"
	"errors"
	"reflect"
	"testing"

	sharedaccess "magic/internal/application/knowledge/shared/access"
	kbaccess "magic/internal/domain/knowledge/access/service"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	kbrepository "magic/internal/domain/knowledge/knowledgebase/repository"
)

var errRelationshipLookup = errors.New("relationship lookup failed")

func TestDigitalEmployeeRelationshipReaderDerivesReadAndEdit(t *testing.T) {
	t.Parallel()

	reader := sharedaccess.NewDigitalEmployeeRelationshipReader(
		&knowledgeBaseReaderStub{items: []*kbentity.KnowledgeBase{
			{Code: "kb-digital", KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee},
			{Code: "kb-flow", KnowledgeBaseType: kbentity.KnowledgeBaseTypeFlowVector},
		}},
		&knowledgeBaseBindingReaderStub{bindIDsByKnowledgeBase: map[string][]string{
			"kb-digital": {"agent-readable", "agent-manageable"},
			"kb-flow":    {"agent-manageable"},
		}},
		&superMagicAgentAccessStub{
			accessible: map[string]struct{}{"agent-readable": {}, "agent-manageable": {}},
			manageable: map[string]struct{}{"agent-manageable": {}},
		},
	)

	operations, err := reader.ListOperations(context.Background(), kbaccess.Actor{
		OrganizationCode: "org",
		UserID:           "user",
	}, []string{"kb-digital", "kb-flow"})
	if err != nil {
		t.Fatalf("ListOperations() error = %v", err)
	}
	if operations["kb-digital"] != kbaccess.OperationRead {
		t.Fatalf("expected digital employee read, got %q", operations["kb-digital"])
	}
	if _, ok := operations["kb-flow"]; ok {
		t.Fatalf("flow_vector must not inherit digital employee relationship access: %#v", operations)
	}

	reader = sharedaccess.NewDigitalEmployeeRelationshipReader(
		&knowledgeBaseReaderStub{items: []*kbentity.KnowledgeBase{{Code: "kb-digital", KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee}}},
		&knowledgeBaseBindingReaderStub{bindIDsByKnowledgeBase: map[string][]string{"kb-digital": {"agent-manageable"}}},
		&superMagicAgentAccessStub{accessible: map[string]struct{}{"agent-manageable": {}}, manageable: map[string]struct{}{"agent-manageable": {}}},
	)
	operations, err = reader.ListOperations(context.Background(), kbaccess.Actor{OrganizationCode: "org", UserID: "user"}, []string{"kb-digital"})
	if err != nil {
		t.Fatalf("ListOperations() error = %v", err)
	}
	if operations["kb-digital"] != kbaccess.OperationEdit {
		t.Fatalf("expected digital employee edit, got %q", operations["kb-digital"])
	}
}

func TestDigitalEmployeeRelationshipReaderReturnsNoneWhenNoReadableAgent(t *testing.T) {
	t.Parallel()

	reader := sharedaccess.NewDigitalEmployeeRelationshipReader(
		&knowledgeBaseReaderStub{items: []*kbentity.KnowledgeBase{{Code: "kb-digital", KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee}}},
		&knowledgeBaseBindingReaderStub{bindIDsByKnowledgeBase: map[string][]string{"kb-digital": {"agent-hidden"}}},
		&superMagicAgentAccessStub{},
	)

	operations, err := reader.ListOperations(context.Background(), kbaccess.Actor{OrganizationCode: "org", UserID: "user"}, []string{"kb-digital"})
	if err != nil {
		t.Fatalf("ListOperations() error = %v", err)
	}
	if _, ok := operations["kb-digital"]; ok {
		t.Fatalf("expected no derived operation, got %#v", operations)
	}
}

func TestDigitalEmployeeRelationshipReaderUsesBatchLookups(t *testing.T) {
	t.Parallel()

	kbReader := &knowledgeBaseReaderStub{items: []*kbentity.KnowledgeBase{
		{Code: "kb-1", KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee},
		{Code: "kb-2", KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee},
	}}
	bindingReader := &knowledgeBaseBindingReaderStub{bindIDsByKnowledgeBase: map[string][]string{
		"kb-1": {"agent-1"}, "kb-2": {"agent-2"},
	}}
	agentAccess := &superMagicAgentAccessStub{accessible: map[string]struct{}{"agent-1": {}, "agent-2": {}}}
	reader := sharedaccess.NewDigitalEmployeeRelationshipReader(kbReader, bindingReader, agentAccess)

	_, err := reader.ListOperations(context.Background(), kbaccess.Actor{OrganizationCode: "org", UserID: "user"}, []string{"kb-1", "kb-2"})
	if err != nil {
		t.Fatalf("ListOperations() error = %v", err)
	}
	if len(kbReader.queries) != 1 || !reflect.DeepEqual(kbReader.queries[0].Codes, []string{"kb-1", "kb-2"}) {
		t.Fatalf("expected one batched knowledge base lookup, got %#v", kbReader.queries)
	}
	if len(bindingReader.queries) != 1 || !reflect.DeepEqual(bindingReader.queries[0], []string{"kb-1", "kb-2"}) {
		t.Fatalf("expected one batched binding lookup, got %#v", bindingReader.queries)
	}
	if len(agentAccess.accessibleCalls) != 1 || !reflect.DeepEqual(agentAccess.accessibleCalls[0], []string{"agent-1", "agent-2"}) {
		t.Fatalf("expected one batched accessible lookup, got %#v", agentAccess.accessibleCalls)
	}
}

func TestDigitalEmployeeRelationshipReaderPropagatesLookupErrors(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name   string
		reader kbaccess.ExternalAccessReader
	}{
		{name: "knowledge base", reader: sharedaccess.NewDigitalEmployeeRelationshipReader(&knowledgeBaseReaderStub{err: errRelationshipLookup}, &knowledgeBaseBindingReaderStub{}, &superMagicAgentAccessStub{})},
		{name: "binding", reader: sharedaccess.NewDigitalEmployeeRelationshipReader(
			&knowledgeBaseReaderStub{items: []*kbentity.KnowledgeBase{{Code: "kb", KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee}}},
			&knowledgeBaseBindingReaderStub{err: errRelationshipLookup}, &superMagicAgentAccessStub{})},
		{name: "accessible agents", reader: sharedaccess.NewDigitalEmployeeRelationshipReader(
			&knowledgeBaseReaderStub{items: []*kbentity.KnowledgeBase{{Code: "kb", KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee}}},
			&knowledgeBaseBindingReaderStub{bindIDsByKnowledgeBase: map[string][]string{"kb": {"agent"}}},
			&superMagicAgentAccessStub{err: errRelationshipLookup})},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := tc.reader.ListOperations(context.Background(), kbaccess.Actor{OrganizationCode: "org", UserID: "user"}, []string{"kb"})
			if !errors.Is(err, errRelationshipLookup) {
				t.Fatalf("expected lookup error, got %v", err)
			}
		})
	}
}

func TestCompositePermissionReaderMergesStrongestOperation(t *testing.T) {
	t.Parallel()

	reader := sharedaccess.NewPermissionReader(
		permissionReaderStub{operations: map[string]string{
			"kb-edit":  "read",
			"kb-owner": "owner",
		}},
		staticExternalAccessReader{operations: map[string]kbaccess.Operation{
			"kb-edit":  kbaccess.OperationEdit,
			"kb-owner": kbaccess.OperationRead,
			"kb-read":  kbaccess.OperationRead,
		}},
	)

	operations, err := reader.ListOperations(context.Background(), "org", "user", []string{"kb-edit", "kb-owner", "kb-read"})
	if err != nil {
		t.Fatalf("ListOperations() error = %v", err)
	}
	expected := map[string]string{
		"kb-edit":  "edit",
		"kb-owner": "owner",
		"kb-read":  "read",
	}
	if !reflect.DeepEqual(operations, expected) {
		t.Fatalf("expected strongest merged operations %#v, got %#v", expected, operations)
	}
}

type knowledgeBaseReaderStub struct {
	items   []*kbentity.KnowledgeBase
	err     error
	queries []kbrepository.Query
}

func (s *knowledgeBaseReaderStub) List(_ context.Context, query *kbrepository.Query) ([]*kbentity.KnowledgeBase, int64, error) {
	if s.err != nil {
		return nil, 0, s.err
	}
	s.queries = append(s.queries, *query)
	return s.items, int64(len(s.items)), nil
}

type knowledgeBaseBindingReaderStub struct {
	bindIDsByKnowledgeBase map[string][]string
	err                    error
	queries                [][]string
}

func (s *knowledgeBaseBindingReaderStub) ListBindIDsByKnowledgeBases(_ context.Context, codes []string, _ kbentity.BindingType) (map[string][]string, error) {
	if s.err != nil {
		return nil, s.err
	}
	s.queries = append(s.queries, append([]string(nil), codes...))
	return s.bindIDsByKnowledgeBase, nil
}

type superMagicAgentAccessStub struct {
	accessible      map[string]struct{}
	manageable      map[string]struct{}
	err             error
	accessibleCalls [][]string
}

type permissionReaderStub struct {
	operations map[string]string
}

func (s permissionReaderStub) ListOperations(context.Context, string, string, []string) (map[string]string, error) {
	return s.operations, nil
}

type staticExternalAccessReader struct {
	operations map[string]kbaccess.Operation
}

func (s staticExternalAccessReader) ListOperations(context.Context, kbaccess.Actor, []string) (map[string]kbaccess.Operation, error) {
	return s.operations, nil
}

func (s *superMagicAgentAccessStub) ListAccessibleCodes(_ context.Context, _ string, _ string, codes []string) (map[string]struct{}, error) {
	if s.err != nil {
		return nil, s.err
	}
	s.accessibleCalls = append(s.accessibleCalls, append([]string(nil), codes...))
	return s.accessible, nil
}

func (s *superMagicAgentAccessStub) ListManageableCodes(_ context.Context, _ string, _ string, _ []string) (map[string]struct{}, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.manageable, nil
}
