<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Entity;

use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Infrastructure\Core\AbstractEntity;

/**
 * AI 能力实体.
 */
class AiAbilityEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected AiAbilityCode $code;

    protected string $organizationCode = '';

    protected array $name = [];

    protected array $description = [];

    protected string $icon;

    protected int $sortOrder;

    protected Status $status;

    protected array $config;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(null|int|string $id): void
    {
        if (is_numeric($id)) {
            $this->id = (int) $id;
        } else {
            $this->id = null;
        }
    }

    public function getCode(): AiAbilityCode
    {
        return $this->code;
    }

    public function setCode(null|AiAbilityCode|string $code): void
    {
        if ($code === null || $code === '') {
            $this->code = AiAbilityCode::Ocr;
        } elseif ($code instanceof AiAbilityCode) {
            $this->code = $code;
        } else {
            $this->code = AiAbilityCode::tryFrom($code) ?? AiAbilityCode::Unknown;
        }
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getName(): array
    {
        return $this->name;
    }

    public function setName(array|string $name): void
    {
        if (is_string($name)) {
            // 如果是字符串，尝试解析JSON
            $decoded = json_decode($name, true);
            $this->name = is_array($decoded) ? $decoded : [];
        } else {
            $this->name = $name;
        }
    }

    /**
     * 获取当前语言的名称.
     */
    public function getLocalizedName(?string $locale = null): string
    {
        $locale = $locale ?? config('translation.locale', 'zh_CN');
        return $this->name[$locale] ?? $this->name['zh_CN'] ?? $this->name['en_US'] ?? '';
    }

    public function getDescription(): array
    {
        return $this->description;
    }

    public function setDescription(array|string $description): void
    {
        if (is_string($description)) {
            // 如果是字符串，尝试解析JSON
            $decoded = json_decode($description, true);
            $this->description = is_array($decoded) ? $decoded : [];
        } else {
            $this->description = $description;
        }
    }

    /**
     * 获取当前语言的描述.
     */
    public function getLocalizedDescription(?string $locale = null): string
    {
        $locale = $locale ?? config('translation.locale', 'zh_CN');
        return $this->description[$locale] ?? $this->description['zh_CN'] ?? $this->description['en_US'] ?? '';
    }

    public function getIcon(): string
    {
        return $this->icon;
    }

    public function setIcon(null|int|string $icon): void
    {
        if ($icon === null) {
            $this->icon = '';
        } else {
            $this->icon = (string) $icon;
        }
    }

    public function getSortOrder(): int
    {
        return $this->sortOrder;
    }

    public function setSortOrder(null|int|string $sortOrder): void
    {
        if ($sortOrder === null) {
            $this->sortOrder = 0;
        } else {
            $this->sortOrder = (int) $sortOrder;
        }
    }

    public function getStatus(): Status
    {
        return $this->status;
    }

    public function setStatus(null|bool|int|Status|string $status): void
    {
        if ($status === null || $status === '') {
            $this->status = Status::Enabled;
        } elseif ($status instanceof Status) {
            $this->status = $status;
        } elseif (is_bool($status)) {
            $this->status = $status ? Status::Enabled : Status::Disabled;
        } else {
            $this->status = Status::from((int) $status);
        }
    }

    public function getConfig(): array
    {
        return $this->config;
    }

    public function setConfig(array|string $config): void
    {
        if (is_string($config)) {
            $configArray = json_decode($config, true) ?: [];
            $this->config = $configArray;
        } else {
            $this->config = $config;
        }
    }

    /**
     * 判断能力是否启用.
     */
    public function isEnabled(): bool
    {
        return $this->status->isEnabled();
    }

    /**
     * 获取脱敏后的配置（用于对外展示）.
     *
     * @return array 脱敏后的配置数组
     */
    public function getMaskedConfig(): array
    {
        $sensitiveFields = $this->code->getSensitiveFields();
        return $this->maskConfigRecursively($this->config, $sensitiveFields);
    }

    /**
     * 合并配置（保留被脱敏的敏感字段原始值）.
     *
     * @param array $newConfig 新的配置数组（可能包含脱敏的敏感字段）
     * @return array 合并后的配置数组
     */
    public function mergeConfig(array $newConfig): array
    {
        $sensitiveFields = $this->code->getSensitiveFields();
        return $this->mergeConfigPreservingSensitiveFields($this->config, $newConfig, $sensitiveFields);
    }

    /**
     * 递归脱敏配置中指定的敏感字段.
     *
     * @param array $config 配置数组
     * @param array<string> $sensitiveFields 需要脱敏的字段列表
     * @return array 脱敏后的配置数组
     */
    private function maskConfigRecursively(array $config, array $sensitiveFields): array
    {
        $result = [];

        foreach ($config as $key => $value) {
            if (in_array($key, $sensitiveFields) && is_string($value) && ! empty($value)) {
                // 脱敏：前4后4
                $result[$key] = $this->maskSensitiveValue($value);
            } elseif (is_array($value)) {
                $result[$key] = $this->maskConfigRecursively($value, $sensitiveFields);
            } else {
                $result[$key] = $value;
            }
        }

        return $result;
    }

    /**
     * 脱敏敏感值.
     *
     * @param string $value 原始值
     * @param int $prefixLength 保留前几位（默认4）
     * @param int $suffixLength 保留后几位（默认4）
     * @return string 脱敏后的值
     */
    private function maskSensitiveValue(string $value, int $prefixLength = 4, int $suffixLength = 4): string
    {
        $length = mb_strlen($value);
        $minLength = $prefixLength + $suffixLength;

        // 如果值太短，全部脱敏
        if ($length <= $minLength) {
            return str_repeat('*', $length);
        }

        // 显示前N位和后N位
        $prefix = mb_substr($value, 0, $prefixLength);
        $suffix = mb_substr($value, -$suffixLength);
        $maskLength = $length - $minLength;

        return $prefix . str_repeat('*', $maskLength) . $suffix;
    }

    /**
     * 合并配置（保留被脱敏的敏感字段原始值）.
     *
     * @param array $dbConfig 数据库原始配置
     * @param array $frontendConfig 前端传来的配置（可能包含脱敏的敏感字段）
     * @param array<string> $sensitiveFields 需要保留的敏感字段列表
     * @return array 合并后的配置
     */
    private function mergeConfigPreservingSensitiveFields(array $dbConfig, array $frontendConfig, array $sensitiveFields): array
    {
        $result = [];

        // 遍历前端配置的所有字段
        foreach ($frontendConfig as $key => $value) {
            // 如果是敏感字段且包含脱敏标记 ***
            if (in_array($key, $sensitiveFields) && is_string($value) && str_contains($value, '*')) {
                // 使用数据库中的原始值
                $result[$key] = $dbConfig[$key] ?? $value;
            } elseif (is_array($value)) {
                // 如果是数组，递归处理
                $dbValue = $dbConfig[$key] ?? [];
                $result[$key] = is_array($dbValue)
                    ? $this->mergeConfigPreservingSensitiveFields($dbValue, $value, $sensitiveFields)
                    : $value;
            } else {
                // 其他情况直接使用前端的值
                $result[$key] = $value;
            }
        }

        // 前端未传的字段, 则数据库中字段为默认值 ''
        foreach ($dbConfig as $key => $value) {
            if (! array_key_exists($key, $result)) {
                $result[$key] = '';
            }
        }

        return $result;
    }
}
