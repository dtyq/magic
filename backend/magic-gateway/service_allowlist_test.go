package main

import "testing"

// TestGetServiceInfoRejectsUnsupportedServiceName is a regression test for a
// service-allowlist bypass: getServiceInfo (called from the ?service= query
// parameter path in proxyHandler) looked up "{service}_API_BASE_URL" /
// "{service}_API_KEY" directly in envVars (a snapshot of the whole process
// environment via os.Environ(), not just this gateway's own config) with no
// check against supportedServices, letting any caller with a valid gateway
// JWT probe for and proxy to any unrelated "{X}_API_BASE_URL"/"{X}_API_KEY"
// pair the process happens to have, not just OPENAI/MAGIC/DEEPSEEK.
func TestGetServiceInfoRejectsUnsupportedServiceName(t *testing.T) {
	origEnvVars := envVars
	origSupported := supportedServices
	defer func() {
		envVars = origEnvVars
		supportedServices = origSupported
	}()

	supportedServices = []string{"OPENAI", "MAGIC", "DEEPSEEK"}
	envVars = map[string]string{
		// A secret that exists in the process environment for some unrelated
		// reason, matching the naming convention this lookup relies on, but
		// not one of the services this gateway is meant to expose.
		"EVIL_API_BASE_URL": "http://internal-admin-service.local/",
		"EVIL_API_KEY":       "super-secret-internal-token",
		// A genuinely supported service, to prove the fix doesn't break
		// legitimate lookups.
		"OPENAI_API_BASE_URL": "https://api.openai.com/v1",
		"OPENAI_API_KEY":      "sk-real-key",
	}

	if _, _, found := getServiceInfo("EVIL"); found {
		t.Fatal("getServiceInfo(\"EVIL\") must be rejected: \"EVIL\" is not in supportedServices, " +
			"so its matching env vars must never be reachable through the service lookup")
	}

	baseURL, apiKey, found := getServiceInfo("OPENAI")
	if !found {
		t.Fatal("getServiceInfo(\"OPENAI\") must still succeed for a service on the allowlist")
	}
	if baseURL != "https://api.openai.com/v1" || apiKey != "sk-real-key" {
		t.Fatalf("getServiceInfo(\"OPENAI\") returned unexpected values: baseURL=%q apiKey=%q", baseURL, apiKey)
	}

	// Case-insensitivity: the allowlist check must not be bypassable by casing.
	if _, _, found := getServiceInfo("evil"); found {
		t.Fatal("getServiceInfo(\"evil\") must be rejected the same as \"EVIL\"")
	}
	if _, _, found := getServiceInfo("openai"); !found {
		t.Fatal("getServiceInfo(\"openai\") (lowercase) must still succeed like \"OPENAI\"")
	}
}

func TestIsSupportedService(t *testing.T) {
	origSupported := supportedServices
	defer func() { supportedServices = origSupported }()
	supportedServices = []string{"OPENAI", "MAGIC", "DEEPSEEK"}

	cases := []struct {
		service string
		want    bool
	}{
		{"OPENAI", true},
		{"openai", true},
		{"MAGIC", true},
		{"DEEPSEEK", true},
		{"EVIL", false},
		{"AWS", false},
		{"", false},
	}
	for _, c := range cases {
		if got := isSupportedService(c.service); got != c.want {
			t.Errorf("isSupportedService(%q) = %v, want %v", c.service, got, c.want)
		}
	}
}
