package deployer

import (
	"context"
	"fmt"
	"net"
	"net/url"
	"strings"
)

const defaultMagicWebURL = "http://localhost:38080"

// SummaryStage prints the deployment completion message.
type SummaryStage struct {
	BaseStage
	d *Deployer
}

func newSummaryStage(d *Deployer) *SummaryStage {
	return &SummaryStage{BaseStage: BaseStage{"print summary"}, d: d}
}

func (s *SummaryStage) Exec(_ context.Context) error {
	webURL := stringAtPath(
		mapValue(mapValue(s.d.merged[releaseNameMagic])["magic-web"]),
		"proxy", "webBaseURL",
	)
	if webURL == "" {
		webURL = defaultMagicWebURL
	}

	fmt.Println()
	fmt.Println("✓ Deployment complete!")
	fmt.Printf("  Access magic-web: %s\n\n", webURL)
	if strings.Contains(webURL, "localhost") {
		ips := candidateAccessIPv4s()
		port := portFromURL(webURL)
		if len(ips) > 0 {
			fmt.Println("  To access from another machine, choose a recommended candidate below and redeploy (actual reachable address depends on your network):")
			for _, ip := range ips {
				fmt.Printf("    export MAGICREW_CLI_WEB_BASE_URL=http://%s:%s\n", ip, port)
			}
		} else {
			fmt.Println("  To access from another machine, set MAGICREW_CLI_WEB_BASE_URL, e.g. export MAGICREW_CLI_WEB_BASE_URL=http://your-server:38080")
		}
	}
	fmt.Println()
	fmt.Println("To remove the cluster, run: magicrew teardown")
	return nil
}

// candidateAccessIPv4s returns deduplicated candidate access IPv4 addresses
// from active, non-loopback interfaces, excluding virtual/CNI-style names.
// Best-effort: returns nil when interface enumeration fails.
func candidateAccessIPv4s() []net.IP {
	ifaces, err := net.Interfaces()
	if err != nil {
		return nil
	}
	return candidateAccessIPv4sFromInterfaces(ifaces, func(iface net.Interface) ([]net.Addr, error) {
		return iface.Addrs()
	})
}

func candidateAccessIPv4sFromInterfaces(ifaces []net.Interface, addrFn func(net.Interface) ([]net.Addr, error)) []net.IP {
	var ips []net.IP
	seen := make(map[string]struct{})
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		if shouldIgnoreAccessInterfaceName(iface.Name) {
			continue
		}
		addrs, err := addrFn(iface)
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			ipNet, ok := addr.(*net.IPNet)
			if !ok {
				continue
			}
			ip := ipNet.IP.To4()
			if ip == nil || !isCandidateAccessIPv4(ip) {
				continue
			}
			key := ip.String()
			if _, ok := seen[key]; ok {
				continue
			}
			seen[key] = struct{}{}
			ips = append(ips, ip)
		}
	}
	return ips
}

func ipStrings(ips []net.IP) []string {
	out := make([]string, 0, len(ips))
	for _, ip := range ips {
		out = append(out, ip.String())
	}
	return out
}

// ignoredAccessInterfacePrefixes matches virtual/CNI/bridge interfaces that are
// unlikely to represent a user-facing LAN address for cross-host access hints.
var ignoredAccessInterfacePrefixes = []string{
	"bridge",
	"docker",
	"br-",
	"cni",
	"flannel",
	"virbr",
	"veth",
	"zt",
}

func shouldIgnoreAccessInterfaceName(name string) bool {
	for _, p := range ignoredAccessInterfacePrefixes {
		if strings.HasPrefix(name, p) {
			return true
		}
	}
	return false
}

func isCandidateAccessIPv4(ip net.IP) bool {
	v4 := ip.To4()
	if v4 == nil {
		return false
	}
	if v4.IsLoopback() || v4.IsLinkLocalUnicast() || v4.IsUnspecified() {
		return false
	}
	return true
}

// portFromURL extracts the port from a URL string, defaulting to "80" for http
// and "443" for https when no explicit port is present.
func portFromURL(raw string) string {
	u, err := url.Parse(raw)
	if err != nil {
		return "38080"
	}
	p := u.Port()
	if p != "" {
		return p
	}
	if strings.EqualFold(u.Scheme, "https") {
		return "443"
	}
	return "80"
}
