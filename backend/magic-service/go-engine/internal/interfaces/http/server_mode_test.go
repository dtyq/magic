package httpapi_test

import (
	"context"
	"testing"

	"github.com/gin-gonic/gin"

	httpapi "magic/internal/interfaces/http"
)

func TestNewServerWithDependenciesSetsGinModeFromResolvedMode(t *testing.T) {
	originalMode := gin.Mode()
	t.Cleanup(func() {
		gin.SetMode(originalMode)
	})

	testCases := []struct {
		name string
		env  string
		mode httpapi.Mode
		want string
	}{
		{name: "debug from APP_ENV local", env: "local", want: gin.DebugMode},
		{name: "release from APP_ENV production", env: "production", want: gin.ReleaseMode},
		{name: "release from APP_ENV saas-prod", env: "saas-prod", want: gin.ReleaseMode},
		{name: "release from APP_ENV dev", env: "dev", want: gin.ReleaseMode},
		{name: "release from APP_ENV empty", env: "", want: gin.ReleaseMode},
		{name: "test from explicit mode", env: "production", mode: httpapi.ModeTest, want: gin.TestMode},
		{name: "release from explicit mode", env: "dev", mode: httpapi.ModeRelease, want: gin.ReleaseMode},
		{name: "debug from explicit mode", env: "production", mode: httpapi.ModeDebug, want: gin.DebugMode},
		{name: "trim and lower explicit mode", env: "dev", mode: httpapi.Mode(" ReLeAsE "), want: gin.ReleaseMode},
	}

	for _, tc := range testCases {
		t.Setenv("APP_ENV", tc.env)

		httpapi.NewServerWithDependencies(&httpapi.ServerDependencies{
			Config: &httpapi.ServerConfig{
				Mode: tc.mode,
				Env:  tc.env,
			},
			InfraServices: noopInfraServices{},
		})

		if got := gin.Mode(); got != tc.want {
			t.Fatalf("%s: gin.Mode() = %q, want %q", tc.name, got, tc.want)
		}
	}
}

type noopInfraServices struct{}

func (noopInfraServices) HealthCheck(context.Context) (map[string]bool, error) {
	return map[string]bool{"ok": true}, nil
}

func (noopInfraServices) Close(context.Context) error {
	return nil
}
