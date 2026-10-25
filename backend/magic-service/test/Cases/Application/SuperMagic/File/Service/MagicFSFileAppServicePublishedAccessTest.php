<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\File\Service;

use App\Application\SuperMagic\File\Service\MagicFSFileAppService;
use App\Application\SuperMagic\Project\Service\PublishedMicroAppFileAccessService;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Service\MagicFSFileDomainService;
use App\Domain\SuperMagic\Project\Entity\ValueObject\MemberRole;
use App\Infrastructure\SuperMagic\Utils\FileTreeBuilder;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Request\CreateFileRequestDTO;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Request\GetFileTreeRequestDTO;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Request\GetFileVersionsRequestDTO;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Request\ListFilesRequestDTO;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Request\UpdateFileRequestDTO;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use RuntimeException;

/** @internal */
class MagicFSFileAppServicePublishedAccessTest extends TestCase
{
    public function testPublishedReaderCanReadMetadataRootListTreeAndVersions(): void
    {
        [$service, $domain, $policy] = $this->service();
        $root = $this->file(100);
        $root->setIsDirectory(true);
        $child = $this->file(200);
        $domain->method('getFileById')->willReturnCallback(fn ($id) => $id === '100' ? $root : $child);
        $domain->method('getProjectRootFileId')->willReturn(100);
        $domain->method('listFilesByParentId')->willReturn([$child]);
        $domain->method('getFileTree')->willReturn(['root' => $root, 'children' => [$child]]);
        $domain->method('getFileVersionsByIds')->willReturn(['200' => 1]);
        $policy->method('canAccessProject')->willReturn(true);
        $policy->method('canAccessFile')->willReturn(true);
        $auth = $this->authorization();
        self::assertSame('200', $service->getFileInfo($auth, '200')->file->id);
        self::assertSame(1, $service->getFileVersion($auth, '200')->version);
        self::assertSame('100', $service->getProjectRootFileId($auth, '11')['root_file_id']);
        $list = new ListFilesRequestDTO();
        $list->parent_id = '100';
        self::assertSame('200', $service->listFiles($auth, $list)->files[0]->id);
        self::assertSame('100', $service->getFileTree($auth, '100', new GetFileTreeRequestDTO())->file->id);
        $batch = new GetFileVersionsRequestDTO();
        $batch->file_ids = ['200'];
        self::assertSame(['200' => 1], $service->getFileVersions($auth, $batch)->versions);
        self::assertSame([], $service->checkedRoles);
    }

    #[DataProvider('readCollections')]
    public function testPublishedProjectGrantCannotAuthorizeTopicSiblingInReadResults(string $operation): void
    {
        [$service, $domain, $policy] = $this->service();
        $parent = $this->file(100);
        $topic = $this->file(201);
        $topic->setSpaceType('topic');
        $domain->method('getFileById')->willReturnCallback(fn ($id) => $id === '201' ? $topic : $parent);
        $domain->method('listFilesByParentId')->willReturn([$parent, $topic]);
        $domain->method('getFileTree')->willReturn(['root' => $parent, 'children' => [$topic]]);
        $domain->expects(self::never())->method('getFileVersionsByIds');
        $policy->method('canAccessFile')->willReturnCallback(fn ($file) => $file->getSpaceType() === 'project');
        $this->expectExceptionMessage('collaboration required');
        if ($operation === 'batch') {
            $batch = new GetFileVersionsRequestDTO();
            $batch->file_ids = ['100', '201'];
            $service->getFileVersions($this->authorization(), $batch);
        } elseif ($operation === 'list') {
            $list = new ListFilesRequestDTO();
            $list->parent_id = '100';
            $service->listFiles($this->authorization(), $list);
        } else {
            $service->getFileTree($this->authorization(), '100', new GetFileTreeRequestDTO());
        }
    }

    public static function readCollections(): array
    {
        return [['batch'], ['list'], ['tree']];
    }

    #[DataProvider('writes')]
    public function testPublishedGrantNeverParticipatesInWriteAuthorization(string $operation): void
    {
        [$service, $domain, $policy] = $this->service();
        $domain->method('getFileById')->willReturn($this->file(100));
        $domain->expects(self::never())->method('createFile');
        $domain->expects(self::never())->method('updateFile');
        $domain->expects(self::never())->method('deleteFile');
        $policy->expects(self::never())->method('canAccessFile');
        $policy->expects(self::never())->method('canAccessProject');
        $auth = $this->authorization();
        try {
            if ($operation === 'check') {
                $service->checkFileWriteAccess($auth, '100');
            } elseif ($operation === 'delete') {
                $service->deleteFile($auth, '100');
            } elseif ($operation === 'update') {
                $service->updateFile($auth, '100', new UpdateFileRequestDTO());
            } else {
                $request = new CreateFileRequestDTO();
                $request->parent_id = '100';
                $service->createFile($auth, $request);
            }
            self::fail('Write must be denied before domain mutation');
        } catch (RuntimeException $e) {
            self::assertSame('collaboration required', $e->getMessage());
            self::assertSame([MemberRole::EDITOR], $service->checkedRoles);
        }
    }

    public static function writes(): array
    {
        return [['check'], ['create'], ['update'], ['delete']];
    }

    public function testExistingCollaboratorCanStillReadTopicAndPerformWritePreflight(): void
    {
        [$service, $domain, $policy] = $this->service();
        $service->collaborator = true;
        $topic = $this->file(201);
        $topic->setSpaceType('topic');
        $domain->method('getFileById')->willReturn($topic);
        $policy->method('canAccessFile')->willReturn(false);
        self::assertSame('201', $service->getFileInfo($this->authorization(), '201')->file->id);
        $service->checkFileWriteAccess($this->authorization(), '201');
        self::assertSame([MemberRole::VIEWER, MemberRole::EDITOR], $service->checkedRoles);
    }

    private function service(): array
    {
        $domain = $this->createMock(MagicFSFileDomainService::class);
        $policy = $this->createMock(PublishedMicroAppFileAccessService::class);
        $treeBuilder = $this->createMock(FileTreeBuilder::class);
        $treeBuilder->method('buildTree')->willReturn([]);
        $service = new class($domain, $policy, $treeBuilder) extends MagicFSFileAppService {
            public bool $collaborator = false;

            public array $checkedRoles = [];

            public function __construct(MagicFSFileDomainService $domain, PublishedMicroAppFileAccessService $policy, FileTreeBuilder $treeBuilder)
            {
                $this->magicFSFileDomainService = $domain;
                $this->publishedMicroAppFileAccessService = $policy;
                $this->fileTreeBuilder = $treeBuilder;
                $this->logger = new NullLogger();
            }

            protected function assertProjectAccessible(int $projectId, MagicUserAuthorization $authorization, MemberRole $requiredRole): void
            {
                $this->checkedRoles[] = $requiredRole;
                if (! $this->collaborator) {
                    throw new RuntimeException('collaboration required');
                }
            }
        };
        return [$service, $domain, $policy];
    }

    private function file(int $id): TaskFileEntity
    {
        $file = new TaskFileEntity();
        $file->setFileId($id);
        $file->setProjectId(11);
        $file->setOrganizationCode('org');
        $file->setParentId(100);
        return $file;
    }

    private function authorization(): MagicUserAuthorization
    {
        $auth = new MagicUserAuthorization();
        $auth->setId('reader');
        $auth->setOrganizationCode('org');
        return $auth;
    }
}
