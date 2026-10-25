<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asset\Repository\Facade;

use App\Domain\Asset\Entity\AssetDataIsolation;

interface AssetAgreementRepositoryInterface
{
    public function hasAccepted(AssetDataIsolation $dataIsolation): bool;

    public function markAccepted(AssetDataIsolation $dataIsolation): void;
}
