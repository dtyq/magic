<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\File;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\AbstractMention;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MentionType;

final class UploadFileMention extends AbstractMention
{
    public function getMentionTextStruct(): string
    {
        $data = $this->getAttrs()?->getData();
        if (! $data instanceof FileData) {
            return '';
        }
        // @todo 上传的文件目前直接放在工作区的根目录。后面可能会调整路径，到时再改。
        $filePath = $data->getFileName() ?? '';
        return sprintf('@<file_path>%s</file_path>', $filePath);
    }

    public function getMentionJsonStruct(): array
    {
        $data = $this->getAttrs()?->getData();
        if (! $data instanceof FileData) {
            return [];
        }

        return [
            'type' => MentionType::UPLOAD_FILE->value,
            'file_id' => $data->getFileId(),
            'file_key' => $data->getFileKey(),
            'file_path' => $data->getFilePath(),
            'file_name' => $data->getFileName(),
        ];
    }
}
