<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\ValueObject;

use App\Domain\ModelGateway\Entity\AccessTokenEntity;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;

class ModelGatewayDataIsolation extends BaseDataIsolation
{
    protected AccessTokenEntity $accessToken;

    protected string $appId = '';

    protected string $sourceId = '';

    protected string $userName = '';

    public function getUserName(): string
    {
        return $this->userName;
    }

    public function setUserName(string $userName): void
    {
        $this->userName = $userName;
    }

    public function getSourceId(): string
    {
        return $this->sourceId;
    }

    public function setSourceId(string $sourceId): void
    {
        $this->sourceId = $sourceId;
    }

    public function getAppId(): string
    {
        return $this->appId;
    }

    public function setAppId(string $appId): void
    {
        $this->appId = $appId;
    }

    public function getAccessToken(): AccessTokenEntity
    {
        return $this->accessToken;
    }

    public function setAccessToken(AccessTokenEntity $accessToken): void
    {
        $this->accessToken = $accessToken;
    }

    public static function create(string $currentOrganizationCode = '', string $userId = ''): self
    {
        return new self($currentOrganizationCode, $userId);
    }

    public static function createByOrganizationCodeWithoutSubscription(string $currentOrganizationCode = ''): self
    {
        $dataIsolation = new self($currentOrganizationCode, '');
        $dataIsolation->getSubscriptionManager()->setEnabled(false);
        return $dataIsolation;
    }
}
