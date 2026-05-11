<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Test\Cases\Interfaces\Authorization\Web;

use App\Domain\Token\Entity\MagicTokenEntity;
use App\Domain\Token\Entity\ValueObject\MagicTokenType;
use App\Domain\Token\Repository\Facade\MagicTokenRepositoryInterface;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Carbon\Carbon;
use Hyperf\Context\ApplicationContext;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;
use ReflectionClass;
use RuntimeException;

/**
 * @internal
 */
class MagicUserAuthorizationTryRenewTokenTest extends TestCase
{
    private ?ContainerInterface $originalContainer = null;

    protected function setUp(): void
    {
        parent::setUp();
        if (ApplicationContext::hasContainer()) {
            $this->originalContainer = ApplicationContext::getContainer();
        }
        Carbon::setTestNow('2026-02-26 10:00:00');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        if ($this->originalContainer instanceof ContainerInterface) {
            ApplicationContext::setContainer($this->originalContainer);
        }
        parent::tearDown();
    }

    public function testRefreshTokenWillNotAutoRenew(): void
    {
        $repository = $this->createMock(MagicTokenRepositoryInterface::class);
        $repository->expects($this->never())->method('refreshTokenExpiration');
        $this->bindTestContainer($repository);

        $tokenEntity = $this->createTokenEntity(MagicTokenType::RefreshToken, '2026-02-27 10:00:00');
        $this->invokeTryRenewToken($tokenEntity);
    }

    public function testModelGatewayUserTokenWillNotAutoRenew(): void
    {
        $repository = $this->createMock(MagicTokenRepositoryInterface::class);
        $repository->expects($this->never())->method('refreshTokenExpiration');
        $this->bindTestContainer($repository);

        $tokenEntity = $this->createTokenEntity(MagicTokenType::ModelGatewayUser, '2026-02-27 10:00:00');
        $this->invokeTryRenewToken($tokenEntity);
    }

    public function testUserTokenWillAutoRenewWhenLessThanSevenDaysLeft(): void
    {
        $repository = $this->createMock(MagicTokenRepositoryInterface::class);
        $repository->expects($this->once())
            ->method('refreshTokenExpiration')
            ->with($this->callback(function (MagicTokenEntity $entity): bool {
                return $entity->getType() === MagicTokenType::User
                    && Carbon::parse((string) $entity->getExpiredAt())->greaterThan(Carbon::now()->copy()->addDays(29));
            }));
        $this->bindTestContainer($repository);

        $tokenEntity = $this->createTokenEntity(MagicTokenType::User, '2026-02-27 10:00:00');
        $this->invokeTryRenewToken($tokenEntity);
    }

    public function testUserTokenWillNotAutoRenewWhenSevenDaysOrMoreLeft(): void
    {
        $repository = $this->createMock(MagicTokenRepositoryInterface::class);
        $repository->expects($this->never())->method('refreshTokenExpiration');
        $this->bindTestContainer($repository);

        $tokenEntity = $this->createTokenEntity(MagicTokenType::User, '2026-03-10 10:00:00');
        $this->invokeTryRenewToken($tokenEntity);
    }

    public function testExpiredTokenWillNotAutoRenew(): void
    {
        $repository = $this->createMock(MagicTokenRepositoryInterface::class);
        $repository->expects($this->never())->method('refreshTokenExpiration');
        $this->bindTestContainer($repository);

        $tokenEntity = $this->createTokenEntity(MagicTokenType::User, '2026-02-20 10:00:00');
        $this->invokeTryRenewToken($tokenEntity);
    }

    private function bindTestContainer(MagicTokenRepositoryInterface $repository): void
    {
        $originContainer = $this->originalContainer;

        $logger = $this->createMock(LoggerInterface::class);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn($logger);

        $container = $this->createMock(ContainerInterface::class);
        $container->method('get')->willReturnCallback(
            static function (string $id) use ($repository, $loggerFactory, $originContainer): mixed {
                if ($id === MagicTokenRepositoryInterface::class) {
                    return $repository;
                }
                if ($id === LoggerFactory::class) {
                    return $loggerFactory;
                }
                if ($originContainer instanceof ContainerInterface) {
                    return $originContainer->get($id);
                }
                throw new RuntimeException("Container binding not found for {$id}");
            }
        );
        $container->method('has')->willReturnCallback(
            static function (string $id) use ($originContainer): bool {
                if (in_array($id, [MagicTokenRepositoryInterface::class, LoggerFactory::class], true)) {
                    return true;
                }
                return $originContainer instanceof ContainerInterface && $originContainer->has($id);
            }
        );

        ApplicationContext::setContainer($container);
    }

    private function invokeTryRenewToken(MagicTokenEntity $tokenEntity): void
    {
        $method = (new ReflectionClass(MagicUserAuthorization::class))->getMethod('tryRenewToken');
        $method->setAccessible(true);
        $method->invoke(null, $tokenEntity);
    }

    private function createTokenEntity(MagicTokenType $tokenType, string $expiredAt): MagicTokenEntity
    {
        $entity = new MagicTokenEntity();
        $entity->setId(1001);
        $entity->setType($tokenType);
        $entity->setTypeRelationValue('user_001');
        $entity->setToken('token_001');
        $entity->setExpiredAt($expiredAt);

        return $entity;
    }
}
