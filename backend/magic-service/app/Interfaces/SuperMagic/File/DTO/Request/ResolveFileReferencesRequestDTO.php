<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\File\DTO\Request;

use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Hyperf\HttpServer\Contract\RequestInterface;

final readonly class ResolveFileReferencesRequestDTO
{
    // 与 TaskFileRepository 的批量查询、文件批量删除上限保持一致。
    public const MAX_REFERENCES = 500;

    /** @param list<FileReferenceSelectorDTO> $references */
    public function __construct(public array $references)
    {
    }

    public static function fromRequest(RequestInterface $request): self
    {
        $references = $request->input('references');
        if (! is_array($references) || ! array_is_list($references)
            || count($references) < 1 || count($references) > self::MAX_REFERENCES) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'Invalid references batch size');
        }

        return new self(array_map(FileReferenceSelectorDTO::fromInput(...), $references));
    }
}
