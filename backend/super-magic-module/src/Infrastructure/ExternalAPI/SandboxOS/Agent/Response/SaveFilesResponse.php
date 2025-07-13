<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Response;

/**
 * 沙箱文件保存响应类
 * 解析沙箱 /api/v1/files/edit 接口的返回数据.
 */
class SaveFilesResponse
{
    private array $editSummary;

    private array $results;

    public function __construct(array $editSummary, array $results)
    {
        $this->editSummary = $editSummary;
        $this->results = $results;
    }

    /**
     * 从API响应数据创建响应对象
     */
    public static function fromApiResponse(array $data): self
    {
        return new self(
            $data['edit_summary'] ?? [],
            $data['results'] ?? []
        );
    }

    /**
     * 获取编辑摘要
     */
    public function getEditSummary(): array
    {
        return $this->editSummary;
    }

    /**
     * 获取详细结果列表.
     */
    public function getResults(): array
    {
        return $this->results;
    }

    /**
     * 检查是否所有文件都成功
     */
    public function isAllSuccess(): bool
    {
        return $this->editSummary['all_success'] ?? false;
    }

    /**
     * 检查是否所有文件都上传成功
     */
    public function isAllUploaded(): bool
    {
        return $this->editSummary['all_uploaded'] ?? false;
    }

    /**
     * 获取成功数量.
     */
    public function getSuccessCount(): int
    {
        return $this->editSummary['success_count'] ?? 0;
    }

    /**
     * 获取失败数量.
     */
    public function getFailedCount(): int
    {
        return $this->editSummary['failed_count'] ?? 0;
    }

    /**
     * 获取总数量.
     */
    public function getTotalCount(): int
    {
        return $this->editSummary['total_count'] ?? 0;
    }

    /**
     * 获取上传成功数量.
     */
    public function getUploadSuccessCount(): int
    {
        return $this->editSummary['upload_success_count'] ?? 0;
    }

    /**
     * 转换为数组格式（保持与原接口兼容）.
     */
    public function toArray(): array
    {
        return [
            'edit_summary' => $this->editSummary,
            'results' => $this->results,
        ];
    }

    /**
     * 获取失败的文件列表.
     */
    public function getFailedFiles(): array
    {
        return array_filter($this->results, function ($result) {
            return ! ($result['success'] ?? true);
        });
    }

    /**
     * 获取成功的文件列表.
     */
    public function getSuccessFiles(): array
    {
        return array_filter($this->results, function ($result) {
            return $result['success'] ?? true;
        });
    }
}
