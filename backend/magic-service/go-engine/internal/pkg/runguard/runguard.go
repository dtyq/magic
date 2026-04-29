// Package runguard provides panic recovery helpers for goroutine boundaries.
package runguard

import (
	"context"
	"fmt"
	"os"
	"runtime/debug"
)

// Policy describes what a goroutine owner intends to do after a panic is reported.
type Policy string

const (
	// Continue logs the panic through OnPanic and lets the goroutine return.
	Continue Policy = "continue"
	// CloseScope logs the panic through OnPanic and expects caller defers to close the current scope.
	CloseScope Policy = "close_scope"
	// ExitProcess logs the panic through OnPanic and exits the process.
	ExitProcess Policy = "exit_process"
)

const (
	scopeField  = "scope"
	panicField  = "panic"
	stackField  = "stack"
	pidField    = "pid"
	policyField = "goroutine_policy"
)

// Report is the structured payload produced when Recover catches a panic.
type Report struct {
	Scope     string
	Policy    Policy
	Panic     string
	Recovered any
	Stack     string
	PID       int
	Fields    []any
}

// Options configures Recover and Go.
type Options struct {
	Scope   string
	Policy  Policy
	Fields  []any
	OnPanic func(context.Context, Report)
	Exit    func(int)
}

// Recover must be deferred directly by the protected goroutine.
func Recover(ctx context.Context, opts Options) bool {
	recovered := recover()
	if recovered == nil {
		return false
	}

	report := newReport(opts, recovered)
	if opts.OnPanic != nil {
		opts.OnPanic(ctx, report)
	}
	if report.Policy == ExitProcess {
		exit := opts.Exit
		if exit == nil {
			exit = os.Exit
		}
		exit(1)
	}
	return true
}

// Go starts fn in a goroutine protected by Recover.
func Go(ctx context.Context, opts Options, fn func()) {
	go func() {
		defer Recover(ctx, opts)
		if fn != nil {
			fn()
		}
	}()
}

func newReport(opts Options, recovered any) Report {
	policy := normalizePolicy(opts.Policy)
	panicText := fmt.Sprint(recovered)
	stack := string(debug.Stack())
	pid := os.Getpid()
	return Report{
		Scope:     opts.Scope,
		Policy:    policy,
		Panic:     panicText,
		Recovered: recovered,
		Stack:     stack,
		PID:       pid,
		Fields:    buildFields(opts.Fields, opts.Scope, panicText, stack, pid, policy),
	}
}

func buildFields(fields []any, scope, panicText, stack string, pid int, policy Policy) []any {
	out := make([]any, 0, len(fields)+10)
	out = append(out, fields...)
	out = appendIfMissing(out, scopeField, scope)
	out = appendIfMissing(out, panicField, panicText)
	out = appendIfMissing(out, stackField, stack)
	out = appendIfMissing(out, pidField, pid)
	out = appendIfMissing(out, policyField, policy)
	return out
}

func appendIfMissing(fields []any, key string, value any) []any {
	if containsField(fields, key) {
		return fields
	}
	return append(fields, key, value)
}

func containsField(fields []any, key string) bool {
	for i := 0; i+1 < len(fields); i += 2 {
		if got, ok := fields[i].(string); ok && got == key {
			return true
		}
	}
	return false
}

func normalizePolicy(policy Policy) Policy {
	switch policy {
	case Continue, CloseScope, ExitProcess:
		return policy
	default:
		return Continue
	}
}
