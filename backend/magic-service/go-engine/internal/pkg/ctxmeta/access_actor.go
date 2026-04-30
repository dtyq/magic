package ctxmeta

import "context"

// AccessActor 表示一次请求里的知识库权限主体。
type AccessActor struct {
	OrganizationCode              string
	UserID                        string
	ThirdPlatformUserID           string
	ThirdPlatformOrganizationCode string
}

type accessActorContextKey struct{}

// WithAccessActor 将权限主体写入 context，供知识库应用服务复用。
func WithAccessActor(ctx context.Context, actor AccessActor) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	if actor.OrganizationCode == "" &&
		actor.UserID == "" &&
		actor.ThirdPlatformUserID == "" &&
		actor.ThirdPlatformOrganizationCode == "" {
		return ctx
	}
	return context.WithValue(ctx, accessActorContextKey{}, actor)
}

// AccessActorFromContext 从 context 读取权限主体。
func AccessActorFromContext(ctx context.Context) (AccessActor, bool) {
	if ctx == nil {
		return AccessActor{}, false
	}
	actor, ok := ctx.Value(accessActorContextKey{}).(AccessActor)
	if !ok {
		return AccessActor{}, false
	}
	if actor.OrganizationCode == "" &&
		actor.UserID == "" &&
		actor.ThirdPlatformUserID == "" &&
		actor.ThirdPlatformOrganizationCode == "" {
		return AccessActor{}, false
	}
	return actor, true
}
