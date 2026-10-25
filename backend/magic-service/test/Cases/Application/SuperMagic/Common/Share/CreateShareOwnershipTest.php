<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Common\Share;

use App\Application\Permission\Service\FunctionPermissionAppService;
use App\Application\SuperMagic\Common\Share\Factory\ShareableResourceFactory;
use App\Application\SuperMagic\Common\Share\Service\ResourceShareAppService;
use App\Domain\SuperMagic\Common\Share\Constant\ResourceType;
use App\Domain\SuperMagic\Common\Share\Entity\ResourceShareEntity;
use App\Domain\SuperMagic\Common\Share\Repository\Facade\ResourceShareRepositoryInterface;
use App\Domain\SuperMagic\Common\Share\Service\ResourceShareDomainService;
use App\Domain\SuperMagic\File\Service\FileCollectionDomainService;
use App\ErrorCode\ShareErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SuperMagic\Common\Share\DTO\Request\CreateShareRequestDTO;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\Validation\Contract\ValidatorFactoryInterface;
use Hyperf\Validation\ValidatorFactory;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionClass;
use ReflectionProperty;

/** @internal */
final class CreateShareOwnershipTest extends TestCase
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
            [ValidatorFactoryInterface::class, new ValidatorFactory($translator)],
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

    #[DataProvider('unauthorizedCreateRequests')]
    public function testCreateRejectsOverwriteBeforeResourceOrFileCollectionChanges(string $userId, string $organizationCode, bool $deleted, bool $shareProject): void
    {
        $share = $this->share(ResourceType::Topic, $deleted);
        $before = serialize($share);
        $repository = $this->repository($share);
        $repository->expects(self::never())->method('save');
        $domain = $this->domain($repository);

        $factory = $this->createMock(ShareableResourceFactory::class);
        $factory->expects(self::never())->method('create');
        $collections = $this->createMock(FileCollectionDomainService::class);
        $collections->expects(self::never())->method('createFileCollection');
        $permissions = $this->createMock(FunctionPermissionAppService::class);
        $permissions->method('checkPermission')->willReturn(true);
        $service = (new ReflectionClass(ResourceShareAppService::class))->newInstanceWithoutConstructor();
        foreach ([
            'shareDomainService' => $domain,
            'resourceFactory' => $factory,
            'fileCollectionDomainService' => $collections,
            'functionPermissionAppService' => $permissions,
        ] as $property => $value) {
            (new ReflectionProperty($service, $property))->setValue($service, $value);
        }

        // Reproduce the report's DTO conversion from FileCollection to Project.
        $dto = CreateShareRequestDTO::fromArray([
            'resource_id' => 'resource-1',
            'resource_type' => ResourceType::FileCollection->value,
            'share_project' => $shareProject,
            'share_type' => 4,
            'project_id' => 'attacker-project',
            'resource_name' => 'hijacked',
            'file_ids' => ['attacker-file'],
        ]);
        self::assertSame(($shareProject ? ResourceType::Project : ResourceType::FileCollection)->value, $dto->resourceType);

        try {
            $service->createShare((new MagicUserAuthorization())->setId($userId)->setOrganizationCode($organizationCode), $dto);
            self::fail('An unauthorized share overwrite must be rejected.');
        } catch (BusinessException $exception) {
            self::assertSame(ShareErrorCode::PERMISSION_DENIED->value, $exception->getCode());
        }
        self::assertSame($before, serialize($share));
    }

    public static function unauthorizedCreateRequests(): array
    {
        $requests = [];
        foreach (self::unauthorizedCallers() as $name => $caller) {
            $requests[$name . ' with project conversion'] = [...$caller, true];
            $requests[$name . ' with file collection'] = [...$caller, false];
        }
        return $requests;
    }

    #[DataProvider('unauthorizedCallers')]
    public function testDirectSaveRejectsOverwriteAndRestorationWithoutMutatingEntity(string $userId, string $organizationCode, bool $deleted): void
    {
        $share = $this->share(ResourceType::Topic, $deleted);
        $before = serialize($share);
        $repository = $this->repository($share);
        $repository->expects(self::never())->method('save');

        try {
            $this->domain($repository)->saveShare('resource-1', ResourceType::Project->value, $userId, $organizationCode, [
                'resource_name' => 'hijacked',
                'share_type' => 4,
            ], projectId: 'attacker-project');
            self::fail('An unauthorized domain write must be rejected.');
        } catch (BusinessException $exception) {
            self::assertSame(ShareErrorCode::PERMISSION_DENIED->value, $exception->getCode());
        }
        self::assertSame($before, serialize($share));
    }

    public static function unauthorizedCallers(): array
    {
        return [
            'other user' => ['attacker', 'org-1', false],
            'other organization' => ['owner', 'org-2', false],
            'other user and organization' => ['attacker', 'org-2', false],
            'other user restoring share' => ['attacker', 'org-1', true],
            'other organization restoring share' => ['owner', 'org-2', true],
            'other user and organization restoring share' => ['attacker', 'org-2', true],
        ];
    }

    #[DataProvider('ownerUpdates')]
    public function testOwnerCanUpdateConvertAndRestoreWithoutChangingShareIdentity(ResourceType $previousType, ResourceType $nextType, bool $deleted): void
    {
        $share = $this->share($previousType, $deleted);
        $repository = $this->repository($share);
        $repository->expects(self::once())->method('save')->with(self::identicalTo($share))->willReturnArgument(0);

        $saved = $this->domain($repository)->saveShare('resource-1', $nextType->value, 'owner', 'org-1', [
            'resource_name' => 'updated',
            'share_type' => 4,
        ], projectId: 'owner-project');

        self::assertSame(123, $saved->getId());
        self::assertSame('resource-1', $saved->getResourceId());
        self::assertSame('share-code-1', $saved->getShareCode());
        self::assertSame('2026-09-23 19:36:33', $saved->getCreatedAt());
        self::assertSame('owner', $saved->getCreatedUid());
        self::assertSame('org-1', $saved->getOrganizationCode());
        self::assertSame($nextType->value, $saved->getResourceType());
        self::assertSame('updated', $saved->getResourceName());
        self::assertNull($saved->getDeletedAt());
    }

    public static function ownerUpdates(): array
    {
        return [
            'update project' => [ResourceType::Project, ResourceType::Project, false],
            'collection to project' => [ResourceType::FileCollection, ResourceType::Project, false],
            'project to collection' => [ResourceType::Project, ResourceType::FileCollection, false],
            'restore project' => [ResourceType::Project, ResourceType::Project, true],
            'restore and convert collection' => [ResourceType::FileCollection, ResourceType::Project, true],
        ];
    }

    public function testFirstShareCreationKeepsCallerOwnership(): void
    {
        $repository = $this->repository(null);
        $repository->expects(self::once())->method('save')->willReturnArgument(0);
        $saved = $this->domain($repository)->saveShare('resource-1', ResourceType::ProjectInvitation->value, 'owner', 'org-1', [
            'resource_name' => 'invitation',
            'share_type' => 4,
        ]);
        self::assertSame('owner', $saved->getCreatedUid());
        self::assertSame('org-1', $saved->getOrganizationCode());
        self::assertSame('resource-1', $saved->getShareCode());
    }

    public function testOwnerUpdateRepairsMissingShareCode(): void
    {
        $share = $this->share(ResourceType::Project, false)->setShareCode('');
        $repository = $this->repository($share);
        $repository->expects(self::once())->method('save')->with(self::identicalTo($share))->willReturnArgument(0);

        $saved = $this->domain($repository)->saveShare('resource-1', ResourceType::Project->value, 'owner', 'org-1', [
            'resource_name' => 'updated',
            'share_type' => 4,
        ]);

        self::assertSame('resource-1', $saved->getShareCode());
    }

    private function share(ResourceType $type, bool $deleted): ResourceShareEntity
    {
        return (new ResourceShareEntity())->setId(123)->setResourceId('resource-1')
            ->setResourceType($type->value)->setShareCode('share-code-1')->setResourceName('original')
            ->setCreatedUid('owner')->setOrganizationCode('org-1')->setCreatedAt('2026-09-23 19:36:33')
            ->setDeletedAt($deleted ? '2026-09-28 20:00:00' : null);
    }

    private function repository(?ResourceShareEntity $share): MockObject&ResourceShareRepositoryInterface
    {
        $repository = $this->createMock(ResourceShareRepositoryInterface::class);
        $repository->expects(self::once())->method('getShareByResourceIdWithTrashed')
            ->with('resource-1', null, null)->willReturn($share);
        return $repository;
    }

    private function domain(ResourceShareRepositoryInterface $repository): ResourceShareDomainService
    {
        $service = (new ReflectionClass(ResourceShareDomainService::class))->newInstanceWithoutConstructor();
        (new ReflectionProperty($service, 'shareRepository'))->setValue($service, $repository);
        return $service;
    }
}
