"""Shared primitives for Kiokun's stable bucket-native corpora."""

from __future__ import annotations

import ctypes
import os
from pathlib import Path
import sys


BUCKET_ALGORITHM = "kiokun_simple_hash_low_byte_v1"
BUCKET_COUNT = 256


class TransactionError(RuntimeError):
    pass


def simple_hash(value: str) -> int:
    result = 0
    for character in value:
        result = ((result * 31) + ord(character)) & ((1 << 64) - 1)
    return result


def bucket_for_key(value: str) -> str:
    return f"{simple_hash(value) & 0xff:02x}"


def atomic_exchange_directories(left: Path, right: Path) -> None:
    """Atomically exchange two directories on Linux or macOS."""

    if sys.platform.startswith("linux"):
        libc = ctypes.CDLL(None, use_errno=True)
        renameat2 = getattr(libc, "renameat2", None)
        if renameat2 is None:
            raise TransactionError("transactional corpus publishing requires renameat2")
        renameat2.argtypes = [
            ctypes.c_int,
            ctypes.c_char_p,
            ctypes.c_int,
            ctypes.c_char_p,
            ctypes.c_uint,
        ]
        renameat2.restype = ctypes.c_int
        result = renameat2(-100, os.fsencode(left), -100, os.fsencode(right), 2)
    elif sys.platform == "darwin":
        libc = ctypes.CDLL(None, use_errno=True)
        renamex_np = getattr(libc, "renamex_np", None)
        if renamex_np is None:
            raise TransactionError("transactional corpus publishing requires renamex_np")
        renamex_np.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_uint]
        renamex_np.restype = ctypes.c_int
        result = renamex_np(os.fsencode(left), os.fsencode(right), 2)
    else:
        raise TransactionError(
            f"transactional corpus publishing is unsupported on {sys.platform}"
        )
    if result != 0:
        error_number = ctypes.get_errno()
        raise TransactionError(
            f"cannot atomically exchange corpus directories: {os.strerror(error_number)}"
        )
