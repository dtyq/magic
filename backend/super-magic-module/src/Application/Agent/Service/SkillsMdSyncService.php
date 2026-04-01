<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Agent\Service;

use App\Domain\File\Service\FileDomainService;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
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
    private const TEMP_DIR_BASE = BASE_PATH . '/runtime/skills_md_sync/';

    private const SKILLS_MD_PATH = '.magic/SKILLS.md';

    private LoggerInterface $logger;

    public function __construct(
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly FileDomainService $fileDomainService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(static::class);
    }

    /**
     * Sync the skills list inside .magic/SKILLS.md to match the directories
     * currently present under .magic/skills/ in the project file index.
     *
     * Does nothing if .magic/SKILLS.md does not exist in the task file index.
     */
    public function syncSkillsMd(
        int $projectId,
        ProjectEntity $projectEntity,
        string $organizationCode,
        string $projectOrgCode
    ): void {
        try {
            $this->doSync($projectId, $projectEntity, $organizationCode, $projectOrgCode);
        } catch (Throwable $e) {
            // Non-critical: log and continue so the caller is not affected.
            $this->logger->error('[SkillsMdSyncService] Failed to sync SKILLS.md', [
                'project_id' => $projectId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private function doSync(
        int $projectId,
        ProjectEntity $projectEntity,
        string $organizationCode,
        string $projectOrgCode
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

        // Check whether SKILLS.md exists in the task file index.
        $entity = $this->taskFileDomainService->getByProjectIdAndFileKey($projectId, $fileKey);
        if ($entity === null) {
            $this->logger->info('[SkillsMdSyncService] SKILLS.md not found, skipping', [
                'project_id' => $projectId,
                'file_key' => $fileKey,
            ]);
            return;
        }

        // Download current content from cloud storage.
        $currentContent = $this->downloadFileContent($projectOrgCode, $fileKey);
        if ($currentContent === null) {
            $this->logger->warning('[SkillsMdSyncService] Failed to download SKILLS.md content', [
                'project_id' => $projectId,
                'file_key' => $fileKey,
            ]);
            return;
        }

        // Collect installed skill directory names from .magic/skills/.
        $skillNames = $this->listInstalledSkillNames($projectId);

        // Build the updated content.
        $newContent = $this->rebuildSkillsList($currentContent, $skillNames);

        if ($newContent === $currentContent) {
            $this->logger->info('[SkillsMdSyncService] SKILLS.md already up-to-date', [
                'project_id' => $projectId,
            ]);
            return;
        }

        // Write the updated content back to cloud storage and update the DB record.
        $this->taskFileDomainService->overwriteProjectFileContent($projectEntity, $fileKey, $newContent);

        $this->logger->info('[SkillsMdSyncService] SKILLS.md synced', [
            'project_id' => $projectId,
            'skill_names' => $skillNames,
        ]);
    }

    /**
     * Download a file from the SandBox bucket to a temp path and return its contents as a string.
     * Returns null on failure.
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
            if (file_exists($tempFile)) {
                @unlink($tempFile);
            }
            if (is_dir($tempDir)) {
                @rmdir($tempDir);
            }
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
     * Replace the `skills:` block in the YAML frontmatter of $content with $skillNames.
     * Preserves all other frontmatter fields and content after the closing `---`.
     */
    private function rebuildSkillsList(string $content, array $skillNames): string
    {
        // Match the YAML frontmatter block: ---\n...\n---
        if (! preg_match('/^(---\n)([\s\S]*?)(\n---)/', $content, $matches)) {
            return $content;
        }

        $open = $matches[1];       // "---\n"
        $frontmatter = $matches[2]; // inner YAML text
        $close = $matches[3];       // "\n---"
        $rest = substr($content, strlen($matches[0])); // everything after closing ---

        if (empty($skillNames)) {
            $newSkillsBlock = 'skills: []';
        } else {
            $lines = array_map(static fn (string $name) => '  - ' . $name, $skillNames);
            $newSkillsBlock = 'skills:' . "\n" . implode("\n", $lines);
        }

        if (str_contains($frontmatter, 'skills:')) {
            // Replace the existing skills block (multi-line list or inline).
            $newFrontmatter = preg_replace(
                '/^skills:[ \t]*\n?((?:[ \t]+-.+\n?)*|[ \t]*\[\]\n?)/m',
                $newSkillsBlock . "\n",
                $frontmatter
            );
        } else {
            // Append skills block before the closing marker.
            $newFrontmatter = rtrim($frontmatter) . "\n" . $newSkillsBlock;
        }

        return $open . $newFrontmatter . $close . $rest;
    }
}
