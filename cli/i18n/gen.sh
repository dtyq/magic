#!/bin/bash

set -eo pipefail

(
    sed '/^var messagesYAMLZstdBase64 string = `/q' messages.go
	cat messages.yml | zstd -19 | base64
	sed -n '/^`$/,$p' messages.go
) > messages.go.new

mv messages.go.new messages.go
