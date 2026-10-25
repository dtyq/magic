<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Common\Share;

use App\Application\SuperMagic\Common\Share\Service\ResourceShareAppService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\SuperMagic\Common\Share\Entity\ResourceShareEntity;
use App\Domain\SuperMagic\Common\Share\Repository\Facade\ResourceShareRepositoryInterface;
use App\Domain\SuperMagic\Common\Share\Service\ResourceShareDomainService;
use App\ErrorCode\ShareErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\TranslatorInterface;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionClass;
use ReflectionProperty;

/** @internal */
final class CancelledShareLifecycleTest extends TestCase
{
    private ?ContainerInterface $previousContainer = null;

    protected function setUp(): void
    {
        $this->previousContainer = ApplicationContext::hasContainer() ? ApplicationContext::getContainer() : null;
        $config = $this->createMock(ConfigInterface::class);
        $config->method('get')->willReturnCallback(static fn (string $key, mixed $default = null): mixed => match ($key) {
            'app_env' => 'test',
            'error_message' => [
                'exception_class' => BusinessException::class,
                'error_code_mapper' => [ShareErrorCode::class => [51300, 51399]],
            ],
            default => $default,
        });
        $translator = $this->createMock(TranslatorInterface::class);
        $translator->method('trans')->willReturnArgument(0);
        $container = $this->createMock(ContainerInterface::class);
        $container->method('get')->willReturnMap([
            [ConfigInterface::class, $config],
            [TranslatorInterface::class, $translator],
        ]);
        ApplicationContext::setContainer($container);
    }

    protected function tearDown(): void
    {
        if ($this->previousContainer !== null) {
            ApplicationContext::setContainer($this->previousContainer);
        } else {
            (new ReflectionProperty(ApplicationContext::class, 'container'))->setValue(null, null);
        }
        parent::tearDown();
    }

    public function testCleanupSucceedsWhenNoActiveShareRemains(): void
    {
        $repository = $this->createMock(ResourceShareRepositoryInterface::class);
        $repository->expects(self::once())->method('getShareByResource')
            ->with('', 'resource-1', 12, false)->willReturn(null);
        $repository->expects(self::never())->method('delete');
        $service = (new ReflectionClass(ResourceShareDomainService::class))->newInstanceWithoutConstructor();
        (new ReflectionProperty($service, 'shareRepository'))->setValue($service, $repository);

        self::assertTrue($service->deleteAllSharesByResource('resource-1', 12));
    }

    public function testCleanupPreservesRealDeletionFailure(): void
    {
        $repository = $this->createMock(ResourceShareRepositoryInterface::class);
        $repository->method('getShareByResource')->with('', 'resource-1', 12, false)
            ->willReturn((new ResourceShareEntity())->setId(123));
        $repository->expects(self::once())->method('delete')->with(123)->willReturn(false);
        $service = (new ReflectionClass(ResourceShareDomainService::class))->newInstanceWithoutConstructor();
        (new ReflectionProperty($service, 'shareRepository'))->setValue($service, $repository);

        self::assertFalse($service->deleteAllSharesByResource('resource-1', 12));
    }

    public function testOwnerCanReadCancelledShareMemberConfiguration(): void
    {
        $service = $this->createMemberService();
        $result = $service->getShareMembers($this->authorization('owner', 'org-1'), 'resource-1', new DataIsolation());
        self::assertSame([], $result->toArray());
    }

    public function testOtherUserCannotReadCancelledShareMembers(): void
    {
        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(ShareErrorCode::PERMISSION_DENIED->value);
        $this->createMemberService()->getShareMembers($this->authorization('other', 'org-1'), 'resource-1', new DataIsolation());
    }

    public function testOtherOrganizationCannotReadCancelledShareMembers(): void
    {
        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(ShareErrorCode::PERMISSION_DENIED->value);
        $this->createMemberService()->getShareMembers($this->authorization('owner', 'org-2'), 'resource-1', new DataIsolation());
    }

    private function createMemberService(): ResourceShareAppService
    {
        $share = (new ResourceShareEntity())->setCreatedUid('owner')->setOrganizationCode('org-1')
            ->setDeletedAt('2026-09-28 20:00:00')->setTargetIdsArray([]);
        $domain = $this->createMock(ResourceShareDomainService::class);
        $domain->expects(self::once())->method('getShareByResourceIdWithTrashed')->with('resource-1')->willReturn($share);
        $domain->expects(self::never())->method('getShareByResourceId');
        $service = (new ReflectionClass(ResourceShareAppService::class))->newInstanceWithoutConstructor();
        (new ReflectionProperty($service, 'shareDomainService'))->setValue($service, $domain);
        return $service;
    }

    private function authorization(string $userId, string $organizationCode): MagicUserAuthorization
    {
        return (new MagicUserAuthorization())->setId($userId)->setOrganizationCode($organizationCode);
    }
}
