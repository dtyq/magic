// Package readiness provides reusable infrastructure readiness gates.
package readiness

import (
	"context"
	"fmt"
	"strings"
)

const defaultIPCCapabilityGateName = "ipc-capability"

// IPCCapabilityWaiter describes the IPC readiness operations needed by a gate.
type IPCCapabilityWaiter interface {
	HasCapableClient(methods ...string) bool
	WaitCapableClient(ctx context.Context, methods ...string) error
}

// IPCCapabilityGate waits until an IPC client declares the required capabilities.
type IPCCapabilityGate struct {
	server  IPCCapabilityWaiter
	name    string
	methods []string
}

// NewIPCCapabilityGate creates a readiness gate for one IPC capability set.
func NewIPCCapabilityGate(server IPCCapabilityWaiter, name string, methods ...string) *IPCCapabilityGate {
	return &IPCCapabilityGate{
		server:  server,
		name:    normalizeGateName(name),
		methods: normalizeCapabilityMethods(methods),
	}
}

// Name returns the gate name for diagnostics.
func (g *IPCCapabilityGate) Name() string {
	if g == nil || strings.TrimSpace(g.name) == "" {
		return defaultIPCCapabilityGateName
	}
	return g.name
}

// WaitReady waits until the IPC capability is ready.
func (g *IPCCapabilityGate) WaitReady(ctx context.Context) error {
	if g == nil || g.server == nil {
		return nil
	}
	if g.server.HasCapableClient(g.methods...) {
		return nil
	}
	if err := g.server.WaitCapableClient(ctx, g.methods...); err != nil {
		return fmt.Errorf("wait %s ready: %w", g.Name(), err)
	}
	return nil
}

func normalizeGateName(name string) string {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return defaultIPCCapabilityGateName
	}
	return trimmed
}

func normalizeCapabilityMethods(methods []string) []string {
	normalized := make([]string, 0, len(methods))
	seen := make(map[string]struct{}, len(methods))
	for _, method := range methods {
		trimmed := strings.TrimSpace(method)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		normalized = append(normalized, trimmed)
	}
	return normalized
}
