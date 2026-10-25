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

class OpenBatchSaveProjectFilesRequestDTO extends AbstractRequestDTO
{
    public string $projectId = '';

    public ?string $parentId = null;

    public array $files = [];

    public function getProjectId(): string
    {
        return $this->projectId;
    }

    public function getParentId(): string
    {
        return $this->parentId ?? '';
    }

    public function getFiles(): array
    {
        return $this->files;
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'project_id' => ['required', 'string', 'regex:/^[1-9][0-9]*$/D'],
            'parent_id' => ['nullable', 'string', 'regex:/^[1-9][0-9]*$/D'],
            'files' => 'required|array|min:1|max:100',
            'files.*.file_key' => 'required|string|max:500',
            'files.*.file_name' => 'required|string|max:255',
            'files.*.file_size' => 'nullable|integer|min:0',
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
        if (! array_is_list($params['files'])) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'file.open_api.files_must_be_list');
        }
        $keys = array_column($params['files'], 'file_key');
        if (count($keys) !== count(array_unique($keys, SORT_STRING))) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'file.open_api.duplicate_file_key');
        }
        foreach ($params['files'] as $file) {
            if (! WorkFileUtil::isValidFileName($file['file_name'])) {
                ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'file.illegal_file_name');
            }
            self::assertCanonicalObjectKey($file['file_key']);
        }
        return $params;
    }

    private static function assertCanonicalObjectKey(string $key): void
    {
        // Keep the request key intact, including when it becomes a response-map key.
        if ($key !== trim($key) || ! str_contains($key, '/') || preg_match('/[\\\\\x00-\x1f\x7f]/', $key)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'file.illegal_file_key');
        }
        foreach (explode('/', $key) as $segment) {
            if ($segment === '' || $segment === '.' || $segment === '..') {
                ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'file.illegal_file_key');
            }
        }
    }
}
