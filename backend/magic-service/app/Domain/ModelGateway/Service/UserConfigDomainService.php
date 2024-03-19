<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Service;

use App\Domain\ModelGateway\Entity\UserConfigEntity;
use App\Domain\ModelGateway\Entity\ValueObject\LLMDataIsolation;
use App\Domain\ModelGateway\Repository\Facade\UserConfigRepositoryInterface;

class UserConfigDomainService extends AbstractDomainService
{
    public function __construct(
        private readonly UserConfigRepositoryInterface $userConfigRepository
    ) {
    }

    public function getByAppCodeAndOrganizationCode(LLMDataIsolation $dataIsolation, ?string $appCode, ?string $organizationCode, string $userId): UserConfigEntity
    {
        if (is_null($appCode)) {
            // 个人版
            $appCode = 'personal';
        }
        if (is_null($organizationCode)) {
            // 个人版
            $organizationCode = 'personal';
        }
        $userConfig = $this->userConfigRepository->getByAppCodeAndOrganizationCode($dataIsolation, $appCode, $organizationCode, $userId);
        if (! $userConfig) {
            // 创建一个
            $userConfig = new UserConfigEntity();
            $userConfig->setUserId($userId);
            $userConfig->setAppCode($appCode);
            $userConfig->setOrganizationCode($organizationCode);
            $userConfig->setTotalAmount(config('magic-api.default_amount_config.user'));
            $userConfig->setRpm(0);
            $userConfig = $this->userConfigRepository->create($dataIsolation, $userConfig);
        }
        return $userConfig;
    }

    public function incrementUseAmount(LLMDataIsolation $dataIsolation, UserConfigEntity $userConfigEntity, float $amount): void
    {
        $this->userConfigRepository->incrementUseAmount($dataIsolation, $userConfigEntity, $amount);
    }
}
