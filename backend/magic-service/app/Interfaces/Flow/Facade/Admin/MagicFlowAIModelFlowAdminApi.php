<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Flow\Facade\Admin;

use App\Application\Flow\Service\MagicFlowAIModelAppService;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Flow\Assembler\AIModel\MagicFlowAIModelAssembler;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse(version: 'low_code')]
class MagicFlowAIModelFlowAdminApi extends AbstractFlowAdminApi
{
    #[Inject]
    protected MagicFlowAIModelAppService $magicFlowAIModelAppService;

    public function getEnabled()
    {
        /** @var MagicUserAuthorization $authorization */
        $authorization = $this->getAuthorization();
        $data = $this->magicFlowAIModelAppService->getEnabled($authorization);
        return MagicFlowAIModelAssembler::createEnabledListDTO($data['list']);
    }
}
