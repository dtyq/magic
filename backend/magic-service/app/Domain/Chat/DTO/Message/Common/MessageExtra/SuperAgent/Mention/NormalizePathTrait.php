<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention;

trait NormalizePathTrait
{
    private function normalizePath(string $path): string
    {
        if (str_starts_with($path, './')) {
            return substr($path, 2);
        }

        if (str_starts_with($path, '/')) {
            return substr($path, 1);
        }

        return $path;
    }
}
