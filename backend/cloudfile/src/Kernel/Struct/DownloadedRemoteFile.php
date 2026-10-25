<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Struct;

/**
 * 远程资源下载后的本地文件信息。
 */
class DownloadedRemoteFile
{
    public function __construct(
        private readonly string $realPath,
        private readonly string $name,
        private readonly string $mimeType,
        private readonly int $size,
    ) {
    }

    /**
     * 获取下载后的本地临时文件路径。
     */
    public function getRealPath(): string
    {
        return $this->realPath;
    }

    /**
     * 获取从远程资源推导出的文件名。
     */
    public function getName(): string
    {
        return $this->name;
    }

    /**
     * 获取本地临时文件的 MIME 类型。
     */
    public function getMimeType(): string
    {
        return $this->mimeType;
    }

    /**
     * 获取本地临时文件大小。
     */
    public function getSize(): int
    {
        return $this->size;
    }
}
