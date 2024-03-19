<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use Hyperf\HttpServer\Contract\RequestInterface;

class GetUserUsageRequestDTO
{
    /**
     * @var int 页码
     */
    protected int $page = 1;

    /**
     * @var int 每页大小
     */
    protected int $pageSize = 100;

    /**
     * @var string 机构编码
     */
    protected string $organizationCode = '';

    /**
     * @var string 用户名称
     */
    protected string $userName = '';

    /**
     * @var string 话题名称
     */
    protected string $topicName = '';

    /**
     * @var string 话题状态
     */
    protected string $topicStatus = '';

    /**
     * @var string 话题ID
     */
    protected string $topicId = '';

    /**
     * @var string 沙盒ID
     */
    protected string $sandboxId = '';

    /**
     * 从请求数组构造.
     */
    public function __construct(array $data = [])
    {
        $this->page = (int) ($data['page'] ?? 1);
        $this->pageSize = (int) ($data['page_size'] ?? 100);
        $this->organizationCode = (string) ($data['organization_code'] ?? '');
        $this->userName = (string) ($data['user_name'] ?? '');
        $this->topicName = (string) ($data['topic_name'] ?? '');
        $this->topicStatus = (string) ($data['topic_status'] ?? '');
        $this->topicId = (string) ($data['topic_id'] ?? '');
        $this->sandboxId = (string) ($data['sandbox_id'] ?? '');
    }

    /**
     * 从 HTTP 请求对象创建实例.
     */
    public static function fromRequest(RequestInterface $request): self
    {
        return new self([
            'page' => $request->input('page', 1),
            'page_size' => $request->input('page_size', 100),
            'organization_code' => $request->input('organization_code', ''),
            'user_name' => $request->input('user_name', ''),
            'topic_name' => $request->input('topic_name', ''),
            'topic_status' => $request->input('topic_status', ''),
            'topic_id' => $request->input('topic_id', ''),
            'sandbox_id' => $request->input('sandbox_id', ''),
        ]);
    }

    public function getPage(): int
    {
        return $this->page;
    }

    public function setPage(int $page): self
    {
        $this->page = $page;

        return $this;
    }

    public function getPageSize(): int
    {
        return $this->pageSize;
    }

    public function setPageSize(int $pageSize): self
    {
        $this->pageSize = $pageSize;

        return $this;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): self
    {
        $this->organizationCode = $organizationCode;

        return $this;
    }

    public function getUserName(): string
    {
        return $this->userName;
    }

    public function setUserName(string $userName): self
    {
        $this->userName = $userName;

        return $this;
    }

    public function getTopicName(): string
    {
        return $this->topicName;
    }

    public function setTopicName(string $topicName): self
    {
        $this->topicName = $topicName;

        return $this;
    }

    public function getTopicStatus(): string
    {
        return $this->topicStatus;
    }

    public function setTopicStatus(string $topicStatus): self
    {
        $this->topicStatus = $topicStatus;

        return $this;
    }

    public function getTopicId(): string
    {
        return $this->topicId;
    }

    public function setTopicId(string $topicId): self
    {
        $this->topicId = $topicId;

        return $this;
    }

    public function getSandboxId(): string
    {
        return $this->sandboxId;
    }

    public function setSandboxId(string $sandboxId): self
    {
        $this->sandboxId = $sandboxId;

        return $this;
    }
}
