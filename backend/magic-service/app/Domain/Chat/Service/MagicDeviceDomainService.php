<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Service;

use App\Domain\Chat\Repository\Persistence\MagicDeviceRepository;

readonly class MagicDeviceDomainService
{
    public function __construct(
        private MagicDeviceRepository $deviceRepository,
    ) {
    }

    public function createDeviceId(string $uid, int $osType, string $sid): string
    {
        return (string) $this->deviceRepository->createDeviceId($uid, $osType, $sid);
    }
}
