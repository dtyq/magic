package service

import (
	"context"

	"magic/internal/interfaces/rpc/jsonrpc/knowledge/dto"
	"magic/internal/pkg/ctxmeta"
)

func withAccessActorFromDataIsolation(ctx context.Context, dataIsolation dto.DataIsolation) context.Context {
	return ctxmeta.WithAccessActor(ctx, ctxmeta.AccessActor{
		OrganizationCode:              dataIsolation.ResolveOrganizationCode(),
		UserID:                        dataIsolation.UserID,
		ThirdPlatformUserID:           dataIsolation.ThirdPlatformUserID,
		ThirdPlatformOrganizationCode: dataIsolation.ThirdPlatformOrganizationCode,
	})
}
