<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Skill\Import;

use App\Application\SuperMagic\Skill\DTO\SkillPackageDTO;
use App\Domain\File\Service\FileDomainService;
use App\ErrorCode\SkillErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\SkillUtil;
use App\Infrastructure\Util\ZipUtil;
use FilesystemIterator;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use RuntimeException;

final class SkillPackageParser
{
    private const MAX_FILE_SIZE = 100 * 1024 * 1024;

    private const MAX_EXTRACTED_SIZE = 100 * 1024 * 1024;

    private const TEMP_DIR_BASE = BASE_PATH . '/runtime/skills/';

    public function __construct(
        private readonly FileDomainService $fileDomainService
    ) {
    }

    public function parseByFileKey(string $organizationCode, string $fileKey, bool $includeManifest = false): SkillPackageDTO
    {
        $tempDir = self::TEMP_DIR_BASE . 'skill_download_' . IdGenerator::getUniqueId32();
        if (! is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }

        $filePath = $tempDir . '/' . basename($fileKey);
        try {
            $this->fileDomainService->downloadByChunks(
                $organizationCode,
                $fileKey,
                $filePath,
                StorageBucketType::Private
            );
            if (! file_exists($filePath)) {
                ExceptionBuilder::throw(SkillErrorCode::FILE_DOWNLOAD_FAILED, 'skill.file_download_failed');
            }

            return $this->parseFile($filePath, $fileKey, $includeManifest);
        } finally {
            $this->removeDirectory($tempDir);
        }
    }

    public function parseFile(string $filePath, string $fileKey = '', bool $includeManifest = false): SkillPackageDTO
    {
        $this->validateFile($filePath);
        $extractDir = self::TEMP_DIR_BASE . 'skill_import_' . IdGenerator::getUniqueId32();
        try {
            ZipUtil::extract($filePath, $extractDir, self::MAX_EXTRACTED_SIZE);
            $skillDir = SkillUtil::findSkillMdDirectory($extractDir);
            if ($skillDir === null) {
                ExceptionBuilder::throw(SkillErrorCode::EXTRACTED_DIRECTORY_NOT_FOUND, 'skill.extracted_directory_not_found');
            }

            [$packageName, $packageDescription] = SkillUtil::parseSkillMd($skillDir . '/SKILL.md');
            if (! $includeManifest) {
                return new SkillPackageDTO($fileKey, $packageName, $packageDescription);
            }
            $manifest = [];
            $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($skillDir, FilesystemIterator::SKIP_DOTS));
            foreach ($iterator as $file) {
                if ($file->isLink()) {
                    throw new RuntimeException('Skill packages cannot contain symbolic links');
                }
                if ($file->isFile()) {
                    $manifest[substr($file->getPathname(), strlen($skillDir) + 1)] = hash_file('sha256', $file->getPathname());
                }
            }
            ksort($manifest);
            return new SkillPackageDTO($fileKey, $packageName, $packageDescription, manifest: $manifest, sha256: (string) hash_file('sha256', $filePath));
        } catch (RuntimeException $e) {
            if (str_contains($e->getMessage(), 'exceeds maximum')) {
                ExceptionBuilder::throw(SkillErrorCode::EXTRACTED_FILE_TOO_LARGE, 'skill.extracted_file_too_large');
            }
            throw $e;
        } finally {
            $this->removeDirectory($extractDir);
        }
    }

    private function validateFile(string $filePath): void
    {
        if (! file_exists($filePath)) {
            ExceptionBuilder::throw(SkillErrorCode::FILE_NOT_FOUND, 'skill.file_not_found');
        }

        $extension = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
        if (! in_array($extension, ['skill', 'zip'], true)) {
            ExceptionBuilder::throw(SkillErrorCode::INVALID_FILE_FORMAT, 'skill.invalid_file_format');
        }

        if ((int) filesize($filePath) > self::MAX_FILE_SIZE) {
            ExceptionBuilder::throw(SkillErrorCode::FILE_TOO_LARGE, 'skill.file_too_large', [
                'max_size' => self::MAX_FILE_SIZE,
            ]);
        }
    }

    private function removeDirectory(string $directory): void
    {
        if (! is_dir($directory)) {
            return;
        }
        ZipUtil::removeDirectory($directory);
    }
}
