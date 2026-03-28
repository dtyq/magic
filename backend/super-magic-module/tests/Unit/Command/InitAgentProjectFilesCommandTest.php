<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Tests\Unit\Command;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use Dtyq\SuperMagic\Command\InitAgentProjectFilesCommand;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskFileRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

class InitAgentProjectFilesCommandTest extends TestCase
{
    private TaskFileRepositoryInterface|MockObject $taskFileRepository;

    private TaskFileDomainService|MockObject $taskFileDomainService;

    private ProjectDomainService|MockObject $projectDomainService;

    private LoggerFactory|MockObject $loggerFactory;

    private LoggerInterface|MockObject $logger;

    private TestableInitAgentProjectFilesCommand $command;

    protected function setUp(): void
    {
        parent::setUp();

        $this->taskFileRepository = $this->createMock(TaskFileRepositoryInterface::class);
        $this->taskFileDomainService = $this->createMock(TaskFileDomainService::class);
        $this->projectDomainService = $this->createMock(ProjectDomainService::class);
        $this->loggerFactory = $this->createMock(LoggerFactory::class);
        $this->logger = $this->createMock(LoggerInterface::class);

        $this->loggerFactory->method('get')->willReturn($this->logger);

        $this->command = new TestableInitAgentProjectFilesCommand(
            $this->taskFileRepository,
            $this->taskFileDomainService,
            $this->projectDomainService,
            $this->loggerFactory
        );
    }

    public function testEnsureMagicDirectoryCreatesDirectoryWhenMissing(): void
    {
        $projectEntity = $this->makeProjectEntity();
        $dataIsolation = DataIsolation::simpleMake('org-current', 'user-1');
        $rootDirEntity = $this->makeDirectoryEntity(1, 'workspace-root/', null, '');
        $magicDirEntity = $this->makeDirectoryEntity(2, 'workspace-root/.magic/', 1, '.magic');

        $index = $this->command->buildProjectFileIndexProxy([$rootDirEntity]);
        $stats = $this->makeStats();

        $this->taskFileDomainService->expects($this->once())
            ->method('createProjectFile')
            ->with(
                $this->callback(fn ($actual) => $actual === $dataIsolation),
                $this->callback(fn ($actual) => $actual === $projectEntity),
                1,
                '.magic',
                true
            )
            ->willReturn($magicDirEntity);

        $result = $this->command->ensureMagicDirectoryProxy(
            $dataIsolation,
            $projectEntity,
            $rootDirEntity,
            $index,
            $stats
        );

        $this->assertSame($magicDirEntity, $result);
        $this->assertSame(1, $stats['created_dirs']);
        $this->assertArrayHasKey('workspace-root/.magic/', $index['byFileKey']);
        $this->assertArrayHasKey(2, $index['byId']);
    }

    public function testMoveSourceFileDeletesExistingTargetFileBeforeMove(): void
    {
        $projectEntity = $this->makeProjectEntity();
        $dataIsolation = DataIsolation::simpleMake('org-current', 'user-1');

        $rootDirEntity = $this->makeDirectoryEntity(1, 'workspace-root/', null, '');
        $magicDirEntity = $this->makeDirectoryEntity(2, 'workspace-root/.magic/', 1, '.magic');
        $sourceFile = $this->makeFileEntity(3, 'workspace-root/AGENTS.md', 1, 'AGENTS.md');
        $existingTarget = $this->makeFileEntity(4, 'workspace-root/.magic/AGENTS.md', 2, 'AGENTS.md');
        $index = $this->command->buildProjectFileIndexProxy([
            $rootDirEntity,
            $magicDirEntity,
            $sourceFile,
            $existingTarget,
        ]);
        $stats = $this->makeStats();

        $this->taskFileDomainService->expects($this->once())
            ->method('deleteProjectFiles')
            ->with('org-project', $existingTarget, 'workspace');

        $this->taskFileDomainService->expects($this->once())
            ->method('moveFile')
            ->with(
                $sourceFile,
                $projectEntity,
                $projectEntity,
                'workspace-root/.magic/AGENTS.md',
                2
            );

        $this->command->moveSourceNodeToTargetProxy(
            $sourceFile,
            2,
            $dataIsolation,
            $projectEntity,
            $index,
            $stats
        );

        $this->assertSame(1, $stats['overwritten']);
        $this->assertSame(1, $stats['moved_files']);
        $this->assertSame($sourceFile, $index['byFileKey']['workspace-root/.magic/AGENTS.md']);
        $this->assertArrayNotHasKey('workspace-root/AGENTS.md', $index['byFileKey']);
    }

    public function testMoveSourceDirectoryDeletesConflictingFileAndMovesChildren(): void
    {
        $projectEntity = $this->makeProjectEntity();
        $dataIsolation = DataIsolation::simpleMake('org-current', 'user-1');

        $rootDirEntity = $this->makeDirectoryEntity(1, 'workspace-root/', null, '');
        $magicDirEntity = $this->makeDirectoryEntity(2, 'workspace-root/.magic/', 1, '.magic');
        $sourceSkillsDir = $this->makeDirectoryEntity(3, 'workspace-root/skills/', 1, 'skills');
        $sourceReadme = $this->makeFileEntity(4, 'workspace-root/skills/readme.md', 3, 'readme.md');
        $conflictingTargetFile = $this->makeFileEntity(5, 'workspace-root/.magic/skills', 2, 'skills');

        $index = $this->command->buildProjectFileIndexProxy([
            $rootDirEntity,
            $magicDirEntity,
            $sourceSkillsDir,
            $sourceReadme,
            $conflictingTargetFile,
        ]);
        $stats = $this->makeStats();

        $this->taskFileDomainService->expects($this->once())
            ->method('deleteProjectFiles')
            ->with('org-project', $conflictingTargetFile, 'workspace');

        $this->taskFileDomainService->expects($this->once())
            ->method('renameFolderFromFileEntity')
            ->with(
                $sourceSkillsDir,
                2,
                'workspace-root/.magic/skills/',
                'workspace',
                100,
                'org-project'
            )
            ->willReturnCallback(function () use ($sourceSkillsDir) {
                $sourceSkillsDir->setFileKey('workspace-root/.magic/skills/');
                $sourceSkillsDir->setParentId(2);
                return $sourceSkillsDir;
            });

        $this->taskFileDomainService->expects($this->once())
            ->method('moveFile')
            ->with(
                $sourceReadme,
                $projectEntity,
                $projectEntity,
                'workspace-root/.magic/skills/readme.md',
                3
            );

        $this->command->moveSourceNodeToTargetProxy(
            $sourceSkillsDir,
            2,
            $dataIsolation,
            $projectEntity,
            $index,
            $stats
        );

        $this->assertSame(1, $stats['overwritten']);
        $this->assertSame(0, $stats['created_dirs']);
        $this->assertSame(1, $stats['moved_files']);
        $this->assertSame($sourceSkillsDir, $index['byFileKey']['workspace-root/.magic/skills/']);
        $this->assertSame($sourceReadme, $index['byFileKey']['workspace-root/.magic/skills/readme.md']);
        $this->assertArrayNotHasKey('workspace-root/skills/', $index['byFileKey']);
        $this->assertArrayNotHasKey('workspace-root/skills/readme.md', $index['byFileKey']);
    }

    private function makeProjectEntity(): ProjectEntity
    {
        return (new ProjectEntity())
            ->setId(100)
            ->setWorkDir('workspace')
            ->setUserOrganizationCode('org-project');
    }

    private function makeDirectoryEntity(int $fileId, string $fileKey, ?int $parentId, string $fileName): TaskFileEntity
    {
        $entity = new TaskFileEntity();
        $entity->setFileId($fileId);
        $entity->setProjectId(100);
        $entity->setUserId('user-1');
        $entity->setOrganizationCode('org-project');
        $entity->setFileName($fileName);
        $entity->setFileKey($fileKey);
        $entity->setIsDirectory(true);
        $entity->setParentId($parentId);
        $entity->setStorageType('workspace');
        $entity->setCreatedAt('2025-01-01 00:00:00');
        $entity->setUpdatedAt('2025-01-01 00:00:00');

        return $entity;
    }

    private function makeFileEntity(int $fileId, string $fileKey, ?int $parentId, string $fileName): TaskFileEntity
    {
        $entity = new TaskFileEntity();
        $entity->setFileId($fileId);
        $entity->setProjectId(100);
        $entity->setUserId('user-1');
        $entity->setOrganizationCode('org-project');
        $entity->setFileName($fileName);
        $entity->setFileKey($fileKey);
        $entity->setFileSize(32);
        $entity->setFileType('markdown');
        $entity->setFileExtension(pathinfo($fileName, PATHINFO_EXTENSION));
        $entity->setIsDirectory(false);
        $entity->setParentId($parentId);
        $entity->setStorageType('workspace');
        $entity->setCreatedAt('2025-01-01 00:00:00');
        $entity->setUpdatedAt('2025-01-01 00:00:00');

        return $entity;
    }

    private function makeStats(): array
    {
        return [
            'processed' => 0,
            'moved_files' => 0,
            'created_dirs' => 0,
            'overwritten' => 0,
            'skipped' => 0,
            'failed' => 0,
        ];
    }
}

class TestableInitAgentProjectFilesCommand extends InitAgentProjectFilesCommand
{
    public function buildProjectFileIndexProxy(array $projectFiles): array
    {
        return $this->buildProjectFileIndex($projectFiles);
    }

    public function ensureMagicDirectoryProxy(
        DataIsolation $dataIsolation,
        ProjectEntity $projectEntity,
        TaskFileEntity $rootDirEntity,
        array &$index,
        array &$stats
    ): TaskFileEntity {
        return $this->ensureMagicDirectory($dataIsolation, $projectEntity, $rootDirEntity, $index, $stats);
    }

    public function moveSourceNodeToTargetProxy(
        TaskFileEntity $sourceEntity,
        int $targetParentId,
        DataIsolation $dataIsolation,
        ProjectEntity $projectEntity,
        array &$index,
        array &$stats
    ): void {
        $this->moveSourceNodeToTarget($sourceEntity, $targetParentId, $dataIsolation, $projectEntity, $index, $stats);
    }
}
