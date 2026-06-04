package client_test

import (
	"context"
	"testing"

	ipcclient "magic/internal/infrastructure/rpc/jsonrpc/client"
)

const aiAbilityRPCSuccessMessage = "success"

func TestPHPAIAbilityConfigRPCClientGetConfig(t *testing.T) {
	t.Parallel()

	c := ipcclient.NewPHPAIAbilityConfigRPCClient(nil, nil)
	c.SetAIAbilityConfigClientReadyFuncForTest(func() bool { return true })
	c.SetCallAIAbilityConfigRPCForTest(func(_ context.Context, request ipcclient.AIAbilityConfigRequestForTest, out *ipcclient.RPCResultForTest[ipcclient.AIAbilityConfigDataForTest]) error {
		if request.OrganizationCode != "DT001" {
			t.Fatalf("organization_code = %q", request.OrganizationCode)
		}
		if request.AbilityCode != "knowledge_base_visual_understanding" {
			t.Fatalf("ability_code = %q", request.AbilityCode)
		}
		out.Code = 0
		out.Message = aiAbilityRPCSuccessMessage
		out.Data = ipcclient.AIAbilityConfigDataForTest{
			Enabled:          true,
			Code:             "knowledge_base_visual_understanding",
			OrganizationCode: "TGosRaFhvb",
			Config:           map[string]any{"model_id": "qwen-vl-plus"},
		}
		return nil
	})

	config, err := c.GetConfig(t.Context(), " DT001 ", " knowledge_base_visual_understanding ")
	if err != nil {
		t.Fatalf("GetConfig() error = %v", err)
	}
	if !config.Enabled {
		t.Fatalf("config should be enabled")
	}
	if config.Config["model_id"] != "qwen-vl-plus" {
		t.Fatalf("model_id = %v", config.Config["model_id"])
	}
	if config.OrganizationCode != "TGosRaFhvb" {
		t.Fatalf("organization_code = %q", config.OrganizationCode)
	}
}

func TestPHPAIAbilityConfigRPCClientReturnsRPCError(t *testing.T) {
	t.Parallel()

	c := ipcclient.NewPHPAIAbilityConfigRPCClient(nil, nil)
	c.SetAIAbilityConfigClientReadyFuncForTest(func() bool { return true })
	c.SetCallAIAbilityConfigRPCForTest(func(_ context.Context, _ ipcclient.AIAbilityConfigRequestForTest, out *ipcclient.RPCResultForTest[ipcclient.AIAbilityConfigDataForTest]) error {
		out.Code = 500
		out.Message = "failed"
		return nil
	})

	_, err := c.GetConfig(t.Context(), "DT001", "knowledge_base_visual_understanding")
	if err == nil {
		t.Fatalf("GetConfig() should return RPC envelope error")
	}
}
