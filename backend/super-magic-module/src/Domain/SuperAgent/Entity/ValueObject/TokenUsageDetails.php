<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

/**
 * Token Usage Details Value Object.
 */
class TokenUsageDetails
{
    /**
     * Constructor.
     *
     * @param null|string $type 类型："summary" 或 "item"
     * @param null|array $usages Token使用记录数组
     */
    public function __construct(
        private ?string $type,
        private ?array $usages
    ) {
    }

    /**
     * Creates an instance from an array.
     * Returns null if the provided data is null or empty.
     *
     * @param null|array $data Data array
     * @return null|self Returns an instance of TokenUsageDetails or null
     */
    public static function fromArray(?array $data): ?self
    {
        if (empty($data)) {
            return null;
        }

        $usages = [];
        if (isset($data['usages']) && is_array($data['usages'])) {
            foreach ($data['usages'] as $usage) {
                if (is_array($usage)) {
                    $tokenUsage = TokenUsage::fromArray($usage);
                    if ($tokenUsage !== null) {
                        $usages[] = $tokenUsage;
                    }
                }
            }
        }

        return new self(
            $data['type'] ?? null,
            ! empty($usages) ? $usages : null
        );
    }

    /**
     * Converts the object to an array.
     */
    public function toArray(): array
    {
        $usages = [];
        if (is_array($this->usages)) {
            foreach ($this->usages as $usage) {
                if ($usage instanceof TokenUsage) {
                    $usages[] = $usage->toArray();
                }
            }
        }

        return [
            'type' => $this->type,
            'usages' => $usages,
        ];
    }

    /**
     * 获取类型.
     */
    public function getType(): ?string
    {
        return $this->type;
    }

    /**
     * 获取使用记录数组.
     *
     * @return null|array 返回TokenUsage对象数组或null
     */
    public function getUsages(): ?array
    {
        return $this->usages;
    }
}
