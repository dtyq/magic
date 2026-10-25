<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Asset\DTO\Response;

class AdminDeleteAssetDTO extends DeleteAssetDTO
{
    public string $scope = 'PUBLIC';
}
