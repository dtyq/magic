<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Entity\ValueObject;

enum BindingScopeType: string
{
    case Specific = 'specific';
    case OrganizationAll = 'organization_all';
}
