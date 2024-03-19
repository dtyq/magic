<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\Attachment;

use App\Domain\File\Service\FileDomainService;
use App\Infrastructure\Util\FileType;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;

/**
 * 本地文件.
 */
class LocalAttachment extends AbstractAttachment
{
    private Attachment $attachment;

    public function __construct(string $path)
    {
        $this->url = '';
        $this->ext = FileType::getType($path);
        $this->size = 0;
        $this->name = '';
        $this->originAttachment = $path;
    }

    public function getAttachment(string $organizationCode): Attachment
    {
        if (isset($this->attachment)) {
            return $this->attachment;
        }
        // 上传文件
        $uploadFile = new UploadFile($this->getOriginAttachment(), 'flow-execute/external/');

        $fileDomainService = di(FileDomainService::class);
        $fileDomainService->uploadByCredential(
            $organizationCode,
            $uploadFile
        );
        $link = $fileDomainService->getLink($organizationCode, $uploadFile->getKey());

        $attachment = new Attachment(
            name: $uploadFile->getName(),
            url: $link->getUrl(),
            ext: $uploadFile->getExt(),
            size: $uploadFile->getSize(),
            chatFileId: '',
            originAttachment: $this->originAttachment
        );
        $this->attachment = $attachment;
        return $attachment;
    }
}
