package deployer

import (
	"fmt"
	"net"
	"net/url"
	"strings"
)

func ValidateWebBaseURL(raw string) error {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}

	u, err := url.Parse(raw)
	if err != nil || u == nil || u.Scheme == "" || u.Host == "" || !u.IsAbs() {
		return fmt.Errorf(
			`invalid web URL %q: must be an absolute URL with scheme and host, for example "http://localhost:38080"`,
			raw,
		)
	}

	switch strings.ToLower(u.Scheme) {
	case "http", "https":
	default:
		return fmt.Errorf(`invalid web URL %q: scheme must be http or https`, raw)
	}

	if u.User != nil {
		return fmt.Errorf(`invalid web URL %q: must not contain userinfo`, raw)
	}

	host := u.Hostname()
	if isListenAddress(host) {
		return fmt.Errorf(
			`invalid web URL %q: host %q is a listen address, not a user-accessible address; use a reachable address such as "http://localhost:38080", "http://127.0.0.1:38080", or "http://<your-host-ip>:38080"`,
			raw,
			host,
		)
	}

	return nil
}

func isListenAddress(host string) bool {
	host = strings.TrimSpace(host)
	if host == "" {
		return false
	}

	switch host {
	case "0.0.0.0", "::":
		return true
	}

	ip := net.ParseIP(host)
	return ip != nil && ip.IsUnspecified()
}
