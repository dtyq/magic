<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Middleware;

use App\Application\ModelGateway\Service\LLMAppService;
use App\Domain\Contact\Entity\ValueObject\UserType;
use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestCoContext;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Qbhy\HyperfAuth\Authenticatable;
use Qbhy\HyperfAuth\AuthManager;
use Throwable;

class RequestContextMiddleware implements MiddlewareInterface
{
    public function __construct(
        private readonly LLMAppService $llmAppService
    ) {
    }

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        // 注意！为了迭代可控，只能在 api 层对协程上下文赋值
        $accessToken = $request->getHeaderLine('api-key');

        if (! empty($accessToken)) {
            $magicUserAuthorization = $this->getOpenPlatformAuthorization($request, $accessToken);
        } else {
            $magicUserAuthorization = $this->getAuthorization();
        }
        // 将用户信息存入协程上下文，方便 api 层获取
        RequestCoContext::setUserAuthorization($magicUserAuthorization);
        return $handler->handle($request);
    }

    /**
     * @return MagicUserAuthorization
     */
    protected function getAuthorization(): Authenticatable
    {
        try {
            return di(AuthManager::class)->guard(name: 'web')->user();
        } catch (BusinessException $exception) {
            // 如果是业务异常，直接抛出，不改变异常类型
            throw $exception;
        } catch (Throwable $exception) {
            ExceptionBuilder::throw(UserErrorCode::ACCOUNT_ERROR, throwable: $exception);
            // This line will never be reached as ExceptionBuilder::throw() throws an exception
            throw $exception;
        }
    }

    /**
     * @param mixed $request
     */
    protected function getOpenPlatformAuthorization(ServerRequestInterface $request, string $accessToken): MagicUserAuthorization
    {
        try {
            $magicUserId = $request->getHeaderLine('magic-user-id');
            $organizationCode = $request->getHeaderLine('magic-organization-code');

            $businessParams = [];
            if (! empty($organizationCode) && ! empty($magicUserId)) {
                $businessParams = [
                    'organization_code' => $organizationCode,
                    'user_id' => $magicUserId,
                ];
            }
            $modelGatewayDataIsolation = $this->llmAppService->createModelGatewayDataIsolationByAccessToken($accessToken, $businessParams);
            $magicUserAuthorization = new MagicUserAuthorization();
            $magicUserAuthorization->setId($modelGatewayDataIsolation->getCurrentUserId());
            $magicUserAuthorization->setOrganizationCode($modelGatewayDataIsolation->getCurrentOrganizationCode());
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
            // This line will never be reached as ExceptionBuilder::throw() throws an exception
            throw $exception;
        }
    }
}
