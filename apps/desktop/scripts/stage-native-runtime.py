#!/usr/bin/env python3
"""Stage PostgreSQL 16 and Redis for a same-architecture macOS build."""

import argparse
import os
from pathlib import Path
import platform
import shutil
import subprocess


def run(*args):
    return subprocess.check_output(args, text=True).strip()


def dependencies(binary):
    for entry in run("otool", "-L", str(binary)).splitlines()[1:]:
        name = entry.strip().split(" (compatibility version", 1)[0]
        if name.startswith(("/usr/lib/", "/System/Library/")):
            continue
        if not name.startswith(("/", "@loader_path/")):
            raise ValueError(f"Unresolved install name {name} in {binary}")
        yield name


def stage(postgres, redis, output):
    architecture = platform.machine()
    pending = []
    libraries = {}

    def copy(source, destination):
        if architecture not in run("lipo", "-archs", str(source)).split():
            raise ValueError(f"{source} does not support {architecture}")
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        destination.chmod(destination.stat().st_mode | 0o200)
        pending.append((source, destination))

    for name in ("postgres", "initdb", "pg_ctl", "pg_dump", "pg_restore", "createdb"):
        copy(postgres / "bin" / name, output / "bin" / name)
    copy(redis / "bin" / "redis-server", output / "bin" / "redis-server")

    pg_config = str(postgres / "bin" / "pg_config")
    share = Path(run(pg_config, "--sharedir"))
    shutil.copytree(share, output / "share" / share.name)
    module = Path(run(pg_config, "--pkglibdir")) / "plpgsql.dylib"
    copy(module, output / "lib" / "postgresql" / module.name)

    while pending:
        source, binary = pending.pop()
        changes = []
        for name in dependencies(source):
            target = (source.parent / name.removeprefix("@loader_path/")).resolve(strict=True)
            if target == source.resolve():
                changes.extend(("-id", "@loader_path/" + binary.name))
                continue
            library = output / "lib" / target.name
            previous = libraries.get(library)
            if previous is None:
                copy(target, library)
                libraries[library] = target
            elif previous != target:
                raise ValueError(f"Library name collision between {previous} and {target}")
            relative = os.path.relpath(library, binary.parent)
            changes.extend(("-change", name, f"@loader_path/{relative}"))
        if changes:
            run("install_name_tool", *changes, str(binary))
        run("codesign", "--force", "--sign", "-", str(binary))
        run("codesign", "--verify", str(binary))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--postgres", required=True, type=Path)
    parser.add_argument("--redis", required=True, type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    if platform.system() != "Darwin":
        parser.error("A macOS build host is required.")
    args.output.mkdir(parents=True, exist_ok=False)
    stage(args.postgres.resolve(), args.redis.resolve(), args.output.resolve())
