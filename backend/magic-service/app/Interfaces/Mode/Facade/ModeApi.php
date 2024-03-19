<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Mode\Facade;

use App\Application\Mode\Service\ModeAppService;
use App\Infrastructure\Core\AbstractApi;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse('low_code')]
class ModeApi extends AbstractApi
{
    #[Inject]
    protected ModeAppService $modeAppService;

    public function getModes()
    {
        return $this->modeAppService->getModes($this->getAuthorization());
    }
}
