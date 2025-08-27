<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Mode\Facade;

use App\Application\Mode\Service\ModeAppService;
use App\Infrastructure\Core\AbstractApi;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse('low_code')]
class ModeApi extends AbstractApi
{
    public function __construct(
        private ModeAppService $modeAppService
    ) {
    }

    public function getModes(RequestInterface $request)
    {
        return $this->modeAppService->getModes($this->getAuthorization());
    }

    public function getModeByIdentifier(RequestInterface $request, string $identifier)
    {
        $authenticatable = $this->getAuthorization();
        return $this->modeAppService->getModeByIdentifier($authenticatable, $identifier);
    }
}
