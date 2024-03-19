<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Struct;

use Dtyq\CloudFile\Kernel\Exceptions\CloudFileException;
use Dtyq\CloudFile\Kernel\Utils\EasyFileTools;
use Dtyq\CloudFile\Kernel\Utils\MimeTypes;

class AppendUploadFile
{
    private bool $isRemote = false;

    private string $remoteUrl = '';

    private string $name;

    private string $dir;

    private string $realPath;

    private string $mimeType;

    private int $size;

    private string $key = '';

    private int $position = 0;

    public function __construct(string $realPath, int $position = 0, string $dir = '', string $name = '')
    {
        $this->dir = $dir;
        $this->name = $name;
        $this->position = $position;
        if (EasyFileTools::isUrl($realPath) || EasyFileTools::isBase64Image($realPath)) {
            $this->isRemote = true;
            $this->remoteUrl = $realPath;
            return;
        }
        if (! is_file($realPath)) {
            throw new CloudFileException(sprintf('File not exists: %s', $realPath));
        }
        $this->realPath = $realPath;
        $this->size = filesize($realPath);
        $options = pathinfo($realPath);

        $this->name = $name ?: $options['basename'];
    }

    public function getKeyPath(): string
    {
        $prefix = '';
        if (! empty($this->dir)) {
            $prefix .= rtrim($this->dir, '/') . '/';
        }

        $prefix .= $this->name;
        return $prefix;
    }

    public function getDir(): string
    {
        return $this->dir;
    }

    public function setDir(string $dir): void
    {
        $this->dir = $dir;
    }

    public function getMimeType(): string
    {
        if (empty($this->mimeType)) {
            if ($this->isRemote) {
                $this->downloadRemoteUrl();
            } else {
                $this->mimeType = mime_content_type($this->realPath);
            }
        }
        return $this->mimeType;
    }

    public function getName(): string
    {
        if (empty($this->name) && $this->isRemote) {
            $this->downloadRemoteUrl();
        }
        return $this->name;
    }

    public function getRealPath(): string
    {
        if (empty($this->realPath) && $this->isRemote) {
            $this->downloadRemoteUrl();
        }
        return $this->realPath;
    }

    public function rename(): void
    {
        $this->name = uniqid() . '.' . pathinfo($this->name, PATHINFO_EXTENSION);
    }

    public function release(): void
    {
        if ($this->isRemote) {
            @unlink($this->realPath);
        }
    }

    public function getKey(): string
    {
        return $this->key;
    }

    public function setKey(string $key): void
    {
        $this->key = $key;
    }

    public function getExt(): string
    {
        return MimeTypes::getExtension($this->getMimeType());
    }

    public function getSize(): int
    {
        return $this->size;
    }

    public function getPosition(): int
    {
        return $this->position;
    }

    public function setPosition(int $position): void
    {
        $this->position = $position;
    }

    private function downloadRemoteUrl(): void
    {
        if (isset($this->realPath)) {
            return;
        }

        // 创建一个临时文件
        $tempFile = tempnam(sys_get_temp_dir(), 'cloud—file-tmp-');
        // 打开 URL 以便读取，然后打开临时文件以便写入
        $inputStream = fopen($this->remoteUrl, 'r');
        if (! $inputStream) {
            throw new CloudFileException(sprintf('Download remote file failed: %s', $this->remoteUrl));
        }
        $outputStream = fopen($tempFile, 'w');
        // 读取输入流并写入到输出流
        while ($data = fread($inputStream, 1024)) {
            fwrite($outputStream, $data);
        }
        // 关闭输入流和输出流
        fclose($inputStream);
        fclose($outputStream);

        $this->realPath = $tempFile;
        $this->size = filesize($this->realPath);
        $this->mimeType = mime_content_type($this->realPath);

        $path = parse_url($this->remoteUrl, PHP_URL_PATH);
        $this->name = pathinfo($path, PATHINFO_BASENAME);

        // 判断 name 中是否具有文件后缀，如果没有，则使用 mime_type 生成一个
        if (empty(pathinfo($this->name, PATHINFO_EXTENSION))) {
            $this->name = $this->name . '.' . MimeTypes::getExtension($this->mimeType);
        }
    }
}
