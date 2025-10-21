<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\DataIsolation;

use App\Domain\Provider\Entity\ValueObject\ModelType;

/**
 * 订阅管理器.
 */
class BaseSubscriptionManager implements SubscriptionManagerInterface
{
    protected bool $enabled = false;

    private string $currentSubscriptionId = '';

    private array $currentSubscriptionInfo = [];

    private array $modelIdsGroupByType = [];

    public function __construct(
    ) {
    }

    public function setCurrentSubscription(string $subscriptionId, array $subscriptionInfo, array $modelIdsGroupByType = []): void
    {
        $this->currentSubscriptionId = $subscriptionId;
        $this->currentSubscriptionInfo = $subscriptionInfo;
        $this->modelIdsGroupByType = $modelIdsGroupByType;
    }

    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    public function setEnabled(bool $enabled): void
    {
        $this->enabled = $enabled;
    }

    public function getCurrentSubscriptionInfo(): array
    {
        return $this->currentSubscriptionInfo;
    }

    public function getCurrentSubscriptionId(): string
    {
        return $this->currentSubscriptionId;
    }

    public function getAvailableModelIds(?ModelType $modelType): ?array
    {
        return null;
    }

    public function isValidModelAvailable(string $modelId, ?ModelType $modelType): bool
    {
        $modelIds = $this->getAvailableModelIds($modelType);
        if (is_null($modelIds)) {
            return true;
        }
        return in_array($modelId, $modelIds, true);
    }

    public function getModelIdsGroupByType(): array
    {
        return $this->modelIdsGroupByType;
    }

    public function setModelIdsGroupByType(array $modelIdsGroupByType): void
    {
        $this->modelIdsGroupByType = $modelIdsGroupByType;
    }

    public function isPaidSubscription(): bool
    {
        return true;
    }

    public function toArray(): array
    {
        return [
            'current_subscription_id' => $this->getCurrentSubscriptionId(),
            'current_subscription_info' => $this->getCurrentSubscriptionInfo(),
            'model_ids_group_by_type' => $this->getModelIdsGroupByType(),
        ];
    }
}
