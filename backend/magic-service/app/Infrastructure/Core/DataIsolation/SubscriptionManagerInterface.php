<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\DataIsolation;

use App\Domain\Provider\Entity\ValueObject\ModelType;

interface SubscriptionManagerInterface
{
    /**
     * 是否启用订阅功能.
     */
    public function enabled(): bool;

    public function setCurrentSubscription(string $subscriptionId, array $subscriptionInfo): void;

    /**
     * 获取当前订阅ID.
     */
    public function getCurrentSubscriptionId(): string;

    /**
     * 获取当前订阅信息.
     */
    public function getCurrentSubscriptionInfo(): array;

    /**
     * 获取当前可用的模型ID列表, 如果返回null表示不限制.
     *
     * @return null|array<string>
     */
    public function getAvailableModelIds(?ModelType $modelType): ?array;

    public function isValidModelAvailable(string $modelId, ?ModelType $modelType): bool;

    public function toArray(): array;
}
