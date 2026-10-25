<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Design\Facade\Sandbox;

use App\Application\SuperMagic\Design\Service\HtmlDesignStyleSourceService;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\SuperMagic\Agent\Facade\Sandbox\AbstractSuperMagicSandboxApi;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse('low_code')]
class HtmlDesignStyleSandboxApi extends AbstractSuperMagicSandboxApi
{
    #[Inject]
    protected HtmlDesignStyleSourceService $sourceService;

    /**
     * Sandbox-facing endpoint: used by super-magic to fetch DESIGN.md by code.
     */
    public function getSource(RequestContext $requestContext, string $styleCode): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        return $this->sourceService->getSource($styleCode);
    }
}
