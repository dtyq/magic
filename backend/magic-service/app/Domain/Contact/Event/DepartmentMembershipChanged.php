<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Event;

final readonly class DepartmentMembershipChanged
{
    public function __construct(public string $organizationCode)
    {
    }
}
