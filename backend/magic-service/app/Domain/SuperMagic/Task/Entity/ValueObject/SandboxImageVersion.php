<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Task\Entity\ValueObject;

/**
 * 镜像引用比较规则（纯函数，无 IO）.
 *
 * 沙箱由 agent 与 agfs 两个镜像共同组成，一次发布通常会同时更新二者。
 * 版本判断只认完整引用（含 registry/path/tag，最好含 digest）：
 *
 * | 当前镜像 | 最新镜像 | 结论 | 说明 |
 * |---|---|---|---|
 * | 完整 | 完整 | true / false | 任一引用不同即需要更新 |
 * | 缺失或空串 | 完整 | null | 无法证明已是最新，调用方自行决定 |
 * | 任意 | 缺失或空串 | null | 上游没有版本标准，不能据此判断 |
 *
 * 例：当前 agent 为 `registry/agent:5.0.92@sha256:old`、最新为
 * `registry/agent:5.0.92@sha256:new`，tag 相同但 digest 不同，结论是 true
 * （同 tag 重新构建过镜像也要升级）。
 */
final class SandboxImageVersion
{
    public const AGENT_IMAGE_KEY = 'agent_image';

    public const AGFS_IMAGE_KEY = 'agfs_image';

    /**
     * 一组镜像引用是否完整（两个 key 都是非空字符串）.
     *
     * @param null|array<string, mixed> $images
     */
    public static function isComplete(?array $images): bool
    {
        return self::nonEmpty($images[self::AGENT_IMAGE_KEY] ?? null) !== null
            && self::nonEmpty($images[self::AGFS_IMAGE_KEY] ?? null) !== null;
    }

    /**
     * 比较两组镜像引用.
     *
     * @param null|array<string, mixed> $currentImages
     * @param array<string, mixed> $latestImages
     * @return null|bool true=需要更新，false=已是最新，null=无法判断
     */
    public static function compare(?array $currentImages, array $latestImages): ?bool
    {
        if (! self::isComplete($latestImages) || ! self::isComplete($currentImages)) {
            return null;
        }

        return $currentImages[self::AGENT_IMAGE_KEY] !== $latestImages[self::AGENT_IMAGE_KEY]
            || $currentImages[self::AGFS_IMAGE_KEY] !== $latestImages[self::AGFS_IMAGE_KEY];
    }

    /**
     * 取出 agent 镜像引用，缺失时返回空串.
     *
     * @param null|array<string, mixed> $images
     */
    public static function agentImage(?array $images): string
    {
        return self::nonEmpty($images[self::AGENT_IMAGE_KEY] ?? null) ?? '';
    }

    /**
     * 取出 agfs 镜像引用，缺失时返回空串.
     *
     * @param null|array<string, mixed> $images
     */
    public static function agfsImage(?array $images): string
    {
        return self::nonEmpty($images[self::AGFS_IMAGE_KEY] ?? null) ?? '';
    }

    /**
     * 仅用于展示的 tag 提取，比较一律使用完整引用.
     *
     * 例：`registry.example.com/agent:5.0.92@sha256:abc` → `5.0.92`；
     * 没有 tag 时返回空串。
     */
    public static function extractTag(mixed $image): string
    {
        if (! is_string($image) || $image === '') {
            return '';
        }

        $imageWithoutDigest = explode('@', $image, 2)[0];
        $lastSlashPos = strrpos($imageWithoutDigest, '/');
        $tagPos = strrpos($imageWithoutDigest, ':');
        if ($tagPos === false || ($lastSlashPos !== false && $tagPos < $lastSlashPos)) {
            return '';
        }

        return substr($imageWithoutDigest, $tagPos + 1);
    }

    /**
     * 把任意来源的值规范成“非空字符串或 null”.
     */
    public static function nonEmpty(mixed $image): ?string
    {
        return is_string($image) && trim($image) !== '' ? $image : null;
    }
}
