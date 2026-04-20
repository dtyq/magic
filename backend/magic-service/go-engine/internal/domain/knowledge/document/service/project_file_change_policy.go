package document

import (
	"strconv"
	"strings"

	"magic/internal/pkg/ctxmeta"
	"magic/internal/pkg/projectfile"
)

const projectFileDeletedStatus = "deleted"

// ProjectFileBindingTarget 描述项目文件绑定目标。
type ProjectFileBindingTarget struct {
	TargetType string
	TargetRef  string
}

// ProjectFileBindingRef 描述项目文件变更规划所需的绑定信息。
type ProjectFileBindingRef struct {
	ID                int64
	OrganizationCode  string
	KnowledgeBaseCode string
	Provider          string
	RootType          string
	RootRef           string
	SyncMode          string
	Enabled           bool
	UserID            string
	Targets           []ProjectFileBindingTarget
}

// ProjectFileCreateTarget 表示需要创建的项目文档目标。
type ProjectFileCreateTarget struct {
	BindingID         int64
	OrganizationCode  string
	KnowledgeBaseCode string
	UserID            string
	RootRef           string
	ProjectID         int64
	ProjectFileID     int64
	DocumentName      string
	AutoAdded         bool
}

// ProjectFileChangeActionGroup 表示单一语义分组下的执行动作。
type ProjectFileChangeActionGroup struct {
	CreateTargets  []ProjectFileCreateTarget
	ResyncRequests []*SyncDocumentInput
}

// ProjectFileChangePlan 描述项目文件变更的完整执行计划。
type ProjectFileChangePlan struct {
	Ignore                   bool
	DeleteDocuments          []*KnowledgeBaseDocument
	Standard                 ProjectFileChangeActionGroup
	Enterprise               ProjectFileChangeActionGroup
	NeedEnterpriseResolution bool
}

// CollectProjectFileKnowledgeBaseCodes 汇总项目文件变更涉及的知识库编码。
func CollectProjectFileKnowledgeBaseCodes(bindings []ProjectFileBindingRef, docs []*KnowledgeBaseDocument) []string {
	codes := make([]string, 0, len(bindings)+len(docs))
	seen := make(map[string]struct{}, len(bindings)+len(docs))
	for _, binding := range bindings {
		code := strings.TrimSpace(binding.KnowledgeBaseCode)
		if code == "" {
			continue
		}
		if _, exists := seen[code]; exists {
			continue
		}
		seen[code] = struct{}{}
		codes = append(codes, code)
	}
	for _, doc := range docs {
		if doc == nil {
			continue
		}
		code := strings.TrimSpace(doc.KnowledgeBaseCode)
		if code == "" {
			continue
		}
		if _, exists := seen[code]; exists {
			continue
		}
		seen[code] = struct{}{}
		codes = append(codes, code)
	}
	return codes
}

// BuildProjectFileChangePlan 根据元数据、绑定和现有文档生成执行计划。
func BuildProjectFileChangePlan(
	meta *projectfile.Meta,
	bindings []ProjectFileBindingRef,
	docs []*KnowledgeBaseDocument,
	useSourceOverrideByKnowledgeBase map[string]bool,
) ProjectFileChangePlan {
	if meta == nil {
		return ProjectFileChangePlan{}
	}
	if strings.EqualFold(strings.TrimSpace(meta.Status), projectFileDeletedStatus) {
		return ProjectFileChangePlan{DeleteDocuments: cloneProjectDocuments(docs)}
	}
	if meta.IsDirectory {
		return ProjectFileChangePlan{Ignore: true}
	}

	applicableBindings := filterApplicableProjectBindingsForPlan(bindings, meta.ProjectFileID)
	if len(bindings) > 0 && len(applicableBindings) == 0 {
		return ProjectFileChangePlan{}
	}

	existingByBinding := buildExistingProjectDocumentRefs(docs)
	standardBindings, enterpriseBindings := partitionProjectBindingsForPlan(applicableBindings, useSourceOverrideByKnowledgeBase)
	standardDocs, enterpriseDocs := partitionProjectDocumentsForPlan(docs, useSourceOverrideByKnowledgeBase)

	if len(bindings) == 0 {
		return ProjectFileChangePlan{
			Standard: ProjectFileChangeActionGroup{
				ResyncRequests: buildProjectFileDocResyncRequests(standardDocs, nil),
			},
			Enterprise: ProjectFileChangeActionGroup{
				ResyncRequests: buildProjectFileDocResyncRequests(enterpriseDocs, nil),
			},
			NeedEnterpriseResolution: len(enterpriseDocs) > 0,
		}
	}

	return ProjectFileChangePlan{
		Standard: ProjectFileChangeActionGroup{
			CreateTargets:  buildProjectFileCreateTargets(meta, standardBindings, existingByBinding),
			ResyncRequests: buildProjectFileBindingResyncRequests(standardBindings, existingByBinding, nil),
		},
		Enterprise: ProjectFileChangeActionGroup{
			CreateTargets:  buildProjectFileCreateTargets(meta, enterpriseBindings, existingByBinding),
			ResyncRequests: buildProjectFileBindingResyncRequests(enterpriseBindings, existingByBinding, nil),
		},
		NeedEnterpriseResolution: len(enterpriseBindings) > 0,
	}
}

type existingProjectDocumentRef struct {
	BindingID         int64
	KnowledgeBaseCode string
	OrganizationCode  string
	Code              string
}

func buildExistingProjectDocumentRefs(docs []*KnowledgeBaseDocument) map[int64]existingProjectDocumentRef {
	results := make(map[int64]existingProjectDocumentRef, len(docs))
	for _, doc := range docs {
		if doc == nil || doc.SourceBindingID <= 0 {
			continue
		}
		results[doc.SourceBindingID] = existingProjectDocumentRef{
			BindingID:         doc.SourceBindingID,
			KnowledgeBaseCode: strings.TrimSpace(doc.KnowledgeBaseCode),
			OrganizationCode:  strings.TrimSpace(doc.OrganizationCode),
			Code:              strings.TrimSpace(doc.Code),
		}
	}
	return results
}

func filterApplicableProjectBindingsForPlan(bindings []ProjectFileBindingRef, projectFileID int64) []ProjectFileBindingRef {
	results := make([]ProjectFileBindingRef, 0, len(bindings))
	projectFileRef := strings.TrimSpace(projectfileRef(projectFileID))
	for _, binding := range bindings {
		if !binding.Enabled ||
			!strings.EqualFold(strings.TrimSpace(binding.Provider), "project") ||
			!strings.EqualFold(strings.TrimSpace(binding.RootType), "project") ||
			!strings.EqualFold(strings.TrimSpace(binding.SyncMode), "realtime") {
			continue
		}
		if len(binding.Targets) == 0 {
			results = append(results, binding)
			continue
		}
		for _, target := range binding.Targets {
			if strings.EqualFold(strings.TrimSpace(target.TargetType), "file") &&
				strings.TrimSpace(target.TargetRef) == projectFileRef {
				results = append(results, binding)
				break
			}
		}
	}
	return results
}

func partitionProjectBindingsForPlan(
	bindings []ProjectFileBindingRef,
	useSourceOverrideByKnowledgeBase map[string]bool,
) ([]ProjectFileBindingRef, []ProjectFileBindingRef) {
	standard := make([]ProjectFileBindingRef, 0, len(bindings))
	enterprise := make([]ProjectFileBindingRef, 0, len(bindings))
	for _, binding := range bindings {
		if useSourceOverrideByKnowledgeBase[strings.TrimSpace(binding.KnowledgeBaseCode)] {
			enterprise = append(enterprise, binding)
			continue
		}
		standard = append(standard, binding)
	}
	return standard, enterprise
}

func partitionProjectDocumentsForPlan(
	docs []*KnowledgeBaseDocument,
	useSourceOverrideByKnowledgeBase map[string]bool,
) ([]*KnowledgeBaseDocument, []*KnowledgeBaseDocument) {
	standard := make([]*KnowledgeBaseDocument, 0, len(docs))
	enterprise := make([]*KnowledgeBaseDocument, 0, len(docs))
	for _, doc := range docs {
		if doc == nil {
			continue
		}
		if useSourceOverrideByKnowledgeBase[strings.TrimSpace(doc.KnowledgeBaseCode)] {
			enterprise = append(enterprise, doc)
			continue
		}
		standard = append(standard, doc)
	}
	return standard, enterprise
}

func buildProjectFileCreateTargets(
	meta *projectfile.Meta,
	bindings []ProjectFileBindingRef,
	existingByBinding map[int64]existingProjectDocumentRef,
) []ProjectFileCreateTarget {
	targets := make([]ProjectFileCreateTarget, 0, len(bindings))
	for _, binding := range bindings {
		if _, exists := existingByBinding[binding.ID]; exists {
			continue
		}
		targets = append(targets, ProjectFileCreateTarget{
			BindingID:         binding.ID,
			OrganizationCode:  strings.TrimSpace(binding.OrganizationCode),
			KnowledgeBaseCode: strings.TrimSpace(binding.KnowledgeBaseCode),
			UserID:            strings.TrimSpace(binding.UserID),
			RootRef:           strings.TrimSpace(binding.RootRef),
			ProjectID:         meta.ProjectID,
			ProjectFileID:     meta.ProjectFileID,
			DocumentName:      resolveProjectFileDocumentName(meta),
			AutoAdded:         len(binding.Targets) == 0,
		})
	}
	return targets
}

func buildProjectFileBindingResyncRequests(
	bindings []ProjectFileBindingRef,
	existingByBinding map[int64]existingProjectDocumentRef,
	override *SourceOverride,
) []*SyncDocumentInput {
	requests := make([]*SyncDocumentInput, 0, len(bindings))
	for _, binding := range bindings {
		existing, ok := existingByBinding[binding.ID]
		if !ok || existing.Code == "" || existing.KnowledgeBaseCode == "" {
			continue
		}
		requests = append(requests, &SyncDocumentInput{
			OrganizationCode:  existing.OrganizationCode,
			KnowledgeBaseCode: existing.KnowledgeBaseCode,
			Code:              existing.Code,
			Mode:              SyncModeResync,
			Async:             true,
			BusinessParams: &ctxmeta.BusinessParams{
				OrganizationCode: existing.OrganizationCode,
				UserID:           strings.TrimSpace(binding.UserID),
				BusinessID:       existing.KnowledgeBaseCode,
			},
			SourceOverride: CloneProjectSourceOverride(override),
		})
	}
	return requests
}

func buildProjectFileDocResyncRequests(docs []*KnowledgeBaseDocument, override *SourceOverride) []*SyncDocumentInput {
	requests := make([]*SyncDocumentInput, 0, len(docs))
	for _, doc := range docs {
		if doc == nil {
			continue
		}
		requests = append(requests, &SyncDocumentInput{
			OrganizationCode:  strings.TrimSpace(doc.OrganizationCode),
			KnowledgeBaseCode: strings.TrimSpace(doc.KnowledgeBaseCode),
			Code:              strings.TrimSpace(doc.Code),
			Mode:              SyncModeResync,
			Async:             true,
			SourceOverride:    CloneProjectSourceOverride(override),
		})
	}
	return requests
}

// CloneProjectSourceOverride 复制项目文件同步场景使用的 SourceOverride。
func CloneProjectSourceOverride(override *SourceOverride) *SourceOverride {
	if override == nil {
		return nil
	}
	cloned := *override
	cloned.DocumentFile = CloneDocumentFilePayload(override.DocumentFile)
	return &cloned
}

func cloneProjectDocuments(docs []*KnowledgeBaseDocument) []*KnowledgeBaseDocument {
	if len(docs) == 0 {
		return nil
	}
	cloned := make([]*KnowledgeBaseDocument, 0, len(docs))
	for _, doc := range docs {
		if doc != nil {
			cloned = append(cloned, doc)
		}
	}
	return cloned
}

func resolveProjectFileDocumentName(meta *projectfile.Meta) string {
	if meta == nil {
		return ""
	}
	if name := strings.TrimSpace(meta.FileName); name != "" {
		return name
	}
	if path := strings.TrimSpace(meta.RelativeFilePath); path != "" {
		return path
	}
	return projectfileRef(meta.ProjectFileID)
}

func projectfileRef(projectFileID int64) string {
	if projectFileID <= 0 {
		return ""
	}
	return strconv.FormatInt(projectFileID, 10)
}
