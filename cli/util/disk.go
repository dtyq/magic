package util

import (
	"fmt"
)

func HumanSize(bytes uint64) string {
	switch {
	case bytes < 1024:
		return fmt.Sprintf("%d Bytes", bytes)
	case bytes < 1024*1024:
		return fmt.Sprintf("%.1f KiB", float64(bytes)/1024)
	case bytes < 1024*1024*1024:
		return fmt.Sprintf("%.1f MiB", float64(bytes)/(1024*1024))
	case bytes < 1024*1024*1024*1024:
		return fmt.Sprintf("%.1f GiB", float64(bytes)/(1024*1024*1024))
	case bytes < 1024*1024*1024*1024*1024:
		return fmt.Sprintf("%.1f TiB", float64(bytes)/(1024*1024*1024*1024))
	case bytes < 1024*1024*1024*1024*1024*1024:
		return fmt.Sprintf("%.1f PiB", float64(bytes)/(1024*1024*1024*1024*1024))
	default:
		return fmt.Sprintf("%.1f EiB", float64(bytes)/(1024*1024*1024*1024*1024*1024))
	}
}
