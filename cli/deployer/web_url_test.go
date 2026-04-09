package deployer

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateWebBaseURL_AllowsCommonReachableURLs(t *testing.T) {
	cases := []string{
		"",
		"http://localhost:38080",
		"http://127.0.0.1:38080",
		"https://magic.example.com",
		"https://magic.example.com:30080",
		"http://192.168.1.10:38080",
	}

	for _, raw := range cases {
		t.Run(raw, func(t *testing.T) {
			require.NoError(t, ValidateWebBaseURL(raw))
		})
	}
}

func TestValidateWebBaseURL_RejectsListenAddresses(t *testing.T) {
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
			err := ValidateWebBaseURL(tc.raw)
			require.Error(t, err)
			assert.Contains(t, err.Error(), `invalid web URL "`+tc.raw+`"`)
			assert.Contains(t, err.Error(), `host "`+tc.host+`" is a listen address`)
			assert.Contains(t, err.Error(), `http://localhost:38080`)
			assert.Contains(t, err.Error(), `http://127.0.0.1:38080`)
		})
	}
}

func TestValidateWebBaseURL_RejectsMalformedURLs(t *testing.T) {
	cases := []string{
		"38080",
		"/foo",
		"http:///x",
	}

	for _, raw := range cases {
		t.Run(raw, func(t *testing.T) {
			err := ValidateWebBaseURL(raw)
			require.Error(t, err)
			assert.Contains(t, err.Error(), `invalid web URL "`+raw+`"`)
			assert.Contains(t, err.Error(), "must be an absolute URL with scheme and host")
			assert.Contains(t, err.Error(), "http://localhost:38080")
		})
	}
}

func TestValidateWebBaseURL_RejectsUnsupportedScheme(t *testing.T) {
	err := ValidateWebBaseURL("ftp://magic.example.com")
	require.Error(t, err)
	assert.Contains(t, err.Error(), `invalid web URL "ftp://magic.example.com"`)
	assert.Contains(t, err.Error(), "scheme must be http or https")
}
