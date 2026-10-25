# -*- coding: utf-8 -*-
"""
变更账本基础设施层

读取本沙箱 agfs-server 的「已应用变更账本」，并把它换算成工作区路径变化：

- ChangeLedgerClient: HTTP 读取端（游标由调用方持有）
- map_ledger_changes_to_workspace_paths: 账本变更 → 工作区相对路径（纯函数）

账本的权威数据来自 magic-service 的 durable journal，由 agfs-server 用一条进程级订阅
拉进沙箱，因此这一层不产生任何 magic-service 请求。
"""
