#!/usr/bin/env bash

set -e
set -x

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
BASEPATH=$(cd `dirname $0`; cd ../backend/; pwd)
REPOS=$@

function split()
{
    SHA1=`./bin/splitsh-lite --prefix=$1`
    git push $2 "$SHA1:refs/heads/$CURRENT_BRANCH" -f
}

function remote()
{
    git remote add $1 $2 || true
}

# git pull origin $CURRENT_BRANCH

if [[ $# -eq 0 ]]; then
    REPOS=$(ls $BASEPATH)
fi

# remote github git@github.com:dtyq/super-magic-module.git
# split "backend/super-magic-module" "git@github.com:dtyq/super-magic-module.git"

for REPO in $REPOS ; do
    remote $REPO git@github.com:dtyq/$REPO.git

    split "backend/$REPO" $REPO
done
