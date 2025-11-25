<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Middleware;

use App\Application\ModelGateway\Service\LLMAppService;
use App\Domain\Contact\Entity\ValueObject\UserType;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestCoContext;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Throwable;

class RequestApiKeyMiddleware implements MiddlewareInterface
{
    public function __construct(
        private readonly LLMAppService $llmAppService
    ) {
    }

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $accessToken = $request->getHeaderLine('api-key');

        // 处理header的Magic-User-Id 存在["usi_8","xxxxxxxxx"]问题，合并为"usi_8xxxxxxxxx"
        $magicUserId = $request->getHeader('magic-user-id');
        $organizationCode = $request->getHeader('magic-organization-code');
        if ($magicUserId && count(value: $magicUserId) > 1) {
            $magicUserId = implode('', $magicUserId);
            $request = $request->withHeader('magic-user-id', $magicUserId);
        }

        $businessParams = [];
        if (! empty($organizationCode) && ! empty($magicUserId)) {
            $businessParams = [
                'organization_code' => $organizationCode,
                'user_id' => $magicUserId,
            ];
        }

        // 3. Create data isolation object (for logging and permission control)
        $modelGatewayDataIsolation = $this->llmAppService->createModelGatewayDataIsolationByAccessToken($accessToken, $businessParams);
        // 注意！为了迭代可控，只能在 api 层进行协程上下文操作，app/domain/repository 层要直接传入对象。

        $magicUserAuthorization = $this->getOpenUserAuthorization($modelGatewayDataIsolation);
        // 将用户信息存入协程上下文，方便 api 层获取。
        RequestCoContext::setUserAuthorization($magicUserAuthorization);

        return $handler->handle($request);
    }

    protected function getOpenUserAuthorization(ModelGatewayDataIsolation $modelGatewayDataIsolation): MagicUserAuthorization
    {
        try {
            $magicUserAuthorization = new MagicUserAuthorization();
            $magicUserAuthorization->setId($modelGatewayDataIsolation->getCurrentUserId());
            $magicUserAuthorization->setOrganizationCode(organizationCode: $modelGatewayDataIsolation->getCurrentOrganizationCode());
            $magicUserAuthorization->setMagicId($modelGatewayDataIsolation->getMagicId());
            $magicUserAuthorization->setThirdPlatformUserId($modelGatewayDataIsolation->getThirdPlatformUserId());
            $magicUserAuthorization->setThirdPlatformOrganizationCode($modelGatewayDataIsolation->getThirdPlatformOrganizationCode());
            $magicUserAuthorization->setMagicEnvId($modelGatewayDataIsolation->getEnvId());
            $magicUserAuthorization->setUserType(UserType::Human);
            return $magicUserAuthorization;
        } catch (BusinessException $exception) {
            // 如果是业务异常，直接抛出，不改变异常类型
            throw $exception;
        } catch (Throwable $exception) {
            ExceptionBuilder::throw(UserErrorCode::ACCOUNT_ERROR, throwable: $exception);
        }
    }
}
