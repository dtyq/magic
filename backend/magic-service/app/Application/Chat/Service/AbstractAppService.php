<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service;

use App\Application\Kernel\AbstractKernelAppService;
use App\Infrastructure\Core\Traits\DataIsolationTrait;

class AbstractAppService extends AbstractKernelAppService
{
    use DataIsolationTrait;

    /**
     * 公共匹配字段.
     */
    public function getCommonRules(): array
    {
        return [
            'context' => 'required',
            'context.organization_code' => 'string|nullable',
            'context.language' => 'string|nullable',
            'data' => 'required|array',
        ];
    }
}
