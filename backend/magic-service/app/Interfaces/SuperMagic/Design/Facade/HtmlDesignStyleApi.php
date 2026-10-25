<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Design\Facade;

use App\Application\SuperMagic\Design\Service\HtmlDesignStyleSourceService;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\SuperMagic\Common\Support\Facade\AbstractApi;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse('low_code')]
class HtmlDesignStyleApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        private readonly HtmlDesignStyleSourceService $sourceService,
    ) {
        parent::__construct($request);
    }

    /**
     * Client-facing endpoint: return the raw DESIGN.md source for a style.
     */
    public function getSource(RequestContext $requestContext, string $styleCode): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        return $this->sourceService->getSource($styleCode);
    }
}
