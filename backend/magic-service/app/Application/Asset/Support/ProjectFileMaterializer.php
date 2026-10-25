<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Asset\Support;

use App\Domain\Asset\Service\AssetDomainService;
use App\Domain\File\Constant\FileUploadBusinessCode;
use App\Domain\File\Service\FileDomainService;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Dtyq\CloudFile\Kernel\Utils\RemoteDownloadSecurityConfig;
use Dtyq\CloudFile\Kernel\Utils\SafeRemoteFileDownloader;

/** 将项目文件转换为资产链路可用的私有桶文件。 */
class ProjectFileMaterializer
{
    private readonly SafeRemoteFileDownloader $downloader;

    public function __construct(
        private readonly ProjectDomainService $projectDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly FileDomainService $fileDomainService,
        private readonly AssetDomainService $assetDomainService,
        ?SafeRemoteFileDownloader $downloader = null,
    ) {
        $this->downloader = $downloader ?? new SafeRemoteFileDownloader(new RemoteDownloadSecurityConfig(
            enabled: true,
            level: RemoteDownloadSecurityConfig::LEVEL_STANDARD,
            maxDownloadSize: 100 * 1024 * 1024,
            maxRedirects: 3,
        ));
    }

    /** 返回已有或新上传文件的 key 与内容哈希；项目或文件不可访问时返回 null。 */
    public function materialize(BaseDataIsolation $dataIsolation, int $projectId, string $projectFilePath): ?array
    {
        $projects = $this->projectDomainService->getProjectsWithAuth(
            [$projectId],
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getCurrentOrganizationCode(),
        );
        if ($projects === []) {
            return null;
        }

        $file = $this->taskFileDomainService->findEntityByRelativePath($projectId, $projectFilePath);
        if (! $file instanceof TaskFileEntity) {
            return null;
        }
        $url = $this->fileDomainService
            ->getLink($dataIsolation->getCurrentOrganizationCode(), $file->getFileKey(), StorageBucketType::SandBox)
            ?->getUrl();
        if ($url === null || $url === '') {
            return null;
        }

        $downloaded = $this->downloader->download($url);
        try {
            $contentHash = hash_file('sha256', $downloaded->getRealPath());
            $existing = $this->assetDomainService->findPersonalAssetByContentHash(
                $dataIsolation->getCurrentUserId(),
                $contentHash,
                true,
            );
            if (
                $existing !== null
                && $existing->getOrganizationCode() === $dataIsolation->getCurrentOrganizationCode()
                && trim((string) $existing->getFileKey()) !== ''
            ) {
                return ['file_key' => $existing->getFileKey(), 'content_hash' => $contentHash];
            }

            $uploadFile = new UploadFile(
                $downloaded->getRealPath(),
                FileUploadBusinessCode::ASSET->getDir(),
                $file->getFileName(),
            );
            $this->fileDomainService->uploadByCredential($dataIsolation->getCurrentOrganizationCode(), $uploadFile);
            return ['file_key' => $uploadFile->getKey(), 'content_hash' => $contentHash];
        } finally {
            @unlink($downloaded->getRealPath());
        }
    }
}
