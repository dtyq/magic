<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\File;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\AbstractMention;

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
        return sprintf('@<file_path>%s</file_path>', $filePath);
    }
}
