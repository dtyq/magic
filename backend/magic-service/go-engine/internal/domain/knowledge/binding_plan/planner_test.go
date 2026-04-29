package bindingplan_test

import (
	"testing"

	bindingplan "magic/internal/domain/knowledge/binding_plan"
)

const bindingPlanTestDocCode1 = "DOC-1"

func TestBuildAddsOnlyNewMembership(t *testing.T) {
	t.Parallel()

	plan := bindingplan.Build(bindingplan.PlanInput{
		CurrentBindings: []bindingplan.BindingSnapshot{
			{ID: 10, Provider: "project", RootType: "project", RootRef: "42"},
		},
		CurrentItems: []bindingplan.BindingItemSnapshot{
			{BindingID: 10, SourceItemID: 1001},
		},
		CurrentDocuments: []bindingplan.ManagedDocumentSnapshot{
			{ID: 1, Code: bindingPlanTestDocCode1, SourceBindingID: 10, SourceItemID: 1001},
		},
		DesiredBindings: []bindingplan.DesiredBinding{
			{
				Provider: "project",
				RootType: "project",
				RootRef:  "42",
				ResolvedItems: []bindingplan.ResolvedSourceItem{
					{SourceItemID: 1001, ResolveReason: "keep"},
					{SourceItemID: 1002, ResolveReason: "new"},
				},
			},
		},
	})

	if len(plan.DeleteTargets) != 0 {
		t.Fatalf("expected no delete targets, got %#v", plan.DeleteTargets)
	}
	if len(plan.KeepTargets) != 1 || plan.KeepTargets[0].Document.Code != bindingPlanTestDocCode1 {
		t.Fatalf("unexpected keep targets: %#v", plan.KeepTargets)
	}
	if len(plan.CreateTargets) != 1 || plan.CreateTargets[0].SourceItemID != 1002 {
		t.Fatalf("unexpected create targets: %#v", plan.CreateTargets)
	}
	if len(plan.FallbackTargets) != 0 {
		t.Fatalf("expected no fallback targets, got %#v", plan.FallbackTargets)
	}
}

func TestBuildDeletesOnlyRemovedMembership(t *testing.T) {
	t.Parallel()

	plan := bindingplan.Build(bindingplan.PlanInput{
		CurrentBindings: []bindingplan.BindingSnapshot{
			{ID: 10, Provider: "project", RootType: "project", RootRef: "42"},
		},
		CurrentItems: []bindingplan.BindingItemSnapshot{
			{BindingID: 10, SourceItemID: 1001},
			{BindingID: 10, SourceItemID: 1002},
		},
		CurrentDocuments: []bindingplan.ManagedDocumentSnapshot{
			{ID: 1, Code: bindingPlanTestDocCode1, SourceBindingID: 10, SourceItemID: 1001},
			{ID: 2, Code: "DOC-2", SourceBindingID: 10, SourceItemID: 1002},
		},
		DesiredBindings: []bindingplan.DesiredBinding{
			{
				Provider: "project",
				RootType: "project",
				RootRef:  "42",
				ResolvedItems: []bindingplan.ResolvedSourceItem{
					{SourceItemID: 1001, ResolveReason: "keep"},
				},
			},
		},
	})

	if len(plan.CreateTargets) != 0 {
		t.Fatalf("expected no create targets, got %#v", plan.CreateTargets)
	}
	if len(plan.DeleteTargets) != 1 || plan.DeleteTargets[0].Document.Code != "DOC-2" {
		t.Fatalf("unexpected delete targets: %#v", plan.DeleteTargets)
	}
	if len(plan.KeepTargets) != 1 || plan.KeepTargets[0].Document.Code != bindingPlanTestDocCode1 {
		t.Fatalf("unexpected keep targets: %#v", plan.KeepTargets)
	}
}

func TestBuildNoOpForSameMembershipSet(t *testing.T) {
	t.Parallel()

	plan := bindingplan.Build(bindingplan.PlanInput{
		CurrentBindings: []bindingplan.BindingSnapshot{
			{ID: 10, Provider: "teamshare", RootType: "knowledge_base", RootRef: "KB-1"},
		},
		CurrentItems: []bindingplan.BindingItemSnapshot{
			{BindingID: 10, SourceItemID: 2001},
		},
		CurrentDocuments: []bindingplan.ManagedDocumentSnapshot{
			{ID: 1, Code: bindingPlanTestDocCode1, SourceBindingID: 10, SourceItemID: 2001},
		},
		DesiredBindings: []bindingplan.DesiredBinding{
			{
				Provider: "teamshare",
				RootType: "knowledge_base",
				RootRef:  "KB-1",
				ResolvedItems: []bindingplan.ResolvedSourceItem{
					{SourceItemID: 2001, ResolveReason: "keep"},
				},
			},
		},
	})

	if len(plan.CreateTargets) != 0 || len(plan.DeleteTargets) != 0 {
		t.Fatalf("expected no creates/deletes, got create=%#v delete=%#v", plan.CreateTargets, plan.DeleteTargets)
	}
	if len(plan.KeepTargets) != 1 || plan.KeepTargets[0].Document.Code != bindingPlanTestDocCode1 {
		t.Fatalf("unexpected keep targets: %#v", plan.KeepTargets)
	}
}

func TestBuildFallbackOnlyForUnsafeBinding(t *testing.T) {
	t.Parallel()

	plan := bindingplan.Build(bindingplan.PlanInput{
		CurrentBindings: []bindingplan.BindingSnapshot{
			{ID: 10, Provider: "project", RootType: "project", RootRef: "42"},
			{ID: 20, Provider: "teamshare", RootType: "knowledge_base", RootRef: "KB-1"},
		},
		CurrentItems: []bindingplan.BindingItemSnapshot{
			{BindingID: 10, SourceItemID: 1001},
			{BindingID: 20, SourceItemID: 2001},
		},
		CurrentDocuments: []bindingplan.ManagedDocumentSnapshot{
			{ID: 1, Code: bindingPlanTestDocCode1, SourceBindingID: 10, SourceItemID: 1001},
			{ID: 2, Code: "DOC-2", SourceBindingID: 10, SourceItemID: 1001},
			{ID: 3, Code: "DOC-3", SourceBindingID: 20, SourceItemID: 2001},
		},
		DesiredBindings: []bindingplan.DesiredBinding{
			{
				Provider: "project",
				RootType: "project",
				RootRef:  "42",
				ResolvedItems: []bindingplan.ResolvedSourceItem{
					{SourceItemID: 1001, ResolveReason: "unsafe"},
				},
			},
			{
				Provider: "teamshare",
				RootType: "knowledge_base",
				RootRef:  "KB-1",
				ResolvedItems: []bindingplan.ResolvedSourceItem{
					{SourceItemID: 2001, ResolveReason: "keep"},
				},
			},
		},
	})

	if len(plan.FallbackTargets) != 1 || plan.FallbackTargets[0].CurrentBindingID != 10 {
		t.Fatalf("unexpected fallback targets: %#v", plan.FallbackTargets)
	}
	if len(plan.DeleteTargets) != 2 {
		t.Fatalf("expected two delete targets for fallback binding, got %#v", plan.DeleteTargets)
	}
	if len(plan.CreateTargets) != 1 || plan.CreateTargets[0].BindingKey != "project|project|42" {
		t.Fatalf("unexpected create targets: %#v", plan.CreateTargets)
	}
	if len(plan.KeepTargets) != 1 || plan.KeepTargets[0].Document.Code != "DOC-3" {
		t.Fatalf("unexpected keep targets: %#v", plan.KeepTargets)
	}
}
