<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Task\Entity\ValueObject;

/**
 * 只删除、不重建的 pod.
 *
 * 两类 pod 落在这里：
 * - 未绑定的温池 pod：没有 owner，无法"重建"，删掉后由温池补货流程用新镜像补齐；
 * - 找不到话题的孤儿 pod：业务上已无人认领，只做清理。
 */
readonly class SandboxPodDeletion
{
    public function __construct(
        private SandboxPodSnapshot $pod,
        private string $reason,
    ) {
    }

    public function getPod(): SandboxPodSnapshot
    {
        return $this->pod;
    }

    public function getReason(): string
    {
        return $this->reason;
    }
}
