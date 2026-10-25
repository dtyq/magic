<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Task\Entity\ValueObject;

use App\Domain\SuperMagic\Task\Service\SandboxRestartPlanner;

/**
 * 一次操作里"沙箱应该跑哪一版镜像"的统一目标.
 *
 * 为什么需要一个独立概念：镜像来源有两个，但对下游只有一种语义——
 * 「这次重建出来的沙箱必须跑这一版」。
 *
 * | 来源 | agent / agfs 取值 | 典型用途 |
 * |---|---|---|
 * | 网关当前发布（release） | 网关 ConfigMap 里的 AGENT_IMAGE / AGFS_IMAGE | 常规发布滚动 |
 * | 运维指定（specified） | 命令行显式给出的镜像引用，未指定的一侧继续跟随发布 | 回滚演练、验证重启命令是否真的生效 |
 *
 * 三个消费者必须看到同一份目标，否则命令会"说一套做一套"：
 *   - 判定（Planner）：pod 当前镜像与本目标不一致才算需要重启；
 *   - 重建（SandboxRebuildPort）：新 pod 必须按本目标构建；
 *   - 执行后校验（AgentSandboxRebuildAdapter）：重建结果与目标不符就报错，
 *     避免"网关没有采纳请求里的镜像"时命令静默成功。
 *
 * 比较的是完整"引用"而不是"标签"：同一个 tag 重新构建过（digest 变了）也算不同，
 * 这与 {@see SandboxImageVersion} 的口径一致。
 */
final readonly class SandboxImageTarget
{
    /**
     * @param string $agentImage 已解析的 agent 镜像引用（空串=未知）
     * @param string $agfsImage 已解析的 agfs 镜像引用（空串=未知）
     * @param null|string $specifiedAgentImage 命令行指定的 agent 镜像；null 表示跟随发布
     * @param null|string $specifiedAgfsImage 命令行指定的 agfs 镜像；null 表示跟随发布
     */
    private function __construct(
        private string $agentImage,
        private string $agfsImage,
        private ?string $specifiedAgentImage,
        private ?string $specifiedAgfsImage,
    ) {
    }

    /**
     * 目标 = 网关当前发布的镜像（默认行为，与历史语义一致）.
     *
     * @param null|array<string, mixed> $release 网关 GET /api/v1/sandboxes/images 的响应
     */
    public static function release(?array $release): self
    {
        return new self(
            agentImage: SandboxImageVersion::agentImage($release),
            agfsImage: SandboxImageVersion::agfsImage($release),
            specifiedAgentImage: null,
            specifiedAgfsImage: null,
        );
    }

    /**
     * 目标 = 发布镜像 + 命令行指定的镜像：指定了哪一侧就用哪一侧，另一侧继续跟随发布.
     *
     * 例：发布为 agent=5.0.92、agfs=1.0.14，命令只给了 --agent-image=5.0.77，
     * 得到的目标是 agent=5.0.77(specified)、agfs=1.0.14(release)。
     * 这样"只回滚 agent"是可表达且可预测的，而不是被静默替换成别的组合。
     *
     * @param null|array<string, mixed> $release
     */
    public static function withSpecifiedImages(?array $release, ?string $agentImage, ?string $agfsImage): self
    {
        $specifiedAgent = SandboxImageVersion::nonEmpty($agentImage);
        $specifiedAgfs = SandboxImageVersion::nonEmpty($agfsImage);
        if ($specifiedAgent === null && $specifiedAgfs === null) {
            return self::release($release);
        }

        return new self(
            agentImage: $specifiedAgent ?? SandboxImageVersion::agentImage($release),
            agfsImage: $specifiedAgfs ?? SandboxImageVersion::agfsImage($release),
            specifiedAgentImage: $specifiedAgent,
            specifiedAgfsImage: $specifiedAgfs,
        );
    }

    /**
     * 已解析的 agent 镜像；空串表示既没指定、也读不到发布版本.
     */
    public function getAgentImage(): string
    {
        return $this->agentImage;
    }

    /**
     * 已解析的 agfs 镜像；空串含义同上.
     */
    public function getAgfsImage(): string
    {
        return $this->agfsImage;
    }

    /**
     * 命令行指定的 agent 镜像；null 表示跟随发布.
     */
    public function getSpecifiedAgentImage(): ?string
    {
        return $this->specifiedAgentImage;
    }

    /**
     * 命令行指定的 agfs 镜像；null 表示跟随发布.
     */
    public function getSpecifiedAgfsImage(): ?string
    {
        return $this->specifiedAgfsImage;
    }

    /**
     * 这次是否指定了镜像：决定本次操作是"发布滚动"还是"定向演练"。
     *
     * 共享温池只服务于"当前发布"，因此指定镜像时不能把池子当过期资源删掉
     * （见 {@see SandboxRestartPlanner}）。
     */
    public function hasSpecifiedImages(): bool
    {
        return $this->specifiedAgentImage !== null || $this->specifiedAgfsImage !== null;
    }

    /**
     * agent 与 agfs 两侧都已确定，可以据此做"是否一致"的判断.
     */
    public function isComplete(): bool
    {
        return $this->agentImage !== '' && $this->agfsImage !== '';
    }

    /**
     * 创建沙箱时要随请求一起下发的镜像（未指定时为空数组）.
     *
     * 只有指定了镜像的运行才把它写进创建请求：未指定时让网关继续读自己的 ConfigMap，
     * 避免把"计划时看到的发布版本"固化成一次快照。
     *
     * @return array{agent_image?: string, agfs_image?: string}
     */
    public function launchImages(): array
    {
        if (! $this->hasSpecifiedImages()) {
            return [];
        }

        $images = [];
        if ($this->agentImage !== '') {
            $images[SandboxImageVersion::AGENT_IMAGE_KEY] = $this->agentImage;
        }
        if ($this->agfsImage !== '') {
            $images[SandboxImageVersion::AGFS_IMAGE_KEY] = $this->agfsImage;
        }
        return $images;
    }

    /**
     * 一组镜像（pod 实际镜像、话题记录里的 sandbox_images）是否已经是本次目标.
     *
     * 目标不完整时返回 false：没有目标就无法证明"已经到位"，
     * 调用方应据此走 ImagesUnknown 分支而不是当成已最新。
     *
     * @param null|array<string, mixed> $images
     */
    public function matches(?array $images): bool
    {
        if (! $this->isComplete() || ! SandboxImageVersion::isComplete($images)) {
            return false;
        }

        return SandboxImageVersion::agentImage($images) === $this->agentImage
            && SandboxImageVersion::agfsImage($images) === $this->agfsImage;
    }

    /**
     * 日志/计划里的一行说明，例如：
     * `agent=registry/agent:5.0.77 (specified), agfs=registry/agfs:1.0.14 (release)`.
     *
     * 未解析出的镜像显示为 unknown，让"读不到发布版本"这件事在输出里可见，
     * 而不是留下一个空字段让人误以为"没有镜像概念"。
     */
    public function describe(): string
    {
        return sprintf(
            'agent=%s (%s), agfs=%s (%s)',
            $this->agentImage === '' ? 'unknown' : $this->agentImage,
            $this->specifiedAgentImage === null ? 'release' : 'specified',
            $this->agfsImage === '' ? 'unknown' : $this->agfsImage,
            $this->specifiedAgfsImage === null ? 'release' : 'specified',
        );
    }
}
