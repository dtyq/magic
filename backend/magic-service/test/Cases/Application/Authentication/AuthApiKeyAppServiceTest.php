<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Test\Cases\Application\Authentication;

use App\Application\Authentication\Service\AuthApiKeyAppService;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\UserStatus;
use App\Domain\Contact\Entity\ValueObject\UserType;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\ModelGateway\Entity\AccessTokenEntity;
use App\Domain\ModelGateway\Entity\ValueObject\AccessTokenType;
use App\Domain\ModelGateway\Service\AccessTokenDomainService;
use App\Domain\Token\Entity\MagicTokenEntity;
use App\Domain\Token\Entity\ValueObject\MagicTokenType;
use App\Domain\Token\Entity\ValueObject\ModelGatewayTokenKey;
use App\Domain\Token\Repository\Facade\MagicTokenRepositoryInterface;
use App\Infrastructure\Core\Exception\BusinessException;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

/**
 * @internal
 */
class AuthApiKeyAppServiceTest extends TestCase
{
    public function testUserAuthorizationModelGatewayUserHasPriorityOverApiKey(): void
    {
        $userAuthorizationToken = 'mgw_user-token-by-header';
        $legacyApiKey = 'legacy-api-key';
        $userId = 'user_header_1002';

        $accessTokenDomainService = $this->createMock(AccessTokenDomainService::class);
        $accessTokenDomainService->expects($this->once())
            ->method('getByAccessToken')
            ->with($legacyApiKey)
            ->willReturn(null);

        $magicTokenRepository = $this->createMagicTokenRepository([
            $this->buildLookupKey(MagicTokenType::ModelGatewayUser, $userAuthorizationToken) => $this->createMagicTokenEntity(
                MagicTokenType::ModelGatewayUser,
                $userId,
                $userAuthorizationToken
            ),
        ]);

        $magicUserDomainService = $this->createMock(MagicUserDomainService::class);
        $magicUserDomainService->expects($this->once())
            ->method('getUserById')
            ->with($userId)
            ->willReturn($this->createUserEntity($userId));

        $service = $this->createService(
            $accessTokenDomainService,
            $magicUserDomainService,
            $magicTokenRepository
        );

        $result = $service->authenticate([
            'user-authorization' => [$userAuthorizationToken],
            'api-key' => [$legacyApiKey],
        ], []);

        $this->assertNull($result->accessTokenEntity);
        $this->assertNotNull($result->userAuthorization);
        $this->assertSame($userId, $result->userAuthorization->getId());
        $this->assertSame('user-authorization', $result->authSource);
        $this->assertSame(MagicTokenType::ModelGatewayUser->name, $result->authTokenType);
    }

    public function testUserAuthorizationCanAuthenticateLegacyUserToken(): void
    {
        $legacyUserToken = 'legacy-user-token';
        $userId = 'legacy_user_1';

        $accessTokenDomainService = $this->createMock(AccessTokenDomainService::class);
        $accessTokenDomainService->expects($this->never())->method('getByAccessToken');

        $magicTokenRepository = $this->createMagicTokenRepository([
            MagicTokenType::User->value . ':' . MagicTokenEntity::getShortToken($legacyUserToken) => $this->createMagicTokenEntity(
                MagicTokenType::User,
                $userId,
                $legacyUserToken
            ),
        ]);

        $magicUserDomainService = $this->createMock(MagicUserDomainService::class);
        $magicUserDomainService->expects($this->once())
            ->method('getUserById')
            ->with($userId)
            ->willReturn($this->createUserEntity($userId));

        $service = $this->createService(
            $accessTokenDomainService,
            $magicUserDomainService,
            $magicTokenRepository
        );

        $result = $service->authenticate([
            'user-authorization' => [$legacyUserToken],
        ], []);

        $this->assertNull($result->accessTokenEntity);
        $this->assertNotNull($result->userAuthorization);
        $this->assertSame($userId, $result->userAuthorization->getId());
        $this->assertSame('user-authorization', $result->authSource);
        $this->assertSame(MagicTokenType::User->name, $result->authTokenType);
    }

    public function testApiKeyHeaderCanAuthenticateModelGatewayUserToken(): void
    {
        $apiKeyToken = 'mgw_user-token';
        $userId = 'user_1001';

        $accessTokenDomainService = $this->createMock(AccessTokenDomainService::class);
        $accessTokenDomainService->expects($this->never())->method('getByAccessToken');

        $magicTokenRepository = $this->createMagicTokenRepository([
            $this->buildLookupKey(MagicTokenType::ModelGatewayUser, $apiKeyToken) => $this->createMagicTokenEntity(
                MagicTokenType::ModelGatewayUser,
                $userId,
                $apiKeyToken
            ),
        ]);

        $magicUserDomainService = $this->createMock(MagicUserDomainService::class);
        $magicUserDomainService->expects($this->once())
            ->method('getUserById')
            ->with($userId)
            ->willReturn($this->createUserEntity($userId));

        $service = $this->createService(
            $accessTokenDomainService,
            $magicUserDomainService,
            $magicTokenRepository
        );

        $result = $service->authenticate([
            'api-key' => [$apiKeyToken],
        ], []);

        $this->assertNull($result->accessTokenEntity);
        $this->assertNotNull($result->userAuthorization);
        $this->assertSame($userId, $result->userAuthorization->getId());
        $this->assertSame('api-key', $result->authSource);
        $this->assertSame(MagicTokenType::ModelGatewayUser->name, $result->authTokenType);
    }

    public function testApiKeyHeaderCanAuthenticateLegacyUserToken(): void
    {
        $apiKeyToken = 'legacy-user-token-on-api-key';
        $userId = 'legacy_user_api_key_1';

        $accessTokenDomainService = $this->createMock(AccessTokenDomainService::class);
        $accessTokenDomainService->expects($this->once())
            ->method('getByAccessToken')
            ->with($apiKeyToken)
            ->willReturn(null);

        $magicTokenRepository = $this->createMagicTokenRepository([
            MagicTokenType::User->value . ':' . MagicTokenEntity::getShortToken($apiKeyToken) => $this->createMagicTokenEntity(
                MagicTokenType::User,
                $userId,
                $apiKeyToken
            ),
        ]);

        $magicUserDomainService = $this->createMock(MagicUserDomainService::class);
        $magicUserDomainService->expects($this->once())
            ->method('getUserById')
            ->with($userId)
            ->willReturn($this->createUserEntity($userId));

        $service = $this->createService(
            $accessTokenDomainService,
            $magicUserDomainService,
            $magicTokenRepository
        );

        $result = $service->authenticate([
            'api-key' => [$apiKeyToken],
        ], []);

        $this->assertNull($result->accessTokenEntity);
        $this->assertNotNull($result->userAuthorization);
        $this->assertSame($userId, $result->userAuthorization->getId());
        $this->assertSame('api-key', $result->authSource);
        $this->assertSame(MagicTokenType::User->name, $result->authTokenType);
    }

    public function testApiKeyNonPrefixedModelGatewayTokenIsRejected(): void
    {
        $legacyModelGatewayToken = 'legacy-model-gateway-token';

        $accessTokenDomainService = $this->createMock(AccessTokenDomainService::class);
        $accessTokenDomainService->expects($this->once())
            ->method('getByAccessToken')
            ->with($legacyModelGatewayToken)
            ->willReturn(null);

        $magicTokenRepository = $this->createMagicTokenRepository([
            $this->buildLookupKey(MagicTokenType::ModelGatewayUser, $legacyModelGatewayToken) => $this->createMagicTokenEntity(
                MagicTokenType::ModelGatewayUser,
                'user_should_not_be_used',
                $legacyModelGatewayToken
            ),
        ]);

        $magicUserDomainService = $this->createMock(MagicUserDomainService::class);
        $magicUserDomainService->expects($this->never())->method('getUserById');

        $service = $this->createService(
            $accessTokenDomainService,
            $magicUserDomainService,
            $magicTokenRepository
        );

        $this->expectException(BusinessException::class);
        $service->authenticate([
            'api-key' => [$legacyModelGatewayToken],
        ], []);
    }

    public function testInvalidUserAuthorizationDoesNotBlockApiKeyAccessToken(): void
    {
        $legacyApiKey = 'legacy-api-key';

        $accessToken = new AccessTokenEntity();
        $accessToken->setType(AccessTokenType::User);
        $accessToken->setRelationId('legacy_user');

        $accessTokenDomainService = $this->createMock(AccessTokenDomainService::class);
        $accessTokenDomainService->expects($this->once())
            ->method('getByAccessToken')
            ->with($legacyApiKey)
            ->willReturn($accessToken);

        $magicTokenRepository = $this->createMagicTokenRepository();

        $magicUserDomainService = $this->createMock(MagicUserDomainService::class);
        $magicUserDomainService->expects($this->once())
            ->method('getUserById')
            ->with('legacy_user')
            ->willReturn($this->createUserEntity('legacy_user'));

        $service = $this->createService(
            $accessTokenDomainService,
            $magicUserDomainService,
            $magicTokenRepository
        );

        $result = $service->authenticate([
            'user-authorization' => ['invalid-user-token'],
            'api-key' => [$legacyApiKey],
        ], []);

        $this->assertNotNull($result->accessTokenEntity);
        $this->assertNotNull($result->userAuthorization);
        $this->assertSame('api-key', $result->authSource);
        $this->assertSame('AccessToken:user', $result->authTokenType);
    }

    public function testConflictResolvesByPriorityAndWritesAuditLog(): void
    {
        $userAuthorizationToken = 'mgw_user-token-user-a';
        $apiKeyToken = 'mgw_user-token-user-b';
        $userA = 'priority_user_a';
        $userB = 'fallback_user_b';

        $accessTokenDomainService = $this->createMock(AccessTokenDomainService::class);
        $accessTokenDomainService->expects($this->never())->method('getByAccessToken');

        $magicTokenRepository = $this->createMagicTokenRepository([
            $this->buildLookupKey(MagicTokenType::ModelGatewayUser, $userAuthorizationToken) => $this->createMagicTokenEntity(
                MagicTokenType::ModelGatewayUser,
                $userA,
                $userAuthorizationToken
            ),
            $this->buildLookupKey(MagicTokenType::ModelGatewayUser, $apiKeyToken) => $this->createMagicTokenEntity(
                MagicTokenType::ModelGatewayUser,
                $userB,
                $apiKeyToken
            ),
        ]);

        $magicUserDomainService = $this->createMock(MagicUserDomainService::class);
        $magicUserDomainService->method('getUserById')->willReturnCallback(
            fn (string $userId) => $this->createUserEntity($userId)
        );

        $warningAudits = [];
        $logger = $this->createMock(LoggerInterface::class);
        $logger->method('warning')->willReturnCallback(function (...$args) use (&$warningAudits): void {
            $message = (string) ($args[0] ?? '');
            $context = is_array($args[1] ?? null) ? $args[1] : [];
            if ($message === 'ModelGatewayToken audit') {
                $warningAudits[] = $context;
            }
        });
        $logger->method('info');

        $service = $this->createService(
            $accessTokenDomainService,
            $magicUserDomainService,
            $magicTokenRepository,
            $logger
        );

        $result = $service->authenticate([
            'user-authorization' => [$userAuthorizationToken],
            'api-key' => [$apiKeyToken],
        ], []);

        $this->assertNotNull($result->userAuthorization);
        $this->assertSame($userA, $result->userAuthorization->getId());
        $this->assertSame('user-authorization', $result->authSource);

        $conflictAudits = array_values(array_filter($warningAudits, static function (array $audit): bool {
            return ($audit['action'] ?? '') === 'conflict_resolved_by_priority';
        }));
        $this->assertCount(1, $conflictAudits);
        $this->assertSame('user-authorization', $conflictAudits[0]['selected_source'] ?? '');
        $this->assertSame($userA, $conflictAudits[0]['user_id'] ?? '');
        $this->assertSame($userB, $conflictAudits[0]['fallback_user_id'] ?? '');
    }

    public function testAuthenticateThrowsWhenAllMethodsFailed(): void
    {
        $accessTokenDomainService = $this->createMock(AccessTokenDomainService::class);
        $accessTokenDomainService->method('getByAccessToken')->willReturn(null);

        $magicTokenRepository = $this->createMagicTokenRepository();

        $magicUserDomainService = $this->createMock(MagicUserDomainService::class);
        $magicUserDomainService->method('getUserById')->willReturn(null);

        $service = $this->createService(
            $accessTokenDomainService,
            $magicUserDomainService,
            $magicTokenRepository
        );

        $this->expectException(BusinessException::class);
        $service->authenticate([
            'user-authorization' => ['invalid-user-token'],
            'api-key' => ['invalid-api-key'],
        ], []);
    }

    private function createService(
        AccessTokenDomainService $accessTokenDomainService,
        MagicUserDomainService $magicUserDomainService,
        MagicTokenRepositoryInterface $magicTokenRepository,
        ?LoggerInterface $logger = null
    ): AuthApiKeyAppService {
        return new AuthApiKeyAppService(
            $accessTokenDomainService,
            $magicUserDomainService,
            $magicTokenRepository,
            $this->createLoggerFactory($logger)
        );
    }

    /**
     * @param array<string,MagicTokenEntity> $tokenMap
     */
    private function createMagicTokenRepository(array $tokenMap = []): MagicTokenRepositoryInterface
    {
        $repository = $this->createMock(MagicTokenRepositoryInterface::class);
        $repository->method('queryTokenEntity')->willReturnCallback(
            static function (MagicTokenType $type, string $token) use ($tokenMap): ?MagicTokenEntity {
                $key = $type->value . ':' . $token;
                return $tokenMap[$key] ?? null;
            }
        );

        return $repository;
    }

    private function createUserEntity(string $userId): MagicUserEntity
    {
        $entity = new MagicUserEntity();
        $entity->setUserId($userId);
        $entity->setMagicId('magic_' . $userId);
        $entity->setOrganizationCode('org_001');
        $entity->setUserType(UserType::Human);
        $entity->setStatus(UserStatus::Activated);
        $entity->setNickname('nick_' . $userId);
        $entity->setAvatarUrl('https://example.com/avatar.png');

        return $entity;
    }

    private function createMagicTokenEntity(MagicTokenType $type, string $userId, string $token): MagicTokenEntity
    {
        $entity = new MagicTokenEntity();
        $entity->setType($type);
        $entity->setTypeRelationValue($userId);
        $entity->setToken($this->storageTokenForType($type, $token));
        $entity->setExpiredAt('2099-01-01 00:00:00');

        return $entity;
    }

    private function buildLookupKey(MagicTokenType $type, string $token): string
    {
        return $type->value . ':' . $this->storageTokenForType($type, $token);
    }

    private function storageTokenForType(MagicTokenType $type, string $token): string
    {
        if ($type === MagicTokenType::ModelGatewayUser && ModelGatewayTokenKey::isModelGatewayApiKey($token)) {
            return ModelGatewayTokenKey::hashForStorage($token);
        }

        return MagicTokenEntity::getShortToken($token);
    }

    private function createLoggerFactory(?LoggerInterface $logger = null): LoggerFactory
    {
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn($logger ?? $this->createMock(LoggerInterface::class));

        return $loggerFactory;
    }
}
