<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Event;

final readonly class FunctionPermissionChanged
{
    /** @param null|list<string> $functionCodes Null means the global control setting changed. */
    public function __construct(
        public string $organizationCode,
        public string $actor,
        public ?array $functionCodes,
    ) {
    }
}
