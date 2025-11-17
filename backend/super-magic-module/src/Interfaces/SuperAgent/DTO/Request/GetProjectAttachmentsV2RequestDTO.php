<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use Hyperf\HttpServer\Contract\RequestInterface;

class GetProjectAttachmentsV2RequestDTO
{
    protected string $projectId;

    /**
     * Current page number.
     */
    protected int $page;

    /**
     * Items per page.
     */
    protected int $pageSize;

    /**
     * File type filter.
     */
    protected array $fileType = [];

    /**
     * Access token (for non-login mode).
     */
    protected ?string $token = null;

    /**
     * Updated after timestamp (for filtering files updated after this time).
     */
    protected ?string $updatedAfter = null;

    public function __construct(array $data = [], ?string $projectId = null)
    {
        // Use passed projectId parameter first
        $this->projectId = $projectId ?? (string) ($data['project_id'] ?? '');
        $this->page = (int) ($data['page'] ?? 1);
        $this->pageSize = (int) ($data['page_size'] ?? 200);
        $this->token = $data['token'] ?? null;
        $this->updatedAfter = $data['updated_after'] ?? null;

        // Handle file type, can accept string or array
        if (isset($data['file_type'])) {
            if (is_array($data['file_type'])) {
                $this->fileType = $data['file_type'];
            } elseif (is_string($data['file_type']) && ! empty($data['file_type'])) {
                $this->fileType = [$data['file_type']];
            }
        }
    }

    /**
     * Create DTO from request.
     *
     * @param RequestInterface $request Request object
     * @return self Return a new DTO instance
     */
    public static function fromRequest(RequestInterface $request): self
    {
        return new self(
            $request->all(),
            $request->route('id')
        );
    }

    public function getProjectId(): string
    {
        return $this->projectId;
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

    /**
     * Get updated after timestamp.
     *
     * @return null|string Updated after timestamp
     */
    public function getUpdatedAfter(): ?string
    {
        return $this->updatedAfter;
    }

    /**
     * Set project ID.
     *
     * @param string $projectId Project ID
     * @return self Return current instance for method chaining
     */
    public function setProjectId(string $projectId): self
    {
        $this->projectId = $projectId;
        return $this;
    }

    /**
     * Set current page number.
     *
     * @param int $page Current page number
     * @return self Return current instance for method chaining
     */
    public function setPage(int $page): self
    {
        $this->page = $page;
        return $this;
    }

    /**
     * Set items per page.
     *
     * @param int $pageSize Items per page
     * @return self Return current instance for method chaining
     */
    public function setPageSize(int $pageSize): self
    {
        $this->pageSize = $pageSize;
        return $this;
    }

    /**
     * Set file type filter.
     *
     * @param array $fileType File type filter array
     * @return self Return current instance for method chaining
     */
    public function setFileType(array $fileType): self
    {
        $this->fileType = $fileType;
        return $this;
    }

    /**
     * Get access token.
     *
     * @return null|string Access token
     */
    public function getToken(): ?string
    {
        return $this->token;
    }

    /**
     * Set access token.
     *
     * @param null|string $token Access token
     * @return self Return current instance for method chaining
     */
    public function setToken(?string $token): self
    {
        $this->token = $token;
        return $this;
    }

    /**
     * Set updated after timestamp.
     *
     * @param null|string $updatedAfter Updated after timestamp
     * @return self Return current instance for method chaining
     */
    public function setUpdatedAfter(?string $updatedAfter): self
    {
        $this->updatedAfter = $updatedAfter;
        return $this;
    }
}
