<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Share\Service;

use App\Application\Kernel\AbstractKernelAppService;
use App\Infrastructure\Core\Traits\DataIsolationTrait;

/**
 * 分享应用服务抽象类.
 */
class AbstractShareAppService extends AbstractKernelAppService
{
    use DataIsolationTrait;
}
