<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\Directory;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\AbstractMention;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MentionType;

final class DirectoryMention extends AbstractMention
{
    public function getMentionTextStruct(): string
    {
        $data = $this->getAttrs()?->getData();
        if (! $data instanceof DirectoryData) {
            return '';
        }
        $directoryPath = $data->getDirectoryPath();
        $projectType = $data->getDirectoryMetadata()['type'] ?? null;

        return match ($projectType) {
            'design' => sprintf('[@design_canvas_project:%s]', $directoryPath),
            'slide' => sprintf('[@slide_project:%s]', $directoryPath),
            default => $projectType !== null
                ? sprintf('[@project_directory:%s]', $directoryPath)
                : sprintf('[@directory_path:%s]', $directoryPath),
        };
    }

    public function getMentionJsonStruct(): array
    {
        $data = $this->getAttrs()?->getData();
        if (! $data instanceof DirectoryData) {
            return [];
        }

        return [
            'type' => MentionType::PROJECT_DIRECTORY->value,
            'directory_path' => $data->getDirectoryPath(),
            'directory_metadata' => $data->getDirectoryMetadata(),
        ];
    }
}
