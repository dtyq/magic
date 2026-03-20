<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Share\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

/**
 * Share title response DTO.
 */
class ShareTitleResponseDTO extends AbstractDTO
{
    /**
     * Project name.
     */
    public string $projectName = '';

    /**
     * Resource type (5: Topic, 12: Project, 13: FileCollection).
     */
    public int $resourceType = 0;

    /**
     * Resource name.
     */
    public string $resourceName = '';

    /**
     * Topic name (empty if not a topic share).
     */
    public string $topicName = '';

    /**
     * File names array.
     *
     * @var string[]
     */
    public array $fileNames = [];

    /**
     * Convert to array.
     */
    public function toArray(): array
    {
        return [
            'project_name' => $this->projectName,
            'resource_type' => $this->resourceType,
            'resource_name' => $this->resourceName,
            'topic_name' => $this->topicName,
            'file_names' => $this->fileNames,
        ];
    }
}
