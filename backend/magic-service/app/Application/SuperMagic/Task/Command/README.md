# 沙箱镜像发布：全量重启沙箱

> 目标：发布一个"必须更新"的沙箱版本时，把仍在跑老镜像的沙箱**无感知**地换掉。
> 不给沙箱发"继续"之类的聊天消息，也不判断沙箱忙不忙。

## 1. 为什么不能"发条消息让 Agent 自己重启"

脚本拿不到"沙箱里到底有没有任务"这个事实。即使拿到了，发一条 `继续` 也不安全：

- Agent 可能正停在"可以这样操作吗？"的提问上，收到 `继续` 会把它当成用户同意并真的执行；
- Agent 可能正在长任务中间，一条新消息会改变它的推理上下文；
- 空闲的沙箱收到 `继续` 会凭空产生一轮对话，用户会看到一条莫名其妙的回复。

所以本方案只做**进程级**动作：删掉旧 pod、按正常初始化流程重建新 pod。
初始化过程（`createSandbox → initAgent → 等 workspace ready`）不会发送任何聊天消息，
用户下次进来时看到的是一个已经跑在新镜像上的沙箱。

## 2. 谁负责什么

| 仓库 | 角色 | 本次改动 |
|---|---|---|
| `sandbox-components`（Go） | 沙箱网关：真正操作 K8s pod、持有当前发布镜像 | `GET /api/v1/sandboxes` 每条记录新增 `agent_image` / `agfs_image` |
| `magic-service`（PHP） | 业务侧：知道话题归属、owner 身份、任务状态 | 新增 `sandbox:restart-all` 命令与编排服务 |
| `super-magic`（Python） | 沙箱内 Agent 运行时 | 无改动：重建走既有初始化路径，仍会恢复历史与启动任务 |

网关的镜像字段是"只重启落后的沙箱"的前提：没有它，脚本只能每次都全量重建。

## 3. 怎么用

只有一个入口，就是 magic-service 的命令；没有额外的包装脚本，
参数、帮助和退出码都以命令自身为准。

```bash
php bin/hyperf.php sandbox:restart-all [选项]
```

```bash
# 1. 先看计划，不动任何东西（永远从这一步开始）
php bin/hyperf.php sandbox:restart-all --dry-run

# 2. 灰度：只重启最老的 20 个话题，4 并发
php bin/hyperf.php sandbox:restart-all --limit=20 --concurrency=4

# 3. 全量
php bin/hyperf.php sandbox:restart-all --concurrency=8

# 4. 只处理 Magic Claw
php bin/hyperf.php sandbox:restart-all --scope=magic-claw

# 查看全部用法与退出码
php bin/hyperf.php sandbox:restart-all --help
```

| 选项 | 说明 |
|---|---|
| `--dry-run` | 只打印计划，不删除、不重建 |
| `--force` | 目标镜像已经是当前状态也强制重建（例如配置漂移） |
| `--scope=all\|magic-claw` | 处理范围，默认 `all` |
| `--code=<claw-code>` | 只处理某只 Magic Claw（隐含 `--scope=magic-claw`） |
| `--status=<a,b>` | 只看这些状态的 pod，默认不过滤 |
| `--limit=<n>` | 最多重启 n 个话题，按"跑得最久优先" |
| `--concurrency=<n>` | 同时处理多少个话题 |
| `--sandbox-id=<a,b>` | 只重启这些沙箱**所属的话题**；不点名时按范围全量 |
| `--agent-image=<ref>` | 指定这次重建要启动的 agent 镜像，未指定的另一侧仍跟随发布 |
| `--agfs-image=<ref>` | 指定这次重建要启动的 agfs（magicfs）镜像 |

`--agent-image` / `--agfs-image` 里的 ref 必须是完整引用并带 tag 或 digest
（例如 `repo/magic/super-magic:5.0.92` 或 `repo/magic/super-magic@sha256:...`）：
裸名字或漏掉 tag 会在动手前直接报错，避免隐式 `:latest` 把演练目标变成"当前最新"。

### 3.1.1 回滚演练：验证重启命令真的换了镜像

需要确认"这个命令确实生效"时，先用 `--agent-image` 指定一版旧镜像重建，再用默认参数反证：

```bash
# ① 把一批沙箱重启到旧版本（先 dry-run 确认范围与目标镜像）
php bin/hyperf.php sandbox:restart-all --agent-image=<旧版本完整引用> --limit=1 --dry-run
php bin/hyperf.php sandbox:restart-all --agent-image=<旧版本完整引用> --limit=1

# ② 不带任何镜像参数再跑一次 dry-run
php bin/hyperf.php sandbox:restart-all --dry-run
```

第二步应当把这批沙箱报成需要重启（`agent image outdated`），原因就是它们此刻跑在
第一步指定的旧版本上。这一步反过来也证明了两件事：第一步真的改了镜像；默认参数
仍然以网关发布版本为准。

演练结束后，再执行一次不带镜像参数的重启即可把它们带回发布版本。

请求里只会在**指定了镜像**时带上 `agent_image` / `agfs_image`；不指定时这两个字段
根本不会出现在创建请求里，网关继续读自己的 ConfigMap，因此常规发布完全不受影响。
反过来，一旦指定了镜像就会同时下发判定时那一对完整引用，保证重建出来的 pod 与
刚刚判定过的目标严格一致（不然发布恰好在这期间滚了一版，pod 就会跟判定对不上）。

指定镜像时还有一条额外保护：重建完成后会回读话题落库的镜像，若与指定值不一致
（例如网关版本过旧、没有采纳请求里的镜像），该话题直接记 FAIL 并以非零退出码收尾，
不会出现"命令说成功、镜像其实没换"的假象。

旧命令名 `magic-claw:restart-sandbox-all` 保留为兼容入口，等价于
`--scope=magic-claw`（并保留历史上的 `--status=Running` 默认值）。

### 3.1.2 只重启指定的沙箱

演练时通常只想动一只沙箱。用 `--sandbox-id` 点名，可与 `--agent-image` 组合：

```bash
# 先看计划：只有这一只（及其所属话题）会出现在 Targets 里
php bin/hyperf.php sandbox:restart-all --sandbox-id=971048413989916673 --dry-run

# 把它重启到一版旧镜像
php bin/hyperf.php sandbox:restart-all \
  --sandbox-id=971048413989916673 \
  --agent-image=<旧版本完整引用>
```

语义有两点必须知道：

- **单位是话题，不是单个 pod**。一个话题如果漂移出多个 pod，点名其中一个会把该话题名下
  **全部** pod 一起换掉——只删点名的那个，另一个旧 pod 会立刻变成新的漂移，正好是这条
  命令要消除的问题。计划输出里 `[DUPLICATE]` 会明确列出这种话题。
- **点名模式下不做任何"顺手清理"**。别的话题、共享温池、孤儿 pod 全部原样保留，
  只会出现在 `Skipped` 统计里。日常发布才会按第 4 节的规则清理池子。

沙箱 id 打错、或点到的是未绑定温池/孤儿 pod（没有 owner，无法重建）时，
命令在删除任何东西**之前**就失败并列出这些 id，不会静默返回空计划。

### 3.2 在哪执行

命令就是镜像里已经带上的 `bin/hyperf.php`，因此不需要额外脚本或跳板机，
直接在任意一个 magic-service Pod 里执行即可（该 Pod 已有配置、数据库与网关连通性）：

```bash
kubectl -n <namespace> exec -it deploy/magic-service -- \
  php bin/hyperf.php sandbox:restart-all --dry-run
```

多副本部署时只需在一个 Pod 里跑一次：目标集合来自网关的 pod 清单，
重复执行是幂等的（第二轮所有沙箱都已等于目标镜像，计划为空）。

## 4. 判定规则

判定基准是"目标镜像"：默认取网关当前发布版本，指定了 `--agent-image` /
`--agfs-image` 时取指定值（未指定的一侧仍取发布版本）。

| 情况 | 结论 | 是否重启 |
|---|---|---|
| 该话题任一 pod 的镜像缺失/不完整 | `ImagesUnknown` | 是（无法证明已到位） |
| agent 镜像与目标不一致 | `AgentImageOutdated` | 是 |
| agfs 镜像与目标不一致 | `AgfsImageOutdated` | 是 |
| 该话题所有 pod 都等于目标镜像 | `UpToDate` | 否 |
| `--force` | `Forced` | 是 |
| 话题缺 owner（user/org 为空） | `TopicOwnerMissing` | 否，记入跳过统计 |

比较按完整引用（含 digest）进行，因此"同 tag 重新构建过"也算不一致；
反向也一样：pod 比目标"更新"（例如目标是旧版本）同样判为需要重启。

补充规则：

- **同一话题多个 pod**（话题表 `sandbox_id` 与实际 pod 漂移过）→ 全部删除，只重建一个；
- **未绑定温池 pod** → 只在镜像落后于发布版本时删除（删掉后由补货流程用发布版本补齐），
  已经是最新镜像的池 pod 保留——删它不会让本批任何沙箱变快，只会让补货把同样的 pod
  再造一遍；`--scope=magic-claw` 时不动它们（属于共享资源）；指定镜像时也不动——
  温池只服务于当前发布，与本次目标无关；`--force` 时仍强删（用于处理镜像引用没变但
  配置漂移的情况）；
- **找不到话题的孤儿 pod** → 只删除，不重建（它本就不该存在，和镜像是否最新无关）；
- **读不到目标镜像**（既没指定、网关发布版本也读不到）→ 直接失败并提示用
  `--agent-image` / `--agfs-image` 指定，或加 `--force` 显式承担，不做盲目全量重启。

## 5. 执行顺序（每个话题）

1. 把该话题 `waiting` / `running` / `waiting_for_user` 的任务与话题状态置为 `suspended`；
2. 删除网关清单里属于该话题的**全部** pod（删不掉的记录失败但继续）；
3. 以话题 owner 身份重建沙箱，**优先复用温池**：旧 pod 删掉后探测返回 NOT_FOUND，
   「调用方指定了 sandbox_id」的守卫随之放行，直接领一个现成 pod 挂载，不必从零冷启动。
   领取条件就是镜像对，因此只可能领到与目标镜像一致的那一代池 pod；池里没有就冷启动，
   仍按目标镜像构建；
4. 回写话题与任务的 `sandbox_id`。

第 1 步刻意放在删除之前：现有 `CheckTaskStatusTask` 会周期性检查"任务在跑但沙箱不存在"并把任务标成
`ERROR`，先挂起可以把这类误报压到最低。

第 3 步走温池是重启速度的关键：冷启动要等 pod 调度、镜像拉取与 AGFS sidecar 就绪，
而温池挂载只做 metadata 写入 + mount。**前提是温池由补货流程维持在最新镜像**——
如果刚更新了 ConfigMap 但温池里还是旧 pod，重启会把旧镜像换个话题继续用。
发布窗口内无法保证这一点时，应先等温池补货完成再重启。

注意这里和"池 pod 要不要删"是两件事：计划阶段只删**镜像落后**的池 pod，并把已最新的
留在池里；领用时按镜像对匹配，所以哪怕池里混着旧 pod 也不会被领走。

## 6. 失败处理

- 单个话题失败不影响其余话题；退出码为 `1`，失败明细逐条打印；
- 指定镜像后重建结果与指定值不一致，同样算该话题失败（避免"成功但没换镜像"）；
- 清理温池/孤儿 pod 前会重新拉一次清单确认归属：已被话题领走的池 pod 不再删除，
  无法确认时宁可跳过清理并记为删除失败，也不误删仍在服役的沙箱；
- 删除失败仍会继续重建（否则该话题永远卡在旧镜像），但会计入 `delete_failures`；
- 重建失败的那一条最危险：旧 pod 已删、新 pod 未起，需要按 `topic_id` 人工重跑
  `php bin/hyperf.php sandbox:restart-all --force --limit=...`，或让用户下次进入时自然重建；
- 任何情况下都不会向沙箱发送聊天消息，因此不存在"AI 误解指令"的风险。

## 7. 测试

```bash
# Go：网关字段与清单契约
cd sandbox-components && go test ./pkg/... ./test/...

# PHP：计划生成、编排、CLI 契约（纯单测，无需 DB/网关/协程扩展）
cd magic-service
php vendor/bin/phpunit -c phpunit.unit.xml --testsuite 沙箱重启
```

覆盖点：镜像比较（含同 tag 不同 digest）、缺字段按未知、重复 pod、温池/孤儿、缺少 owner、
Magic Claw 范围过滤、先挂起后删除的顺序、删除失败不阻断重建、进度回调、退出码与 dry-run。

## 8. 运行期观察

执行过程中每完成一个话题就打印一行 `[i/n] [OK|FAIL]`，并每 10 个目标或 30 秒补一行
`progress: ... elapsed ... eta ...`，所以几十分钟的批量能看出是在推进还是卡住。
结束时打印汇总：`restarted / failed / deleted_only / delete_failures / suspended_tasks / elapsed`。

日志沿用 magic-service 的 `sandbox` channel（`[Sandbox][RestartAll]` 前缀），
每一条删除、重建、挂起都带 `topic_id` / `sandbox_id`，可直接用于事后核对。
