#!/usr/bin/env python3

import re
import sys
import os

# try import yaml, if cannot import, tell user to install pyyaml
try:
    import yaml
except ImportError:
    print("Please install pyyaml: pip install pyyaml")
    exit(1)

refRe = re.compile(r'\bL\("([^"]+)"')

ids = set()

for root, dirs, files in os.walk("."):
    for file in files:
        if not file.endswith(".go"):
            continue
        # ignore test files
        if file.endswith("_test.go"):
            continue
        with open(os.path.join(root, file), "r") as f:
            for line in f:
                if refRe.search(line):
                    ids.add(refRe.search(line).group(1))

dirname = os.path.dirname(os.path.abspath(__file__))
messagesYAML = dirname + "/messages.yml"
with open(messagesYAML, "r") as f:
    messagesYAML = f.read()
messages = yaml.load(messagesYAML, Loader=yaml.FullLoader)

languages = messages.keys()

for id in ids:
    for language in languages:
        if not id in messages[language]:
            print(f"{id} not found in {language}")
