<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Agent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\File\Service\FileDomainService;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\ZipUtil;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskFileSource;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Infrastructure\Utils\FrontmatterParser;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Keeps .magic/SKILLS.md in sync with the directories installed under .magic/skills/.
 *
 * Triggered after:
 *  - skills are added to an agent
 *  - skills are removed from an agent
 *  - an agent is published (before the workspace is exported)
 */
class SkillsMdSyncService
{
    public const OPERATION_ADD = 'add';

    public const OPERATION_REMOVE = 'remove';

    public const OPERATION_SYNC = 'sync';

    private const TEMP_DIR_BASE = BASE_PATH . '/runtime/skills_md_sync/';

    private const SKILLS_MD_PATH = '.magic/SKILLS.md';

    private const SKILLS_KEY = 'skills';

    private LoggerInterface $logger;

    public function __construct(
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly FileDomainService $fileDomainService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(static::class);
    }

    /**
     * Sync the skills list inside .magic/SKILLS.md.
     *
     * @param string[] $skillNames skill package names to add or remove (ignored for 'sync')
     * @param string $operation one of 'add', 'remove', 'sync'
     */
    public function syncSkillsMd(
        int $projectId,
        ProjectEntity $projectEntity,
        string $organizationCode,
        string $projectOrgCode,
        array $skillNames = [],
        string $operation = self::OPERATION_SYNC
    ): void {
        try {
            $this->doSync($projectId, $projectEntity, $organizationCode, $projectOrgCode, $skillNames, $operation);
        } catch (Throwable $e) {
            $this->logger->error('[SkillsMdSyncService] Failed to sync SKILLS.md', [
                'project_id' => $projectId,
                'operation' => $operation,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Read the current skill list from the SKILLS.md content string.
     *
     * @return string[]
     */
    public function getSkills(string $content): array
    {
        $parsed = FrontmatterParser::parse($content);
        $skills = $parsed['data'][self::SKILLS_KEY] ?? [];

        if (! is_array($skills)) {
            return [];
        }

        return array_values(array_filter($skills, 'is_string'));
    }

    /**
     * Add skill names to the SKILLS.md content. Duplicates are ignored.
     */
    public function addSkills(string $content, array $skillNames): string
    {
        if (empty($skillNames)) {
            return $content;
        }

        $parsed = FrontmatterParser::parse($content);
        $existing = $this->extractSkillsList($parsed['data']);

        $merged = array_unique(array_merge($existing, $skillNames));
        sort($merged);

        $parsed['data'][self::SKILLS_KEY] = $merged;

        return FrontmatterParser::dump($parsed['data'], $parsed['body']);
    }

    /**
     * Remove skill names from the SKILLS.md content.
     */
    public function removeSkills(string $content, array $skillNames): string
    {
        if (empty($skillNames)) {
            return $content;
        }

        $parsed = FrontmatterParser::parse($content);
        $existing = $this->extractSkillsList($parsed['data']);

        $remaining = array_values(array_diff($existing, $skillNames));
        sort($remaining);

        $parsed['data'][self::SKILLS_KEY] = $remaining;

        return FrontmatterParser::dump($parsed['data'], $parsed['body']);
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * @param string[] $skillNames
     */
    private function doSync(
        int $projectId,
        ProjectEntity $projectEntity,
        string $organizationCode,
        string $projectOrgCode,
        array $skillNames,
        string $operation
    ): void {
        $workDir = $projectEntity->getWorkDir();
        if (empty($workDir)) {
            return;
        }

        $fullPrefix = $this->taskFileDomainService->getFullPrefix($projectOrgCode);
        $fileKey = ltrim(
            WorkDirectoryUtil::getFullFileKey($fullPrefix, $workDir, self::SKILLS_MD_PATH),
            '/'
        );

        $entity = $this->taskFileDomainService->getByProjectIdAndFileKey($projectId, $fileKey);

        if ($entity === null) {
            if ($operation === self::OPERATION_ADD && ! empty($skillNames)) {
                $this->createSkillsMd($projectId, $projectEntity, $organizationCode, $skillNames);
                return;
            }

            $this->logger->info('[SkillsMdSyncService] SKILLS.md not found, skipping', [
                'project_id' => $projectId,
                'file_key' => $fileKey,
                'operation' => $operation,
            ]);
            return;
        }

        $currentContent = $this->downloadFileContent($projectOrgCode, $fileKey);
        if ($currentContent === null) {
            $this->logger->warning('[SkillsMdSyncService] Failed to download SKILLS.md content', [
                'project_id' => $projectId,
                'file_key' => $fileKey,
            ]);
            return;
        }

        $newContent = match ($operation) {
            self::OPERATION_ADD => $this->addSkills($currentContent, $skillNames),
            self::OPERATION_REMOVE => $this->removeSkills($currentContent, $skillNames),
            default => $this->rebuildFromInstalledSkills($currentContent, $projectId),
        };

        if ($newContent === $currentContent) {
            $this->logger->info('[SkillsMdSyncService] SKILLS.md already up-to-date', [
                'project_id' => $projectId,
                'operation' => $operation,
            ]);
            return;
        }

        $this->taskFileDomainService->overwriteProjectFileContent($projectEntity, $fileKey, $newContent);

        $this->logger->info('[SkillsMdSyncService] SKILLS.md synced', [
            'project_id' => $projectId,
            'operation' => $operation,
            'skill_count' => count($skillNames),
        ]);
    }

    /**
     * Create a new .magic/SKILLS.md file with the given skill names.
     *
     * @param string[] $skillNames
     */
    private function createSkillsMd(
        int $projectId,
        ProjectEntity $projectEntity,
        string $organizationCode,
        array $skillNames
    ): void {
        $magicDir = $this->taskFileDomainService->findDirectoryByPath($projectId, '.magic');
        if ($magicDir === null) {
            $this->logger->warning('[SkillsMdSyncService] .magic directory not found, cannot create SKILLS.md', [
                'project_id' => $projectId,
            ]);
            return;
        }

        sort($skillNames);
        $content = FrontmatterParser::dump([
            'inherit_defaults' => true,
            self::SKILLS_KEY => $skillNames,
        ]);

        $dataIsolation = DataIsolation::simpleMake($organizationCode, $projectEntity->getUserId());

        $this->taskFileDomainService->createProjectFileWithContent(
            $dataIsolation,
            $projectEntity,
            $magicDir->getFileId(),
            'SKILLS.md',
            $content,
            TaskFileSource::SKILL
        );

        $this->logger->info('[SkillsMdSyncService] SKILLS.md created', [
            'project_id' => $projectId,
            'skill_count' => count($skillNames),
        ]);
    }

    /**
     * Full rebuild: replace the skills list with the directories found under .magic/skills/.
     */
    private function rebuildFromInstalledSkills(string $content, int $projectId): string
    {
        $installedNames = $this->listInstalledSkillNames($projectId);

        $parsed = FrontmatterParser::parse($content);
        $parsed['data'][self::SKILLS_KEY] = $installedNames;

        return FrontmatterParser::dump($parsed['data'], $parsed['body']);
    }

    /**
     * Download a file from the SandBox bucket to a temp path and return its contents as a string.
     */
    private function downloadFileContent(string $organizationCode, string $fileKey): ?string
    {
        $tempDir = self::TEMP_DIR_BASE . IdGenerator::getUniqueId32();
        if (! is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }
        $tempFile = $tempDir . '/SKILLS.md';

        try {
            $this->fileDomainService->downloadByChunks(
                $organizationCode,
                $fileKey,
                $tempFile,
                StorageBucketType::SandBox
            );

            if (! file_exists($tempFile)) {
                return null;
            }

            $content = file_get_contents($tempFile);
            return $content === false ? null : $content;
        } finally {
            ZipUtil::removeDirectory($tempDir);
        }
    }

    /**
     * Return the directory names (= skill package names) directly under .magic/skills/.
     *
     * @return string[]
     */
    private function listInstalledSkillNames(int $projectId): array
    {
        $skillsDir = $this->taskFileDomainService->findDirectoryByPath($projectId, '.magic/skills');
        if ($skillsDir === null) {
            return [];
        }

        $children = $this->taskFileDomainService->getChildrenByParentAndProject(
            $projectId,
            $skillsDir->getFileId()
        );

        $names = [];
        foreach ($children as $child) {
            if ($child->getIsDirectory()) {
                $names[] = $child->getFileName();
            }
        }

        sort($names);
        return $names;
    }

    /**
     * @param array<string, mixed> $data
     * @return string[]
     */
    private function extractSkillsList(array $data): array
    {
        $skills = $data[self::SKILLS_KEY] ?? [];

        if (! is_array($skills)) {
            return [];
        }

        return array_values(array_filter($skills, 'is_string'));
    }
}
