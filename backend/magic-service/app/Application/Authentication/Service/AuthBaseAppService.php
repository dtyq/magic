<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Authentication\Service;

use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\RequestUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\Contract\ConfigInterface;
use Qbhy\HyperfAuth\AuthManager;
use Throwable;

/**
 * 共用的鉴权辅助方法，供具体鉴权 AppService 复用。
 */
class AuthBaseAppService
{
    /**
     * 标准用户鉴权（web guard）。
     *
     * @throws Throwable
     */
    protected function authenticateByWebGuard(): MagicUserAuthorization
    {
        try {
            /* @var MagicUserAuthorization $authorization */
            return di(AuthManager::class)->guard(name: 'web')->user();
        } catch (BusinessException $exception) {
            throw $exception;
        } catch (Throwable $exception) {
            ExceptionBuilder::throw(UserErrorCode::ACCOUNT_ERROR, throwable: $exception);
        }
    }

    /**
     * 兼容旧沙箱鉴权流程，按需返回用户授权对象.
     *
     * @param array<string,mixed> $headers
     *
     * @throws Throwable 当兜底失败时抛出原始异常
     */
    protected function trySandboxCompatibleAuth(
        array $headers,
        ConfigInterface $config,
        MagicUserDomainService $magicUserDomainService,
        Throwable $origin
    ): ?MagicUserAuthorization {
        $sandboxToken = $config->get('super-magic.sandbox.token', '');
        if ($sandboxToken === '') {
            throw $origin;
        }

        $normalized = RequestUtil::normalizeHeaders($headers);

        $sandboxInputToken = RequestUtil::getApiKeyHeader($headers);
        if ($sandboxInputToken === '') {
            $sandboxInputToken = $normalized['token'] ?? '';
        }
        if ($sandboxInputToken === '') {
            $authHeader = $normalized['magic-authorization'] ?? $normalized['authorization'] ?? '';
            if ($authHeader !== '') {
                $sandboxInputToken = stripos($authHeader, 'bearer ') === 0 ? substr($authHeader, 7) : $authHeader;
            }
        }
        if ($sandboxInputToken !== $sandboxToken) {
            throw $origin;
        }

        $magicUserId = $normalized['magic-user-id'] ?? '';
        $organizationCode = $normalized['magic-organization-code'] ?? '';
        if ($magicUserId === '' || $organizationCode === '') {
            return null;
        }

        $userEntity = $magicUserDomainService->getUserById($magicUserId);
        if ($userEntity === null) {
            return null;
        }

        return $this->buildAuthorizationFromUserEntity($userEntity, $organizationCode);
    }

    /**
     * 构造授权对象（补充常用字段），可选覆盖组织编码.
     */
    private function buildAuthorizationFromUserEntity(MagicUserEntity $userEntity, ?string $organizationCode = null): MagicUserAuthorization
    {
        $authorization = MagicUserAuthorization::fromUserEntity($userEntity);
        if ($organizationCode !== null) {
            $authorization->setOrganizationCode($organizationCode);
        }
        $authorization->setNickname($userEntity->getNickname());
        $authorization->setAvatar($userEntity->getAvatarUrl());
        $authorization->setStatus((string) $userEntity->getStatus()->value);
        return $authorization;
    }
}
