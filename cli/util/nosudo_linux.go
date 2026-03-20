//go:build linux

package util

import (
	"os"
	"runtime"
	"strconv"
	"syscall"
	"unsafe"

	"golang.org/x/sys/unix"
)

type capHeader struct {
	Version uint32
	Pid     int32
}

type capData struct {
	Effective   uint32
	Permitted   uint32
	Inheritable uint32
}

func getCapMask(cap int) (uint64, error) {
	header := capHeader{
		Version: 0x20080522, // _LINUX_CAPABILITY_VERSION_3
		Pid:     0,          // 0 means the current process
	}
	data := [2]capData{}

	_, _, err := syscall.Syscall(
		syscall.SYS_CAPGET,
		uintptr(unsafe.Pointer(&header)),
		uintptr(unsafe.Pointer(&data[0])),
		0,
	)
	if err != 0 {
		// cannot determine if we have the capability
		return 0, err
	}

	cap64 := uint64(data[1].Effective)<<32 | uint64(data[0].Effective)

	return cap64, nil
}

func NoSudo[T any](callback func() T) T {
	capMask, err := getCapMask(unix.CAP_SETUID | unix.CAP_SETGID)
	if err != nil {
		if capMask&((1<<unix.CAP_SETUID)|(1<<unix.CAP_SETGID)) == 0 {
			// have no capability to set uid or gid
			return callback()
		}
	}

	euid := syscall.Geteuid()
	egid := syscall.Getegid()
	// cannot determine if we are sudo, try to get the real uid and gid from environment variables
	// try SUDO_UID and SUDO_GID environment variables
	// fmt.Println("SUDO_UID:", os.Getenv("SUDO_UID"))
	// fmt.Println("SUDO_GID:", os.Getenv("SUDO_GID"))
	ruid, _ := strconv.Atoi(os.Getenv("SUDO_UID"))
	rgid, _ := strconv.Atoi(os.Getenv("SUDO_GID"))
	if (euid == ruid && egid == rgid) || (ruid == 0 || rgid == 0) {
		// we are fucked
		return callback()
	}

	// restore HOME environment variable
	if os.Getenv("SUDO_HOME") != "" {
		os.Setenv("HOME", os.Getenv("SUDO_HOME"))
	}

	resultChan := make(chan T)
	go func() {
		runtime.LockOSThread()

		// fmt.Println("setting gid to", rgid)
		// fmt.Println("setting uid to", ruid)
		// best effort to set uid and gid
		syscall.Syscall(syscall.SYS_SETGID, uintptr(rgid), 0, 0)
		syscall.Syscall(syscall.SYS_SETUID, uintptr(ruid), 0, 0)

		resultChan <- callback()
	}()
	return <-resultChan
}
