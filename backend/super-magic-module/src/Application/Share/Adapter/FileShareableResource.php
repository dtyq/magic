<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Share\Adapter;

use Dtyq\SuperMagic\Application\Share\DTO\ShareableResourceDTO;
use Dtyq\SuperMagic\Application\Share\Factory\Facade\ResourceFactoryInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

/**
 * File shareable resource adapter.
 */
class FileShareableResource implements ResourceFactoryInterface
{
    protected LoggerInterface $logger;

    public function __construct(
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    /**
     * Get file content for sharing.
     */
    public function getResourceContent(string $resourceId, string $userId, string $organizationCode, int $page, int $pageSize): array
    {
        return [];
    }

    /**
     * Get file name.
     */
    public function getResourceName(string $resourceId): string
    {
        return '';
    }

    /**
     * Check if file is shareable.
     */
    public function isResourceShareable(string $resourceId, string $organizationCode): bool
    {
        return false;
    }

    /**
     * Check if user has permission to share the file.
     */
    public function hasSharePermission(string $resourceId, string $userId, string $organizationCode): bool
    {
        return false;
    }

    /**
     * Extend file share list with additional info.
     */
    public function getResourceExtendList(array $list): array
    {
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
