<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Task\DTO;

use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxImageTarget;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxRestartScope;

/**
 * 沙箱重启命令的输入参数.
 *
 * 集中一处默认值，命令层只负责解析 CLI、应用层只负责执行，避免默认值散落在
 * 两边、单测和线上行为不一致。
 *
 * 指定的镜像（requestedAgentImage / requestedAgfsImage）只描述"运维要求的目标"，
 * 不参与解析。解析结果见 {@see SandboxImageTarget}：
 * 未指定的一侧继续跟随网关发布版本。
 */
readonly class SandboxRestartOptions
{
    /**
     * 释放前先挂起这些状态的任务/话题，避免"沙箱被重启"被下游误判成任务失败。
     *
     * waiting_for_user 必须包含：它代表 Agent 停下来等用户回答，
     * 此时 pod 仍被占用，重启后这条等待也不能被留成"沙箱不存在"的错误。
     *
     * @param string[] $statuses 传给网关的状态过滤（空数组=不过滤）
     * @param string[] $sandboxIds 点名的沙箱 id（空数组=不限定）。注意选中的是
     *                             "该沙箱所属的话题"，见 SandboxRestartPlanner
     * @param string $requestedAgentImage 命令行指定的 agent 镜像；空串=跟随网关发布版本
     * @param string $requestedAgfsImage 命令行指定的 agfs 镜像；空串=跟随网关发布版本
     */
    public function __construct(
        private bool $force = false,
        private SandboxRestartScope $scope = SandboxRestartScope::All,
        private string $clawCode = '',
        private int $limit = 0,
        private array $statuses = [],
        private bool $dryRun = false,
        private int $concurrency = 1,
        private string $requestedAgentImage = '',
        private string $requestedAgfsImage = '',
        private array $sandboxIds = [],
    ) {
    }

    public function isForce(): bool
    {
        return $this->force;
    }

    public function getScope(): SandboxRestartScope
    {
        return $this->scope;
    }

    /**
     * 仅 Magic Claw 范围使用：只处理这只 Claw 的沙箱.
     */
    public function getClawCode(): string
    {
        return $this->clawCode;
    }

    /**
     * 最多重启多少个话题，0 表示不限.
     */
    public function getLimit(): int
    {
        return max(0, $this->limit);
    }

    /**
     * @return string[]
     */
    public function getStatuses(): array
    {
        return $this->statuses;
    }

    public function isDryRun(): bool
    {
        return $this->dryRun;
    }

    public function getConcurrency(): int
    {
        return max(1, $this->concurrency);
    }

    /**
     * 点名的沙箱 id；空数组表示不限定范围.
     *
     * 去重并丢弃空串，保证重复写同一个 id 不会让它被处理两次。
     *
     * @return string[]
     */
    public function getSandboxIds(): array
    {
        $ids = [];
        foreach ($this->sandboxIds as $sandboxId) {
            $sandboxId = trim((string) $sandboxId);
            if ($sandboxId === '') {
                continue;
            }
            $ids[$sandboxId] = $sandboxId;
        }
        return array_values($ids);
    }

    /**
     * 命令行指定的 agent 镜像；null 表示跟随网关发布版本.
     */
    public function getRequestedAgentImage(): ?string
    {
        $value = trim($this->requestedAgentImage);
        return $value === '' ? null : $value;
    }

    /**
     * 命令行指定的 agfs 镜像；null 表示跟随网关发布版本.
     */
    public function getRequestedAgfsImage(): ?string
    {
        $value = trim($this->requestedAgfsImage);
        return $value === '' ? null : $value;
    }
}
