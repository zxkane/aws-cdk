#!/bin/bash
# Script to check that the licenses we're using are okay.
set -euo pipefail

# PSF is Python Software Foundation license.
approved_licenses="
    MIT ISC MIT/X11
    BSD BSD-2-Clause BSD-3-Clause
    Apache-2.0
    PSF
    CC0-1.0 Unlicense
    CC-BY-3.0
    "

approved_packages=()

# jmespath uses 'Apache 2.0' but the tool doesn't accept spaces.
approved_packages+=(jmespath)

# Uses MIT today but version in our dep tree is unlicensed
approved_packages+=(cli-color)

# Uses MIT in a separate LICENSE file, in newer version than
# one we're depending on.
approved_packages+=(dreamopt)

# Uses ISC but was mistyped in package.json
approved_packages+=(es5-ext)

# The use of --allow-packages will make the tool complain
# about all the packages where these dependencies aren't actually
# used, which is unfortunate but no getting around it.

echo "Checking licenses..." >&2
node_modules/.bin/lerna exec -- node-license-validator \
    --verbose \
    --production \
    --warn \
    --allow-licenses $approved_licenses \
    --allow-packages ${approved_packages[@]} \
    > /tmp/licenses.txt


# If "grep" can't find any invalid licenses, yay
grep "Invalid license" /tmp/licenses.txt | sort | uniq > /tmp/invalid-licenses.txt || {
    echo "All licenses OK."
    exit 0
}

echo =================================
echo     UNAPPROVED LICENCES FOUND
echo =================================
cat /tmp/invalid-licenses.txt
exit 1
