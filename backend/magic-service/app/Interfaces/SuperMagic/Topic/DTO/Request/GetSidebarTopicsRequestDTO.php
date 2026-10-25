<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Topic\DTO\Request;

use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\AbstractDTO;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Hyperf\HttpServer\Contract\RequestInterface;

class GetSidebarTopicsRequestDTO extends AbstractDTO
{
    protected int $projectId = 0;

    protected string $q = '';

    protected int $page = 1;

    protected int $pageSize = 20;

    /** @var int[] 1 = ordinary topics, 2 = scheduled topics; empty means all. */
    protected array $topicTypes = [];

    public static function fromRequest(RequestInterface $request): self
    {
        $dto = new self();
        $dto->setProjectId((int) $request->route('id', 0));
        $dto->setQ(trim((string) $request->input('q', '')));
        $dto->setPage(max(1, (int) $request->input('page', 1)));
        $dto->setPageSize(max(1, (int) $request->input('page_size', 20)));
        $rawTypes = $request->input('topic_types', '');
        if (! is_string($rawTypes) && ! is_int($rawTypes)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'topic_types');
        }
        $rawTypes = (string) $rawTypes;
        $types = $rawTypes === '' ? [] : array_values(array_unique(explode(',', $rawTypes)));
        if (array_filter($types, static fn (string $type) => ! in_array($type, ['1', '2'], true)) !== []) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'topic_types');
        }
        $dto->topicTypes = array_map('intval', $types);
        return $dto;
    }

    public function getTopicTypes(): array
    {
        return $this->topicTypes;
    }

    public function getProjectId(): int
    {
        return $this->projectId;
    }

    public function setProjectId(int $projectId): self
    {
        $this->projectId = $projectId;
        return $this;
    }

    public function getQ(): string
    {
        return $this->q;
    }

    public function setQ(string $q): self
    {
        $this->q = $q;
        return $this;
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
}
