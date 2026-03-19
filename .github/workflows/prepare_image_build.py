#!/usr/bin/env python3

import os
import sys
import json
import datetime
from typing import TypedDict

import yaml

defaultBuildArgs = {
    "TZ": "UTC",
    "GOPROXY": "",
    "APK_MIRROR": "dl-cdn.alpinelinux.org",
    "DEBIAN_APT_MIRROR": "deb.debian.org",
    "UBUNTU_APT_MIRROR": "archive.ubuntu.com",
    "UBUNTU_SECURITY_APT_MIRROR": "security.ubuntu.com",
    "PIP_INDEX_URL": "https://pypi.org/simple",
    "NODEJS_MIRROR": "https://nodejs.org/dist/",
    "NPM_REGISTRY": "https://registry.npmjs.org",
    "COMPOSER_MIRROR": "",
}


class ImageDescription(TypedDict):
    # match Build struct in cli image/build.go
    dockerfile: str
    context: str
    buildArgs: dict[str, str]
    tags: list[str]
    platforms: list[str]


class MagicrewStructure(TypedDict):
    # match MagicrewStructure struct in cli code/code.go
    images: dict[str, ImageDescription]


# open github output file
githubOutput = open(os.environ["GITHUB_OUTPUT"], "w")

# read context from file
contextFile = open(sys.argv[1], "r")
context = json.load(contextFile)
contextFile.close()
imageName = context["inputs"]["imageName"]

# read magicrew structure from file
magicrewStructureFile = open("magicrew.yml", "r")
magicrewStructure: MagicrewStructure = yaml.load(
    magicrewStructureFile, Loader=yaml.Loader
)
magicrewStructureFile.close()

imageDesc = magicrewStructure["images"].get(imageName)
if imageDesc is None:
    print(f"image {imageName} not found in magicrew structure", file=sys.stderr)
    sys.exit(1)

# output platforms
platforms = "linux/amd64,linux/arm64"
if imageDesc.get("platforms"):
    platforms = ",".join(imageDesc.get("platforms"))
githubOutput.write(f"platforms={platforms}\n")

# output context
contextDir = imageDesc.get("context")
if contextDir is None:
    print(
        f"context for image {imageName} not found in magicrew structure",
        file=sys.stderr,
    )
    sys.exit(1)
githubOutput.write(f"context={contextDir}\n")

# generate build args
buildArgs = defaultBuildArgs.copy()
if context["github"]["ref_type"] == "tag":
    buildArgs["CI_COMMIT_TAG"] = context["github"]["ref_name"]
buildArgs["CI_COMMIT_SHA"] = context["github"]["sha"]
if imageDesc.get("buildArgs"):
    buildArgs.update(imageDesc.get("buildArgs"))
buildArgsLFSplited = "\n".join([f"{key}={value}" for key, value in buildArgs.items()])
buildArgsJSON = json.dumps(buildArgsLFSplited)
githubOutput.write(f"buildArgs<<EOF\n{buildArgsLFSplited}\nEOF\n")

# generate tags
tags = []
tagsPolicy = context["vars"].get("TAGS_POLICY", '["commit", "branch"]')
for tagPolicy in json.loads(tagsPolicy):
    if tagPolicy == "commit":
        tags.append(context["github"]["sha"])
    elif tagPolicy == "branch":
        if context["github"]["ref_type"] == "branch":
            tags.append(context["github"]["ref_name"])
    elif tagPolicy == "git-tags":
        if context["github"]["ref_type"] == "tag":
            tags.append(context["github"]["ref_name"])
    elif tagPolicy == "nightly-date":
        tags.append("nightly-" + datetime.now().strftime("%Y%m%d"))
    else:
        print(f"unknown tag policy: {tagPolicy}", file=sys.stderr)
        sys.exit(1)

imageFullTags = []
imagePrefixies = context["vars"].get(
    "IMAGE_PREFIXIES", '["ghcr.io/dtyq/", "dtyq/", "public.ecr.aws/dtyq/"]'
)
for imagePrefix in json.loads(imagePrefixies):
    if imagePrefix.startswith("ghcr.io/"):
        # check if we have GHCR cred
        if context["secrets"].get("github_token") is None:
            print("loginGHCR=false", file=githubOutput)
            continue
        else:
            print("loginGHCR=true", file=githubOutput)
    elif imagePrefix.startswith("public.ecr.aws/"):
        # check if we have ECR cred
        if (
            context["secrets"].get("AWS_ACCESS_KEY_ID") is None
            or context["secrets"].get("AWS_SECRET_ACCESS_KEY") is None
        ):
            print("loginECR=false", file=githubOutput)
            continue
        else:
            print("loginECR=true", file=githubOutput)
    else:
        # check if we have Docker Hub cred
        if (
            context["secrets"].get("DOCKERHUB_USERNAME") is None
            or context["secrets"].get("DOCKERHUB_TOKEN") is None
        ):
            print("loginDockerHub=false", file=githubOutput)
            continue
        else:
            print("loginDockerHub=true", file=githubOutput)

    for tag in tags:
        imageFullTags.append(imagePrefix + imageName + ":" + tag)

if len(imageFullTags) == 0:
    print("no image tags to build, are secrets set?", file=sys.stderr)
    sys.exit(1)
print(f"tags={','.join(imageFullTags)}", file=githubOutput)

githubOutput.close()
