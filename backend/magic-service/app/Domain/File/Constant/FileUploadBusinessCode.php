<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\File\Constant;

use App\Infrastructure\Util\IdGenerator\IdGenerator;

enum FileUploadBusinessCode: string
{
    case SKILL = 'skill';
    case ASSET = 'asset';

    public function getDir(): string
    {
        return $this->value . '/' . IdGenerator::getSnowId();
    }
}
