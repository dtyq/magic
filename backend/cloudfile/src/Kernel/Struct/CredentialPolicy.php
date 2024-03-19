<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Struct;

class CredentialPolicy
{
    /**
     * 文件大小限制.
     */
    private int $sizeMax = 0;

    /**
     * 凭证有效期.
     */
    private int $expires = 7200;

    /**
     * 允许上传的文件类型.
     */
    private array $mimeType = [];

    /**
     * 上传到指定目录.
     */
    private string $dir = '';

    /**
     * 是否开启 sts 模式.
     * 获取临时凭证给前端使用.
     */
    private bool $sts = false;

    /**
     * 角色会话名称.
     * sts模式下使用.
     * 可用于记录操作人.
     */
    private string $roleSessionName = '';

    /**
     * STS类型.
     * sts模式下使用.
     */
    private string $stsType = '';

    private string $contentType = '';

    public function __construct(array $config = [])
    {
        if (isset($config['size_max'])) {
            $this->sizeMax = (int) $config['size_max'];
        }
        if (isset($config['expires'])) {
            $this->expires = (int) $config['expires'];
        }
        if (isset($config['mime_type'])) {
            $this->mimeType = (array) $config['mime_type'];
        }
        if (isset($config['dir'])) {
            $this->dir = $this->formatDirPath($config['dir']);
        }
        if (isset($config['sts'])) {
            $this->sts = (bool) $config['sts'];
        }
        if (isset($config['role_session_name'])) {
            $this->roleSessionName = (string) $config['role_session_name'];
        }
        if (isset($config['sts_type'])) {
            $this->stsType = (string) $config['sts_type'];
        }
        if (isset($config['content_type'])) {
            $this->contentType = (string) $config['content_type'];
        }
    }

    public function getSizeMax(): int
    {
        return $this->sizeMax;
    }

    public function getExpires(): int
    {
        return $this->expires;
    }

    public function getMimeType(): array
    {
        return $this->mimeType;
    }

    public function getDir(): string
    {
        return $this->dir;
    }

    public function isSts(): bool
    {
        return $this->sts;
    }

    public function getRoleSessionName(): string
    {
        return $this->roleSessionName;
    }

    public function getStsType(): string
    {
        return $this->stsType;
    }

    public function setSts(bool $sts): void
    {
        $this->sts = $sts;
    }

    public function setStsType(string $stsType): void
    {
        $this->stsType = $stsType;
    }

    public function getContentType(): string
    {
        return $this->contentType;
    }

    public function setContentType(string $contentType): void
    {
        $this->contentType = $contentType;
    }

    public function uniqueKey(array $options = []): string
    {
        return md5(serialize($this) . serialize($options));
    }

    /**
     * 去除左右多余的 /，去除空的 /，结束带 /.
     */
    private function formatDirPath(string $path): string
    {
        if ($path === '') {
            return '';
        }
        return implode('/', array_filter(explode('/', $path))) . '/';
    }
}
