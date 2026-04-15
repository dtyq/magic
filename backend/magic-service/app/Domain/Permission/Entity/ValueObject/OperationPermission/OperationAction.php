<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Entity\ValueObject\OperationPermission;

enum OperationAction: string
{
    case Read = 'r';
    case Edit = 'w';
    case Delete = 'del';
    case Manage = 'manage';
    case Transfer = 'transfer';
}
