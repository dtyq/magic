<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Service;

use App\Domain\ModelGateway\Entity\OrganizationConfigEntity;
use App\Domain\ModelGateway\Entity\ValueObject\LLMDataIsolation;
use App\Domain\ModelGateway\Repository\Facade\OrganizationConfigRepositoryInterface;

class OrganizationConfigDomainService extends AbstractDomainService
{
    public function __construct(
        private readonly OrganizationConfigRepositoryInterface $organizationConfigRepository
    ) {
    }

    public function getByAppCodeAndOrganizationCode(LLMDataIsolation $dataIsolation, string $appCode, string $organizationCode): OrganizationConfigEntity
    {
        $organizationConfig = $this->organizationConfigRepository->getByAppCodeAndOrganizationCode($dataIsolation, $appCode, $organizationCode);
        if (! $organizationConfig) {
            // 创建一个
            $organizationConfig = new OrganizationConfigEntity();
            $organizationConfig->setAppCode($appCode);
            $organizationConfig->setOrganizationCode($organizationCode);
            $organizationConfig->setTotalAmount(config('magic-api.default_amount_config.organization'));
            $organizationConfig->setRpm(0);
            $organizationConfig = $this->organizationConfigRepository->create($dataIsolation, $organizationConfig);
        }
        return $organizationConfig;
    }

    public function incrementUseAmount(LLMDataIsolation $dataIsolation, OrganizationConfigEntity $organizationConfig, float $amount): void
    {
        $this->organizationConfigRepository->incrementUseAmount($dataIsolation, $organizationConfig, $amount);
    }
}
