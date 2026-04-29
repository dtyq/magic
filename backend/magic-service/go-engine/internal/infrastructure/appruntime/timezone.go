package appruntime

import (
	"fmt"
	"os"
	"time"
)

const defaultProcessTimezone = "Asia/Shanghai"

// SetDefaultProcessTimezone 将 Go 进程本地时区固定为默认业务时区。
func SetDefaultProcessTimezone() error {
	return SetProcessTimezone(defaultProcessTimezone)
}

// SetProcessTimezone 将 Go 进程的本地时区设置为指定 IANA 时区。
func SetProcessTimezone(name string) error {
	location, err := time.LoadLocation(name)
	if err != nil {
		return fmt.Errorf("load process timezone %q: %w", name, err)
	}
	if err := os.Setenv("TZ", name); err != nil {
		return fmt.Errorf("set TZ environment %q: %w", name, err)
	}
	time.Local = location
	return nil
}
