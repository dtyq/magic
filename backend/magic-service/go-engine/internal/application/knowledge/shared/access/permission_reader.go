package sharedaccess

import (
	"context"
	"fmt"

	kbaccess "magic/internal/domain/knowledge/access/service"
)

// NewPermissionReader combines the PHP permission source with supplemental access sources.
func NewPermissionReader(
	base kbaccess.PermissionReader,
	supplemental kbaccess.ExternalAccessReader,
) kbaccess.PermissionReader {
	if base == nil && supplemental == nil {
		return nil
	}
	return permissionReader{base: base, supplemental: supplemental}
}

type permissionReader struct {
	base         kbaccess.PermissionReader
	supplemental kbaccess.ExternalAccessReader
}

func (r permissionReader) ListOperations(
	ctx context.Context,
	organizationCode string,
	userID string,
	knowledgeBaseCodes []string,
) (map[string]string, error) {
	operations := make(map[string]kbaccess.Operation)
	if r.base != nil {
		rawOperations, err := r.base.ListOperations(ctx, organizationCode, userID, knowledgeBaseCodes)
		if err != nil {
			return nil, fmt.Errorf("list base knowledge access operations: %w", err)
		}
		for code, rawOperation := range rawOperations {
			operations[code] = kbaccess.ParseOperation(rawOperation)
		}
	}
	if r.supplemental != nil {
		externalOperations, err := r.supplemental.ListOperations(ctx, kbaccess.Actor{
			OrganizationCode: organizationCode,
			UserID:           userID,
		}, knowledgeBaseCodes)
		if err != nil {
			return nil, fmt.Errorf("list supplemental knowledge access operations: %w", err)
		}
		for code, operation := range externalOperations {
			if operation.StrongerThan(operations[code]) {
				operations[code] = operation
			}
		}
	}

	result := make(map[string]string, len(operations))
	for code, operation := range operations {
		result[code] = string(operation)
	}
	return result, nil
}
