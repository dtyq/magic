<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\Attachment;

use App\Domain\File\Service\FileDomainService;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;

abstract class AbstractAttachment implements AttachmentInterface
{
    protected string $chatFileId = '';

    protected string $url = '';

    protected string $name;

    protected string $ext;

    protected int $size;

    protected string $originAttachment = '';

    protected string $fileKey = '';

    private bool $needUpload = false;

    private string $organizationCode = '';

    public function setNeedUpload(bool $needUpload): void
    {
        $this->needUpload = $needUpload;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getFileId(): string
    {
        return $this->chatFileId;
    }

    public function setName(string $name): void
    {
        $name = trim($name);
        if ($name === '') {
            return;
        }
        // 判断是否有扩展名，如果有，则去掉重新添加
        $ext = pathinfo($name, PATHINFO_EXTENSION);
        if ($ext) {
            $name = rtrim($name, '.' . $ext);
        }
        $this->name = $name . ".{$this->ext}";
    }

    public function getChatFileId(): string
    {
        return $this->chatFileId;
    }

    public function setChatFileId(string $chatFileId): void
    {
        $this->chatFileId = $chatFileId;
    }

    public function getUrl(): string
    {
        return $this->url;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getExt(): string
    {
        return $this->ext;
    }

    public function getSize(): int
    {
        return $this->size;
    }

    public function getOriginAttachment(): string
    {
        return $this->originAttachment;
    }

    public function getPath(): string
    {
        if (is_url($this->url)) {
            $parsedUrl = parse_url($this->url);
            $path = $parsedUrl['path'] ?? '';
            return trim($path, '/');
        }
        return '';
    }

    public function toStartArray(): array
    {
        return [
            'name' => $this->name,
            'url' => $this->url,
            'extension' => $this->ext,
            'size' => $this->size,
        ];
    }

    public function toArray(): array
    {
        $this->upload();
        return [
            'name' => $this->name,
            'url' => $this->url,
            'ext' => $this->ext,
            'size' => $this->size,
            'chat_file_id' => $this->chatFileId,
            'file_key' => $this->fileKey,
            'origin_attachment' => $this->originAttachment,
        ];
    }

    public function isImage(): bool
    {
        return in_array(strtolower($this->ext), [
            'jpg', 'jpeg', 'png', 'gif', 'bmp',
        ]);
    }

    public function isVideo(): bool
    {
        return in_array(strtolower($this->ext), [
            'mp4', 'avi', 'mov', 'wmv', 'flv', 'rmvb', 'rm', '3gp', 'mkv', 'webm', 'mpg', 'mpeg', 'm4v', 'vob', 'asf', 'ts', 'swf', 'f4v', 'm2ts', 'divx', 'xvid', 'dat', 'mts', 'ogv', '3g2', 'm2v', 'm2t', 'm2p', 'm2a', 'm1v', 'm1a', 'm1v', 'm1a', 'm4b', 'm4p', 'm4r', 'm4a',
        ]);
    }

    private function upload(): void
    {
        if (! $this->needUpload || empty($this->organizationCode)) {
            return;
        }
        $uploadFile = new UploadFile($this->url, 'flow-execute/external-attachment');
        di(FileDomainService::class)->uploadByCredential($this->organizationCode, $uploadFile);
        $this->fileKey = $uploadFile->getKey();
        $this->needUpload = false;
    }
}
