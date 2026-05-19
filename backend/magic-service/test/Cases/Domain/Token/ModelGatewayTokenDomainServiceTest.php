<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Test\Cases\Domain\Token;

use App\Domain\Token\Entity\MagicTokenEntity;
use App\Domain\Token\Entity\ValueObject\ModelGatewayTokenKey;
use App\Domain\Token\Repository\Facade\MagicTokenRepositoryInterface;
use App\Domain\Token\Service\ModelGatewayTokenDomainService;
use App\Infrastructure\Util\Locker\LockerInterface;
use Carbon\Carbon;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use Psr\SimpleCache\CacheInterface;
use ReflectionClass;
use ReflectionMethod;

/**
 * @internal
 */
class ModelGatewayTokenDomainServiceTest extends TestCase
{
    public function testCreateApiKeyTokenExpirationUsesApiKeyExpiresSecondsConstant(): void
    {
        Carbon::setTestNow('2026-02-26 10:00:00');
        try {
            $capturedExpiredAt = '';
            $capturedStoredToken = '';
            $repository = $this->createMock(MagicTokenRepositoryInterface::class);
            $repository->expects($this->once())
                ->method('createToken')
                ->with($this->callback(static function (MagicTokenEntity $entity) use (&$capturedExpiredAt, &$capturedStoredToken): bool {
                    $capturedExpiredAt = (string) $entity->getExpiredAt();
                    $capturedStoredToken = $entity->getToken();
                    return true;
                }));

            $service = $this->createService($repository);
            [$apiKey, $storedToken] = $this->invokePrivateMethod($service, 'createApiKeyToken', ['user_001', Carbon::now()]);

            $constant = (new ReflectionClass(ModelGatewayTokenDomainService::class))->getConstant('API_KEY_EXPIRES_SECONDS');
            $actualSeconds = Carbon::now()->diffInSeconds(Carbon::parse($capturedExpiredAt), false);
            $this->assertSame($constant, $actualSeconds);
            $this->assertTrue(str_starts_with($apiKey, ModelGatewayTokenKey::API_KEY_PREFIX));
            $this->assertSame(hash('sha256', $apiKey), $storedToken);
            $this->assertSame($capturedStoredToken, $storedToken);
            $this->assertNotSame($apiKey, $storedToken);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function testCreateRefreshTokenExpirationUsesRefreshTokenExpiresSecondsConstant(): void
    {
        Carbon::setTestNow('2026-02-26 10:00:00');
        try {
            $capturedExpiredAt = '';
            $capturedStoredToken = '';
            $repository = $this->createMock(MagicTokenRepositoryInterface::class);
            $repository->expects($this->once())
                ->method('createToken')
                ->with($this->callback(static function (MagicTokenEntity $entity) use (&$capturedExpiredAt, &$capturedStoredToken): bool {
                    $capturedExpiredAt = (string) $entity->getExpiredAt();
                    $capturedStoredToken = $entity->getToken();
                    return true;
                }));

            $service = $this->createService($repository);
            [$refreshToken, $storedToken] = $this->invokePrivateMethod($service, 'createRefreshToken', ['user_001', Carbon::now()]);

            $constant = (new ReflectionClass(ModelGatewayTokenDomainService::class))->getConstant('REFRESH_TOKEN_EXPIRES_SECONDS');
            $actualSeconds = Carbon::now()->diffInSeconds(Carbon::parse($capturedExpiredAt), false);
            $this->assertSame($constant, $actualSeconds);
            $this->assertSame(hash('sha256', $refreshToken), $storedToken);
            $this->assertSame($capturedStoredToken, $storedToken);
            $this->assertNotSame($refreshToken, $storedToken);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function testHashRefreshTokenUsesPureSha256(): void
    {
        $service = $this->createService();
        $method = new ReflectionMethod($service, 'hashRefreshToken');
        $method->setAccessible(true);

        $rawToken = 'refresh_token_raw';
        $actualHash = $method->invoke($service, $rawToken);

        $this->assertSame(hash('sha256', $rawToken), $actualHash);
    }

    private function createService(?MagicTokenRepositoryInterface $repository = null): ModelGatewayTokenDomainService
    {
        $repository ??= $this->createMock(MagicTokenRepositoryInterface::class);
        $locker = $this->createMock(LockerInterface::class);
        $cache = $this->createMock(CacheInterface::class);

        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn($this->createMock(LoggerInterface::class));

        return new ModelGatewayTokenDomainService($repository, $locker, $cache, $loggerFactory);
    }

    /**
     * @param array<int,mixed> $args
     */
    private function invokePrivateMethod(ModelGatewayTokenDomainService $service, string $methodName, array $args): mixed
    {
        $method = new ReflectionMethod($service, $methodName);
        $method->setAccessible(true);
        return $method->invokeArgs($service, $args);
    }
}
