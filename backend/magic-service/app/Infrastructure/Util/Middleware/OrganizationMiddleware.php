<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Middleware;

use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

class OrganizationMiddleware implements MiddlewareInterface
{
    public function __construct()
    {
    }

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $organizationCode = $request->getHeader('organization-code')[0] ?? '';
        if (empty($organizationCode)) {
            ExceptionBuilder::throw(UserErrorCode::ORGANIZATION_NOT_EXIST);
        }

        $requestContext = RequestContext::getRequestContext($request);
        // todo 获取用户id
        $userId = $requestContext->getUserId();

        // todo 检查用户是否在当前组织
        //        $this->userAppService->assertUserInCurrentOrganization($requestContext, $organizationCode);
        $requestContext->setOrganizationCode($organizationCode);
        return $handler->handle($request);
    }
}
