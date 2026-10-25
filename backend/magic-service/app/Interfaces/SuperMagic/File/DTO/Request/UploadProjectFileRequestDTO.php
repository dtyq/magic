<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\File\DTO\Request;

use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\AbstractRequestDTO;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\SuperMagic\Utils\WorkFileUtil;
use Hyperf\HttpServer\Contract\RequestInterface;
use Swow\Psr7\Message\UploadedFile;

class UploadProjectFileRequestDTO extends AbstractRequestDTO
{
    public string $projectId = '';

    public ?string $parentId = null;

    public ?string $fileName = null;

    public static function fromRequest(RequestInterface $request): static
    {
        $dto = parent::fromRequest($request);
        $file = $request->file('file');
        if (! $file instanceof UploadedFile || $file->getError() !== UPLOAD_ERR_OK) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'file.open_api.invalid_upload');
        }
        return $dto;
    }

    public function getProjectId(): string
    {
        return $this->projectId;
    }

    public function getParentId(): string
    {
        return $this->parentId ?? '';
    }

    public function getFileName(): string
    {
        return $this->fileName ?? '';
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'project_id' => ['required', 'string', 'regex:/^[1-9][0-9]*$/D'],
            'parent_id' => ['nullable', 'string', 'regex:/^[1-9][0-9]*$/D'],
            'file_name' => 'nullable|string|max:255',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [];
    }

    protected static function checkParams(array $params): array
    {
        $params = parent::checkParams($params);
        foreach (['project_id', 'parent_id'] as $field) {
            $id = $params[$field] ?? null;
            if ($id !== null && ! FileReferenceSelectorDTO::fromInput(['file_id' => $id])->isValid()) {
                ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'file.open_api.invalid_id', ['field' => $field]);
            }
        }
        if (isset($params['file_name']) && ! WorkFileUtil::isValidFileName($params['file_name'])) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'file.illegal_file_name');
        }
        return $params;
    }
}
