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
            $path = substr($path, 2);
        } elseif (str_starts_with($path, '/')) {
            $path = substr($path, 1);
        }

        return rtrim($path, '/');
    }
}
