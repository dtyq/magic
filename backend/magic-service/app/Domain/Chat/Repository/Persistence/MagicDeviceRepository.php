<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Repository\Persistence;

use App\Domain\Chat\Repository\Persistence\Model\MagicDeviceModel;
use Hyperf\Snowflake\IdGeneratorInterface;

class MagicDeviceRepository
{
    public function __construct(
        protected MagicDeviceModel $magicDevice,
        private readonly IdGeneratorInterface $idGenerator,
    ) {
    }

    public function createDeviceId(string $uid, int $osType, string $sid): int
    {
        $deviceInfo = [
            'id' => $this->idGenerator->generate(),
            'user_id' => $uid,
            'type' => $osType,
            'brand' => '',
            'model' => '',
            'system_version' => '',
            'sdk_version' => '',
            'status' => 1,
            'sid' => $sid,
            'client_addr' => '',
        ];
        $this->magicDevice::query()->create($deviceInfo);
        return $deviceInfo['id'];
    }
}
