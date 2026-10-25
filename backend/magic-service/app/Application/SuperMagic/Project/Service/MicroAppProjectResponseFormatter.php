<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Project\Service;

use App\Domain\File\Service\FileDomainService;
use App\Domain\SuperMagic\Common\Share\Entity\ResourceShareEntity;
use App\Domain\SuperMagic\Common\Share\Service\ResourceShareDomainService;
use App\Domain\SuperMagic\Project\Entity\MicroAppEntity;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Infrastructure\SuperMagic\Utils\ShareUrlBuilder;
use Throwable;

class MicroAppProjectResponseFormatter
{
    public function __construct(
        private readonly ShareUrlBuilder $shareUrlBuilder,
        private readonly FileDomainService $fileDomainService,
        private readonly ResourceShareDomainService $resourceShareDomainService,
        private readonly MicroAppShareConfig $shareConfig,
    ) {
    }

    public function formatPublishRecord(
        MicroAppEntity $record,
        ?string $projectName = null,
        ?array $extra = null,
        ?int $expireDays = null,
        ?string $expireAt = null,
        ?string $defaultOpenFileId = null,
    ): array {
        return [
            'app_id' => (string) $record->getId(),
            'project_id' => $record->getProjectId(),
            'app_name' => $projectName,
            'resource_id' => $record->getResourceId(),
            'share_id' => $record->getShareId(),
            'share_code' => $record->getShareCode(),
            'share_type' => $record->getShareType(),
            'share_range' => $record->getShareRange(),
            'target_ids' => $record->getTargetIds(),
            'cover_file_key' => $record->getCoverFileKey(),
            'extra' => $this->shareConfig->formatResponseExtra($extra),
            'expire_days' => $expireDays,
            'expire_at' => $expireAt,
            'default_open_file_id' => $defaultOpenFileId,
            'publish_status' => $record->getPublishStatus(),
            'access_url' => $this->shareUrlBuilder->buildMicroAppShareUrl((string) $record->getId()) ?? $record->getAccessUrl(),
            'published_at' => $record->getPublishedAt(),
            'unpublished_at' => $record->getUnpublishedAt(),
        ];
    }

    public function formatMicroApp(MicroAppEntity $record, ProjectEntity $project): array
    {
        $shareEntity = $this->resourceShareDomainService->getShareByResourceIdWithTrashed($record->getResourceId());

        return [
            'app_id' => (string) $record->getId(),
            'project_id' => (string) $record->getProjectId(),
            'organization_code' => $project->getUserOrganizationCode(),
            'project' => $this->formatProject($project),
            'publish' => $this->formatPublishRecord(
                $record,
                $project->getProjectName(),
                $shareEntity?->getExtra(),
                $shareEntity?->getExpireDays(),
                $shareEntity?->getExpireAt(),
                $shareEntity?->getDefaultOpenFileId() !== null ? (string) $shareEntity->getDefaultOpenFileId() : null,
            ),
        ];
    }

    public function formatProject(ProjectEntity $project): array
    {
        return [
            'id' => (string) $project->getId(),
            'workspace_id' => $project->getWorkspaceId() !== null ? (string) $project->getWorkspaceId() : null,
            'project_name' => $project->getProjectName(),
            'project_description' => $project->getProjectDescription(),
            'project_mode' => $project->getProjectMode(),
            'current_topic_id' => $project->getCurrentTopicId() !== null ? (string) $project->getCurrentTopicId() : null,
            'current_topic_status' => $project->getCurrentTopicStatus(),
            'created_at' => $project->getCreatedAt(),
            'updated_at' => $project->getUpdatedAt(),
        ];
    }

    public function formatAppMetadata(MicroAppEntity $record, ProjectEntity $project): array
    {
        $coverKey = $record->getCoverFileKey() ?? '';
        $row = [
            'organization_code' => $project->getUserOrganizationCode(),
            'cover_file_key' => $coverKey,
        ];
        $coverUrls = $this->resolveCoverUrls([$row]);

        return [
            'app_id' => (string) $record->getId(),
            'app_name' => $project->getProjectName(),
            'cover_file_key' => $record->getCoverFileKey(),
            'cover_url' => $coverUrls[$this->coverUrlMapKey($row, $coverKey)] ?? '',
            'publish_status' => $record->getPublishStatus(),
            'updated_at' => $project->getUpdatedAt(),
        ];
    }

    public function formatPublishedResolution(MicroAppEntity $record, ResourceShareEntity $shareEntity): array
    {
        $coverKey = trim((string) ($record->getCoverFileKey() ?? ''));
        $coverRow = [
            'organization_code' => $record->getOrganizationCode(),
            'cover_file_key' => $coverKey,
        ];
        $coverUrls = $this->resolveCoverUrls([$coverRow]);

        return [
            'app_id' => (string) $record->getId(),
            'organization_code' => $record->getOrganizationCode(),
            'resource_id' => $record->getResourceId(),
            'share_code' => $shareEntity->getShareCode(),
            'cover_url' => $coverUrls[$this->coverUrlMapKey($coverRow, $coverKey)] ?? '',
            'extra' => $this->shareConfig->formatResponseExtra($shareEntity->getExtra()),
            'default_open_file_id' => $shareEntity->getDefaultOpenFileId() !== null ? (string) $shareEntity->getDefaultOpenFileId() : null,
        ];
    }

    /**
     * @param array<int,array<string,mixed>> $rows
     * @return array<string,string>
     */
    public function resolveCoverUrls(array $rows): array
    {
        $result = [];
        $grouped = [];
        foreach ($rows as $row) {
            $coverKey = trim((string) ($row['cover_file_key'] ?? ''));
            if ($coverKey === '') {
                continue;
            }

            $organizationCode = (string) ($row['organization_code'] ?? '');
            if ($organizationCode === '') {
                continue;
            }

            $mapKey = $this->coverUrlMapKey($row, $coverKey);
            if (filter_var($coverKey, FILTER_VALIDATE_URL)) {
                $result[$mapKey] = $coverKey;
                continue;
            }

            $grouped[$organizationCode][$coverKey] = $mapKey;
        }

        foreach ($grouped as $organizationCode => $coverKeys) {
            try {
                $links = $this->fileDomainService->getLinks($organizationCode, array_keys($coverKeys));
                foreach ($links as $fileKey => $link) {
                    $mapKey = $coverKeys[$fileKey] ?? null;
                    if ($mapKey !== null) {
                        $result[$mapKey] = $link->getUrl();
                    }
                }
            } catch (Throwable) {
                // A missing cover must not make the complete micro-app list fail.
            }
        }

        return $result;
    }

    /**
     * @param array<string,mixed> $row
     */
    public function coverUrlMapKey(array $row, string $coverKey): string
    {
        return (string) ($row['organization_code'] ?? '') . ':' . $coverKey;
    }
}
