<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Hyperf\HttpServer\Contract\RequestInterface;

class GetTaskFilesRequestDTO
{
    private int $id;

    private int $page;

    private int $pageSize;

    public function __construct(array $params)
    {
        $this->id = isset($params['id']) ? (int) $params['id'] : 0;
        $this->page = isset($params['page']) ? (int) $params['page'] : 1;
        $this->pageSize = isset($params['page_size']) ? (int) $params['page_size'] : 20;

        $this->validate();
    }

    public static function fromRequest(RequestInterface $request): self
    {
        return new self($request->all());
    }

    public function getId(): int
    {
        return $this->id;
    }

    public function getPage(): int
    {
        return $this->page;
    }

    public function getPageSize(): int
    {
        return $this->pageSize;
    }

    private function validate(): void
    {
        if (empty($this->id)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'task.id_required');
        }
    }
}
