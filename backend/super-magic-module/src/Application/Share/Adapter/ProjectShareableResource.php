<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Share\Adapter;

use App\Application\Chat\Service\MagicUserContactAppService;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\Application\Share\DTO\ShareableResourceDTO;
use Dtyq\SuperMagic\Application\Share\Factory\Facade\ResourceFactoryInterface;
use Dtyq\SuperMagic\Application\SuperAgent\Service\ProjectAppService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Exception;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

/**
 * Project shareable resource adapter.
 */
class ProjectShareableResource implements ResourceFactoryInterface
{
    protected LoggerInterface $logger;

    public function __construct(
        private readonly ProjectAppService $projectAppService,
        private readonly MagicUserContactAppService $magicUserContactAppService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    /**
     * Get project content for sharing.
     */
    public function getResourceContent(string $resourceId, string $userId, string $organizationCode, int $page, int $pageSize): array
    {
        try {
            // Get project details
            $projectEntity = $this->projectAppService->getProjectNotUserId((int) $resourceId);
            if (! $projectEntity) {
                ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, 'project.project_access_denied');
            }

            $userInfo = $this->magicUserContactAppService->getByUserId($projectEntity->getUserId());
            if (! empty($userInfo)) {
                $creator = $userInfo->getNickname();
            } else {
                $creator = '';
            }

            // Get project basic info
            $projectInfo = [
                'project_id' => (string) $projectEntity->getId(),
                'project_name' => $projectEntity->getProjectName(),
                'extended' => [
                    'description' => $projectEntity->getProjectDescription(),
                    'creator' => $creator,
                    'fork_num' => $this->projectAppService->getProjectForkCount($projectEntity->getId())
                ]
            ];

            return [
                'data' => $projectInfo,
            ];
        } catch (Exception $e) {
            $this->logger->error('Failed to get project content: ' . $e->getMessage());
            return [
                'project_info' => null,
                'attachments' => ['total' => 0, 'list' => []],
                'error' => 'Project not found or access denied',
            ];
        }
    }

    /**
     * Get project name.
     */
    public function getResourceName(string $resourceId): string
    {
        try {
            // We need to get project without userId check for share scenarios
            $projectEntity = $this->projectAppService->getProjectNotUserId((int) $resourceId);
            if (! $projectEntity) {
                ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, 'project.project_access_denied');
            }
            return $projectEntity->getProjectName() ?? 'Unknown Project';
        } catch (Exception $e) {
            $this->logger->warning('Failed to get project name: ' . $e->getMessage());
            return 'Unknown Project';
        }
    }

    /**
     * Check if project is shareable.
     */
    public function isResourceShareable(string $resourceId, string $organizationCode): bool
    {
        try {
            // Check if project exists
            $projectEntity = $this->projectAppService->getProjectNotUserId((int) $resourceId);
            if (! $projectEntity) {
                ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, 'project.project_access_denied');
            }
            return true;
        } catch (Exception $e) {
            $this->logger->warning('Project shareability check failed: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Check if user has permission to share the project.
     */
    public function hasSharePermission(string $resourceId, string $userId, string $organizationCode): bool
    {
        try {
            // Check if user can access the project
            $this->projectAppService->getProject((int) $resourceId, $userId);

            return true;
        } catch (Exception $e) {
            $this->logger->warning('Project share permission check failed: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Extend project share list with additional info.
     */
    public function getResourceExtendList(array $list): array
    {
        if (empty($list)) {
            return $list;
        }

        return [];
    }

    /**
     * Create resource DTO.
     */
    public function createResource(string $resourceId, string $userId, string $organizationCode): ShareableResourceDTO
    {
        return new ShareableResourceDTO();
    }
}
