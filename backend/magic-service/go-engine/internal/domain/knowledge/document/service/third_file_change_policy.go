package document

import (
	"strings"

	docentity "magic/internal/domain/knowledge/document/entity"
)

// ThirdFileBindingRef 描述 third-file 回调变更计划所需的绑定信息。
type ThirdFileBindingRef struct {
	ID                int64
	OrganizationCode  string
	KnowledgeBaseCode string
	Provider          string
	RootType          string
	RootRef           string
	UserID            string
	TargetCount       int
}

// ThirdFileCurrentRef 描述 third-file 当前文件。
type ThirdFileCurrentRef struct {
	ThirdFileID  string
	DocumentName string
}

// ThirdFileCreateTarget 表示 third-file 回调需要创建的文档目标。
type ThirdFileCreateTarget struct {
	BindingID         int64
	OrganizationCode  string
	KnowledgeBaseCode string
	Provider          string
	RootType          string
	RootRef           string
	UserID            string
	DocumentName      string
	ThirdFileID       string
	AutoAdded         bool
}

// ThirdFileChangePlan 描述 third-file 回调的领域决策。
type ThirdFileChangePlan struct {
	DeleteDocuments  []*docentity.KnowledgeBaseDocument
	ResyncDocuments  []*docentity.KnowledgeBaseDocument
	CreateTargets    []ThirdFileCreateTarget
	ExistingDocument map[int64]*docentity.KnowledgeBaseDocument
}

// BuildThirdFileChangePlan 依据当前文件覆盖到的 binding 和已有文档生成执行计划。
func BuildThirdFileChangePlan(
	task *ThirdFileRevectorizeInput,
	current ThirdFileCurrentRef,
	bindings []ThirdFileBindingRef,
	docs []*docentity.KnowledgeBaseDocument,
) ThirdFileChangePlan {
	if task == nil {
		return ThirdFileChangePlan{}
	}
	keptDocs, staleDocs := splitThirdFileDocumentsByBindingCoverageForPlan(docs, bindings)
	existingByBinding := buildExistingThirdFileDocumentsByBindingForPlan(keptDocs)
	return ThirdFileChangePlan{
		DeleteDocuments:  staleDocs,
		ResyncDocuments:  keptDocs,
		CreateTargets:    buildThirdFileCreateTargets(task, current, bindings, existingByBinding),
		ExistingDocument: existingByBinding,
	}
}

func splitThirdFileDocumentsByBindingCoverageForPlan(
	docs []*docentity.KnowledgeBaseDocument,
	bindings []ThirdFileBindingRef,
) ([]*docentity.KnowledgeBaseDocument, []*docentity.KnowledgeBaseDocument) {
	if len(docs) == 0 {
		return nil, nil
	}
	coveredBindingIDs := make(map[int64]struct{}, len(bindings))
	for _, binding := range bindings {
		if binding.ID > 0 {
			coveredBindingIDs[binding.ID] = struct{}{}
		}
	}
	kept := make([]*docentity.KnowledgeBaseDocument, 0, len(docs))
	stale := make([]*docentity.KnowledgeBaseDocument, 0)
	for _, doc := range docs {
		if doc == nil {
			continue
		}
		if doc.SourceBindingID <= 0 {
			kept = append(kept, doc)
			continue
		}
		if _, ok := coveredBindingIDs[doc.SourceBindingID]; ok {
			kept = append(kept, doc)
			continue
		}
		stale = append(stale, doc)
	}
	return kept, stale
}

func buildExistingThirdFileDocumentsByBindingForPlan(
	docs []*docentity.KnowledgeBaseDocument,
) map[int64]*docentity.KnowledgeBaseDocument {
	result := make(map[int64]*docentity.KnowledgeBaseDocument, len(docs))
	for _, doc := range docs {
		if doc == nil || doc.SourceBindingID <= 0 {
			continue
		}
		result[doc.SourceBindingID] = doc
	}
	return result
}

func buildThirdFileCreateTargets(
	task *ThirdFileRevectorizeInput,
	current ThirdFileCurrentRef,
	bindings []ThirdFileBindingRef,
	existingByBinding map[int64]*docentity.KnowledgeBaseDocument,
) []ThirdFileCreateTarget {
	targets := make([]ThirdFileCreateTarget, 0, len(bindings))
	for _, binding := range bindings {
		if binding.ID <= 0 {
			continue
		}
		if _, exists := existingByBinding[binding.ID]; exists {
			continue
		}
		targets = append(targets, ThirdFileCreateTarget{
			BindingID:         binding.ID,
			OrganizationCode:  strings.TrimSpace(binding.OrganizationCode),
			KnowledgeBaseCode: strings.TrimSpace(binding.KnowledgeBaseCode),
			Provider:          strings.TrimSpace(binding.Provider),
			RootType:          strings.TrimSpace(binding.RootType),
			RootRef:           strings.TrimSpace(binding.RootRef),
			UserID:            firstNonEmptyString(binding.UserID, task.UserID),
			DocumentName:      strings.TrimSpace(current.DocumentName),
			ThirdFileID:       strings.TrimSpace(current.ThirdFileID),
			AutoAdded:         binding.TargetCount == 0 && !strings.EqualFold(strings.TrimSpace(binding.RootType), "file"),
		})
	}
	return targets
}
