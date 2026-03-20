package deployer

import (
	"context"
	"fmt"
)

// Stage defines the interface all deployment stages must implement.
// Each stage holds a reference to *Deployer in its own struct fields;
// intermediate results between Prep and Exec are also stored as struct fields.
type Stage interface {
	Name() string
	// Prep reads configuration and shared state, registers dependencies, and
	// prepares any data needed by Exec. Runs before Exec.
	Prep(ctx context.Context) error
	// Exec performs the main operation (helm install, cluster creation, etc.).
	// Reads from struct fields populated by Prep rather than from shared state.
	Exec(ctx context.Context) error
	// Post runs after Exec and writes results back to the shared Deployer state.
	Post(ctx context.Context) error
}

// BaseStage provides no-op default implementations of the Stage interface.
// Concrete stages embed BaseStage and override only the methods they need.
type BaseStage struct{ name string }

func (b BaseStage) Name() string               { return b.name }
func (b BaseStage) Prep(_ context.Context) error { return nil }
func (b BaseStage) Exec(_ context.Context) error { return nil }
func (b BaseStage) Post(_ context.Context) error { return nil }

// runStages executes Prep → Exec → Post for each stage in order.
func runStages(ctx context.Context, d *Deployer) error {
	for _, s := range d.stages {
		d.log.Logi("deploy", "[%s]...", s.Name())
		if err := s.Prep(ctx); err != nil {
			return fmt.Errorf("%s prep: %w", s.Name(), err)
		}
		if err := s.Exec(ctx); err != nil {
			return fmt.Errorf("%s: %w", s.Name(), err)
		}
		if err := s.Post(ctx); err != nil {
			return fmt.Errorf("%s post: %w", s.Name(), err)
		}
	}
	return nil
}
