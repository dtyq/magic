package external_test

import (
	"context"
	"errors"
	"testing"

	"magic/internal/infrastructure/external"
)

var errConfigProviderBoom = errors.New("config provider boom")

type stubAccessTokenProvider struct {
	token string
	err   error
	calls int
}

func (s *stubAccessTokenProvider) GetAccessToken(context.Context) (string, error) {
	s.calls++
	if s.err != nil {
		return "", s.err
	}
	return s.token, nil
}

type stubRefreshableProvider struct {
	stubAccessTokenProvider
	refreshToken string
	refreshErr   error
	refreshCalls int
}

func (s *stubRefreshableProvider) RefreshAccessToken(context.Context) (string, error) {
	s.refreshCalls++
	if s.refreshErr != nil {
		return "", s.refreshErr
	}
	return s.refreshToken, nil
}

func TestConfigFirstAccessTokenProviderUsesConfigTokenFirst(t *testing.T) {
	t.Parallel()

	fallback := &stubAccessTokenProvider{token: "fallback-token"}
	provider := external.NewConfigFirstAccessTokenProvider("  config-token  ", fallback)

	token, err := provider.GetAccessToken(context.Background())
	if err != nil || token != "config-token" {
		t.Fatalf("GetAccessToken() = (%q, %v), want (%q, nil)", token, err, "config-token")
	}
	if fallback.calls != 0 {
		t.Fatalf("expected fallback not to be called, got %d", fallback.calls)
	}

	token, err = provider.RefreshAccessToken(context.Background())
	if err != nil || token != "config-token" {
		t.Fatalf("RefreshAccessToken() = (%q, %v), want (%q, nil)", token, err, "config-token")
	}
}

func TestConfigFirstAccessTokenProviderFallsBackAndWrapsErrors(t *testing.T) {
	t.Parallel()

	fallback := &stubAccessTokenProvider{token: "fallback-token"}
	provider := external.NewConfigFirstAccessTokenProvider("", fallback)

	token, err := provider.GetAccessToken(context.Background())
	if err != nil || token != "fallback-token" {
		t.Fatalf("GetAccessToken() = (%q, %v), want (%q, nil)", token, err, "fallback-token")
	}

	fallback.err = errConfigProviderBoom
	if _, err = provider.GetAccessToken(context.Background()); !errors.Is(err, errConfigProviderBoom) {
		t.Fatalf("expected wrapped fallback error, got %v", err)
	}
}

func TestConfigFirstAccessTokenProviderRefreshFlow(t *testing.T) {
	t.Parallel()

	refreshable := &stubRefreshableProvider{refreshToken: "refreshed-token"}
	provider := external.NewConfigFirstAccessTokenProvider("", refreshable)

	token, err := provider.RefreshAccessToken(context.Background())
	if err != nil || token != "refreshed-token" {
		t.Fatalf("RefreshAccessToken() = (%q, %v), want (%q, nil)", token, err, "refreshed-token")
	}
	if refreshable.refreshCalls != 1 {
		t.Fatalf("expected refresh fallback to be called once, got %d", refreshable.refreshCalls)
	}

	plain := &stubAccessTokenProvider{token: "plain-token"}
	provider = external.NewConfigFirstAccessTokenProvider("", plain)
	token, err = provider.RefreshAccessToken(context.Background())
	if err != nil || token != "plain-token" {
		t.Fatalf("RefreshAccessToken() = (%q, %v), want (%q, nil)", token, err, "plain-token")
	}

	provider = external.NewConfigFirstAccessTokenProvider("", nil)
	if _, err = provider.RefreshAccessToken(context.Background()); !errors.Is(err, external.ErrAccessTokenEmpty) {
		t.Fatalf("expected ErrAccessTokenEmpty, got %v", err)
	}
}
