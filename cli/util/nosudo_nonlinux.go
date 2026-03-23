//go:build !linux && !darwin

package util

// NoSudo is a no-op on non-Linux systems.
func NoSudo[T any](callback func() T) T {
	return callback()
}
