<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Project\Service;

use App\Application\SuperMagic\Project\Service\PublishedMicroAppFileAccessService;
use App\Application\SuperMagic\Project\Service\PublishedMicroAppResolver;
use App\Domain\SuperMagic\Common\Share\Constant\ResourceType;
use App\Domain\SuperMagic\Common\Share\Constant\ShareAccessType;
use App\Domain\SuperMagic\Common\Share\Entity\ResourceShareEntity;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Repository\Facade\TaskFileRepositoryInterface;
use App\Domain\SuperMagic\Project\Entity\MicroAppEntity;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Entity\ValueObject\MicroAppPublishStatus;
use App\Domain\SuperMagic\Project\Entity\ValueObject\ProjectMode;
use App\Domain\SuperMagic\Project\Repository\Facade\MicroAppRepositoryInterface;
use App\Domain\SuperMagic\Project\Repository\Facade\ProjectRepositoryInterface;
use App\Domain\SuperMagic\Workspace\Repository\Facade\WorkspaceRepositoryInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** @internal */
class PublishedMicroAppFileAccessServiceTest extends TestCase
{
    #[DataProvider('supportedShares')]
    public function testSupportsSameOrganizationPasswordlessPublication(ShareAccessType $shareType): void
    {
        [$record, $project, $share] = $this->publication();
        $share->setShareType($shareType->value);

        self::assertTrue(PublishedMicroAppFileAccessService::supportsShare($record, $project, $share, 'org'));
    }

    public static function supportedShares(): array
    {
        return [
            'team' => [ShareAccessType::TeamShare],
            'public' => [ShareAccessType::Internet],
        ];
    }

    #[DataProvider('rejectedShares')]
    public function testRejectsUnsupportedOrMismatchedShare(string $target, string $setter, mixed $value): void
    {
        [$record, $project, $share] = $this->publication();
        ${$target}->{$setter}($value);
        self::assertFalse(PublishedMicroAppFileAccessService::supportsShare($record, $project, $share, 'org'));
    }

    public static function rejectedShares(): array
    {
        return [
            'password' => ['share', 'setShareType', ShareAccessType::PasswordProtected->value],
            'password enabled' => ['share', 'setIsPasswordEnabled', true],
            'disabled' => ['share', 'setIsEnabled', false],
            'expired' => ['share', 'setExpireAt', '2000-01-01 00:00:00'],
            'deleted share' => ['share', 'setDeletedAt', '2000-01-01 00:00:00'],
            'file selection' => ['share', 'setShareProject', false],
            'file collection' => ['share', 'setResourceType', ResourceType::FileCollection->value],
            'other project' => ['share', 'setProjectId', '22'],
            'other resource' => ['share', 'setResourceId', 'other-resource'],
            'other share org' => ['share', 'setOrganizationCode', 'other-org'],
            'other record org' => ['record', 'setOrganizationCode', 'other-org'],
            'other project org' => ['project', 'setUserOrganizationCode', 'other-org'],
            'unpublished' => ['record', 'setPublishStatus', 'unpublished'],
            'deleted record' => ['record', 'setDeletedAt', '2000-01-01 00:00:00'],
            'deleted project' => ['project', 'setDeletedAt', '2000-01-01 00:00:00'],
            'record project mismatch' => ['record', 'setProjectId', 22],
        ];
    }

    public function testRequiresExistingShareAudienceAndRechecksOnEveryOperation(): void
    {
        [$record, $project, $share] = $this->publication();
        $resolver = $this->createMock(PublishedMicroAppResolver::class);
        $resolver->method('findPublished')->with(7)->willReturn([$record, $share]);
        $resolver->expects(self::exactly(2))->method('canAccessShare')->with($share, 'reader', 'org')->willReturnOnConsecutiveCalls(true, false);
        $service = $this->service($record, $project, $resolver, $this->createMock(TaskFileRepositoryInterface::class));
        self::assertTrue($service->canAccessProject(11, 'reader', 'org'));
        self::assertFalse($service->canAccessProject(11, 'reader', 'org'));
    }

    public function testSameOrganizationUserCanReadPublicProject(): void
    {
        [$record, $project, $share] = $this->publication();
        $share->setShareType(ShareAccessType::Internet->value);
        $resolver = $this->createMock(PublishedMicroAppResolver::class);
        $resolver->method('findPublished')->with(7)->willReturn([$record, $share]);
        $resolver->expects(self::once())->method('canAccessShare')->with($share, 'reader', 'org')->willReturn(true);

        $service = $this->service($record, $project, $resolver, $this->createMock(TaskFileRepositoryInterface::class));

        self::assertTrue($service->canAccessProject(11, 'reader', 'org'));
        self::assertFalse($service->canAccessProject(11, 'reader', 'other-org'));
    }

    public function testBatchSharesProjectAndParentChecksButRejectsScopeAndActorChanges(): void
    {
        [$record, $project, $share] = $this->publication();
        $resolver = $this->createMock(PublishedMicroAppResolver::class);
        $resolver->expects(self::exactly(2))->method('findPublished')->willReturn([$record, $share]);
        $resolver->expects(self::exactly(2))->method('canAccessShare')->willReturnCallback(fn ($s, $user) => $user === 'reader');
        $files = $this->createMock(TaskFileRepositoryInterface::class);
        $files->expects(self::once())->method('findRootDirectoryByProjectId')->with(11)->willReturn($this->file(100, null, true));
        $files->expects(self::once())->method('getById')->with(101)->willReturn($this->file(101, 100, true));
        $service = $this->service($record, $project, $resolver, $files);
        $context = [];
        for ($id = 200; $id < 300; ++$id) {
            self::assertTrue($service->canAccessFile($this->file($id, 101), 'reader', 'org', $context));
        }
        $topic = $this->file(400, 101);
        $topic->setSpaceType('topic');
        self::assertFalse($service->canAccessFile($topic, 'reader', 'org', $context));
        $internal = $this->file(401, 101);
        $internal->setSpaceType('message');
        self::assertFalse($service->canAccessFile($internal, 'reader', 'org', $context));
        self::assertFalse($service->canAccessFile($this->file(200, 101), 'outsider', 'org', $context));
    }

    #[DataProvider('invalidParents')]
    public function testFileMustReachLiveProjectRoot(string $invalid): void
    {
        [$record, $project, $share] = $this->publication();
        $resolver = $this->createMock(PublishedMicroAppResolver::class);
        $resolver->method('findPublished')->willReturn([$record, $share]);
        $resolver->method('canAccessShare')->willReturn(true);
        $files = $this->createMock(TaskFileRepositoryInterface::class);
        $files->method('findRootDirectoryByProjectId')->willReturn($this->file(100, null, true));
        $parent = $this->file(101, 100, true);
        match ($invalid) {
            'missing' => $parent = null,
            'deleted' => $parent->setDeletedAt('2000-01-01 00:00:00'),
            'foreign' => $parent->setProjectId(22),
            'organization' => $parent->setOrganizationCode('other-org'),
            'topic' => $parent->setSpaceType('topic'),
            'file' => $parent->setIsDirectory(false),
            'cycle' => $parent->setParentId(101),
            'root' => $parent->setParentId(null),
        };
        $files->method('getById')->with(101)->willReturn($parent);
        $service = $this->service($record, $project, $resolver, $files);
        self::assertFalse($service->canAccessFile($this->file(200, 101), 'reader', 'org'));
    }

    public static function invalidParents(): array
    {
        return ['missing' => ['missing'], 'deleted' => ['deleted'], 'foreign project' => ['foreign'], 'other org' => ['organization'], 'topic' => ['topic'], 'regular file' => ['file'], 'cycle' => ['cycle'], 'other root' => ['root']];
    }

    public function testOrdinaryProjectCannotUsePublicationGrant(): void
    {
        [$record, $project, $share] = $this->publication();
        $project->setProjectMode('general');
        $resolver = $this->createMock(PublishedMicroAppResolver::class);
        $resolver->method('findPublished')->willReturn([$record, $share]);
        $resolver->expects(self::never())->method('canAccessShare');
        $service = $this->service($record, $project, $resolver, $this->createMock(TaskFileRepositoryInterface::class));
        self::assertFalse($service->canAccessProject(11, 'reader', 'org'));
    }

    private function publication(): array
    {
        $record = (new MicroAppEntity())->setId(7)->setProjectId(11)->setResourceId('micro-app-resource')->setOrganizationCode('org')->setPublishStatus(MicroAppPublishStatus::Published->value);
        $project = (new ProjectEntity())->setId(11)->setUserOrganizationCode('org')->setProjectMode(ProjectMode::MICRO_APP->value);
        $share = (new ResourceShareEntity())->setResourceId('micro-app-resource')->setProjectId('11')->setOrganizationCode('org')->setResourceType(ResourceType::Project->value)->setShareType(ShareAccessType::TeamShare->value)->setShareProject(true)->setIsEnabled(true);
        return [$record, $project, $share];
    }

    private function file(int $id, ?int $parent, bool $directory = false): TaskFileEntity
    {
        $file = new TaskFileEntity();
        $file->setFileId($id);
        $file->setProjectId(11);
        $file->setOrganizationCode('org');
        $file->setParentId($parent);
        $file->setIsDirectory($directory);
        return $file;
    }

    private function service(MicroAppEntity $record, ProjectEntity $project, PublishedMicroAppResolver $resolver, TaskFileRepositoryInterface $files): PublishedMicroAppFileAccessService
    {
        $records = $this->createMock(MicroAppRepositoryInterface::class);
        $records->method('findByProjectId')->with(11)->willReturn($record);
        $projects = $this->createMock(ProjectRepositoryInterface::class);
        $projects->method('findById')->with(11)->willReturn($project);
        return new PublishedMicroAppFileAccessService($records, $projects, $resolver, $files, $this->createMock(WorkspaceRepositoryInterface::class));
    }
}
