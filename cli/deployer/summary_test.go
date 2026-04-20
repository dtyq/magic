package deployer

import (
	"bytes"
	"context"
	"io"
	"net"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestShouldIgnoreAccessInterfaceName(t *testing.T) {
	ignored := []string{
		"bridge0",
		"bridge100",
		"docker0",
		"br-582dd221864b",
		"cni0",
		"flannel.1",
		"virbr0",
		"veth7d4b3f1",
		"ztly7f4a2",
	}
	for _, name := range ignored {
		t.Run(name, func(t *testing.T) {
			assert.True(t, shouldIgnoreAccessInterfaceName(name), "expected ignored: %s", name)
		})
	}
	kept := []string{"bond0", "eth0", "ens160"}
	for _, name := range kept {
		t.Run(name, func(t *testing.T) {
			assert.False(t, shouldIgnoreAccessInterfaceName(name), "expected kept: %s", name)
		})
	}
}

func TestSummaryStageExec_PrintsTeardownHint(t *testing.T) {
	stage := newSummaryStage(&Deployer{
		merged: map[string]interface{}{
			releaseNameMagic: map[string]interface{}{
				"magic-web": map[string]interface{}{
					"proxy": map[string]interface{}{
						"webBaseURL": "http://magic.example.com",
					},
				},
			},
		},
	})

	output := captureStdout(t, func() {
		err := stage.Exec(context.Background())
		require.NoError(t, err)
	})

	assert.Contains(t, output, "To remove the cluster, run: magicrew teardown")
}

func TestCandidateAccessIPv4sFromInterfaces(t *testing.T) {
	ifaces := []net.Interface{
		{Name: "bond0", Flags: net.FlagUp},
		{Name: "docker0", Flags: net.FlagUp},
		{Name: "br-a7e591db7267", Flags: net.FlagUp},
		{Name: "lo", Flags: net.FlagUp | net.FlagLoopback},
		{Name: "eth1", Flags: 0},
	}
	addrFn := func(iface net.Interface) ([]net.Addr, error) {
		switch iface.Name {
		case "bond0":
			return []net.Addr{
				mustIPNet(t, "28.254.0.15"),
				mustIPNet(t, "192.168.1.20"),
				mustIPNet(t, "28.254.0.15"),
			}, nil
		case "docker0":
			return []net.Addr{mustIPNet(t, "172.17.0.1")}, nil
		case "br-a7e591db7267":
			return []net.Addr{mustIPNet(t, "172.25.0.1")}, nil
		case "lo":
			return []net.Addr{mustIPNet(t, "127.0.0.1")}, nil
		case "eth1":
			return []net.Addr{mustIPNet(t, "10.0.0.5")}, nil
		default:
			return nil, nil
		}
	}

	got := ipStrings(candidateAccessIPv4sFromInterfaces(ifaces, addrFn))
	assert.Equal(t, []string{"28.254.0.15", "192.168.1.20"}, got)
}

func TestCandidateAccessIPv4sFromInterfaces_SkipsAddrErrors(t *testing.T) {
	ifaces := []net.Interface{
		{Name: "bond0", Flags: net.FlagUp},
		{Name: "eth0", Flags: net.FlagUp},
	}
	addrFn := func(iface net.Interface) ([]net.Addr, error) {
		switch iface.Name {
		case "bond0":
			return nil, assert.AnError
		case "eth0":
			return []net.Addr{mustIPNet(t, "10.0.0.12")}, nil
		default:
			return nil, nil
		}
	}

	got := ipStrings(candidateAccessIPv4sFromInterfaces(ifaces, addrFn))
	assert.Equal(t, []string{"10.0.0.12"}, got)
}

func TestCandidateAccessIPv4sFromInterfaces_ReturnsEmptyWhenNoCandidates(t *testing.T) {
	ifaces := []net.Interface{
		{Name: "docker0", Flags: net.FlagUp},
		{Name: "lo", Flags: net.FlagUp | net.FlagLoopback},
	}
	addrFn := func(iface net.Interface) ([]net.Addr, error) {
		switch iface.Name {
		case "docker0":
			return []net.Addr{mustIPNet(t, "172.17.0.1")}, nil
		case "lo":
			return []net.Addr{mustIPNet(t, "127.0.0.1")}, nil
		default:
			return nil, nil
		}
	}

	got := candidateAccessIPv4sFromInterfaces(ifaces, addrFn)
	assert.Empty(t, got)
}

func mustIPNet(t *testing.T, s string) *net.IPNet {
	t.Helper()
	ip := net.ParseIP(s)
	require.NotNil(t, ip)
	v4 := ip.To4()
	require.NotNil(t, v4)
	return &net.IPNet{IP: v4, Mask: net.CIDRMask(24, 32)}
}

func TestIsCandidateAccessIPv4(t *testing.T) {
	valid := []string{"28.254.0.15", "192.168.1.10"}
	for _, s := range valid {
		t.Run(s, func(t *testing.T) {
			ip := net.ParseIP(s)
			require.NotNil(t, ip)
			assert.True(t, isCandidateAccessIPv4(ip), "expected candidate: %s", s)
		})
	}
	invalid := []string{"127.0.0.1", "169.254.1.1", "0.0.0.0", "fc00:f853:ccd:e793::1"}
	for _, s := range invalid {
		t.Run(s, func(t *testing.T) {
			ip := net.ParseIP(s)
			require.NotNil(t, ip)
			assert.False(t, isCandidateAccessIPv4(ip), "expected not candidate: %s", s)
		})
	}
}

func TestPortFromURL(t *testing.T) {
	cases := []struct {
		url  string
		want string
	}{
		{"http://localhost:38080", "38080"},
		{"http://localhost", "80"},
		{"https://localhost", "443"},
		{"http://192.168.1.1:30080", "30080"},
		{"http://192.168.1.1", "80"},
		{"://invalid", "38080"}, // fallback to default
	}
	for _, tc := range cases {
		t.Run(tc.url, func(t *testing.T) {
			got := portFromURL(tc.url)
			assert.Equal(t, tc.want, got)
		})
	}
}

func captureStdout(t *testing.T, fn func()) string {
	t.Helper()

	oldStdout := os.Stdout
	r, w, err := os.Pipe()
	require.NoError(t, err)

	os.Stdout = w
	t.Cleanup(func() {
		os.Stdout = oldStdout
	})

	fn()

	require.NoError(t, w.Close())

	var buf bytes.Buffer
	_, err = io.Copy(&buf, r)
	require.NoError(t, err)
	require.NoError(t, r.Close())

	return strings.ReplaceAll(buf.String(), "\r\n", "\n")
}
