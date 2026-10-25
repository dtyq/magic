<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service\Mention\Normalizer;

use App\Application\Chat\Service\Mention\AbstractMentionNormalizer;
use App\Application\SuperMagic\Project\Service\PublishedMicroAppFileAccessService;
use App\Application\SuperMagic\Project\Service\PublishedMicroAppResolver;
use App\Application\SuperMagic\Task\Service\ReferencedProjectAccessKind;
use App\Application\SuperMagic\Task\Service\ReferencedProjectCollaborationAccess;
use App\Domain\SuperMagic\Project\Entity\MicroAppEntity;
use App\Domain\SuperMagic\Project\Entity\ValueObject\MicroAppPublishStatus;
use App\Domain\SuperMagic\Project\Repository\Facade\MicroAppRepositoryInterface;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use Hyperf\Logger\LoggerFactory;

/**
 * @micro_app mention 规范化：补全 app_name / project_id。
 *
 * 创建者/协作者走协作权限；组织内发布接收者走独立只读权限。
 * 前端 @微应用 只传 app_id / app_name，project_id 必须在这里补。
 */
class MicroAppMentionNormalizer extends AbstractMentionNormalizer
{
    public function __construct(
        LoggerFactory $loggerFactory,
        private readonly PublishedMicroAppResolver $publishedMicroAppResolver,
        private readonly MicroAppRepositoryInterface $microAppRepository,
        private readonly ReferencedProjectCollaborationAccess $collaborationAccess,
        private readonly PublishedMicroAppFileAccessService $publishedFileAccess,
    ) {
        parent::__construct($loggerFactory);
    }

    public function normalize(array $item, BaseDataIsolation $dataIsolation): array
    {
        // These fields are server-derived. A failed lookup must not retain client hints.
        unset($item['project_id'], $item['access_kind']);
        return parent::normalize($item, $dataIsolation);
    }

    protected function enrich(array $item, BaseDataIsolation $dataIsolation): array
    {
        $rawAppId = $item['app_id'] ?? ($item['id'] ?? null);
        if ((! is_int($rawAppId) && ! is_string($rawAppId))
            || ! preg_match('/^[1-9][0-9]*$/D', (string) $rawAppId)
            || (string) (int) $rawAppId !== (string) $rawAppId) {
            return [];
        }

        $appId = (int) $rawAppId;
        $userId = $dataIsolation->getCurrentUserId();
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();

        $publishedMicroApp = $this->publishedMicroAppResolver->findPublished($appId);
        if ($publishedMicroApp === null) {
            $record = $this->microAppRepository->findById($appId);
            if ($record === null || $record->getPublishStatus() !== MicroAppPublishStatus::Unpublished->value) {
                return [];
            }
            if (! $this->collaborationAccess->canEdit($record->getProjectId(), $userId, $organizationCode)) {
                return [];
            }

            return [
                ...$this->enrichedFields($record, $appId, $item),
                'access_kind' => ReferencedProjectAccessKind::Collaboration->value,
            ];
        }

        [$record] = $publishedMicroApp;

        $accessKind = ReferencedProjectAccessKind::Collaboration;
        if (! $this->collaborationAccess->canAccess($record->getProjectId(), $userId, $organizationCode)) {
            if (! $this->publishedFileAccess->canAccessProject($record->getProjectId(), $userId, $organizationCode)) {
                return [];
            }
            $accessKind = ReferencedProjectAccessKind::PublishedShare;
        }

        return [
            ...$this->enrichedFields($record, $appId, $item),
            'access_kind' => $accessKind->value,
        ];
    }

    /**
     * @param array<string, mixed> $item
     * @return array<string, string>
     */
    private function enrichedFields(MicroAppEntity $record, int $appId, array $item): array
    {
        $appName = $this->publishedMicroAppResolver->getProjectNameFromRecord($record);
        if ($appName === '') {
            $appName = (string) ($item['app_name'] ?? $appId);
        }

        return [
            'app_id' => (string) $appId,
            'app_name' => $appName,
            'project_id' => (string) $record->getProjectId(),
        ];
    }
}
