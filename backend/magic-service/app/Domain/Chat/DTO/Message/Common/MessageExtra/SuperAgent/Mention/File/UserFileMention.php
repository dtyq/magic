<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\File;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\AbstractMention;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MentionType;

final class UserFileMention extends AbstractMention
{
    use MarkdownFileLinkTrait;

    public function getMentionTextStruct(): string
    {
        $data = $this->getAttrs()?->getData();
        return $data instanceof FileData ? $this->formatMarkdownFileReference($data) : '';
    }

    public function getMentionJsonStruct(): array
    {
        $data = $this->getAttrs()?->getData();
        if (! $data instanceof FileData) {
            return [];
        }

        return [
            'type' => MentionType::USER_FILE->value,
            'file_id' => $data->getFileId(),
            'file_name' => $data->getFileName(),
            'file_path' => $data->getFilePath(),
            'file_extension' => $data->getFileExtension(),
        ];
    }
}
