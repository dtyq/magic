// Package timeformat provides datetime formatting helpers for API responses.
package timeformat

import "time"

const apiDatetimeLayout = "2006-01-02 15:04:05"

// FormatAPIDatetime formats API response datetime with local timezone.
func FormatAPIDatetime(t time.Time) string {
	return t.In(time.Local).Format(apiDatetimeLayout)
}
