package kbapp

import (
	"context"
	"errors"
	"fmt"
	"strings"

	kbaccess "magic/internal/domain/knowledge/access/service"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	"magic/internal/pkg/thirdplatform"
)

type knowledgeBaseExternalAccessReader struct {
	support *KnowledgeBaseAppService
}

func (r *knowledgeBaseExternalAccessReader) ListOperations(
	ctx context.Context,
	actor kbaccess.Actor,
	knowledgeBaseCodes []string,
) (map[string]kbaccess.Operation, error) {
	if r == nil || r.support == nil || r.support.thirdPlatformExpander == nil {
		return map[string]kbaccess.Operation{}, nil
	}

	items, err := r.support.thirdPlatformExpander.ListKnowledgeBases(
		ctx,
		thirdplatform.KnowledgeBaseListInput{
			OrganizationCode:              actor.OrganizationCode,
			UserID:                        actor.UserID,
			ThirdPlatformUserID:           actor.ThirdPlatformUserID,
			ThirdPlatformOrganizationCode: actor.ThirdPlatformOrganizationCode,
		},
	)
	if err != nil {
		if errors.Is(err, thirdplatform.ErrIdentityMissing) {
			return map[string]kbaccess.Operation{}, nil
		}
		return nil, fmt.Errorf("list teamshare manageable knowledge bases: %w", err)
	}
	if len(items) == 0 {
		return map[string]kbaccess.Operation{}, nil
	}

	businessIDs := make([]string, 0, len(items))
	for _, item := range items {
		businessID := strings.TrimSpace(item.KnowledgeBaseID)
		if businessID == "" {
			continue
		}
		businessIDs = append(businessIDs, businessID)
	}
	if len(businessIDs) == 0 {
		return map[string]kbaccess.Operation{}, nil
	}

	requestedCodes := make([]string, 0, len(knowledgeBaseCodes))
	for _, code := range knowledgeBaseCodes {
		trimmed := strings.TrimSpace(code)
		if trimmed == "" {
			continue
		}
		requestedCodes = append(requestedCodes, trimmed)
	}

	var localKnowledge map[string]*kbentity.KnowledgeBase
	if len(requestedCodes) > 0 {
		localKnowledge, err = r.support.listTeamshareKnowledgeByCodesAndBusinessIDs(
			ctx,
			actor.OrganizationCode,
			requestedCodes,
			businessIDs,
		)
	} else {
		localKnowledge, err = r.support.listTeamshareKnowledgeByBusinessIDs(ctx, actor.OrganizationCode, businessIDs)
	}
	if err != nil {
		return nil, err
	}

	operations := make(map[string]kbaccess.Operation, len(localKnowledge))
	for _, knowledgeBase := range localKnowledge {
		if knowledgeBase == nil {
			continue
		}
		operations[knowledgeBase.Code] = kbaccess.OperationAdmin
	}
	return operations, nil
}
