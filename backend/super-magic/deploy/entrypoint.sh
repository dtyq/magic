#!/usr/bin/bash
. ~/.bashrc

exec tini -- "$@"
