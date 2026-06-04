package client_test

import (
	"context"
	"testing"

	ipcclient "magic/internal/infrastructure/rpc/jsonrpc/client"
)

func TestPHPModelCallConfigRPCClientGetConfig(t *testing.T) {
	t.Parallel()

	c := ipcclient.NewPHPModelCallConfigRPCClient(nil, nil)
	c.SetModelCallConfigClientReadyFuncForTest(func() bool { return true })
	c.SetCallModelCallConfigRPCForTest(func(_ context.Context, request ipcclient.ModelCallConfigRequestForTest, out *ipcclient.RPCResultForTest[ipcclient.ModelCallConfigDataForTest]) error {
		if request.OrganizationCode != "DT001" {
			t.Fatalf("organization_code = %q", request.OrganizationCode)
		}
		if request.ModelID != "qwen3-omni-flash" {
			t.Fatalf("model_id = %q", request.ModelID)
		}
		if request.ModelType != "llm" {
			t.Fatalf("model_type = %q", request.ModelType)
		}
		out.Code = 0
		out.Message = rpcSuccessMessage
		out.Data = ipcclient.ModelCallConfigDataForTest{
			ModelID:        "qwen3-omni-flash",
			Model:          "qwen3-omni-flash",
			ProviderCode:   "DashScope",
			RequestBaseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
			AccessToken:    "token-1",
			RawConfig:      map[string]any{"base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1"},
		}
		return nil
	})

	config, err := c.GetConfig(t.Context(), " DT001 ", " qwen3-omni-flash ", " llm ")
	if err != nil {
		t.Fatalf("GetConfig() error = %v", err)
	}
	if config.ProviderCode != "DashScope" {
		t.Fatalf("provider_code = %q", config.ProviderCode)
	}
	if config.RequestBaseURL == "" || config.AccessToken == "" {
		t.Fatalf("config should include URL and token")
	}
}

func TestPHPModelCallConfigRPCClientRejectsIncompleteConfig(t *testing.T) {
	t.Parallel()

	c := ipcclient.NewPHPModelCallConfigRPCClient(nil, nil)
	c.SetModelCallConfigClientReadyFuncForTest(func() bool { return true })
	c.SetCallModelCallConfigRPCForTest(func(_ context.Context, _ ipcclient.ModelCallConfigRequestForTest, out *ipcclient.RPCResultForTest[ipcclient.ModelCallConfigDataForTest]) error {
		out.Code = 0
		out.Data = ipcclient.ModelCallConfigDataForTest{Model: "qwen3-omni-flash"}
		return nil
	})

	_, err := c.GetConfig(t.Context(), "DT001", "qwen3-omni-flash", "llm")
	if err == nil {
		t.Fatalf("GetConfig() should reject incomplete config")
	}
}
