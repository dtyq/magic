<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Authentication\Service;

use App\Application\Authentication\DTO\ApiKeyAuthResult;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\ModelGateway\Entity\AccessTokenEntity;
use App\Domain\ModelGateway\Entity\ValueObject\AccessTokenType;
use App\Domain\ModelGateway\Service\AccessTokenDomainService;
use App\ErrorCode\HttpErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\RequestUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use DateTime;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

class AuthApiKeyAppService extends AuthBaseAppService
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly AccessTokenDomainService $accessTokenDomainService,
        private readonly MagicUserDomainService $magicUserDomainService,
        private readonly ConfigInterface $config,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    /**
     * 尝试沙箱用户鉴权，其次 API-Key 鉴权。
     *
     * @param array<string,mixed> $headers
     * @param array<string,mixed> $serverParams
     */
    public function authenticate(array $headers, array $serverParams = []): ApiKeyAuthResult
    {
        // 有 sandbox user-authorization 头，只进行沙箱用户鉴权，不会再次读取 api-key 去鉴权。
        if ($this->hasSandboxUserAuthHeader($headers)) {
            $authorization = $this->authenticateSandboxUser($headers);
            if ($authorization instanceof MagicUserAuthorization) {
                return new ApiKeyAuthResult(null, $authorization, null);
            }
            $this->logger->warning('AuthFlow sandbox user auth failed (empty result), reject', [
                'class' => self::class,
            ]);
            ExceptionBuilder::throw(HttpErrorCode::Unauthorized);
        }

        // 没有 sandbox user-authorization 头，尝试 api-key 鉴权。
        $accessTokenEntity = $this->tryApiKeyAuth($headers, $serverParams);
        if ($accessTokenEntity instanceof AccessTokenEntity) {
            $apiKey = $this->getApiKeyFromHeaders($headers);
            $userAuthorization = $this->buildUserContextIfNeeded($accessTokenEntity);
            return new ApiKeyAuthResult($accessTokenEntity, $userAuthorization, $apiKey);
        }

        ExceptionBuilder::throw(HttpErrorCode::Unauthorized);
    }

    private function hasSandboxUserAuthHeader(array $headers): bool
    {
        foreach ($headers as $headerName => $headerValues) {
            $normalizedName = str_replace('_', '-', strtolower((string) $headerName));
            if ($normalizedName === 'user-authorization' && ! empty($headerValues[0])) {
                return true;
            }
        }
        return false;
    }

    /**
     * 获取 api-key（含兼容授权头）。
     */
    private function getApiKeyFromHeaders(array $headers): string
    {
        $apiKey = RequestUtil::getApiKeyHeader($headers);
        if ($apiKey !== '') {
            return $apiKey;
        }
        $normalized = RequestUtil::normalizeHeaders($headers);
        foreach (['magic-authorization', 'authorization'] as $headerKey) {
            $authHeader = $normalized[$headerKey] ?? '';
            $apiKey = RequestUtil::parseAuthorizationToken($authHeader);
            if ($apiKey !== '') {
                return $apiKey;
            }
        }
        return '';
    }

    /**
     * 根据 headers 与 server params 获取客户端 IP 列表。
     */
    private function getClientIps(array $headers, array $serverParams = []): array
    {
        $ips = [];

        $forwardedFor = $this->getHeaderValue($headers, 'x-forwarded-for');
        if ($forwardedFor !== '') {
            $forwardedIps = array_map('trim', explode(',', $forwardedFor));
            $ips = array_merge($ips, $forwardedIps);
        }

        $realIp = $this->getHeaderValue($headers, 'x-real-ip');
        if ($realIp !== '') {
            $ips[] = $realIp;
        }

        if (isset($serverParams['remote_addr']) && $serverParams['remote_addr'] !== '') {
            $ips[] = $serverParams['remote_addr'];
        }

        return array_unique(array_filter($ips));
    }

    private function getHeaderValue(array $headers, string $headerName): string
    {
        $lowerHeaderName = strtolower($headerName);
        foreach ($headers as $name => $values) {
            if (strtolower((string) $name) === $lowerHeaderName) {
                return ! empty($values[0]) ? (string) $values[0] : '';
            }
        }
        return '';
    }

    /**
     * 优先标准用户鉴权，失败时尝试兼容模式。
     *
     * @param array<string,mixed> $headers
     *
     * @throws Throwable
     */
    private function authenticateSandboxUser(array $headers): ?MagicUserAuthorization
    {
        try {
            return $this->authenticateByWebGuard();
        } catch (Throwable $e) {
            $this->logger->warning('AuthFlow sandbox user auth failed, try compatible', [
                'error' => $e->getMessage(),
                'code' => $e->getCode(),
                'class' => $e::class,
            ]);
            return $this->trySandboxCompatibleAuth($headers, $this->config, $this->magicUserDomainService, $e);
        }
    }

    /**
     * @param array<string,mixed> $headers
     * @param array<string,mixed> $serverParams
     */
    private function tryApiKeyAuth(array $headers, array $serverParams): ?AccessTokenEntity
    {
        $apiKey = $this->getApiKeyFromHeaders($headers);
        if ($apiKey === '') {
            $this->logger->info('AuthFlow apikey missing api-key header');
            return null;
        }

        try {
            $accessTokenEntity = $this->accessTokenDomainService->getByAccessToken($apiKey);
            if ($accessTokenEntity === null) {
                $this->logger->info('AuthFlow apikey token not found');
                return null;
            }

            if (! $accessTokenEntity->isEnabled()) {
                $this->logger->info('AuthFlow apikey token disabled', [
                    'type' => $accessTokenEntity->getType()->value,
                    'relation_id' => $accessTokenEntity->getRelationId(),
                ]);
                return null;
            }

            try {
                $accessTokenEntity->checkExpiredTime(new DateTime());
                $accessTokenEntity->checkIps($this->getClientIps($headers, $serverParams));
            } catch (BusinessException $businessException) {
                throw $businessException;
            } catch (Throwable $checkException) {
                $this->logger->info('AuthFlow apikey token validation failed', [
                    'type' => $accessTokenEntity->getType()->value,
                    'relation_id' => $accessTokenEntity->getRelationId(),
                    'error' => $checkException->getMessage(),
                ]);
                return null;
            }

            return $accessTokenEntity;
        } catch (BusinessException $businessException) {
            throw $businessException;
        } catch (Throwable $exception) {
            $this->logger->warning('AuthFlow apikey unexpected exception', [
                'error' => $exception->getMessage(),
            ]);
            return null;
        }
    }

    private function buildUserContextIfNeeded(AccessTokenEntity $accessTokenEntity): ?MagicUserAuthorization
    {
        if ($accessTokenEntity->getType() !== AccessTokenType::User) {
            return null;
        }

        $userId = $accessTokenEntity->getRelationId();
        if ($userId === '') {
            return null;
        }

        $userEntity = $this->magicUserDomainService->getUserById($userId);
        if ($userEntity === null) {
            return null;
        }

        $authorization = MagicUserAuthorization::fromUserEntity($userEntity);
        $authorization->setNickname($userEntity->getNickname());
        $authorization->setAvatar($userEntity->getAvatarUrl());
        $authorization->setStatus((string) $userEntity->getStatus()->value);
        return $authorization;
    }
}
