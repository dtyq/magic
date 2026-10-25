<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Agent\Command;

use App\Application\SuperMagic\Task\Command\RestartAllSandboxCommand;
use App\Application\SuperMagic\Task\DTO\SandboxRestartOptions;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxRestartScope;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Constant\SandboxStatus;
use Hyperf\Command\Annotation\Command;
use Psr\Container\ContainerInterface;

/**
 * 旧命令名兼容入口：等价于 `sandbox:restart-all --scope=magic-claw`.
 *
 * 保留它的原因：发布流水线里可能已经写死了这个名字，改名会让流水线静默失效。
 * 实现上不再有第二套逻辑——目标解析、同话题去重、并发、挂起任务等规则全部来自
 * {@see RestartAllSandboxCommand}，这里只把范围钉在 Magic Claw。
 *
 * 与旧实现的差异（有意为之）：
 * - 目标集合仍是网关 pod 清单，但会跳过已是最新镜像的沙箱（旧实现每次都重建）；
 * - 同一话题的多个漂移 pod 会全删再重建一个（与旧实现一致）；
 * - 删除前会把运行中/等用户回答的任务挂起，避免被误判为失败；
 * - 不碰共享的温池与孤儿 pod（它们不属于某只 Claw）。
 *
 * @deprecated 用 `sandbox:restart-all --scope=magic-claw` 代替
 */
#[Command]
class RestartAllMagicClawSandboxCommand extends RestartAllSandboxCommand
{
    protected ?string $name = 'magic-claw:restart-sandbox-all';

    public function __construct(ContainerInterface $container)
    {
        parent::__construct($container);
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('[deprecated] Restart Magic Claw sandboxes; use sandbox:restart-all --scope=magic-claw');
    }

    /**
     * 保留旧命令"默认只处理 Running"的行为，避免流水线升级后突然去碰 Pending/Exited 的 pod。
     */
    protected function defaultStatusOption(): string
    {
        return SandboxStatus::RUNNING;
    }

    /**
     * 旧命令名永远是 Magic Claw 范围，不接受 --scope 覆盖；
     * 其余参数（含 --agent-image / --agfs-image）原样透传。
     */
    protected function buildOptions(): SandboxRestartOptions
    {
        $options = parent::buildOptions();

        return new SandboxRestartOptions(
            force: $options->isForce(),
            scope: SandboxRestartScope::MagicClaw,
            clawCode: $options->getClawCode(),
            limit: $options->getLimit(),
            statuses: $options->getStatuses(),
            dryRun: $options->isDryRun(),
            concurrency: $options->getConcurrency(),
            // 指定镜像同样可以被旧命令名使用，不能因为重建 options 就丢掉。
            requestedAgentImage: (string) $options->getRequestedAgentImage(),
            requestedAgfsImage: (string) $options->getRequestedAgfsImage(),
            // 点名的沙箱同样透传，否则旧命令名会静默扩成"整只 Claw 全量重启"。
            sandboxIds: $options->getSandboxIds(),
        );
    }
}
