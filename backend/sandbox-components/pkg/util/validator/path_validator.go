package validator

import (
	"fmt"
	"regexp"
	"strings"
)

// PathValidator validates OSS path inputs for security
type PathValidator struct {
	// allowedPattern: only allow safe characters (alphanumeric, underscore, hyphen, dot, forward slash)
	allowedPattern *regexp.Regexp
	// dangerousPattern: detect shell special characters
	dangerousPattern *regexp.Regexp
	// maxLength: maximum path length
	maxLength int
}

// NewPathValidator creates a new path validator
func NewPathValidator() *PathValidator {
	return &PathValidator{
		// Only allow safe path characters
		allowedPattern: regexp.MustCompile(`^[a-zA-Z0-9_\-\.\/]+$`),
		// Detect dangerous shell special characters
		dangerousPattern: regexp.MustCompile(`[;&|$` + "`" + `()<>\\!"']`),
		maxLength:        1024, // Limit path length to prevent abuse
	}
}

// ValidateOSSPath validates an OSS path for security
func (v *PathValidator) ValidateOSSPath(path string) error {
	// Empty path is allowed (means no workspace storage)
	if path == "" {
		return nil
	}

	// Check length
	if len(path) > v.maxLength {
		return fmt.Errorf("path too long: maximum length is %d characters", v.maxLength)
	}

	// Check for command substitution patterns first (more specific check)
	if strings.Contains(path, "$(") || strings.Contains(path, "${") {
		return fmt.Errorf("command substitution detected: $( and ${ are not allowed")
	}

	// Check for path traversal attempts
	if strings.Contains(path, "..") {
		return fmt.Errorf("path traversal detected: '..' is not allowed")
	}

	// Path should not contain consecutive slashes
	if strings.Contains(path, "//") {
		return fmt.Errorf("invalid path: consecutive slashes are not allowed")
	}

	// Check for dangerous shell characters
	if v.dangerousPattern.MatchString(path) {
		return fmt.Errorf("path contains dangerous characters: shell special characters are not allowed")
	}

	// Check if path contains only allowed characters
	if !v.allowedPattern.MatchString(path) {
		return fmt.Errorf("path contains invalid characters: only alphanumeric, underscore, hyphen, dot, and forward slash are allowed")
	}

	return nil
}

// SanitizePath removes leading/trailing slashes and normalizes the path
func (v *PathValidator) SanitizePath(path string) string {
	// Trim spaces
	path = strings.TrimSpace(path)

	// Remove all leading slashes
	path = strings.TrimLeft(path, "/")

	// Remove all trailing slashes
	path = strings.TrimRight(path, "/")

	return path
}
