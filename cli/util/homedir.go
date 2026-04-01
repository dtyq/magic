package util

import (
	"os"
	"path/filepath"
	"runtime"
)

// HomeDir returns the home directory for the current user.
//
// On Windows, resolution follows kubernetes client-go/util/homedir (kubectl):
//  1. First non-empty path among %HOME%, %HOMEDRIVE%%HOMEPATH%, %USERPROFILE%
//     that contains a ".kube/config" file (or ".kube\\config" on disk).
//  2. If none contain kubeconfig: first among %HOME%, %USERPROFILE%, %HOMEDRIVE%%HOMEPATH%
//     that exists, is a directory, and passes the same writability heuristic as client-go.
//  3. Else first path that exists.
//  4. Else first path that is set (non-empty).
//
// On Unix-like systems, $HOME is preferred when set; otherwise os.UserHomeDir is used.
// The lookup runs inside NoSudo so behavior stays consistent with sudo elevation on Linux/macOS.
func HomeDir() string {
	if runtime.GOOS == "windows" {
		return homeDirWindows()
	}
	return NoSudo(homeDirUnix)
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
		if _, err := os.Stat(filepath.Join(p, ".kube", "config")); err != nil {
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
		if info.IsDir() && info.Mode().Perm()&(1<<(uint(7))) != 0 {
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
