<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\File;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\AbstractMention;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MentionType;

final class ProjectFileMention extends AbstractMention
{
    public function getMentionTextStruct(): string
    {
        // 如果file_path为空，需要根据 file_id拿到 file_key，从 file_key解析到 file_path
        $data = $this->getAttrs()?->getData();
        if (! $data instanceof FileData) {
            return '';
        }
        $filePath = $data->getFilePath() ?? '';
        return sprintf('[@file_path:%s]', $filePath);
    }

    public function getMentionJsonStruct(): array
    {
        $data = $this->getAttrs()?->getData();
        if (! $data instanceof FileData) {
            return [];
        }

        return [
            'type' => MentionType::PROJECT_FILE->value,
            'file_id' => $data->getFileId(),
            'file_key' => $data->getFileKey(),
            'file_path' => $data->getFilePath(),
            'file_name' => $data->getFileName(),
        ];
    }
}
