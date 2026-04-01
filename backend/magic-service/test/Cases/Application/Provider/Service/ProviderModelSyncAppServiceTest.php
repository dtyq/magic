<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Provider\Service;

use App\Application\Provider\Service\ProviderModelSyncAppService;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Domain\File\Service\FileDomainService;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Repository\Facade\ProviderConfigRepositoryInterface;
use App\Domain\Provider\Repository\Facade\ProviderModelConfigVersionRepositoryInterface;
use App\Domain\Provider\Repository\Facade\ProviderModelRepositoryInterface;
use App\Domain\Provider\Repository\Facade\ProviderRepositoryInterface;
use App\Domain\Provider\Service\ProviderConfigDomainService;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\Infrastructure\Util\Locker\LockerInterface;
use Hyperf\Guzzle\ClientFactory;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use ReflectionMethod;

/**
 * @internal
 */
class ProviderModelSyncAppServiceTest extends TestCase
{
    public function testGetModelTypesByCategorySeparatesImageAndVideo(): void
    {
        $service = $this->createService();

        $this->assertSame(['image'], $this->invokePrivate($service, 'getModelTypesByCategory', Category::VLM));
        $this->assertSame(['video'], $this->invokePrivate($service, 'getModelTypesByCategory', Category::VGM));
    }

    public function testResolveModelCategoryMapsVideoToVgm(): void
    {
        $service = $this->createService();

        $this->assertSame(Category::VGM, $this->invokePrivate($service, 'resolveModelCategory', 'video'));
        $this->assertSame(Category::VLM, $this->invokePrivate($service, 'resolveModelCategory', 'image'));
        $this->assertSame(Category::LLM, $this->invokePrivate($service, 'resolveModelCategory', 'model'));
    }

    private function createService(): ProviderModelSyncAppService
    {
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn($this->createMock(LoggerInterface::class));

        $providerModelRepository = $this->createMock(ProviderModelRepositoryInterface::class);
        $providerConfigRepository = $this->createMock(ProviderConfigRepositoryInterface::class);
        $providerRepository = $this->createMock(ProviderRepositoryInterface::class);
        $providerModelConfigVersionRepository = $this->createMock(ProviderModelConfigVersionRepositoryInterface::class);
        $locker = $this->createMock(LockerInterface::class);
        $cloudFileRepository = $this->createMock(CloudFileRepositoryInterface::class);

        return new ProviderModelSyncAppService(
            new ProviderConfigDomainService(
                $providerConfigRepository,
                $providerModelRepository,
                $providerRepository,
                $locker,
            ),
            new ProviderModelDomainService(
                $providerModelRepository,
                $providerConfigRepository,
                $providerModelConfigVersionRepository,
            ),
            $this->createMock(ClientFactory::class),
            new FileDomainService($cloudFileRepository),
            $loggerFactory,
        );
    }

    private function invokePrivate(object $object, string $method, mixed ...$args): mixed
    {
        $reflectionMethod = new ReflectionMethod($object, $method);
        $reflectionMethod->setAccessible(true);

        return $reflectionMethod->invoke($object, ...$args);
    }
}
