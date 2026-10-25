<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Task\Contract;

use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxImageTarget;
use Throwable;

/**
 * "重建一个话题的沙箱"能力端口.
 *
 * 重启编排只关心两件事：删掉旧 pod、按目标镜像重新初始化一个。
 * 具体初始化流程（create → initAgent → waitForWorkspaceReady → 回写绑定）
 * 属于 AgentAppService 的既有职责，这里用端口隔开，避免编排层直接依赖
 * 那个近千行的应用服务，也让单测可以用极小的假实现替身。
 */
interface SandboxRebuildPortInterface
{
    /**
     * 删除一个沙箱 pod.
     *
     * 实现必须把"pod 本来就不存在"视为成功（幂等），其余失败抛异常，
     * 由编排层聚合成该话题的失败结果。
     *
     * @throws Throwable 删除失败
     */
    public function deleteSandbox(string $sandboxId): void;

    /**
     * 以话题 owner 身份重建沙箱，并返回新沙箱 id.
     *
     * 实现必须保证新沙箱运行的是 $images 指定的镜像：
     *   - 没有指定镜像（$images 为 null，或对象里没有指定值）时按网关当前发布版本构建；
     *   - 指定了镜像时按指定引用构建，并在结果与指定值不一致时抛错，而不是静默成功。
     * 温池只作为加速手段：领到的 pod 必须与目标镜像完全一致，否则退回冷启动。
     *
     * @throws Throwable 重建失败（包括"重建结果不符合指定镜像"）
     */
    public function rebuild(int $topicId, string $userId, string $organizationCode, ?SandboxImageTarget $images = null): string;
}
