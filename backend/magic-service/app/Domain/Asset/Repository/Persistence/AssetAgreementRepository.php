<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asset\Repository\Persistence;

use App\Domain\Asset\Entity\AssetDataIsolation;
use App\Domain\Asset\Repository\Facade\AssetAgreementRepositoryInterface;
use App\Domain\Asset\Repository\Persistence\Model\AssetAgreementModel;
use App\Infrastructure\Util\IdGenerator\IdGenerator;

class AssetAgreementRepository implements AssetAgreementRepositoryInterface
{
    public function __construct(protected AssetAgreementModel $agreementModel)
    {
    }

    public function hasAccepted(AssetDataIsolation $dataIsolation): bool
    {
        return $this->agreementModel::query()
            ->where('organization_code', $dataIsolation->getCurrentOrganizationCode())
            ->where('user_id', $dataIsolation->getCurrentUserId())
            ->exists();
    }

    public function markAccepted(AssetDataIsolation $dataIsolation): void
    {
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $userId = $dataIsolation->getCurrentUserId();
        $now = date('Y-m-d H:i:s');
        $this->agreementModel::query()->upsert(
            [[
                'id' => IdGenerator::getSnowId(),
                'organization_code' => $organizationCode,
                'user_id' => $userId,
                'accepted_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ]],
            ['organization_code', 'user_id'],
            ['accepted_at', 'updated_at'],
        );
    }
}
