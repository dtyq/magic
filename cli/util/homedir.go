package util

import (
	"os"
	"path/filepath"
	"runtime"
)

// HomeDir returns the home directory for the current user.
//
// On Windows, resolution follows kubernetes client-go/util/homedir (kubectl) ordering,
// but probes for ".magicrew/config.yml" instead of ".kube/config":
//  1. First non-empty path among %HOME%, %HOMEDRIVE%%HOMEPATH%, %USERPROFILE%
//     that contains a ".magicrew/config.yml" file.
//  2. If none contain magicrew config: first among %HOME%, %USERPROFILE%, %HOMEDRIVE%%HOMEPATH%
//     that exists, is a directory, and passes a tempfile create/remove writability probe.
//  3. Else first path that exists.
//  4. Else first path that is set (non-empty).
//
// On Unix-like systems, $HOME is preferred when set; otherwise os.UserHomeDir is used.
// The lookup runs inside NoSudo so behavior stays consistent with sudo elevation on Linux/macOS.
//
// Non-empty results are passed through filepath.Clean on all platforms.
func HomeDir() string {
	var s string
	if runtime.GOOS == "windows" {
		s = homeDirWindows()
	} else {
		s = NoSudo(homeDirUnix)
	}
	if s != "" {
		return filepath.Clean(s)
	}
	return ""
}

func homeDirUnix() string {
	if h := os.Getenv("HOME"); h != "" {
		return h
	}
	dir, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return dir
}

func homeDirWritableProbe(dir string) bool {
	f, err := os.CreateTemp(dir, "magicrew-writable-*")
	if err != nil {
		return false
	}
	name := f.Name()
	if err := f.Close(); err != nil {
		_ = os.Remove(name)
		return false
	}
	return os.Remove(name) == nil
}

func homeDirWindows() string {
	home := os.Getenv("HOME")
	homeDriveHomePath := ""
	if homeDrive, homePath := os.Getenv("HOMEDRIVE"), os.Getenv("HOMEPATH"); len(homeDrive) > 0 && len(homePath) > 0 {
		homeDriveHomePath = homeDrive + homePath
	}
	userProfile := os.Getenv("USERPROFILE")

	for _, p := range []string{home, homeDriveHomePath, userProfile} {
		if len(p) == 0 {
			continue
		}
		if _, err := os.Stat(filepath.Join(p, ".config", "magicrew", "config.yml")); err != nil {
			continue
		}
		return p
	}

	var firstSetPath, firstExistingPath string

	for _, p := range []string{home, userProfile, homeDriveHomePath} {
		if len(p) == 0 {
			continue
		}
		if firstSetPath == "" {
			firstSetPath = p
		}
		info, err := os.Stat(p)
		if err != nil {
			continue
		}
		if firstExistingPath == "" {
			firstExistingPath = p
		}
		if info.IsDir() && homeDirWritableProbe(p) {
			return p
		}
	}

	if firstExistingPath != "" {
		return firstExistingPath
	}
	if firstSetPath != "" {
		return firstSetPath
	}
	return ""
}
