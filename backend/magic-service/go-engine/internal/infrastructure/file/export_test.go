package file

import (
	"context"

	"github.com/volcengine/ve-tos-golang-sdk/v2/tos"

	"magic/internal/domain/knowledge/shared"
)

func NewTOSFileClientForTest(
	config *shared.StorageConfig,
	headObjectHook func(client *tos.ClientV2, ctx context.Context, input *tos.HeadObjectV2Input) (*tos.HeadObjectV2Output, error),
) *TOSFileClient {
	client := &tos.ClientV2{}
	headObject := func(ctx context.Context, input *tos.HeadObjectV2Input) (*tos.HeadObjectV2Output, error) {
		return client.HeadObjectV2(ctx, input)
	}
	if headObjectHook != nil {
		headObject = func(ctx context.Context, input *tos.HeadObjectV2Input) (*tos.HeadObjectV2Output, error) {
			return headObjectHook(client, ctx, input)
		}
	}
	return &TOSFileClient{
		client:     client,
		config:     config,
		headObject: headObject,
	}
}
