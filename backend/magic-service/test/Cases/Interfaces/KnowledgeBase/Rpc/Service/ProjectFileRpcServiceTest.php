<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Interfaces\KnowledgeBase\Rpc\Service;

use App\Application\Kernel\Proxy\FileParserProxy;
use App\Interfaces\KnowledgeBase\Rpc\Service\ProjectFileRpcService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\WorkspaceDomainService;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

/**
 * @internal
 */
class ProjectFileRpcServiceTest extends TestCase
{
    public function testResolveReturnsUnsupportedStatusForUnparsableFile(): void
    {
        $taskFile = $this->createTaskFileEntity('custom.svg', 'svg');
        $taskFileDomainService = $this->createMock(TaskFileDomainService::class);
        $taskFileDomainService->expects($this->once())
            ->method('getById')
            ->with(42)
            ->willReturn($taskFile);
        $taskFileDomainService->expects($this->never())
            ->method('getFilePreSignedUrl');

        $fileParserProxy = $this->createMock(FileParserProxy::class);
        $fileParserProxy->expects($this->never())
            ->method('parse');

        $service = $this->newService(
            $taskFileDomainService,
            $this->createProjectDomainService(),
            $fileParserProxy,
        );

        $result = $service->resolve(['project_file_id' => 42]);

        $this->assertSame(0, $result['code']);
        $this->assertSame('success', $result['message']);
        $this->assertSame('unsupported', $result['data']['status']);
        $this->assertSame('', $result['data']['content']);
        $this->assertSame('', $result['data']['content_hash']);
        $this->assertSame('svg', $result['data']['document_file']['extension']);
        $this->assertSame('/custom.svg', $result['data']['relative_file_path']);
    }

    public function testResolveKeepsActivePayloadForParsableFile(): void
    {
        $taskFile = $this->createTaskFileEntity('notes.mdx', 'mdx');
        $taskFileDomainService = $this->createMock(TaskFileDomainService::class);
        $taskFileDomainService->expects($this->once())
            ->method('getById')
            ->with(42)
            ->willReturn($taskFile);
        $taskFileDomainService->expects($this->once())
            ->method('getFilePreSignedUrl')
            ->with('ORG1', $taskFile)
            ->willReturn('https://download.example.com/notes.mdx');

        $fileParserProxy = $this->createMock(FileParserProxy::class);
        $fileParserProxy->expects($this->once())
            ->method('parse')
            ->with('https://download.example.com/notes.mdx', true)
            ->willReturn("# title\ncontent");

        $service = $this->newService(
            $taskFileDomainService,
            $this->createProjectDomainService(),
            $fileParserProxy,
        );

        $result = $service->resolve(['project_file_id' => 42]);

        $this->assertSame(0, $result['code']);
        $this->assertSame('active', $result['data']['status']);
        $this->assertSame("# title\ncontent", $result['data']['content']);
        $this->assertSame(sha1("# title\ncontent"), $result['data']['content_hash']);
        $this->assertSame('mdx', $result['data']['document_file']['extension']);
    }

    private function newService(
        TaskFileDomainService $taskFileDomainService,
        ProjectDomainService $projectDomainService,
        FileParserProxy $fileParserProxy,
    ): ProjectFileRpcService {
        return new ProjectFileRpcService(
            $taskFileDomainService,
            $projectDomainService,
            $this->createMock(WorkspaceDomainService::class),
            $fileParserProxy,
            $this->createMock(LoggerInterface::class),
        );
    }

    private function createProjectDomainService(): ProjectDomainService
    {
        $service = $this->createMock(ProjectDomainService::class);
        $service->method('getProjectNotUserId')
            ->with(900)
            ->willReturn(
                (new ProjectEntity())
                    ->setId(900)
                    ->setWorkDir('/workspace')
            );

        return $service;
    }

    private function createTaskFileEntity(string $fileName, string $extension): TaskFileEntity
    {
        $entity = new TaskFileEntity();
        $entity->setFileId(42);
        $entity->setOrganizationCode('ORG1');
        $entity->setProjectId(900);
        $entity->setTaskId(700);
        $entity->setTopicId(800);
        $entity->setFileType('file');
        $entity->setFileName($fileName);
        $entity->setFileExtension($extension);
        $entity->setFileKey('/workspace/' . $fileName);
        $entity->setFileSize(1024);
        $entity->setExternalUrl('');
        $entity->setStorageType('workspace');
        $entity->setIsHidden(false);
        $entity->setIsDirectory(false);
        $entity->setSort(1);
        $entity->setParentId(1);
        $entity->setSource(0);
        $entity->setUpdatedAt('2026-04-21 18:10:08');

        return $entity;
    }
}
