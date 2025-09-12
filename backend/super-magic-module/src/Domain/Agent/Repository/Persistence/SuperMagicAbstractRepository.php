<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Repository\Persistence;

use App\Infrastructure\Core\AbstractRepository;

abstract class SuperMagicAbstractRepository extends AbstractRepository
{
    protected bool $filterOrganizationCode = true;
}
