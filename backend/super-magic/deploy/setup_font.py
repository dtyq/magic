#! /usr/bin/env python3
# -*- coding: utf-8 -*-
import os, sys
import struct as st
import logging
import re
import io

# logging.basicConfig(level=logging.DEBUG)


def resortTTC(fontPath: str, outputPath: str):
    fi = open(fontPath, "rb")

    otcheader = fi.read(12)
    endian = ">"
    sig = st.unpack(">I", otcheader[0:4])
    if sig[0] == 0x74746366:
        endian = ">"
    elif sig[0] == 0x66637474:
        endian = "<"
    else:
        raise Exception("Invalid TTC signature: {sig[0]}")
    # 0: uint32_t tag 0x74746366 be or 0x66637474 le
    # 4: uint16_t major version
    # 6: uint16_t minor version
    major_version, minor_version = st.unpack(f"{endian}HH", otcheader[4:8])
    if major_version != 1:
        raise Exception("Invalid TTC major version: {major_version}")
    if minor_version != 0:
        raise Exception("Invalid TTC minor version: {minor_version}")

    numFonts = st.unpack(f"{endian}I", otcheader[8:12])[0]
    offsetBytes = fi.read(4 * numFonts)
    otcheader += offsetBytes
    fontOffsets = st.unpack(endian + ("I" * numFonts), offsetBytes)

    fonts = []
    for i in range(numFonts):
        fontOffset = fontOffsets[i]
        fi.seek(fontOffset)
        # for each font:
        # 0 uint32_t sfntVersion 0x4f54544f
        # 4 uint16_t numTables
        # 6 uint16_t searchRange
        # 8 uint16_t entrySelector
        # 10 uint16_t rangeShift
        fontHeader = fi.read(12)
        sfntVersion, numTables, searchRange, entrySelector, rangeShift = st.unpack(
            f"{endian}IHHHH", fontHeader
        )
        if sfntVersion != 0x4F54544F:
            raise Exception(f"Invalid OTF signature: {sfntVersion}")

        logging.info(
            f"font {i} at {fontOffset:08x} numTables: {numTables} searchRange: {searchRange} entrySelector: {entrySelector} rangeShift: {rangeShift}"
        )
        fontHeader += fi.read(16 * numTables)

        def findFontName():
            for j in range(numTables):
                # for each table:
                # 0 uint32_t tag
                # 4 uint32_t checksum
                # 8 uint32_t offset
                # 12 uint32_t length
                tableData = fontHeader[j * 16 + 12 : j * 16 + 16 + 12]
                tableTag, checksum, offset, length = st.unpack(
                    f"{endian}IIII", tableData
                )
                tableTagStr = tableData[0:4].decode("utf-8")
                logging.info(
                    f"  {i} table {j} tag: {tableTagStr} checksum: {checksum:08x} offset: {offset:08x} length: {length:08x}"
                )

                if tableTagStr == "name":
                    # read the name table
                    fi.seek(offset)
                    nameTable = fi.read(length)
                    version, nameCount, storageOffset = st.unpack(
                        f"{endian}HHH", nameTable[0:6]
                    )
                    logging.info(
                        f"  {i} name table version: {version} nameCount: {nameCount} storageOffset: {storageOffset:04x}"
                    )

                    for k in range(nameCount):
                        nameRecord = nameTable[k * 12 + 6 : k * 12 + 12 + 6]
                        (
                            platformID,
                            encodingID,
                            languageID,
                            nameID,
                            strLength,
                            strOffset,
                        ) = st.unpack(f"{endian}HHHHHH", nameRecord)
                        logging.info(
                            f"    {i} str {k} platformID: {platformID} encodingID: {encodingID} languageID: {languageID} nameID: {nameID} strLength: {strLength:04x} strOffset: {strOffset:04x}"
                        )
                        if nameID == 1 and languageID == 0x0409:
                            # print(nameTable[strOffset+storageOffset:strOffset+ storageOffset + (strLength)].hex())
                            utf16Str = nameTable[
                                strOffset
                                + storageOffset : strOffset
                                + storageOffset
                                + (strLength)
                            ].decode("utf-16" + ("le" if endian == "<" else "be"))
                            logging.info(f"      {i} name {k} utf16Str: {utf16Str}")
                            return utf16Str

        name = findFontName()
        if name:
            fonts.append((name, fontHeader))
        else:
            raise Exception(f"font {i} name not found")

    nameOrderDict = [
        "Noto Sans CJK SC",
        "Noto Sans CJK TC",
        "Noto Sans CJK HK",
        "Noto Sans CJK JP",
        "Noto Sans CJK KR",
        "Noto Sans Mono CJK SC",
        "Noto Sans Mono CJK TC",
        "Noto Sans Mono CJK HK",
        "Noto Sans Mono CJK JP",
        "Noto Sans Mono CJK KR",
        "Noto Serif CJK SC",
        "Noto Serif CJK TC",
        "Noto Serif CJK HK",
        "Noto Serif CJK JP",
        "Noto Serif CJK KR",
    ]

    def keyFunc(x):
        for i, name in enumerate(nameOrderDict):
            if name in x[0]:
                return i
        raise Exception(f"Font {x[0]} not found in nameOrderDict")

    fo = open(outputPath, "wb")
    fo.write(otcheader)

    for name in sorted(fonts, key=keyFunc):
        # print(name[0])
        fo.write(name[1])

    fi.seek(fo.tell())
    while True:
        data = fi.read(4096)
        if not data:
            break
        fo.write(data)
    fi.close()
    fo.close()


def resortTTCs():
    for file in os.listdir("/usr/share/fonts/opentype/noto/"):
        if (
            file.startswith("NotoSansCJK") or file.startswith("NotoSerifCJK")
        ) and file.endswith(".ttc"):
            newPath = os.path.join(
                "/usr/share/fonts/opentype/noto/", file.replace(".ttc", ".ttc.new")
            )
            oldPath = os.path.join("/usr/share/fonts/opentype/noto/", file)
            resortTTC(oldPath, newPath)
            os.remove(oldPath)
            os.rename(newPath, oldPath)


def setupFontconfig():
    config = """<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
    <alias>
        <family>Noto Sans CJK</family>
        <prefer>
            <family>Noto Sans CJK SC</family>
            <family>Noto Sans CJK TC</family>
            <family>Noto Sans CJK HK</family>
            <family>Noto Sans CJK JP</family>
            <family>Noto Sans CJK KR</family>
        </prefer>
    </alias>
    <alias>
        <family>Noto Serif CJK</family>
        <prefer>
            <family>Noto Serif CJK SC</family>
            <family>Noto Serif CJK TC</family>
            <family>Noto Serif CJK HK</family>
            <family>Noto Serif CJK JP</family>
            <family>Noto Serif CJK KR</family>
        </prefer>
    </alias>
    <alias>
        <family>Noto Sans Mono CJK</family>
        <prefer>
            <family>Noto Sans Mono CJK SC</family>
            <family>Noto Sans Mono CJK TC</family>
            <family>Noto Sans Mono CJK HK</family>
            <family>Noto Sans Mono CJK JP</family>
            <family>Noto Sans Mono CJK KR</family>
        </prefer>
    </alias>
    <alias>
        <family>sans-serif</family>
        <prefer>
            <family>Noto Sans CJK</family>
            <family>WenQuanYi Zen Hei</family>
            <family>Noto Sans</family>
            <family>Liberation Sans</family>
            <family>DejaVu Sans</family>
            <family>Bitstream Vera Sans</family>
        </prefer>
    </alias>
    <alias>
        <family>serif</family>
        <prefer>
            <family>Noto Serif CJK</family>
            <family>WenQuanYi Zen Hei Serif</family>
            <family>Noto Serif</family>
            <family>Liberation Serif</family>
            <family>DejaVu Serif</family>
            <family>FreeSerif</family>
        </prefer>
    </alias>
    <alias>
        <family>monospace</family>
        <prefer>
            <family>Noto Sans Mono CJK</family>
            <family>WenQuanYi Zen Mono</family>
            <family>Source Code Pro</family>
            <family>Inconsolata</family>
            <family>Liberation Mono</family>
            <family>DejaVu Sans Mono</family>
            <family>Bitstream Vera Sans Mono</family>
        </prefer>
    </alias>
    <alias>
        <family>Source Han Serif CN</family>
        <prefer>
            <family>Noto Serif CJK SC</family>
        </prefer>
    </alias>
    <alias>
        <family>Source Han Sans CN</family>
        <prefer>
            <family>Noto Sans CJK SC</family>
        </prefer>
    </alias>
    <alias>
        <family>思源宋体</family>
        <prefer>
            <family>Noto Serif CJK SC</family>
        </prefer>
    </alias>
    <alias>
        <family>思源黑体</family>
        <prefer>
            <family>Noto Sans CJK SC</family>
        </prefer>
    </alias>
</fontconfig>
"""

    with open("/etc/fonts/conf.d/60-fontprefer.conf", "w") as f:
        f.write(config)
    rc = os.system("fc-cache -r")
    if rc != 0:
        raise Exception("Failed to cache fonts")


def installFonts():
    # for ubuntu
    rc = os.system("apt-get update")
    if rc != 0:
        raise Exception("Failed to update apt")
    rc = os.system(
        "apt-get install -yyq fonts-noto-cjk fonts-noto-cjk-extra fonts-wqy-microhei fonts-wqy-zenhei fonts-inconsolata fonts-noto-color-emoji"
    )
    if rc != 0:
        raise Exception("Failed to install fonts")


def configureMPL():
    config = """backend: Agg
axes.unicode_minus: False
font.family: sans-serif
font.sans-serif: Noto Sans CJK SC, Noto Sans CJK TC, Noto Sans CJK HK, Noto Sans CJK JP, Noto Sans CJK KR, WenQuanYi Zen Hei, Arial, Liberation Sans, DejaVu Sans, Bitstream Vera Sans, sans-serif
font.serif: Noto Serif CJK SC, Noto Serif CJK TC, Noto Serif CJK HK, Noto Serif CJK JP, Noto Serif CJK KR, WenQuanYi Zen Hei Serif, Liberation Serif, DejaVu Serif, FreeSerif, serif
font.monospace: Noto Sans Mono CJK SC, Source Code Pro, Inconsolata, Liberation Mono, DejaVu Sans Mono, Bitstream Vera Sans Mono, monospace
"""

    mpl_config_dir = os.environ.get(
        "MPLCONFIGDIR",
        os.path.join(os.environ.get("XDG_CONFIG_HOME", os.path.expanduser("~/.config")), "matplotlib"),
    )
    os.makedirs(mpl_config_dir, exist_ok=True)
    with open(os.path.join(mpl_config_dir, "matplotlibrc"), "w") as f:
        f.write(config)


def patchMPL(venvPath: str):
    fontRe = re.compile(r"^(font\.(?:family|sans-serif):.*)", re.MULTILINE)
    pythonVersionDir = os.listdir(f"{venvPath}/lib")[0]
    baseDir = (
        f"{venvPath}/lib/{pythonVersionDir}/site-packages/matplotlib/mpl-data/stylelib"
    )
    for file in os.listdir(baseDir):
        if file.endswith(".mplstyle"):
            with open(os.path.join(baseDir, file), "r+") as f:
                content = f.read()
                if fontRe.search(content):
                    logging.info(f"Patching {file}")
                    content = fontRe.sub(r"# \1", content)
                    f.seek(0)
                    f.write(content)
                    f.truncate()


def testFonts():
    # mpl do not use fontconfig, test if it can use the fonts we installed
    # these imports should be there, after our patch, DO NOT move to header
    import matplotlib.pyplot as plt  # DO NOT move to header
    from PIL import Image, ImageDraw, ImageFont  # DO NOT move to header
    import numpy as np
    from scipy import ndimage

    plt.style.use("seaborn-v0_8")

    buffer = io.BytesIO()
    plt.clf()
    _, ax = plt.subplots(figsize=(1, 1))
    ax.text(0, 0, "门", fontsize=100, ha="center", va="center")
    ax.set_xticks([])
    ax.set_yticks([])
    plt.savefig(
        buffer, dpi=300, bbox_inches="tight", facecolor="white", transparent=True
    )
    plt.close()
    imageMPL = Image.open(buffer).convert("L")

    # assert image glyph is chinese glyph -> 门 have 3 features in chinese glyph and 1 in japanese glyph
    npa = np.array(imageMPL)
    npa = npa < 128  # simply bw
    _, numFeatures = ndimage.label(npa)
    assert (
        numFeatures == 3
    ), f"matplotlib test image for 门 should have 3 features, but got {numFeatures}"


def main():
    installFonts()
    resortTTCs()
    setupFontconfig()
    configureMPL()
    patchMPL("/venv")
    testFonts()


if __name__ == "__main__":
    main()
