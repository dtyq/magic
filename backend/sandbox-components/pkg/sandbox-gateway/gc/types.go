package gc

import (
	"time"
)

// PVCGCConfig configures PVC garbage collection
type PVCGCConfig struct {
	// Enabled enables or disables PVC garbage collection
	Enabled bool `json:"enabled" yaml:"enabled"`

	// CheckInterval is the interval between PVC GC runs
	CheckInterval time.Duration `json:"checkInterval" yaml:"checkInterval"`

	// UnusedThreshold is the time threshold for unused PVC cleanup
	UnusedThreshold time.Duration `json:"unusedThreshold" yaml:"unusedThreshold"`
}

// DefaultPVCGCConfig returns default PVC GC configuration
func DefaultPVCGCConfig() PVCGCConfig {
	return PVCGCConfig{
		Enabled:         false, // Enabled by default
		CheckInterval:   5 * time.Minute,
		UnusedThreshold: 10 * time.Minute, // 10 minutes
	}
}

// PVGCConfig configures PV garbage collection
type PVGCConfig struct {
	// Enabled enables or disables PV garbage collection
	Enabled bool `json:"enabled" yaml:"enabled"`

	// CheckInterval is the interval between PV GC runs
	CheckInterval time.Duration `json:"checkInterval" yaml:"checkInterval"`

	// ReleasedThreshold is the time threshold for released PV cleanup
	ReleasedThreshold time.Duration `json:"releasedThreshold" yaml:"releasedThreshold"`
}

// DefaultPVGCConfig returns default PV GC configuration
func DefaultPVGCConfig() PVGCConfig {
	return PVGCConfig{
		Enabled:           false, // Enabled by default
		CheckInterval:     5 * time.Minute,
		ReleasedThreshold: 10 * time.Minute, // 10 minutes
	}
}

// AgentGCConfig configures Agent garbage collection for sandbox pods
type AgentGCConfig struct {
	// Enabled enables or disables Agent garbage collection
	Enabled bool `json:"enabled" yaml:"enabled"`

	// CheckInterval is the interval between Agent GC runs
	CheckInterval time.Duration `json:"checkInterval" yaml:"checkInterval"`

	// ExpiredThreshold is the time threshold for expired Agent cleanup
	ExpiredThreshold time.Duration `json:"expiredThreshold" yaml:"expiredThreshold"`
}

// DefaultAgentGCConfig returns default Agent GC configuration
func DefaultAgentGCConfig() AgentGCConfig {
	return AgentGCConfig{
		Enabled:          true, // Enabled by default
		CheckInterval:    5 * time.Minute,
		ExpiredThreshold: 10 * time.Minute, // 10 minutes
	}
}

// FusePodGCConfig configures Fuse Pod garbage collection
type FusePodGCConfig struct {
	// Enabled enables or disables Fuse Pod garbage collection
	Enabled bool `json:"enabled" yaml:"enabled"`

	// CheckInterval is the interval between Fuse Pod GC runs
	CheckInterval time.Duration `json:"checkInterval" yaml:"checkInterval"`

	// OrphanedThreshold is the time threshold for orphaned Fuse Pod cleanup
	OrphanedThreshold time.Duration `json:"orphanedThreshold" yaml:"orphanedThreshold"`
}

// DefaultFusePodGCConfig returns default Fuse Pod GC configuration
func DefaultFusePodGCConfig() FusePodGCConfig {
	return FusePodGCConfig{
		Enabled:           false, // Enabled by default
		CheckInterval:     5 * time.Minute,
		OrphanedThreshold: 10 * time.Minute, // 10 minutes
	}
}
