package docapp

import (
	"context"
	"errors"
	"fmt"
	"strings"

	userdomain "magic/internal/domain/contact/user"
	docentity "magic/internal/domain/knowledge/document/entity"
	documentdomain "magic/internal/domain/knowledge/document/service"
	kbrepository "magic/internal/domain/knowledge/knowledgebase/repository"
	sourcebindingentity "magic/internal/domain/knowledge/sourcebinding/entity"
)

type documentUIDCandidate struct {
	value  string
	source string
}

const (
	documentReadUserCandidateMultiplier = 4
	documentReadUserCandidateCapacity   = 6
)

func (s *DocumentAppService) requireActiveUser(
	ctx context.Context,
	organizationCode string,
	userID string,
	action string,
) error {
	if s == nil || s.userService == nil {
		return nil
	}
	userID = strings.TrimSpace(userID)
	exists, err := s.userService.ExistsActiveUser(ctx, organizationCode, userID)
	if err != nil {
		return fmt.Errorf("check document active user: %w", err)
	}
	if !exists {
		return fmt.Errorf(
			"%w: action=%s organization_code=%s user_id=%s",
			errDocumentUserNotFound,
			strings.TrimSpace(action),
			strings.TrimSpace(organizationCode),
			userID,
		)
	}
	return nil
}

func (s *DocumentAppService) resolveDocumentReadUser(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
) (string, error) {
	resolved, err := s.resolveDocumentsReadUsers(ctx, []*docentity.KnowledgeBaseDocument{doc})
	if err != nil {
		return "", err
	}
	if doc == nil {
		return "", sharedDocumentReadUserError(nil)
	}
	userID := strings.TrimSpace(resolved[doc.Code])
	if userID == "" {
		return "", sharedDocumentReadUserError(doc)
	}
	return userID, nil
}

func (s *DocumentAppService) resolveDocumentsReadUsers(
	ctx context.Context,
	docs []*docentity.KnowledgeBaseDocument,
) (map[string]string, error) {
	return s.resolveDocumentsReadUsersWithPolicy(ctx, docs, true)
}

func (s *DocumentAppService) resolveDocumentsReadUsersBestEffort(
	ctx context.Context,
	docs []*docentity.KnowledgeBaseDocument,
) (map[string]string, error) {
	return s.resolveDocumentsReadUsersWithPolicy(ctx, docs, false)
}

func (s *DocumentAppService) resolveDocumentsReadUsersWithPolicy(
	ctx context.Context,
	docs []*docentity.KnowledgeBaseDocument,
	failOnMissing bool,
) (map[string]string, error) {
	result := make(map[string]string, len(docs))
	if s == nil || len(docs) == 0 {
		return result, nil
	}
	if s.userService == nil {
		return fallbackDocumentReadUsers(docs), nil
	}

	bindingsByKB, err := s.listSourceBindingsForReadUser(ctx, docs)
	if err != nil {
		return nil, err
	}
	knowledgeByCode, err := s.listKnowledgeBasesForReadUser(ctx, docs)
	if err != nil {
		return nil, err
	}

	candidatesByDoc, allCandidateValues := s.collectDocumentReadUserCandidates(docs, bindingsByKB, knowledgeByCode)
	directUsers, err := s.userService.ListActiveUserIDs(ctx, firstDocumentOrganizationCode(docs), allCandidateValues)
	if err != nil {
		return nil, fmt.Errorf("list active document read users: %w", err)
	}
	usersByMagicID, err := s.listDocumentReadUsersByMagicID(ctx, docs, allCandidateValues, directUsers)
	if err != nil {
		return nil, err
	}
	return s.applyResolvedDocumentReadUsers(ctx, docs, candidatesByDoc, directUsers, usersByMagicID, failOnMissing)
}

func fallbackDocumentReadUsers(docs []*docentity.KnowledgeBaseDocument) map[string]string {
	result := make(map[string]string, len(docs))
	for _, doc := range docs {
		if doc == nil || strings.TrimSpace(doc.Code) == "" {
			continue
		}
		result[doc.Code] = strings.TrimSpace(documentdomain.ResolveMappedDocumentUserID(doc))
	}
	return result
}

func (s *DocumentAppService) collectDocumentReadUserCandidates(
	docs []*docentity.KnowledgeBaseDocument,
	bindingsByKB map[string][]sourcebindingentity.Binding,
	knowledgeByCode map[string]knowledgeBaseUIDs,
) (map[string][]documentUIDCandidate, []string) {
	candidatesByDoc := make(map[string][]documentUIDCandidate, len(docs))
	allCandidateValues := make([]string, 0, len(docs)*documentReadUserCandidateMultiplier)
	for _, doc := range docs {
		if doc == nil || strings.TrimSpace(doc.Code) == "" {
			continue
		}
		candidates := s.documentReadUserCandidates(doc, bindingsByKB, knowledgeByCode)
		candidatesByDoc[doc.Code] = candidates
		for _, candidate := range candidates {
			allCandidateValues = append(allCandidateValues, candidate.value)
		}
	}
	return candidatesByDoc, allCandidateValues
}

func (s *DocumentAppService) listDocumentReadUsersByMagicID(
	ctx context.Context,
	docs []*docentity.KnowledgeBaseDocument,
	allCandidateValues []string,
	directUsers map[string]struct{},
) (map[string][]userdomain.User, error) {
	magicIDValues := make([]string, 0, len(allCandidateValues))
	for _, value := range allCandidateValues {
		if _, ok := directUsers[value]; !ok {
			magicIDValues = append(magicIDValues, value)
		}
	}
	usersByMagicID, err := s.userService.ListActiveUsersByMagicIDs(ctx, firstDocumentOrganizationCode(docs), magicIDValues)
	if err != nil {
		return nil, fmt.Errorf("list document read users by magic id: %w", err)
	}
	return usersByMagicID, nil
}

func (s *DocumentAppService) applyResolvedDocumentReadUsers(
	ctx context.Context,
	docs []*docentity.KnowledgeBaseDocument,
	candidatesByDoc map[string][]documentUIDCandidate,
	directUsers map[string]struct{},
	usersByMagicID map[string][]userdomain.User,
	failOnMissing bool,
) (map[string]string, error) {
	result := make(map[string]string, len(docs))
	for _, doc := range docs {
		if doc == nil || strings.TrimSpace(doc.Code) == "" {
			continue
		}
		userID, source := chooseResolvedDocumentUser(candidatesByDoc[doc.Code], directUsers, usersByMagicID)
		if userID == "" {
			if failOnMissing {
				s.logDocumentReadUserMissing(ctx, doc)
				return nil, sharedDocumentReadUserError(doc)
			}
			s.logSkippedDocumentReadUserMissing(ctx, doc)
			continue
		}
		result[doc.Code] = userID
		if err := s.healDocumentUIDs(ctx, doc, userID, directUsers, source); err != nil {
			return nil, err
		}
	}
	return result, nil
}

func (s *DocumentAppService) listSourceBindingsForReadUser(
	ctx context.Context,
	docs []*docentity.KnowledgeBaseDocument,
) (map[string][]sourcebindingentity.Binding, error) {
	if s == nil || s.sourceBindingRepo == nil {
		return map[string][]sourcebindingentity.Binding{}, nil
	}
	knowledgeBaseCodes := make([]string, 0, len(docs))
	for _, doc := range docs {
		if doc == nil || doc.SourceBindingID <= 0 {
			continue
		}
		knowledgeBaseCodes = append(knowledgeBaseCodes, doc.KnowledgeBaseCode)
	}
	bindings, err := s.sourceBindingRepo.ListBindingsByKnowledgeBases(ctx, knowledgeBaseCodes)
	if err != nil {
		return nil, fmt.Errorf("list source bindings for document uid self heal: %w", err)
	}
	return bindings, nil
}

func (s *DocumentAppService) listKnowledgeBasesForReadUser(
	ctx context.Context,
	docs []*docentity.KnowledgeBaseDocument,
) (map[string]knowledgeBaseUIDs, error) {
	if s == nil || s.kbService == nil {
		return map[string]knowledgeBaseUIDs{}, nil
	}
	organizationCode := firstDocumentOrganizationCode(docs)
	knowledgeBaseCodes := make([]string, 0, len(docs))
	for _, doc := range docs {
		if doc == nil {
			continue
		}
		knowledgeBaseCodes = append(knowledgeBaseCodes, doc.KnowledgeBaseCode)
	}
	knowledgeBaseCodes = dedupeDocumentStrings(knowledgeBaseCodes)
	if organizationCode == "" || len(knowledgeBaseCodes) == 0 {
		return map[string]knowledgeBaseUIDs{}, nil
	}
	items, _, err := s.kbService.List(ctx, &kbrepository.Query{
		OrganizationCode: organizationCode,
		Codes:            knowledgeBaseCodes,
		Limit:            len(knowledgeBaseCodes),
	})
	if err != nil {
		return nil, fmt.Errorf("list knowledge bases for document uid self heal: %w", err)
	}
	result := make(map[string]knowledgeBaseUIDs, len(items))
	for _, item := range items {
		if item == nil {
			continue
		}
		result[item.Code] = knowledgeBaseUIDs{created: item.CreatedUID, updated: item.UpdatedUID}
	}
	return result, nil
}

type knowledgeBaseUIDs struct {
	created string
	updated string
}

func (s *DocumentAppService) documentReadUserCandidates(
	doc *docentity.KnowledgeBaseDocument,
	bindingsByKB map[string][]sourcebindingentity.Binding,
	knowledgeByCode map[string]knowledgeBaseUIDs,
) []documentUIDCandidate {
	candidates := make([]documentUIDCandidate, 0, documentReadUserCandidateCapacity)
	appendCandidate := func(value, source string) {
		value = strings.TrimSpace(value)
		if value == "" {
			return
		}
		candidates = append(candidates, documentUIDCandidate{value: value, source: source})
	}
	appendCandidate(doc.UpdatedUID, "document.updated_uid")
	appendCandidate(doc.CreatedUID, "document.created_uid")
	for _, binding := range bindingsByKB[doc.KnowledgeBaseCode] {
		if binding.ID != doc.SourceBindingID {
			continue
		}
		appendCandidate(binding.UpdatedUID, "source_binding.updated_uid")
		appendCandidate(binding.CreatedUID, "source_binding.created_uid")
		break
	}
	if kb, ok := knowledgeByCode[doc.KnowledgeBaseCode]; ok {
		appendCandidate(kb.updated, "knowledge_base.updated_uid")
		appendCandidate(kb.created, "knowledge_base.created_uid")
	}
	return candidates
}

func chooseResolvedDocumentUser(
	candidates []documentUIDCandidate,
	directUsers map[string]struct{},
	usersByMagicID map[string][]userdomain.User,
) (string, string) {
	for _, candidate := range candidates {
		if _, ok := directUsers[candidate.value]; ok {
			return candidate.value, candidate.source
		}
		users := usersByMagicID[candidate.value]
		if len(users) > 0 {
			return strings.TrimSpace(users[0].UserID), candidate.source + ".magic_id"
		}
	}
	return "", ""
}

func (s *DocumentAppService) healDocumentUIDs(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	resolvedUserID string,
	directUsers map[string]struct{},
	source string,
) error {
	if doc == nil || resolvedUserID == "" {
		return nil
	}
	createdUID := strings.TrimSpace(doc.CreatedUID)
	updatedUID := strings.TrimSpace(doc.UpdatedUID)
	_, createdValid := directUsers[createdUID]
	_, updatedValid := directUsers[updatedUID]
	if createdValid && updatedValid {
		return nil
	}
	if !createdValid {
		doc.CreatedUID = resolvedUserID
	}
	if !updatedValid {
		doc.UpdatedUID = resolvedUserID
	}
	if s.logger != nil {
		s.logger.WarnContext(
			ctx,
			"Knowledge document uid self healed",
			"organization_code", doc.OrganizationCode,
			"knowledge_base_code", doc.KnowledgeBaseCode,
			"document_code", doc.Code,
			"old_created_uid", createdUID,
			"old_updated_uid", updatedUID,
			"resolved_user_id", resolvedUserID,
			"source", source,
		)
	}
	if err := s.domainService.Update(ctx, doc); err != nil {
		return fmt.Errorf("self heal document uid: %w", err)
	}
	return nil
}

func (s *DocumentAppService) logDocumentReadUserMissing(ctx context.Context, doc *docentity.KnowledgeBaseDocument) {
	if s == nil || s.logger == nil || doc == nil {
		return
	}
	s.logger.ErrorContext(
		ctx,
		"Document read user missing after uid self heal",
		"organization_code", doc.OrganizationCode,
		"knowledge_base_code", doc.KnowledgeBaseCode,
		"document_code", doc.Code,
		"created_uid", doc.CreatedUID,
		"updated_uid", doc.UpdatedUID,
		"source_binding_id", doc.SourceBindingID,
	)
}

func (s *DocumentAppService) logSkippedDocumentReadUserMissing(ctx context.Context, doc *docentity.KnowledgeBaseDocument) {
	if s == nil || s.logger == nil || doc == nil {
		return
	}
	s.logger.KnowledgeWarnContext(
		ctx,
		"Skip third-file document sync because read user is missing",
		"organization_code", doc.OrganizationCode,
		"knowledge_base_code", doc.KnowledgeBaseCode,
		"document_code", doc.Code,
		"created_uid", doc.CreatedUID,
		"updated_uid", doc.UpdatedUID,
		"source_binding_id", doc.SourceBindingID,
		"task_kind", thirdFileRevectorizeTaskKind,
		"skip_reason", "document_read_user_missing",
	)
}

func firstDocumentOrganizationCode(docs []*docentity.KnowledgeBaseDocument) string {
	for _, doc := range docs {
		if doc == nil {
			continue
		}
		if organizationCode := strings.TrimSpace(doc.OrganizationCode); organizationCode != "" {
			return organizationCode
		}
	}
	return ""
}

func sharedDocumentReadUserError(doc *docentity.KnowledgeBaseDocument) error {
	if doc == nil {
		return errDocumentUserNotFound
	}
	return fmt.Errorf(
		"%w: organization_code=%s knowledge_base_code=%s document_code=%s",
		errDocumentUserNotFound,
		doc.OrganizationCode,
		doc.KnowledgeBaseCode,
		doc.Code,
	)
}

func isDocumentReadUserMissingError(err error) bool {
	return errors.Is(err, errDocumentUserNotFound)
}

func dedupeDocumentStrings(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}
