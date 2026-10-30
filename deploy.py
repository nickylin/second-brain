#!/usr/bin/env python3
"""Deploy the second-brain Worker via the Cloudflare API.

- Cloudflare token comes from the vault surrogate (custom.cloudflare).
- The Nebius key is passed to Cloudflare as a Worker secret_text binding whose
  value is the vault surrogate for custom.nebius; the egress layer swaps it for
  the real key on this approved outbound request. The real key is never seen,
  printed, or stored by this script.
Usage: python3 deploy.py
Prints: kv namespace id, deploy success + etag, workers.dev URL.
"""
import json
import sys
import urllib.request
import urllib.error

sys.path.insert(0, "/opt/muse/skills/custom-connector-setup/bin")
from dynamic_credentials import (
    add_surrogate_to_request,
    dynamic_credential_entry,
    read_json_response,
)

API_BASE = "https://api.cloudflare.com/client/v4"
ACCOUNT_ID = "2e545132b910ae25963ce97b39dc8258"
SCRIPT = "second-brain"
KV_TITLE = "second-brain-memories"
WORKER_JS = "/home/hatch/workspace/nebius-secondbrain/worker.js"


def _api(method, path, data=None, ctype=None):
    url = f"{API_BASE}{path}"
    req = urllib.request.Request(url, data=data, method=method)
    if ctype:
        req.add_header("Content-Type", ctype)
    add_surrogate_to_request(req, "custom.cloudflare", allowed_hosts=["api.cloudflare.com"])
    try:
        return read_json_response(urllib.request.urlopen(req, timeout=120))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        try:
            return json.loads(body)
        except Exception:
            return {"success": False, "http": e.code, "raw": body[:500]}


def _multipart(fields):
    boundary = "----lumi-worker-deploy"
    body = b""
    for name, filename, ctype, data in fields:
        disp = f'form-data; name="{name}"'
        if filename:
            disp += f'; filename="{filename}"'
        body += f"--{boundary}\r\nContent-Disposition: {disp}\r\nContent-Type: {ctype}\r\n\r\n".encode()
        body += data + b"\r\n"
    body += f"--{boundary}--\r\n".encode()
    return body, f"multipart/form-data; boundary={boundary}"


def ensure_kv():
    res = _api("GET", f"/accounts/{ACCOUNT_ID}/storage/kv/namespaces?per_page=100")
    for ns in res.get("result") or []:
        if ns.get("title") == KV_TITLE:
            return ns["id"]
    res = _api("POST", f"/accounts/{ACCOUNT_ID}/storage/kv/namespaces",
               data=json.dumps({"title": KV_TITLE}).encode(), ctype="application/json")
    if not res.get("success"):
        print("KV create failed:", json.dumps(res, ensure_ascii=False)[:600])
        sys.exit(1)
    return res["result"]["id"]


def main():
    kv_id = ensure_kv()
    print("kv namespace:", kv_id)

    nebius_surrogate = dynamic_credential_entry("custom.nebius", "access_token")["surrogate"]

    worker_js = open(WORKER_JS, encoding="utf-8").read()
    metadata = {
        "main_module": "worker.js",
        "compatibility_date": "2025-09-01",
        "bindings": [
            {"type": "kv_namespace", "name": "MEMORIES", "namespace_id": kv_id},
            {"type": "secret_text", "name": "NEBIUS_API_KEY", "text": nebius_surrogate},
        ],
    }
    body, ctype = _multipart([
        ("metadata", None, "application/json", json.dumps(metadata).encode()),
        ("worker.js", "worker.js", "application/javascript+module", worker_js.encode()),
    ])
    res = _api("PUT", f"/accounts/{ACCOUNT_ID}/workers/scripts/{SCRIPT}", data=body, ctype=ctype)
    print("deploy success:", res.get("success"))
    if not res.get("success"):
        print(json.dumps(res, ensure_ascii=False)[:800])
        sys.exit(1)
    etag = (res.get("result") or {}).get("etag")
    print("etag:", etag)

    sub = _api("POST", f"/accounts/{ACCOUNT_ID}/workers/scripts/{SCRIPT}/subdomain",
               data=json.dumps({"enabled": True}).encode(), ctype="application/json")
    print("subdomain enable success:", sub.get("success"))

    info = _api("GET", f"/accounts/{ACCOUNT_ID}/workers/subdomain")
    account_sub = (info.get("result") or {}).get("subdomain")
    if account_sub:
        print("demo url: https://" + SCRIPT + "." + account_sub + ".workers.dev")
    else:
        print("could not read account subdomain:", json.dumps(info, ensure_ascii=False)[:300])


if __name__ == "__main__":
    main()
