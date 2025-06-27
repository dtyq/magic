<?php

declare(strict_types=1);

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Validation\Contract\ValidatorFactoryInterface;

class ConvertFilesToPdfRequestDTO
{
    private array $fileIds;
    private array $options;
    private bool $isDebug;

    public function __construct(array $params)
    {
        $this->fileIds = $params['file_ids'] ?? [];
        $this->options = $params['options'] ?? [];
        $this->isDebug = $params['is_debug'] ?? false;
        $this->validate($params);
    }

    public static function fromRequest(RequestInterface $request): self
    {
        return new self($request->all());
    }

    public function getFileIds(): array
    {
        return $this->fileIds;
    }

    public function getOptions(): array
    {
        return $this->options;
    }

    public function isDebug(): bool
    {
        return $this->isDebug;
    }
    
    /**
     * @throws BusinessException
     */
    private function validate(array $params): void
    {
        $validator = di(ValidatorFactoryInterface::class)->make(
            $params,
            [
                'file_ids' => 'required|array',
                'options' => 'sometimes|array',
                'is_debug' => 'sometimes|boolean',
            ],
            [
                'file_ids.required' => 'file_ids is required',
                'file_ids.array' => 'file_ids must be an array',
            ]
        );

        if ($validator->fails()) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, $validator->errors()->first());
        }
    }
} 