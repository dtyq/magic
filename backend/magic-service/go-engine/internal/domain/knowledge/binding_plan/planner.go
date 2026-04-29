// Package bindingplan 负责来源绑定增量更新的纯规划逻辑。
package bindingplan

import (
	"slices"
	"strconv"
	"strings"
)

// BindingSnapshot 表示当前持久化 binding 的稳定快照。
type BindingSnapshot struct {
	ID       int64
	Provider string
	RootType string
	RootRef  string
}

// BindingTargetSnapshot 表示 binding target 的稳定快照。
type BindingTargetSnapshot struct {
	TargetType string
	TargetRef  string
}

// BindingItemSnapshot 表示 binding item 的稳定快照。
type BindingItemSnapshot struct {
	BindingID    int64
	SourceItemID int64
}

// ManagedDocumentSnapshot 表示托管文档的稳定快照。
type ManagedDocumentSnapshot struct {
	ID              int64
	Code            string
	SourceBindingID int64
	SourceItemID    int64
}

// ResolvedSourceItem 表示新 binding 解析出的目标来源项。
type ResolvedSourceItem struct {
	SourceItemID  int64
	ResolveReason string
}

// DesiredBinding 表示目标 binding 与其目标来源项集合。
type DesiredBinding struct {
	Provider      string
	RootType      string
	RootRef       string
	SyncMode      string
	Enabled       bool
	SyncConfig    map[string]any
	Targets       []BindingTargetSnapshot
	ResolvedItems []ResolvedSourceItem
}

// BindingApplyTarget 表示需要保留/新增并落库的 binding。
type BindingApplyTarget struct {
	CurrentBindingID int64
	DesiredBinding   DesiredBinding
	DesiredItems     []ResolvedSourceItem
}

// CreateTarget 表示需要新增托管文档的目标。
type CreateTarget struct {
	BindingKey    string
	SourceItemID  int64
	ResolveReason string
}

// DeleteTarget 表示需要删除的托管文档。
type DeleteTarget struct {
	Document ManagedDocumentSnapshot
}

// KeepTarget 表示保留不动的托管文档。
type KeepTarget struct {
	Document ManagedDocumentSnapshot
}

// FallbackTarget 表示当前 binding 必须局部回退为“删光再重建”。
type FallbackTarget struct {
	BindingKey       string
	CurrentBindingID int64
}

// BindingChangePlan 表示一次增量更新的执行计划。
type BindingChangePlan struct {
	DeleteBindingIDs []int64
	ApplyBindings    []BindingApplyTarget
	CreateTargets    []CreateTarget
	DeleteTargets    []DeleteTarget
	KeepTargets      []KeepTarget
	FallbackTargets  []FallbackTarget
}

// PlanInput 表示 planner 的纯输入。
type PlanInput struct {
	CurrentBindings  []BindingSnapshot
	CurrentItems     []BindingItemSnapshot
	CurrentDocuments []ManagedDocumentSnapshot
	DesiredBindings  []DesiredBinding
}

type planningState struct {
	currentBindingByKey         map[string]BindingSnapshot
	currentItemsByBinding       map[int64]map[int64]int
	currentDocumentsByBinding   map[int64][]ManagedDocumentSnapshot
	currentDocumentByMembership map[string]ManagedDocumentSnapshot
	duplicateDocumentBindings   map[int64]struct{}
	desiredKeys                 map[string]struct{}
}

// Build 生成 binding 增量变更计划。
func Build(input PlanInput) BindingChangePlan {
	state, duplicateBindingDeleteIDs := buildPlanningState(input)
	plan := BindingChangePlan{
		DeleteBindingIDs: append([]int64(nil), duplicateBindingDeleteIDs...),
		ApplyBindings:    make([]BindingApplyTarget, 0, len(input.DesiredBindings)),
		CreateTargets:    make([]CreateTarget, 0),
		DeleteTargets:    make([]DeleteTarget, 0),
		KeepTargets:      make([]KeepTarget, 0),
		FallbackTargets:  make([]FallbackTarget, 0),
	}
	planDesiredBindings(&plan, state, input.DesiredBindings)
	planRemovedBindings(&plan, state, input.CurrentBindings)
	sortPlan(&plan)
	return plan
}

func buildPlanningState(input PlanInput) (planningState, []int64) {
	state := planningState{
		currentBindingByKey:         make(map[string]BindingSnapshot, len(input.CurrentBindings)),
		currentItemsByBinding:       make(map[int64]map[int64]int, len(input.CurrentBindings)),
		currentDocumentsByBinding:   make(map[int64][]ManagedDocumentSnapshot, len(input.CurrentBindings)),
		currentDocumentByMembership: make(map[string]ManagedDocumentSnapshot, len(input.CurrentDocuments)),
		duplicateDocumentBindings:   make(map[int64]struct{}),
		desiredKeys:                 make(map[string]struct{}, len(input.DesiredBindings)),
	}
	duplicateBindingDeleteIDs := make([]int64, 0)
	for _, binding := range input.CurrentBindings {
		key := BindingKey(binding.Provider, binding.RootType, binding.RootRef)
		if _, exists := state.currentBindingByKey[key]; exists {
			if binding.ID != 0 {
				duplicateBindingDeleteIDs = append(duplicateBindingDeleteIDs, binding.ID)
			}
			continue
		}
		state.currentBindingByKey[key] = binding
	}
	for _, item := range input.CurrentItems {
		bindingItems := state.currentItemsByBinding[item.BindingID]
		if bindingItems == nil {
			bindingItems = make(map[int64]int)
			state.currentItemsByBinding[item.BindingID] = bindingItems
		}
		bindingItems[item.SourceItemID]++
	}
	for _, doc := range input.CurrentDocuments {
		state.currentDocumentsByBinding[doc.SourceBindingID] = append(state.currentDocumentsByBinding[doc.SourceBindingID], doc)
		membershipKey := buildMembershipKey(doc.SourceBindingID, doc.SourceItemID)
		if _, exists := state.currentDocumentByMembership[membershipKey]; exists {
			state.duplicateDocumentBindings[doc.SourceBindingID] = struct{}{}
			continue
		}
		state.currentDocumentByMembership[membershipKey] = doc
	}
	return state, duplicateBindingDeleteIDs
}

func planDesiredBindings(plan *BindingChangePlan, state planningState, desiredBindings []DesiredBinding) {
	for _, desired := range desiredBindings {
		key := BindingKey(desired.Provider, desired.RootType, desired.RootRef)
		state.desiredKeys[key] = struct{}{}
		planSingleDesiredBinding(plan, state, key, desired)
	}
}

func planSingleDesiredBinding(plan *BindingChangePlan, state planningState, key string, desired DesiredBinding) {
	currentBinding, matched := state.currentBindingByKey[key]
	desiredItems := dedupeResolvedItems(desired.ResolvedItems)
	plan.ApplyBindings = append(plan.ApplyBindings, BindingApplyTarget{
		CurrentBindingID: currentBinding.ID,
		DesiredBinding:   desired,
		DesiredItems:     desiredItems,
	})
	if !matched {
		appendCreateTargets(plan, key, desiredItems)
		return
	}
	if shouldFallbackBinding(
		currentBinding.ID,
		state.currentItemsByBinding,
		state.currentDocumentsByBinding,
		state.duplicateDocumentBindings,
	) {
		plan.FallbackTargets = append(plan.FallbackTargets, FallbackTarget{
			BindingKey:       key,
			CurrentBindingID: currentBinding.ID,
		})
		appendDeleteTargets(plan, state.currentDocumentsByBinding[currentBinding.ID])
		appendCreateTargets(plan, key, desiredItems)
		return
	}
	planMatchedBindingTargets(plan, state, key, currentBinding.ID, desiredItems)
}

func planMatchedBindingTargets(
	plan *BindingChangePlan,
	state planningState,
	key string,
	bindingID int64,
	desiredItems []ResolvedSourceItem,
) {
	desiredItemIDs := make(map[int64]ResolvedSourceItem, len(desiredItems))
	for _, item := range desiredItems {
		desiredItemIDs[item.SourceItemID] = item
		doc, exists := state.currentDocumentByMembership[buildMembershipKey(bindingID, item.SourceItemID)]
		if exists {
			plan.KeepTargets = append(plan.KeepTargets, KeepTarget{Document: doc})
			continue
		}
		plan.CreateTargets = append(plan.CreateTargets, CreateTarget{
			BindingKey:    key,
			SourceItemID:  item.SourceItemID,
			ResolveReason: item.ResolveReason,
		})
	}
	for _, doc := range state.currentDocumentsByBinding[bindingID] {
		if _, exists := desiredItemIDs[doc.SourceItemID]; exists {
			continue
		}
		plan.DeleteTargets = append(plan.DeleteTargets, DeleteTarget{Document: doc})
	}
}

func planRemovedBindings(plan *BindingChangePlan, state planningState, currentBindings []BindingSnapshot) {
	for _, binding := range currentBindings {
		key := BindingKey(binding.Provider, binding.RootType, binding.RootRef)
		if _, exists := state.desiredKeys[key]; exists {
			continue
		}
		if binding.ID != 0 {
			plan.DeleteBindingIDs = append(plan.DeleteBindingIDs, binding.ID)
		}
		appendDeleteTargets(plan, state.currentDocumentsByBinding[binding.ID])
	}
}

func appendCreateTargets(plan *BindingChangePlan, bindingKey string, items []ResolvedSourceItem) {
	for _, item := range items {
		plan.CreateTargets = append(plan.CreateTargets, CreateTarget{
			BindingKey:    bindingKey,
			SourceItemID:  item.SourceItemID,
			ResolveReason: item.ResolveReason,
		})
	}
}

func appendDeleteTargets(plan *BindingChangePlan, docs []ManagedDocumentSnapshot) {
	for _, doc := range docs {
		plan.DeleteTargets = append(plan.DeleteTargets, DeleteTarget{Document: doc})
	}
}

func shouldFallbackBinding(
	bindingID int64,
	currentItemsByBinding map[int64]map[int64]int,
	currentDocumentsByBinding map[int64][]ManagedDocumentSnapshot,
	duplicateDocumentMembership map[int64]struct{},
) bool {
	if _, duplicated := duplicateDocumentMembership[bindingID]; duplicated {
		return true
	}
	for sourceItemID, count := range currentItemsByBinding[bindingID] {
		if sourceItemID == 0 || count > 1 {
			return true
		}
	}
	for _, doc := range currentDocumentsByBinding[bindingID] {
		if doc.SourceItemID == 0 {
			return true
		}
	}
	return false
}

func dedupeResolvedItems(items []ResolvedSourceItem) []ResolvedSourceItem {
	if len(items) == 0 {
		return []ResolvedSourceItem{}
	}
	seen := make(map[int64]struct{}, len(items))
	result := make([]ResolvedSourceItem, 0, len(items))
	for _, item := range items {
		if item.SourceItemID == 0 {
			continue
		}
		if _, exists := seen[item.SourceItemID]; exists {
			continue
		}
		seen[item.SourceItemID] = struct{}{}
		result = append(result, item)
	}
	return result
}

// BindingKey 返回 binding 的稳定对比键。
func BindingKey(provider, rootType, rootRef string) string {
	return strings.Join([]string{
		strings.ToLower(strings.TrimSpace(provider)),
		strings.ToLower(strings.TrimSpace(rootType)),
		strings.TrimSpace(rootRef),
	}, "|")
}

func buildMembershipKey(bindingID, sourceItemID int64) string {
	return strconv.FormatInt(bindingID, 10) + "|" + strconv.FormatInt(sourceItemID, 10)
}

func sortPlan(plan *BindingChangePlan) {
	slices.Sort(plan.DeleteBindingIDs)
	slices.SortFunc(plan.ApplyBindings, func(left, right BindingApplyTarget) int {
		return strings.Compare(
			BindingKey(left.DesiredBinding.Provider, left.DesiredBinding.RootType, left.DesiredBinding.RootRef),
			BindingKey(right.DesiredBinding.Provider, right.DesiredBinding.RootType, right.DesiredBinding.RootRef),
		)
	})
	slices.SortFunc(plan.CreateTargets, func(left, right CreateTarget) int {
		if cmp := strings.Compare(left.BindingKey, right.BindingKey); cmp != 0 {
			return cmp
		}
		switch {
		case left.SourceItemID < right.SourceItemID:
			return -1
		case left.SourceItemID > right.SourceItemID:
			return 1
		default:
			return 0
		}
	})
	slices.SortFunc(plan.DeleteTargets, func(left, right DeleteTarget) int {
		return strings.Compare(left.Document.Code, right.Document.Code)
	})
	slices.SortFunc(plan.KeepTargets, func(left, right KeepTarget) int {
		return strings.Compare(left.Document.Code, right.Document.Code)
	})
	slices.SortFunc(plan.FallbackTargets, func(left, right FallbackTarget) int {
		return strings.Compare(left.BindingKey, right.BindingKey)
	})
}
