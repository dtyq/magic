<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\HttpServer\Router\Dispatched;

/**
 * Audio marker list request DTO.
 */
class AudioMarkerListRequestDTO extends AbstractRequestDTO
{
    /**
     * Project ID (from route parameter).
     */
    public string $projectId = '';

    /**
     * Page number.
     */
    public int $page = 1;

    /**
     * Page size.
     */
    public int $pageSize = 20;

    public static function fromRequest(RequestInterface $request): static
    {
        /* @phpstan-ignore-next-line */
        $dto = new static();

        // Get route parameters
        $routeParams = $request->getAttribute(Dispatched::class)->params;
        $dto->projectId = $routeParams['projectId'] ?? '';

        // Get query parameters with type casting
        $dto->page = (int) $request->input('page', 1);
        $dto->pageSize = (int) $request->input('page_size', 20);

        // Validate parameters
        $data = [
            'page' => $dto->page,
            'page_size' => $dto->pageSize,
        ];
        static::checkParams($data);

        return $dto;
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

    protected static function getHyperfValidationRules(): array
    {
        return [
            'page' => 'nullable|integer|min:1',
            'page_size' => 'nullable|integer|min:1|max:100',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [
            'page.integer' => 'Page must be an integer',
            'page.min' => 'Page must be greater than 0',
            'page_size.integer' => 'Page size must be an integer',
            'page_size.min' => 'Page size must be greater than 0',
            'page_size.max' => 'Page size cannot exceed 100',
        ];
    }
}
