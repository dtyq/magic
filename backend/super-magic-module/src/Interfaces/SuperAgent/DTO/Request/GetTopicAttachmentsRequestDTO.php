<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use Hyperf\HttpServer\Contract\RequestInterface;

class GetTopicAttachmentsRequestDTO
{
    protected string $topicId;

    /**
     * 非登录用户使用 token 获取信息.
     */
    protected string $token;

    /**
     * 当前页码.
     */
    protected int $page;

    /**
     * 每页数量.
     */
    protected int $pageSize;

    /**
     * 文件类型过滤.
     */
    protected array $fileType = [];

    public function __construct(array $data = [], ?string $topicId = null)
    {
        // 优先使用传入的 topicId 参数
        $this->topicId = $topicId ?? (string) ($data['topic_id'] ?? '');
        $this->page = (int) ($data['page'] ?? 1);
        $this->pageSize = (int) ($data['page_size'] ?? 200);
        $this->token = (string) ($data['token'] ?? '');

        // 处理文件类型，可以接收字符串或数组
        if (isset($data['file_type'])) {
            if (is_array($data['file_type'])) {
                $this->fileType = $data['file_type'];
            } elseif (is_string($data['file_type']) && ! empty($data['file_type'])) {
                $this->fileType = [$data['file_type']];
            }
        }
    }

    /**
     * 从请求创建 DTO.
     *
     * @param RequestInterface $request 请求对象
     * @return self 返回一个新的 DTO 实例
     */
    public static function fromRequest(RequestInterface $request): self
    {
        return new self(
            $request->all(),
            $request->route('id')
        );
    }

    public function getTopicId(): string
    {
        return $this->topicId;
    }

    public function getPage(): int
    {
        return $this->page;
    }

    public function getPageSize(): int
    {
        return $this->pageSize;
    }

    public function getFileType(): array
    {
        return $this->fileType;
    }

    public function getToken(): string
    {
        return $this->token;
    }

    /**
     * 设置话题ID.
     *
     * @param string $topicId 话题ID
     * @return self 返回当前实例，支持链式调用
     */
    public function setTopicId(string $topicId): self
    {
        $this->topicId = $topicId;
        return $this;
    }

    /**
     * 设置当前页码.
     *
     * @param int $page 当前页码
     * @return self 返回当前实例，支持链式调用
     */
    public function setPage(int $page): self
    {
        $this->page = $page;
        return $this;
    }

    /**
     * 设置每页数量.
     *
     * @param int $pageSize 每页数量
     * @return self 返回当前实例，支持链式调用
     */
    public function setPageSize(int $pageSize): self
    {
        $this->pageSize = $pageSize;
        return $this;
    }

    /**
     * 设置文件类型过滤.
     *
     * @param array $fileType 文件类型过滤数组
     * @return self 返回当前实例，支持链式调用
     */
    public function setFileType(array $fileType): self
    {
        $this->fileType = $fileType;
        return $this;
    }

    /**
     * 设置访问令牌.
     *
     * @param string $token 访问令牌
     * @return self 返回当前实例，支持链式调用
     */
    public function setToken(string $token): self
    {
        $this->token = $token;
        return $this;
    }
}
