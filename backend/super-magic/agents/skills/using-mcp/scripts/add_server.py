#!/usr/bin/env python3
"""
动态添加 MCP 服务器

参数：
    --name:    必填，服务器名称
    --type:    必填，连接类型：stdio 或 http
    --command: stdio 类型必填，启动命令（如 npx）
    --args:    可选，命令参数，必须用 JSON 数组字符串传入，例如 '["-y","@pkg"]'
    --url:     http 类型必填，服务器 URL
    --env:     可选，环境变量，格式为 KEY=VALUE，支持多个
    --label:   可选，服务器显示名称

注意：添加的服务器仅在当前运行期间有效，重启后失效。

输出格式：JSON
成功字段：ok, name, tool_count, tools
失败字段：ok, error
"""
import json
import argparse
import sys

from sdk.mcp import mcp

parser = argparse.ArgumentParser(description="动态添加 MCP 服务器")
parser.add_argument("--name", type=str, required=True, help="服务器名称")
parser.add_argument(
    "--type",
    type=str,
    required=True,
    choices=["stdio", "http"],
    help="连接类型：stdio 或 http",
)
parser.add_argument("--command", type=str, help="启动命令（stdio 类型必填，如 npx）")
parser.add_argument(
    "--args",
    type=str,
    default=None,
    help="命令参数，必须是 JSON 数组字符串，例如 '[\"−y\", \"@pkg\"]'",
)
parser.add_argument("--url", type=str, help="服务器 URL（http 类型必填）")
parser.add_argument(
    "--env",
    type=str,
    nargs="*",
    metavar="KEY=VALUE",
    help="环境变量，格式为 KEY=VALUE，支持多个",
)
parser.add_argument("--label", type=str, help="服务器显示名称")
args = parser.parse_args()

# 解析 --args JSON 数组
args_list: list = []
if args.args:
    raw = args.args.strip()
    try:
        parsed = json.loads(raw)
        if not isinstance(parsed, list):
            print(
                json.dumps(
                    {"ok": False, "error": f"--args 必须是 JSON 数组，实际收到: {raw}"},
                    ensure_ascii=False,
                )
            )
            sys.exit(1)
        args_list = [str(a) for a in parsed]
    except json.JSONDecodeError:
        print(
            json.dumps(
                {"ok": False, "error": f"--args JSON 解析失败，请确认格式正确，实际收到: {raw}"},
                ensure_ascii=False,
            )
        )
        sys.exit(1)

# 解析环境变量
env: dict = {}
if args.env:
    for item in args.env:
        if "=" not in item:
            print(
                json.dumps(
                    {"ok": False, "error": f"env 参数格式错误，应为 KEY=VALUE，实际收到: {item}"},
                    ensure_ascii=False,
                )
            )
            sys.exit(1)
        key, _, value = item.partition("=")
        env[key.strip()] = value

try:
    result = mcp.add_server(
        name=args.name,
        server_type=args.type,
        command=args.command,
        args=args_list if args_list else None,
        url=args.url,
        env=env if env else None,
        label_name=args.label,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))

except Exception as e:
    print(
        json.dumps(
            {"ok": False, "error": f"添加 MCP 服务器时发生异常: {str(e)}"},
            ensure_ascii=False,
        )
    )
    sys.exit(1)
