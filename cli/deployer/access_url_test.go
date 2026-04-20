package deployer

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateAccessURL_AllowsCommonReachableURLs(t *testing.T) {
	cases := []struct {
		name string
		raw  string
	}{
		{name: "empty_string_skips_validation", raw: ""},
		{name: "http_localhost_with_port", raw: "http://localhost:38080"},
		{name: "http_loopback_ipv4", raw: "http://127.0.0.1:38080"},
		{name: "https_hostname_no_port", raw: "https://magic.example.com"},
		{name: "https_hostname_with_port", raw: "https://magic.example.com:30080"},
		{name: "http_lan_ipv4_with_port", raw: "http://192.168.1.10:38080"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			require.NoError(t, ValidateAccessURL(tc.raw))
		})
	}
}

func TestValidateAccessURL_RejectsListenAddresses(t *testing.T) {
	cases := []struct {
		name string
		raw  string
		host string
	}{
		{name: "ipv4_any", raw: "http://0.0.0.0:38080", host: "0.0.0.0"},
		{name: "ipv6_any_bracketed", raw: "http://[::]:38080", host: "::"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateAccessURL(tc.raw)
			require.Error(t, err)
			assert.Contains(t, err.Error(), `invalid URL "`+tc.raw+`"`)
			assert.Contains(t, err.Error(), `host "`+tc.host+`" is a listen address`)
			assert.Contains(t, err.Error(), `http://localhost:38080`)
			assert.Contains(t, err.Error(), `http://127.0.0.1:38080`)
		})
	}
}

func TestValidateAccessURL_RejectsMalformedURLs(t *testing.T) {
	cases := []string{
		"38080",
		"/foo",
		"http:///x",
		"http://:38080",
	}

	for _, raw := range cases {
		t.Run(raw, func(t *testing.T) {
			err := ValidateAccessURL(raw)
			require.Error(t, err)
			assert.Contains(t, err.Error(), `invalid URL "`+raw+`"`)
			assert.Contains(t, err.Error(), "must be an absolute URL with scheme and host")
			assert.Contains(t, err.Error(), "http://localhost:38080")
		})
	}
}

func TestValidateAccessURL_RejectsUnsupportedScheme(t *testing.T) {
	err := ValidateAccessURL("ftp://magic.example.com")
	require.Error(t, err)
	assert.Contains(t, err.Error(), `invalid URL "ftp://magic.example.com"`)
	assert.Contains(t, err.Error(), "scheme must be http or https")
}

func TestValidateAccessURL_RejectsUserInfo(t *testing.T) {
	raw := "https://user:pass@magic.example.com"

	err := ValidateAccessURL(raw)
	require.Error(t, err)
	assert.Contains(t, err.Error(), `invalid URL "`+raw+`"`)
	assert.Contains(t, err.Error(), "must not contain userinfo")
}

func TestValidateAccessURL_RejectsPathQueryFragment(t *testing.T) {
	cases := []struct {
		name string
		raw  string
		hint string
	}{
		{name: "trailing_slash", raw: "http://localhost:38080/", hint: "must not contain a path"},
		{name: "path_segment", raw: "http://localhost:38080/api", hint: "must not contain a path"},
		{name: "query", raw: "http://localhost:38080?x=1", hint: "must not contain a query"},
		{name: "empty_query_marker", raw: "http://localhost:38080?", hint: "must not contain a query"},
		{name: "fragment", raw: "http://localhost:38080#frag", hint: "must not contain a fragment"},
		{name: "path_and_query", raw: "http://localhost:38080/foo?x=1", hint: "must not contain a path"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateAccessURL(tc.raw)
			require.Error(t, err)
			assert.Contains(t, err.Error(), `invalid URL "`+tc.raw+`"`)
			assert.Contains(t, err.Error(), tc.hint)
		})
	}
}

func TestValidateAccessURL_RemainsGeneric(t *testing.T) {
	invalids := []struct {
		name string
		raw  string
	}{
		{name: "relative_not_absolute", raw: "/foo"},
		{name: "missing_scheme_host", raw: "38080"},
		{name: "unsupported_scheme", raw: "ftp://magic.example.com"},
		{name: "userinfo", raw: "https://user:pass@magic.example.com"},
		{name: "path_trailing_slash", raw: "http://localhost:38080/"},
		{name: "query", raw: "http://localhost:38080?x=1"},
		{name: "fragment", raw: "http://localhost:38080#frag"},
		{name: "listen_address_ipv4", raw: "http://0.0.0.0:38080"},
	}

	for _, tc := range invalids {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateAccessURL(tc.raw)
			require.Error(t, err)
			lower := strings.ToLower(err.Error())
			assert.NotContains(t, lower, "web url")
			assert.NotContains(t, lower, "minio url")
		})
	}
}
