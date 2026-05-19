package main

import (
	"bytes"
	"context"
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"
)

var errUnexpectedPackage = errors.New("unexpected package")

func TestCollectSlowResults(t *testing.T) {
	t.Parallel()

	input := strings.NewReader(strings.Join([]string{
		`{"Action":"output","Package":"magic/pkg/a","Test":"TestFail","Output":"boom\n"}`,
		`{"Action":"fail","Package":"magic/pkg/a","Test":"TestFail"}`,
		`{"Action":"pass","Package":"magic/pkg/a","Test":"TestFast","Elapsed":0.05}`,
		`{"Action":"pass","Package":"magic/pkg/a","Test":"TestSlow","Elapsed":0.25}`,
		`{"Action":"pass","Package":"magic/pkg/b","Elapsed":1.5}`,
		`{"Action":"pass","Package":"magic/pkg/a","Elapsed":0.8}`,
	}, "\n"))

	results, err := collectSlowResults(input, 100*time.Millisecond, time.Second)
	if err != nil {
		t.Fatalf("collectSlowResults() error = %v", err)
	}

	if len(results.Tests) != 1 {
		t.Fatalf("expected 1 slow test, got %d", len(results.Tests))
	}
	if results.Tests[0].Package != "magic/pkg/a" || results.Tests[0].Test != "TestSlow" {
		t.Fatalf("unexpected slow test result: %#v", results.Tests[0])
	}

	if len(results.Packages) != 1 {
		t.Fatalf("expected 1 slow package, got %d", len(results.Packages))
	}
	if results.Packages[0].Package != "magic/pkg/b" {
		t.Fatalf("unexpected slow package result: %#v", results.Packages[0])
	}

	if len(results.Failures) != 1 {
		t.Fatalf("expected 1 failure, got %d", len(results.Failures))
	}
	if got := strings.Join(results.Failures[0].Output, "\n"); got != "boom" {
		t.Fatalf("unexpected failure output: %q", got)
	}

	wantPackagesSeen := []string{"magic/pkg/a", "magic/pkg/b"}
	if !reflect.DeepEqual(results.PackagesSeen, wantPackagesSeen) {
		t.Fatalf("unexpected packages seen: got=%v want=%v", results.PackagesSeen, wantPackagesSeen)
	}
}

func TestPrintSlowPackages(t *testing.T) {
	t.Parallel()

	var buf bytes.Buffer
	err := printSlowPackages(&buf, []slowPackage{
		{Package: "magic/pkg/b", Elapsed: 1500 * time.Millisecond},
	}, time.Second, 10)
	if err != nil {
		t.Fatalf("printSlowPackages() error = %v", err)
	}

	output := buf.String()
	if !strings.Contains(output, "真实慢包阈值: 1s") {
		t.Fatalf("expected threshold in output, got %q", output)
	}
	if !strings.Contains(output, "命中慢包: 1") {
		t.Fatalf("expected package count in output, got %q", output)
	}
	if !strings.Contains(output, "1.5s\tmagic/pkg/b") {
		t.Fatalf("expected package row in output, got %q", output)
	}
}

func TestCalibrateSlowPackages(t *testing.T) {
	t.Parallel()

	var calls [][]string
	runner := func(_ context.Context, args []string, _, _ time.Duration) (scanResults, error) {
		calls = append(calls, append([]string(nil), args...))

		pkg := args[len(args)-1]
		switch pkg {
		case "magic/pkg/a":
			return scanResults{Packages: []slowPackage{{Package: pkg, Elapsed: 900 * time.Millisecond}}}, nil
		case "magic/pkg/b":
			return scanResults{Packages: []slowPackage{{Package: pkg, Elapsed: 1500 * time.Millisecond}}}, nil
		default:
			return scanResults{}, errUnexpectedPackage
		}
	}

	results, err := calibrateSlowPackages(
		context.Background(),
		[]string{"-short", "-p", "8", "magic/pkg/a", "magic/pkg/b"},
		[]string{"magic/pkg/a", "magic/pkg/b"},
		[]slowPackage{
			{Package: "magic/pkg/a", Elapsed: 5 * time.Second},
			{Package: "magic/pkg/b", Elapsed: 6 * time.Second},
		},
		time.Second,
		runner,
	)
	if err != nil {
		t.Fatalf("calibrateSlowPackages() error = %v", err)
	}

	wantResults := []slowPackage{{Package: "magic/pkg/b", Elapsed: 1500 * time.Millisecond}}
	if !reflect.DeepEqual(results, wantResults) {
		t.Fatalf("unexpected calibrated packages: got=%#v want=%#v", results, wantResults)
	}

	wantCalls := [][]string{
		{"-short", "-p=1", "magic/pkg/a"},
		{"-short", "-p=1", "magic/pkg/b"},
	}
	if !reflect.DeepEqual(calls, wantCalls) {
		t.Fatalf("unexpected runner calls: got=%v want=%v", calls, wantCalls)
	}
}

func TestOverrideFlagValue(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		args []string
		want []string
	}{
		{
			name: "replace equals form",
			args: []string{"-short", "-p=8"},
			want: []string{"-short", "-p=1"},
		},
		{
			name: "replace split form",
			args: []string{"-short", "-p", "8"},
			want: []string{"-short", "-p=1"},
		},
		{
			name: "prepend when missing",
			args: []string{"-short"},
			want: []string{"-p=1", "-short"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := overrideFlagValue(tc.args, "-p", "1")
			if !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("overrideFlagValue() got=%v want=%v", got, tc.want)
			}
		})
	}
}
