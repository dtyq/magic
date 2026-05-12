<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Token\Service;

use App\Domain\Token\DTO\ModelGatewayTokenDTO;
use App\Domain\Token\Entity\MagicTokenEntity;
use App\Domain\Token\Entity\ValueObject\MagicTokenType;
use App\Domain\Token\Entity\ValueObject\ModelGatewayTokenExtra;
use App\Domain\Token\Entity\ValueObject\ModelGatewayTokenKey;
use App\Domain\Token\Repository\Facade\MagicTokenRepositoryInterface;
use App\ErrorCode\AuthenticationErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use Carbon\Carbon;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Psr\SimpleCache\CacheInterface;
use Throwable;

/**
 * 模型网关用户 token 领域服务（Domain 才能调用 Repository）。
 */
class ModelGatewayTokenDomainService
{
    /**
     * refresh 幂等缓存时间（秒）：需大于等于宽限期，避免窗口期重复刷新生成多对 token。
     */
    private const int REFRESH_IDEMPOTENCY_TTL = 300;

    /**
     * 旧 token 宽限期（秒）。
     */
    private const int TOKEN_GRACE_PERIOD_SECONDS = 300;

    /**
     * api_key 有效期（秒）。
     */
    private const int API_KEY_EXPIRES_SECONDS = 7200;

    /**
     * refresh_token 有效期（秒）。
     */
    private const int REFRESH_TOKEN_EXPIRES_SECONDS = 604800;

    private const string AUDIT_ACTION_ISSUED = 'issued';

    private const string AUDIT_ACTION_REFRESHED = 'refreshed';

    private LoggerInterface $logger;

    public function __construct(
        private readonly MagicTokenRepositoryInterface $magicTokenRepository,
        private readonly LockerInterface $locker,
        private readonly CacheInterface $cache,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    /**
     * 签发模型网关用户 token 对（api_key + refresh_token）。
     *
     * @param array<string,mixed> $auditContext
     */
    public function issueToken(string $userId, array $auditContext = []): ModelGatewayTokenDTO
    {
        $userId = trim($userId);
        if ($userId === '') {
            ExceptionBuilder::throw(AuthenticationErrorCode::ModelGatewayUnauthorized, 'User ID is empty');
        }

        $idempotencyKey = 'model_gateway_issue_idempotency:' . $userId;
        $tokenDto = $this->executeTokenIssuance($userId, $idempotencyKey);
        $this->audit(self::AUDIT_ACTION_ISSUED, $userId, $auditContext);

        return $tokenDto;
    }

    /**
     * refresh：仅凭 refresh_token 下发新的 api_key，每次都生成新的 refresh_token（双旋转）。
     *
     * @param array<string,mixed> $auditContext
     */
    public function refreshToken(string $refreshToken, array $auditContext = []): ModelGatewayTokenDTO
    {
        $refreshToken = trim($refreshToken);
        if ($refreshToken === '') {
            ExceptionBuilder::throw(AuthenticationErrorCode::ModelGatewayRefreshTokenInvalid, 'Refresh token is empty');
        }

        $idempotencyKey = 'model_gateway_refresh_idempotency:' . md5($refreshToken);
        $cachedDto = $this->tryGetDtoFromIdempotencyCache($idempotencyKey);
        if ($cachedDto !== null) {
            return $cachedDto;
        }

        $refreshTokenHash = $this->hashRefreshToken($refreshToken);
        $refreshEntity = $this->magicTokenRepository->queryTokenEntity(MagicTokenType::RefreshToken, $refreshTokenHash);
        if ($refreshEntity === null) {
            ExceptionBuilder::throw(AuthenticationErrorCode::ModelGatewayRefreshTokenInvalid, 'Refresh token not found in database');
        }

        $refreshExpiredAt = $refreshEntity->getExpiredAt();
        if (! empty($refreshExpiredAt) && Carbon::parse($refreshExpiredAt)->isPast()) {
            ExceptionBuilder::throw(AuthenticationErrorCode::ModelGatewayRefreshTokenInvalid, 'Refresh token has expired');
        }

        $relationUserId = trim($refreshEntity->getTypeRelationValue());
        if ($relationUserId === '') {
            ExceptionBuilder::throw(AuthenticationErrorCode::ModelGatewayRefreshTokenInvalid, 'User ID not found in refresh token relation value');
        }

        $extra = new ModelGatewayTokenExtra($refreshEntity->getExtra()?->toArray() ?? []);
        if (! $extra->isModelGatewayRefreshForType(MagicTokenType::ModelGatewayUser)) {
            ExceptionBuilder::throw(AuthenticationErrorCode::ModelGatewayRefreshTokenMismatch, 'Refresh token metadata does not match model gateway audience');
        }

        $extraUserId = trim((string) $extra->getUserId());
        if ($extraUserId === '' || $extraUserId !== $relationUserId) {
            ExceptionBuilder::throw(AuthenticationErrorCode::ModelGatewayRefreshTokenMismatch, 'Refresh token user_id mismatch');
        }

        $tokenDto = $this->executeTokenIssuance($relationUserId, $idempotencyKey);
        $this->audit(self::AUDIT_ACTION_REFRESHED, $relationUserId, $auditContext);

        return $tokenDto;
    }

    /**
     * 执行通用的 token 签发流程：防抖 -> 加锁 -> 事务 -> 签发新 token & 清理旧 token -> 写入防抖。
     */
    private function executeTokenIssuance(string $userId, string $idempotencyKey): ModelGatewayTokenDTO
    {
        $cachedDto = $this->tryGetDtoFromIdempotencyCache($idempotencyKey);
        if ($cachedDto !== null) {
            return $cachedDto;
        }

        $lockKey = 'model_gateway_refresh_lock:' . $userId;
        $lockOwner = IdGenerator::getUniqueIdSha256();
        if (! $this->locker->spinLock($lockKey, $lockOwner, 5)) {
            ExceptionBuilder::throw(AuthenticationErrorCode::ModelGatewayRefreshTokenInvalid, 'Failed to acquire lock for token refresh');
        }

        try {
            $cachedDto = $this->tryGetDtoFromIdempotencyCache($idempotencyKey);
            return $cachedDto ?? Db::transaction(function () use ($userId, $idempotencyKey) {
                $tokenDto = $this->issueNewTokenPairAndExpireOldTokens($userId);

                $this->cache->set($idempotencyKey, [
                    'api_key' => $tokenDto->getApiKey(),
                    'refresh_token' => $tokenDto->getRefreshToken(),
                    'api_key_expires_at' => $tokenDto->getApiKeyExpiresAt(),
                    'refresh_token_expires_at' => $tokenDto->getRefreshTokenExpiresAt(),
                ], self::REFRESH_IDEMPOTENCY_TTL);

                return $tokenDto;
            });
        } finally {
            $this->locker->release($lockKey, $lockOwner);
        }
    }

    /**
     * 从幂等缓存恢复 DTO（吞掉缓存异常）。
     */
    private function tryGetDtoFromIdempotencyCache(string $idempotencyKey): ?ModelGatewayTokenDTO
    {
        try {
            $cachedResult = $this->cache->get($idempotencyKey);
            if (! is_array($cachedResult)) {
                return null;
            }

            if (
                isset(
                    $cachedResult['api_key'],
                    $cachedResult['refresh_token'],
                    $cachedResult['api_key_expires_at'],
                    $cachedResult['refresh_token_expires_at']
                )
            ) {
                return new ModelGatewayTokenDTO(
                    (string) $cachedResult['api_key'],
                    (string) $cachedResult['refresh_token'],
                    (string) $cachedResult['api_key_expires_at'],
                    (string) $cachedResult['refresh_token_expires_at']
                );
            }

            return null;
        } catch (Throwable) {
            return null;
        }
    }

    /**
     * 签发新的 refresh_token + api_key，并将旧的 token 设置为宽限期后过期。
     */
    private function issueNewTokenPairAndExpireOldTokens(string $userId): ModelGatewayTokenDTO
    {
        $now = Carbon::now();

        [$refreshToken, $refreshTokenStored, $refreshTokenExpiresAt] = $this->createRefreshToken($userId, $now);
        [$apiKey, $apiKeyStored, $apiKeyExpiresAt] = $this->createApiKeyToken($userId, $now);

        $existingRefreshTokens = $this->magicTokenRepository->listTokenEntitiesByTypeAndRelationValue(
            MagicTokenType::RefreshToken,
            $userId
        );
        $this->expireOldModelGatewayRefreshTokens($existingRefreshTokens, $refreshTokenStored);

        $existingModelGatewayUserTokens = $this->magicTokenRepository->listTokenEntitiesByTypeAndRelationValue(
            MagicTokenType::ModelGatewayUser,
            $userId
        );
        $this->expireOldTokens($existingModelGatewayUserTokens, $apiKeyStored);

        return new ModelGatewayTokenDTO($apiKey, $refreshToken, $apiKeyExpiresAt, $refreshTokenExpiresAt);
    }

    private function createApiKeyToken(string $userId, Carbon $now): array
    {
        $expiredAt = $now->copy()->addSeconds(self::API_KEY_EXPIRES_SECONDS)->toDateTimeString();

        $plaintextApiKey = ModelGatewayTokenKey::API_KEY_PREFIX . IdGenerator::getUniqueIdSha256();

        return $this->createTokenEntity(
            $userId,
            MagicTokenType::ModelGatewayUser,
            $expiredAt,
            null,
            true,
            $plaintextApiKey
        );
    }

    private function createRefreshToken(string $userId, Carbon $now): array
    {
        $expiredAt = $now->copy()->addSeconds(self::REFRESH_TOKEN_EXPIRES_SECONDS)->toDateTimeString();

        $extra = new ModelGatewayTokenExtra();
        $extra->setUserId($userId);
        $extra->setAudience(ModelGatewayTokenExtra::MODEL_GATEWAY_AUDIENCE);
        $extra->setTargetTokenType(MagicTokenType::ModelGatewayUser->value);

        return $this->createTokenEntity(
            $userId,
            MagicTokenType::RefreshToken,
            $expiredAt,
            $extra,
            true
        );
    }

    private function createTokenEntity(
        string $relationValue,
        MagicTokenType $tokenType,
        string $expiredAt,
        ?ModelGatewayTokenExtra $extra = null,
        bool $hashForStorage = false,
        ?string $plaintextToken = null
    ): array {
        $plaintextToken ??= IdGenerator::getUniqueIdSha256();
        $storedToken = $hashForStorage ? $this->hashRefreshToken($plaintextToken) : $plaintextToken;

        $entity = new MagicTokenEntity();
        $entity->setType($tokenType);
        $entity->setTypeRelationValue($relationValue);
        $entity->setToken($storedToken);
        $entity->setExpiredAt($expiredAt);
        if ($extra !== null) {
            $entity->setExtra($extra);
        }

        $this->magicTokenRepository->createToken($entity);

        if ($hashForStorage) {
            return [$plaintextToken, $storedToken, $expiredAt];
        }
        return [$plaintextToken, $expiredAt];
    }

    private function hashRefreshToken(string $refreshToken): string
    {
        return ModelGatewayTokenKey::hashForStorage($refreshToken);
    }

    /**
     * @param array<string,mixed> $auditContext
     */
    private function audit(string $action, string $userId, array $auditContext): void
    {
        $this->logger->info('ModelGatewayToken audit', [
            'action' => $action,
            'user_id' => $userId,
            'ip' => (string) ($auditContext['client_ip'] ?? ''),
            'trace_id' => (string) ($auditContext['trace_id'] ?? ''),
            'header_source' => (string) ($auditContext['header_source'] ?? ''),
            'result_code' => 0,
        ]);
    }

    /**
     * @param MagicTokenEntity[] $existingTokens
     */
    private function expireOldModelGatewayRefreshTokens(array $existingTokens, string $currentToken): void
    {
        $gracePeriodExpiresAt = Carbon::now()->addSeconds(self::TOKEN_GRACE_PERIOD_SECONDS)->toDateTimeString();
        $idsToUpdate = [];

        foreach ($existingTokens as $entity) {
            if ($entity->getToken() === $currentToken) {
                continue;
            }

            $extra = new ModelGatewayTokenExtra($entity->getExtra()?->toArray() ?? []);
            if (! $extra->isModelGatewayRefreshForType(MagicTokenType::ModelGatewayUser)) {
                continue;
            }

            $currentExpiresAt = (string) $entity->getExpiredAt();
            if ($currentExpiresAt > $gracePeriodExpiresAt) {
                $idsToUpdate[] = $entity->getId();
            }
        }

        if (! empty($idsToUpdate)) {
            $this->magicTokenRepository->batchUpdateTokenExpiration($idsToUpdate, $gracePeriodExpiresAt);
        }
    }

    /**
     * @param MagicTokenEntity[] $existingTokens
     */
    private function expireOldTokens(array $existingTokens, string $currentToken): void
    {
        $gracePeriodExpiresAt = Carbon::now()->addSeconds(self::TOKEN_GRACE_PERIOD_SECONDS)->toDateTimeString();
        $idsToUpdate = [];

        foreach ($existingTokens as $entity) {
            if ($entity->getToken() === $currentToken) {
                continue;
            }

            $currentExpiresAt = (string) $entity->getExpiredAt();
            if ($currentExpiresAt > $gracePeriodExpiresAt) {
                $idsToUpdate[] = $entity->getId();
            }
        }

        if (! empty($idsToUpdate)) {
            $this->magicTokenRepository->batchUpdateTokenExpiration($idsToUpdate, $gracePeriodExpiresAt);
        }
    }
}
