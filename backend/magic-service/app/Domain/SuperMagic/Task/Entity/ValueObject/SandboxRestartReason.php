<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Task\Entity\ValueObject;

/**
 * 一次沙箱重启判定的结论.
 *
 * 判定只看两件事实：话题名下所有 pod 的镜像，以及网关当前发布的最新镜像。
 * 优先级从高到低：
 *
 * | 条件 | 结论 | 是否需要重启 |
 * |---|---|---|
 * | 调用方 --force | Forced | 是 |
 * | 任一 pod 镜像缺失/不完整 | ImagesUnknown | 是（无法证明已最新） |
 * | agent 镜像不是最新 | AgentImageOutdated | 是 |
 * | agfs 镜像不是最新 | AgfsImageOutdated | 是 |
 * | 全部 pod 都等于最新镜像 | UpToDate | 否 |
 * | 话题缺少归属用户信息 | TopicOwnerMissing | 否（重建需要 owner 身份） |
 *
 * 注意 Unknown 与 UpToDate 的区别：前者是"没证据"，后者是"有证据证明已最新"。
 * 发布场景必须把前者当成需要重启，否则老镜像会一直留在集群里。
 */
enum SandboxRestartReason: string
{
    case Forced = 'forced';
    case ImagesUnknown = 'images_unknown';
    case AgentImageOutdated = 'agent_image_outdated';
    case AgfsImageOutdated = 'agfs_image_outdated';
    case UpToDate = 'up_to_date';
    case TopicOwnerMissing = 'topic_owner_missing';

    public function needsRestart(): bool
    {
        return match ($this) {
            self::Forced,
            self::ImagesUnknown,
            self::AgentImageOutdated,
            self::AgfsImageOutdated => true,
            self::UpToDate,
            self::TopicOwnerMissing => false,
        };
    }

    public function describe(): string
    {
        return match ($this) {
            self::Forced => 'forced restart',
            self::ImagesUnknown => 'sandbox images unknown',
            self::AgentImageOutdated => 'agent image outdated',
            self::AgfsImageOutdated => 'agfs image outdated',
            self::UpToDate => 'already on the latest images',
            self::TopicOwnerMissing => 'topic owner is incomplete',
        };
    }
}
