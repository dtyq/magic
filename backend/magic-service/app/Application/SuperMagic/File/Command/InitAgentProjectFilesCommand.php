<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\File\Command;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\SuperMagic\Agent\Entity\SuperMagicAgentEntity;
use App\Domain\SuperMagic\Agent\Factory\SuperMagicAgentFactory;
use App\Domain\SuperMagic\Agent\Repository\Persistence\Model\SuperMagicAgentModel;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Repository\Facade\TaskFileRepositoryInterface;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

#[Command]
class InitAgentProjectFilesCommand extends HyperfCommand
{
    private const PAGE_SIZE = 500;

    private const PROJECT_FILE_PAGE_SIZE = 500;

    private const MAGIC_DIR = '.magic';

    /**
     * @var string[]
     */
    private const ROOT_FILE_NAMES = [
        'AGENTS.md',
        'IDENTITY.md',
        'SKILLS.md',
        'SOUL.md',
        'TOOLS.md',
    ];

    protected ?string $name = 'super-magic:init-agent-project-files';

    protected LoggerInterface $logger;

    public function __construct(
        private readonly TaskFileRepositoryInterface $taskFileRepository,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly ProjectDomainService $projectDomainService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('init-agent-project-files');
        parent::__construct();
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('Migrate root agent files into the .magic directory for each agent project');
        $this->addOption('code', null, InputOption::VALUE_OPTIONAL, 'Specific agent code to process');
    }

    public function handle(): void
    {
        $code = $this->input->getOption('code');

        $this->line('Starting agent .magic files migration...');
        $this->logger->info('Starting agent .magic files migration', ['code' => $code]);

        $stats = [
            'processed' => 0,
            'moved_files' => 0,
            'created_dirs' => 0,
            'overwritten' => 0,
            'skipped' => 0,
            'failed' => 0,
        ];

        try {
            if ($code) {
                $this->processSpecificAgent((string) $code, $stats);
            } else {
                $this->processAllAgents($stats);
            }
        } catch (Throwable $e) {
            $this->error("Command failed: {$e->getMessage()}");
            $this->logger->error('Command failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }

        $this->line('');
        $this->line('Result summary:');
        $this->line("  Processed: {$stats['processed']}");
        $this->line("  Files moved: {$stats['moved_files']}");
        $this->line("  Directories created: {$stats['created_dirs']}");
        $this->line("  Overwritten: {$stats['overwritten']}");
        $this->line("  Skipped: {$stats['skipped']}");
        $this->line("  Failed: {$stats['failed']}");
        $this->line('Done.');

        $this->logger->info('Agent .magic files migration completed', $stats);
    }

    protected function processSpecificAgent(string $code, array &$stats): void
    {
        $model = SuperMagicAgentModel::query()
            ->where('code', $code)
            ->whereNull('deleted_at')
            ->first();

        if (! $model) {
            $this->error("Agent not found: {$code}");
            return;
        }

        $this->processAgent($this->buildEntityFromModel($model), $stats);
    }

    protected function processAllAgents(array &$stats): void
    {
        $lastId = 0;

        while (true) {
            $models = SuperMagicAgentModel::query()
                ->where('id', '>', $lastId)
                ->whereNull('deleted_at')
                ->orderBy('id')
                ->limit(self::PAGE_SIZE)
                ->get();

            if ($models->isEmpty()) {
                break;
            }

            foreach ($models as $model) {
                $lastId = $model->id;
                $this->processAgent($this->buildEntityFromModel($model), $stats);
            }
        }
    }

    protected function processAgent(SuperMagicAgentEntity $entity, array &$stats): void
    {
        ++$stats['processed'];
        $code = $entity->getCode();
        $this->line("Processing agent: {$code} ({$entity->getName()})");

        try {
            $projectId = $entity->getProjectId();
            if (empty($projectId) || $projectId <= 0) {
                $this->skipAgent($entity, $stats, 'project_id is empty');
                return;
            }

            $projectEntity = $this->projectDomainService->getProjectNotUserId($projectId);
            if ($projectEntity === null) {
                $this->skipAgent($entity, $stats, sprintf('project not found: %d', $projectId));
                return;
            }

            $workDir = $projectEntity->getWorkDir();
            if ($workDir === '') {
                $this->skipAgent($entity, $stats, sprintf('project workDir is empty: %d', $projectId));
                return;
            }

            $dataIsolation = DataIsolation::simpleMake(
                $entity->getOrganizationCode(),
                $entity->getCreator()
            );

            $rootDirId = $this->taskFileDomainService->findOrCreateProjectRootDirectory(
                projectId: $projectId,
                workDir: $workDir,
                userId: $entity->getCreator(),
                organizationCode: $entity->getOrganizationCode(),
                projectOrganizationCode: $projectEntity->getUserOrganizationCode(),
            );

            $projectFiles = $this->loadProjectFiles($projectId);
            $index = $this->buildProjectFileIndex($projectFiles);

            $rootDirEntity = $index['byId'][$rootDirId] ?? $this->taskFileRepository->getById($rootDirId);
            if (! $rootDirEntity instanceof TaskFileEntity) {
                throw new RuntimeException(sprintf('Project root directory not found: %d', $projectId));
            }

            if (! isset($index['byId'][$rootDirId])) {
                $this->addEntityToIndex($index, $rootDirEntity);
            }

            $sourceEntries = $this->collectSourceEntries($index, $rootDirEntity->getFileId());
            if ($sourceEntries === []) {
                $this->skipAgent($entity, $stats, 'no root files or skills directory to migrate');
                return;
            }

            $magicDirEntity = $this->ensureMagicDirectory(
                $dataIsolation,
                $projectEntity,
                $rootDirEntity,
                $index,
                $stats
            );

            foreach ($sourceEntries as $sourceEntity) {
                $this->moveSourceNodeToTarget(
                    $sourceEntity,
                    $magicDirEntity->getFileId(),
                    $dataIsolation,
                    $projectEntity,
                    $index,
                    $stats
                );
            }

            $this->line(sprintf(
                '  Migrated root files into .magic for project %d',
                $projectId
            ));
        } catch (Throwable $e) {
            ++$stats['failed'];
            $this->error("  Failed to process agent {$code}: {$e->getMessage()}");
            $this->logger->error('Failed to process agent for .magic migration', [
                'code' => $code,
                'project_id' => $entity->getProjectId(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * @return TaskFileEntity[]
     */
    protected function loadProjectFiles(int $projectId): array
    {
        $page = 1;
        $files = [];

        do {
            $result = $this->taskFileRepository->getByProjectId($projectId, $page, self::PROJECT_FILE_PAGE_SIZE);
            $list = $result['list'] ?? [];
            foreach ($list as $fileEntity) {
                if ($fileEntity instanceof TaskFileEntity) {
                    $files[] = $fileEntity;
                }
            }
            ++$page;
        } while ($list !== []);

        return $files;
    }

    /**
     * @param TaskFileEntity[] $projectFiles
     * @return array{byFileKey: array<string, TaskFileEntity>, byId: array<int, TaskFileEntity>, childrenByParentId: array<int, array<int, TaskFileEntity>>}
     */
    protected function buildProjectFileIndex(array $projectFiles): array
    {
        $index = [
            'byFileKey' => [],
            'byId' => [],
            'childrenByParentId' => [],
        ];

        foreach ($projectFiles as $fileEntity) {
            $this->addEntityToIndex($index, $fileEntity);
        }

        return $index;
    }

    /**
     * @return TaskFileEntity[]
     */
    protected function collectSourceEntries(array $index, int $rootDirId): array
    {
        $sourceEntries = [];

        foreach (self::ROOT_FILE_NAMES as $fileName) {
            $fileEntity = $this->getDirectChildByName($index, $rootDirId, $fileName);
            if ($fileEntity instanceof TaskFileEntity && ! $fileEntity->getIsDirectory()) {
                $sourceEntries[] = $fileEntity;
            }
        }

        $skillsDir = $this->getDirectChildByName($index, $rootDirId, 'skills');
        if ($skillsDir instanceof TaskFileEntity && $skillsDir->getIsDirectory()) {
            $sourceEntries[] = $skillsDir;
        }

        return $sourceEntries;
    }

    protected function ensureMagicDirectory(
        DataIsolation $dataIsolation,
        ProjectEntity $projectEntity,
        TaskFileEntity $rootDirEntity,
        array &$index,
        array &$stats
    ): TaskFileEntity {
        $magicDirEntity = $this->getDirectChildByName($index, $rootDirEntity->getFileId(), self::MAGIC_DIR);
        if ($magicDirEntity instanceof TaskFileEntity) {
            if ($magicDirEntity->getIsDirectory()) {
                return $magicDirEntity;
            }

            $this->deleteTargetEntity($magicDirEntity, $dataIsolation, $projectEntity, $index);
            ++$stats['overwritten'];
        }

        $magicDirEntity = $this->taskFileDomainService->createProjectFile(
            $dataIsolation,
            $projectEntity,
            $rootDirEntity->getFileId(),
            self::MAGIC_DIR,
            true
        );

        $this->addEntityToIndex($index, $magicDirEntity);
        ++$stats['created_dirs'];

        return $magicDirEntity;
    }

    protected function moveSourceNodeToTarget(
        TaskFileEntity $sourceEntity,
        int $targetParentId,
        DataIsolation $dataIsolation,
        ProjectEntity $projectEntity,
        array &$index,
        array &$stats
    ): void {
        $targetParentEntity = $index['byId'][$targetParentId] ?? $this->taskFileRepository->getById($targetParentId);
        if (! $targetParentEntity instanceof TaskFileEntity) {
            throw new RuntimeException(sprintf('Target parent not found: %d', $targetParentId));
        }

        $existingTarget = $this->getDirectChildByName($index, $targetParentId, $sourceEntity->getFileName());
        if ($existingTarget instanceof TaskFileEntity && $existingTarget->getFileId() === $sourceEntity->getFileId()) {
            $existingTarget = null;
        }

        if ($sourceEntity->getIsDirectory()) {
            $targetDirEntity = $this->moveSourceDirectoryToTarget(
                $sourceEntity,
                $targetParentId,
                $dataIsolation,
                $projectEntity,
                $index,
                $stats,
                $existingTarget
            );

            foreach ($this->getChildren($index, $sourceEntity->getFileId()) as $childEntity) {
                $this->moveSourceNodeToTarget(
                    $childEntity,
                    $targetDirEntity->getFileId(),
                    $dataIsolation,
                    $projectEntity,
                    $index,
                    $stats
                );
            }

            if ($targetDirEntity->getFileId() !== $sourceEntity->getFileId()) {
                $this->deleteTargetEntity($sourceEntity, $dataIsolation, $projectEntity, $index);
            }

            return;
        }

        if ($existingTarget instanceof TaskFileEntity) {
            $this->deleteTargetEntity($existingTarget, $dataIsolation, $projectEntity, $index);
            ++$stats['overwritten'];
        }

        $oldFileKey = $sourceEntity->getFileKey();
        $targetPath = rtrim($targetParentEntity->getFileKey(), '/') . '/' . $sourceEntity->getFileName();
        $this->taskFileDomainService->moveFile(
            $sourceEntity,
            $projectEntity,
            $projectEntity,
            $targetPath,
            $targetParentEntity->getFileName(),
            $targetParentId,
            sourceDataIsolation: $dataIsolation
        );
        $sourceEntity->setFileKey($targetPath);
        $sourceEntity->setParentId($targetParentId);
        $sourceEntity->setFileName(basename($targetPath));
        $this->replaceEntityFileKeyInIndex($index, $oldFileKey, $sourceEntity);
        ++$stats['moved_files'];
    }

    protected function moveSourceDirectoryToTarget(
        TaskFileEntity $sourceEntity,
        int $targetParentId,
        DataIsolation $dataIsolation,
        ProjectEntity $projectEntity,
        array &$index,
        array &$stats,
        ?TaskFileEntity $existingTarget
    ): TaskFileEntity {
        if ($existingTarget instanceof TaskFileEntity && ! $existingTarget->getIsDirectory()) {
            $this->deleteTargetEntity($existingTarget, $dataIsolation, $projectEntity, $index);
            $existingTarget = null;
            ++$stats['overwritten'];
        }

        if ($existingTarget instanceof TaskFileEntity) {
            return $existingTarget;
        }

        $targetParentEntity = $index['byId'][$targetParentId] ?? $this->taskFileRepository->getById($targetParentId);
        if (! $targetParentEntity instanceof TaskFileEntity) {
            throw new RuntimeException(sprintf('Target parent not found: %d', $targetParentId));
        }

        $oldFileKey = $sourceEntity->getFileKey();
        $targetPath = rtrim($targetParentEntity->getFileKey(), '/') . '/' . $sourceEntity->getFileName() . '/';
        $movedDirEntity = $this->taskFileDomainService->renameFolderFromFileEntity(
            $sourceEntity,
            $targetParentId,
            $targetPath,
            $projectEntity->getWorkDir(),
            $projectEntity->getId(),
            $projectEntity->getUserOrganizationCode()
        );
        $this->replaceEntityFileKeyInIndex($index, $oldFileKey, $movedDirEntity);

        return $movedDirEntity;
    }

    protected function deleteTargetEntity(
        TaskFileEntity $targetEntity,
        DataIsolation $dataIsolation,
        ProjectEntity $projectEntity,
        array &$index
    ): void {
        if ($targetEntity->getIsDirectory()) {
            $this->taskFileDomainService->deleteDirectoryFiles(
                $dataIsolation,
                $projectEntity->getWorkDir(),
                $projectEntity->getId(),
                $targetEntity->getFileKey(),
                $projectEntity->getUserOrganizationCode()
            );
            $this->removeDirectoryFromIndex($index, $targetEntity->getFileKey());
            return;
        }

        $this->taskFileDomainService->deleteProjectFiles(
            $projectEntity->getUserOrganizationCode(),
            $targetEntity,
            $projectEntity->getWorkDir()
        );
        $this->removeEntityFromIndex($index, $targetEntity);
    }

    protected function addEntityToIndex(array &$index, TaskFileEntity $fileEntity): void
    {
        $index['byFileKey'][$fileEntity->getFileKey()] = $fileEntity;
        $index['byId'][$fileEntity->getFileId()] = $fileEntity;

        $parentId = $fileEntity->getParentId();
        if ($parentId !== null) {
            $index['childrenByParentId'][$parentId][$fileEntity->getFileId()] = $fileEntity;
        }
    }

    protected function replaceEntityFileKeyInIndex(array &$index, string $oldFileKey, TaskFileEntity $fileEntity): void
    {
        if ($oldFileKey !== $fileEntity->getFileKey()) {
            unset($index['byFileKey'][$oldFileKey]);
        }
        $this->addEntityToIndex($index, $fileEntity);
    }

    protected function removeEntityFromIndex(array &$index, TaskFileEntity $fileEntity): void
    {
        unset($index['byFileKey'][$fileEntity->getFileKey()], $index['byId'][$fileEntity->getFileId()]);

        $parentId = $fileEntity->getParentId();
        if ($parentId !== null && isset($index['childrenByParentId'][$parentId][$fileEntity->getFileId()])) {
            unset($index['childrenByParentId'][$parentId][$fileEntity->getFileId()]);
            if ($index['childrenByParentId'][$parentId] === []) {
                unset($index['childrenByParentId'][$parentId]);
            }
        }
    }

    protected function removeDirectoryFromIndex(array &$index, string $directoryKey): void
    {
        foreach (array_keys($index['byFileKey']) as $fileKey) {
            if (str_starts_with($fileKey, $directoryKey)) {
                $entity = $index['byFileKey'][$fileKey];
                $this->removeEntityFromIndex($index, $entity);
            }
        }
    }

    protected function getDirectChildByName(array $index, int $parentId, string $name): ?TaskFileEntity
    {
        foreach ($this->getChildren($index, $parentId) as $childEntity) {
            if ($childEntity->getFileName() === $name) {
                return $childEntity;
            }
        }

        return null;
    }

    /**
     * @return TaskFileEntity[]
     */
    protected function getChildren(array $index, int $parentId): array
    {
        return array_values($index['childrenByParentId'][$parentId] ?? []);
    }

    protected function skipAgent(SuperMagicAgentEntity $entity, array &$stats, string $reason): void
    {
        ++$stats['skipped'];
        $message = sprintf('  Skipped agent %s: %s', $entity->getCode(), $reason);
        $this->line($message);
        $this->logger->info('Skipped agent during .magic migration', [
            'code' => $entity->getCode(),
            'project_id' => $entity->getProjectId(),
            'reason' => $reason,
        ]);
    }

    protected function buildEntityFromModel(object $model): SuperMagicAgentEntity
    {
        return SuperMagicAgentFactory::createEntity($model);
    }
}
