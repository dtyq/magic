<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Hyperf\HttpServer\Contract\RequestInterface;

class GetFileUrlsRequestDTO
{
    /**
     * List of file IDs.
     */
    private array $fileIds;

    private string $token;

    private string $downloadMode;

    private string $topicId;

    private string $projectId;

    /**
     * Cache setting, default is true.
     */
    private bool $cache;

    /**
     * 文件版本号映射，格式：[file_id => version_number]
     * 如果某个文件未指定版本号，则使用当前版本.
     */
    private array $fileVersions;

    /**
     * Constructor.
     */
    public function __construct(array $params)
    {
        $this->fileIds = $params['file_ids'] ?? [];
        $this->token = $params['token'] ?? '';
        $this->downloadMode = $params['download_mode'] ?? 'preview';
        $this->topicId = $params['topic_id'] ?? '';
        $this->projectId = $params['project_id'] ?? '';
        $this->cache = $params['cache'] ?? true;
        $this->fileVersions = $params['file_versions'] ?? [];

        $this->validate();
    }

    /**
     * 从HTTP请求创建DTO.
     */
    public static function fromRequest(RequestInterface $request): self
    {
        return new self($request->all());
    }

    /**
     * 获取文件ID列表.
     */
    public function getFileIds(): array
    {
        return $this->fileIds;
    }

    public function getToken(): string
    {
        return $this->token;
    }

    public function getDownloadMode(): string
    {
        return $this->downloadMode;
    }

    public function getTopicId(): string
    {
        return $this->topicId;
    }

    public function getProjectId(): string
    {
        return $this->projectId;
    }

    public function getCache(): bool
    {
        return $this->cache;
    }

    public function setProjectId(string $projectId)
    {
        $this->projectId = $projectId;
    }

    /**
     * 获取文件版本号映射.
     */
    public function getFileVersions(): array
    {
        return $this->fileVersions;
    }

    /**
     * 设置文件版本号映射.
     */
    public function setFileVersions(array $fileVersions): void
    {
        $this->fileVersions = $fileVersions;
    }

    /**
     * 获取指定文件的版本号.
     *
     * @param int $fileId 文件ID
     * @return null|int 版本号，未指定则返回null
     */
    public function getFileVersion(int $fileId): ?int
    {
        return $this->fileVersions[$fileId] ?? null;
    }

    /**
     * 验证请求数据.
     *
     * @throws BusinessException 如果验证失败则抛出异常
     */
    /* @phpstan-ignore-next-line */
    private function validate(): void
    {
        if (empty($this->fileIds)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'file_ids.required');
        }

        if (empty($this->projectId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'project_id.required');
        }

        // 验证文件版本号格式
        if (! empty($this->fileVersions)) {
            foreach ($this->fileVersions as $fileId => $version) {
                if (! is_numeric($fileId) || ! is_numeric($version) || (int) $version < 1) {
                    ExceptionBuilder::throw(
                        GenericErrorCode::ParameterValidationFailed,
                        'file_versions.invalid_format'
                    );
                }
            }
        }
    }
}
