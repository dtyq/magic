<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Authentication\Facade;

use App\Application\Authentication\Service\ModelGatewayTokenAppService;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\Traits\MagicUserAuthorizationTrait;
use App\Infrastructure\Util\Context\CoContext;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse(version: 'low_code')]
readonly class ModelGatewayTokenApi
{
    use MagicUserAuthorizationTrait;

    public function __construct(
        protected RequestInterface $request,
        private ModelGatewayTokenAppService $modelGatewayTokenAppService
    ) {
    }

    /**
     * 签发模型网关用户 token 对（api_key + refresh_token）.
     */
    public function issueModelGatewayToken(): array
    {
        $authorization = $this->getAuthorization();
        $auditContext = $this->buildAuditContext('issue');
        $tokenDTO = $this->modelGatewayTokenAppService->issueToken($authorization->getId(), $auditContext);

        return [
            'api_key' => $tokenDTO->getApiKey(),
            'refresh_token' => $tokenDTO->getRefreshToken(),
            'api_key_expires_at' => $tokenDTO->getApiKeyExpiresAt(),
            'refresh_token_expires_at' => $tokenDTO->getRefreshTokenExpiresAt(),
        ];
    }

    /**
     * 刷新模型网关用户 token（双旋转：返回新的 api_key + refresh_token）.
     */
    public function refreshModelGatewayToken(): array
    {
        $refreshToken = $this->validateRefreshRequest();

        $auditContext = $this->buildAuditContext('refresh');
        $tokenDTO = $this->modelGatewayTokenAppService->refreshToken($refreshToken, $auditContext);

        return [
            'api_key' => $tokenDTO->getApiKey(),
            'refresh_token' => $tokenDTO->getRefreshToken(),
            'api_key_expires_at' => $tokenDTO->getApiKeyExpiresAt(),
            'refresh_token_expires_at' => $tokenDTO->getRefreshTokenExpiresAt(),
        ];
    }

    private function validateRefreshRequest(): string
    {
        $contentType = strtolower(trim($this->request->getHeaderLine('content-type')));
        if (! str_contains($contentType, 'application/json')) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'Content-Type must be application/json');
        }

        $requestData = $this->request->all();
        if (count($requestData) !== 1 || ! array_key_exists('refresh_token', $requestData)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'Request body must only contain refresh_token');
        }

        $refreshToken = $requestData['refresh_token'];
        if (! is_string($refreshToken)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'refresh_token must be string');
        }

        return trim($refreshToken);
    }

    private function buildAuditContext(string $headerSource): array
    {
        $forwardedFor = $this->request->getHeaderLine('x-forwarded-for');
        $realIp = $this->request->getHeaderLine('x-real-ip');
        $serverParams = $this->request->getServerParams();
        if ($forwardedFor !== '') {
            $clientIp = trim(explode(',', $forwardedFor)[0]);
        } elseif ($realIp !== '') {
            $clientIp = trim($realIp);
        } else {
            $clientIp = (string) ($serverParams['remote_addr'] ?? '');
        }

        return [
            'trace_id' => CoContext::getTraceId(),
            'client_ip' => $clientIp,
            'header_source' => $headerSource,
        ];
    }
}
