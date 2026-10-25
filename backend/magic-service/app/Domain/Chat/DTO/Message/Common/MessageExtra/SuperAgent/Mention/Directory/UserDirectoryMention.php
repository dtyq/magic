<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\Directory;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\AbstractMention;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\File\MarkdownFileLinkTrait;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MentionType;

final class UserDirectoryMention extends AbstractMention
{
    use MarkdownFileLinkTrait;

    public function getMentionTextStruct(): string
    {
        $data = $this->getAttrs()?->getData();
        return $data instanceof DirectoryData
            ? $this->formatMarkdownPathReference($data->getDirectoryPath(), $data->getDirectoryName(), true)
            : '';
    }

    public function getMentionJsonStruct(): array
    {
        $data = $this->getAttrs()?->getData();
        if (! $data instanceof DirectoryData) {
            return [];
        }

        return [
            'type' => MentionType::USER_DIRECTORY->value,
            'directory_id' => $data->getDirectoryId(),
            'directory_name' => $data->getDirectoryName(),
            'directory_path' => $data->getDirectoryPath(),
        ];
    }
}
