#!/usr/bin/env python3
"""Generates placeholder extension icons (flat green square with a lighter
inner square) without any image-library dependencies. Re-run if sizes change:

    python3 scripts/gen-icons.py

Replace with real branded icons before store submission.
"""
import os
import struct
import zlib

GREEN = (46, 125, 50, 255)        # #2E7D32
LIGHT = (129, 199, 132, 255)      # #81C784
SIZES = [16, 32, 48, 96, 128]
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "icon")


def png_chunk(tag: bytes, data: bytes) -> bytes:
    chunk = tag + data
    return struct.pack(">I", len(data)) + chunk + struct.pack(">I", zlib.crc32(chunk))


def make_png(size: int) -> bytes:
    inset = max(2, size // 4)
    rows = []
    for y in range(size):
        row = bytearray(b"\x00")  # filter type 0
        for x in range(size):
            inner = inset <= x < size - inset and inset <= y < size - inset
            row += bytes(LIGHT if inner else GREEN)
        rows.append(bytes(row))
    raw = b"".join(rows)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # 8-bit RGBA
    return (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", ihdr)
        + png_chunk(b"IDAT", zlib.compress(raw, 9))
        + png_chunk(b"IEND", b"")
    )


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    for size in SIZES:
        path = os.path.join(OUT_DIR, f"{size}.png")
        with open(path, "wb") as f:
            f.write(make_png(size))
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
