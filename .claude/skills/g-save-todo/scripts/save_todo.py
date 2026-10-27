#!/usr/bin/env python3
"""Save todo list content to a deterministic markdown file path."""

import argparse
import getpass
import re
import sys
from datetime import date, datetime
from pathlib import Path


def build_parser():
    parser = argparse.ArgumentParser(
        description="Save todo lists to markdown files in the project’s established directory.",
    )
    parser.add_argument("--title", required=True, help="Todo title used for file slug.")
    parser.add_argument("--source", default="agent", help="Todo source metadata.")
    parser.add_argument("--status", default="open", help="Todo status metadata.")
    parser.add_argument("--owner", default=getpass.getuser(), help="Todo owner metadata.")
    parser.add_argument(
        "--date",
        dest="todo_date",
        default=date.today().isoformat(),
        help="Todo date in YYYY-MM-DD format.",
    )
    parser.add_argument(
        "--out-dir",
        default=None,
        help="Output directory; defaults to existing project storage or .agents/todo.",
    )
    parser.add_argument("--stdin", action="store_true", help="Read body from stdin.")
    parser.add_argument("--input", help="Read body from file path.")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing output file if present.",
    )
    parser.add_argument("--filename", help="Explicit Markdown basename (no directories).")
    return parser


def validate_date(value):
    try:
        if not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value):
            raise ValueError("Invalid date format")
        datetime.strptime(value, "%Y-%m-%d")
        return value
    except ValueError as exc:
        raise ValueError("--date must use YYYY-MM-DD format") from exc


def slugify(title):
    slug = re.sub(r"[^a-z0-9]+", "-", title.strip().lower()).strip("-")
    slug = re.sub(r"-{2,}", "-", slug)
    if not slug:
        raise ValueError("--title must include at least one letter or digit")
    return slug


def read_body(args):
    if args.stdin and args.input:
        raise ValueError("Use either --stdin or --input, not both")

    if args.input:
        path = Path(args.input)
        if not path.exists() or not path.is_file():
            raise ValueError(f"Input file not found: {path}")
        body = path.read_text(encoding="utf-8")
    elif args.stdin:
        body = sys.stdin.read()
    else:
        raise ValueError("Todo body is required. Provide --stdin or --input <file>")

    if not body.strip():
        raise ValueError("Todo body is empty")

    return body.rstrip() + "\n"


def format_document(meta, body):
    header = "\n".join(
        [
            f"title: {meta['title']}",
            f"date: {meta['date']}",
            f"source: {meta['source']}",
            f"status: {meta['status']}",
            f"owner: {meta['owner']}",
        ]
    )
    return f"{header}\n\n{body}"


def output_directory(explicit):
    if explicit:
        return Path(explicit).expanduser()
    shared = Path(".agents/todo")
    if shared.is_dir():
        return shared
    legacy = [p for p in (Path(".codex/todo"), Path(".claude/todo")) if p.is_dir()]
    if len(legacy) > 1:
        raise ValueError("Both .codex/todo and .claude/todo exist; specify --out-dir")
    return legacy[0] if legacy else shared


def output_filename(explicit, saved_date, slug):
    if explicit is None:
        return f"{saved_date}-{slug}.md"
    if (not explicit or explicit in (".", "..")
            or "/" in explicit or "\\" in explicit
            or any(ord(char) < 32 for char in explicit)
            or not explicit.endswith(".md") or explicit == ".md"):
        raise ValueError("--filename must be a Markdown basename ending in .md, without directories")
    return explicit


def main():
    parser = build_parser()
    args = parser.parse_args()

    try:
        todo_date = validate_date(args.todo_date)
        slug = slugify(args.title)
        body = read_body(args)
        out_dir = output_directory(args.out_dir)
        filename = output_filename(args.filename, todo_date, slug)
    except (ValueError, OSError) as err:
        print(f"ERROR: {err}", file=sys.stderr)
        return 1

    output_path = out_dir / filename
    if output_path.exists() and not args.force:
        print(
            f"ERROR: Output file already exists: {output_path}. Use --force to overwrite.",
            file=sys.stderr,
        )
        return 1

    meta = {
        "title": args.title.strip(),
        "date": todo_date,
        "source": args.source.strip(),
        "status": args.status.strip(),
        "owner": args.owner.strip(),
    }

    try:
        out_dir.mkdir(parents=True, exist_ok=True)
        with output_path.open("w" if args.force else "x", encoding="utf-8") as output:
            output.write(format_document(meta, body))
    except OSError as err:
        print(f"ERROR: {err}", file=sys.stderr)
        return 1
    print(str(output_path.resolve()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
