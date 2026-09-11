#!/usr/bin/env python3
"""Small Devin v3 experiment runner. Credentials come only from the environment."""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import re
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://api.devin.ai"


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def private_json(path, value, exclusive=False):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    flags = os.O_WRONLY | os.O_CREAT | (os.O_EXCL if exclusive else os.O_TRUNC)
    fd = os.open(path, flags, 0o600)
    with os.fdopen(fd, "w") as f:
        json.dump(value, f, ensure_ascii=False, indent=2)
        f.write("\n")


def api(method, path, body=None):
    key = os.environ.get("DEVIN_V3_API_KEY") or os.environ.get("DEVIN_API_KEY")
    if not key or not key.startswith("cog_"):
        raise RuntimeError("Set DEVIN_V3_API_KEY (cog_ credential), never put it in a command argument.")
    req = urllib.request.Request(BASE + path,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"},
        method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            return json.load(response)
    except urllib.error.HTTPError as e:
        # Do not echo provider response bodies: they can contain prompt or secret data.
        raise RuntimeError(f"Devin {method} {path}: HTTP {e.code}") from None


def org_path():
    org = os.environ.get("DEVIN_ORG_ID", "")
    if not re.fullmatch(r"org-[A-Za-z0-9-]+", org):
        raise RuntimeError("Set a valid DEVIN_ORG_ID.")
    return "/v3/organizations/" + org


def session_id(value):
    value = value.removeprefix("devin-")
    if not re.fullmatch(r"[A-Za-z0-9-]+", value):
        raise ValueError("Invalid session ID")
    return value


def summarize(session, insights=None, consumption=None):
    return {
        "observed_at": now(), "session_id": session.get("session_id"),
        "url": session.get("url"), "status": session.get("status"),
        "status_detail": session.get("status_detail"),
        "session_acus": session.get("acus_consumed"),
        "insights_acus": (insights or {}).get("acus_consumed"),
        "daily_total_acus": (consumption or {}).get("total_acus"),
        "input_tokens": None, "output_tokens": None,
        "model_api_verified": False,
        "structured_output": session.get("structured_output"),
        "pull_requests": session.get("pull_requests", []),
    }


def collect(sid, directory):
    sid = session_id(sid)
    p = org_path()
    paths = {"session": f"{p}/sessions/{sid}",
             "insights": f"{p}/sessions/{sid}/insights",
             "consumption": f"{p}/consumption/daily/sessions/devin-{sid}"}
    data = {}
    for label, path in paths.items():
        try:
            data[label] = api("GET", path)
        except RuntimeError as e:
            if label == "session":
                raise
            data[label] = {"unavailable": str(e)}
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    private_json(directory / f"{stamp}.json", data)
    result = summarize(**data)
    private_json(directory / "latest.json", result)
    return result


def start(role, run_name, cap, extra=None):
    if not re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,63}", run_name):
        raise ValueError("Run name must be a short lowercase slug")
    if role not in {"frontend", "backend", "integration"} or cap <= 0:
        raise ValueError("Invalid role or positive ACU cap")
    directory = ROOT / "artifacts" / run_name / role
    intent = directory / "create-intent.json"
    # Validate credentials before reserving the run, without sending a billable request.
    p = org_path()
    principal = api("GET", "/v3/self")
    prompt = (ROOT / "prompts" / (role + ".md")).read_text()
    if extra:
        prompt += "\n\n" + Path(extra).read_text()
    body = {
        "prompt": prompt, "title": f"Tomorrow Echo | {role} | {run_name}",
        "repos": ["https://github.com/soren-labs/tomorrow-echo"],
        "max_acu_limit": cap, "tags": ["tomorrow-echo", role, run_name],
        "resumable": True,
        "structured_output_schema": {
            "type": "object", "properties": {
                "phase": {"type": "string"}, "branch": {"type": "string"},
                "pr_url": {"type": ["string", "null"]},
                "deployment_url": {"type": ["string", "null"]},
                "tests_passed": {"type": "array", "items": {"type": "string"}},
                "acceptance_passed": {"type": "array", "items": {"type": "string"}},
                "blockers": {"type": "array", "items": {"type": "string"}},
                "model_observed": {"type": ["string", "null"]}
            }, "required": ["phase", "branch", "pr_url", "tests_passed", "blockers", "model_observed"]
        }
    }
    # API has no documented idempotency key. Reserve before POST and NEVER auto-retry.
    # If the response is lost, inspect the session list by this unique title first.
    private_json(intent, {"created_at": now(), "principal": principal, "request": body}, exclusive=True)
    result = api("POST", p + "/sessions", body)
    private_json(directory / "created.json", result)
    return summarize(result)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    create = sub.add_parser("start")
    create.add_argument("role", choices=["frontend", "backend", "integration"])
    create.add_argument("--run", required=True)
    create.add_argument("--cap", type=int, default=10)
    create.add_argument("--context-file")
    status = sub.add_parser("status")
    status.add_argument("session")
    status.add_argument("--out", type=Path, default=ROOT / "artifacts" / "observations")
    messages = sub.add_parser("messages")
    messages.add_argument("session")
    messages.add_argument("--out", type=Path, default=ROOT / "artifacts" / "messages")
    send = sub.add_parser("send")
    send.add_argument("session")
    send.add_argument("--file", type=Path, required=True)
    args = parser.parse_args()
    if args.command == "start":
        result = start(args.role, args.run, args.cap, args.context_file)
    elif args.command == "status":
        result = collect(args.session, args.out)
    elif args.command == "send":
        result = summarize(api("POST", org_path() + "/sessions/" + session_id(args.session) + "/messages",
                               {"message": args.file.read_text()}))
    else:
        sid = session_id(args.session)
        result = api("GET", org_path() + "/sessions/" + sid + "/messages")
        private_json(args.out / (sid + ".json"), result)
        result = {"saved": str(args.out / (sid + ".json")), "pagination": "First page; inspect has_next_page before treating as complete."}
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
