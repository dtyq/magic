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

/**
 * Check batch operation status request DTO.
 */
class CheckBatchOperationStatusRequestDTO
{
    /**
     * Batch key for operation tracking.
     */
    private string $batchKey;

    /**
     * Constructor.
     */
    public function __construct(array $params)
    {
        $this->batchKey = $params['batch_key'] ?? '';

        $this->validate();
    }

    /**
     * Create DTO from HTTP request.
     */
    public static function fromRequest(RequestInterface $request): self
    {
        return new self($request->all());
    }

    /**
     * Get batch key.
     */
    public function getBatchKey(): string
    {
        return $this->batchKey;
    }

    /**
     * Validate request data.
     *
     * @throws BusinessException If validation fails
     */
    private function validate(): void
    {
        if (empty($this->batchKey)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'batch_key.required');
        }
    }
}
