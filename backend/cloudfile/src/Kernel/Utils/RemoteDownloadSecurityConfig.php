<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Utils;

/**
 * 远程文件下载安全配置，负责把防护等级转换成下载边界策略。
 */
class RemoteDownloadSecurityConfig
{
    public const LEVEL_STRICT = 'strict';

    public const LEVEL_STANDARD = 'standard';

    public const LEVEL_COMPATIBLE = 'compatible';

    private const DEFAULT_MAX_DOWNLOAD_SIZE = 100 * 1024 * 1024;

    private const DEFAULT_MAX_REDIRECTS = 3;

    private const DEFAULT_IP_PROTECTION = [
        'block_private_ip' => true,
        'block_loopback_ip' => true,
        'block_link_local_ip' => true,
        'block_reserved_ip' => true,
        'block_cloud_metadata_ip' => true,
        'extra_blocked_ips' => [],
        'extra_blocked_cidrs' => [],
    ];

    private static ?self $current = null;

    public function __construct(
        private readonly bool $enabled = false,
        private readonly string $level = self::LEVEL_STRICT,
        private readonly int $maxDownloadSize = self::DEFAULT_MAX_DOWNLOAD_SIZE,
        private readonly int $maxRedirects = self::DEFAULT_MAX_REDIRECTS,
        private readonly bool $blockPrivateIp = true,
        private readonly bool $blockLoopbackIp = true,
        private readonly bool $blockLinkLocalIp = true,
        private readonly bool $blockReservedIp = true,
        private readonly bool $blockCloudMetadataIp = true,
        private readonly array $extraBlockedIps = [],
        private readonly array $extraBlockedCidrs = [],
    ) {
    }

    /**
     * 从 cloudfile 配置数组更新全局远程下载安全配置。
     *
     * @param array<string, mixed> $config
     */
    public static function configure(array $config): void
    {
        self::$current = self::fromArray($config);
    }

    /**
     * 获取当前远程下载安全配置，未初始化时使用严格默认值。
     */
    public static function current(): self
    {
        if (! self::$current instanceof self) {
            self::$current = self::fromArray([]);
        }

        return self::$current;
    }

    /**
     * 重置全局配置，主要用于测试隔离。
     */
    public static function reset(): void
    {
        self::$current = null;
    }

    /**
     * 根据配置数组创建安全配置对象。
     *
     * @param array<string, mixed> $config
     */
    public static function fromArray(array $config): self
    {
        $enabled = self::readBoolean($config['enabled'] ?? false, false);
        $level = strtolower((string) ($config['level'] ?? self::LEVEL_STRICT));
        if (! in_array($level, [self::LEVEL_STRICT, self::LEVEL_STANDARD, self::LEVEL_COMPATIBLE], true)) {
            $level = self::LEVEL_STRICT;
        }

        $maxDownloadSize = (int) ($config['max_download_size'] ?? self::DEFAULT_MAX_DOWNLOAD_SIZE);
        if ($maxDownloadSize <= 0) {
            $maxDownloadSize = self::DEFAULT_MAX_DOWNLOAD_SIZE;
        }

        $maxRedirects = (int) ($config['max_redirects'] ?? self::DEFAULT_MAX_REDIRECTS);
        if ($maxRedirects < 0) {
            $maxRedirects = self::DEFAULT_MAX_REDIRECTS;
        }

        $ipProtection = $config['ip_protection'] ?? [];
        if (! is_array($ipProtection)) {
            $ipProtection = [];
        }
        $ipProtection = array_merge(self::DEFAULT_IP_PROTECTION, $ipProtection);

        return new self(
            $enabled,
            $level,
            $maxDownloadSize,
            $maxRedirects,
            self::readBoolean($ipProtection['block_private_ip'], true),
            self::readBoolean($ipProtection['block_loopback_ip'], true),
            self::readBoolean($ipProtection['block_link_local_ip'], true),
            self::readBoolean($ipProtection['block_reserved_ip'], true),
            self::readBoolean($ipProtection['block_cloud_metadata_ip'], true),
            self::readStringList($ipProtection['extra_blocked_ips']),
            self::readStringList($ipProtection['extra_blocked_cidrs']),
        );
    }

    /**
     * 判断远程下载防护是否启用，默认关闭以兼容历史行为。
     */
    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    /**
     * 获取当前防护等级。
     */
    public function getLevel(): string
    {
        return $this->level;
    }

    /**
     * 获取允许的 URL 协议列表。
     *
     * @return array<string>
     */
    public function getAllowedSchemes(): array
    {
        return match ($this->level) {
            self::LEVEL_STANDARD, self::LEVEL_COMPATIBLE => ['http', 'https'],
            default => ['https'],
        };
    }

    /**
     * 获取允许的端口列表；空数组表示当前等级允许协议对应的任意端口。
     *
     * @return array<int>
     */
    public function getAllowedPorts(): array
    {
        return match ($this->level) {
            self::LEVEL_STANDARD => [80, 443],
            self::LEVEL_COMPATIBLE => [],
            default => [443],
        };
    }

    /**
     * 获取最大下载字节数。
     */
    public function getMaxDownloadSize(): int
    {
        return $this->maxDownloadSize;
    }

    /**
     * 获取最大重定向次数。
     */
    public function getMaxRedirects(): int
    {
        return $this->maxRedirects;
    }

    /**
     * 是否拦截私网地址。
     */
    public function shouldBlockPrivateIp(): bool
    {
        return $this->blockPrivateIp;
    }

    /**
     * 是否拦截回环地址。
     */
    public function shouldBlockLoopbackIp(): bool
    {
        return $this->blockLoopbackIp;
    }

    /**
     * 是否拦截本地链路地址。
     */
    public function shouldBlockLinkLocalIp(): bool
    {
        return $this->blockLinkLocalIp;
    }

    /**
     * 是否拦截保留地址。
     */
    public function shouldBlockReservedIp(): bool
    {
        return $this->blockReservedIp;
    }

    /**
     * 是否拦截云元数据地址。
     */
    public function shouldBlockCloudMetadataIp(): bool
    {
        return $this->blockCloudMetadataIp;
    }

    /**
     * 获取额外拒绝的精确 IP 列表。
     *
     * @return array<string>
     */
    public function getExtraBlockedIps(): array
    {
        return $this->extraBlockedIps;
    }

    /**
     * 获取额外拒绝的 CIDR 列表。
     *
     * @return array<string>
     */
    public function getExtraBlockedCidrs(): array
    {
        return $this->extraBlockedCidrs;
    }

    /**
     * 判断当前等级是否允许指定协议。
     */
    public function allowsScheme(string $scheme): bool
    {
        return in_array(strtolower($scheme), $this->getAllowedSchemes(), true);
    }

    /**
     * 获取 cURL 可使用的协议位图。
     */
    public function getCurlProtocolMask(): int
    {
        $mask = 0;
        foreach ($this->getAllowedSchemes() as $scheme) {
            if ($scheme === 'http' && defined('CURLPROTO_HTTP')) {
                $mask |= CURLPROTO_HTTP;
            }
            if ($scheme === 'https' && defined('CURLPROTO_HTTPS')) {
                $mask |= CURLPROTO_HTTPS;
            }
        }

        return $mask;
    }

    /**
     * 从混合配置值中读取布尔配置，兼容 env 字符串。
     */
    private static function readBoolean(mixed $value, bool $default): bool
    {
        if (is_bool($value)) {
            return $value;
        }

        if (is_string($value)) {
            $parsed = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            return $parsed ?? $default;
        }

        if (is_int($value)) {
            return $value !== 0;
        }

        return $default;
    }

    /**
     * 从混合配置值中读取字符串列表。
     *
     * @return array<string>
     */
    private static function readStringList(mixed $value): array
    {
        if (is_string($value)) {
            $decoded = json_decode($value, true);
            if (is_array($decoded)) {
                $value = $decoded;
            } else {
                $value = array_filter(array_map('trim', explode(',', $value)));
            }
        }

        if (! is_array($value)) {
            return [];
        }

        $items = array_map(static fn ($item) => is_string($item) ? trim($item) : $item, $value);

        return array_values(array_filter($items, static fn ($item) => is_string($item) && $item !== ''));
    }
}
