<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Message\DTO\Request;

use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

class MessageCursorRequestDTO
{
    protected ?int $afterId;

    protected int $limit;

    public function __construct(array $data = [], int $defaultLimit = 20)
    {
        foreach (['page', 'page_size', 'offset', 'sort_direction'] as $field) {
            if (array_key_exists($field, $data)) {
                ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'message_cursor.unsupported_pagination');
            }
        }
        $this->afterId = isset($data['after_id'])
            ? self::parsePositiveInteger($data['after_id'], 'after_id') : null;
        $this->limit = self::parsePositiveInteger($data['limit'] ?? $defaultLimit, 'limit');
        if ($this->limit > 100) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'message_cursor.invalid_limit');
        }
    }

    public function getAfterId(): ?int
    {
        return $this->afterId;
    }

    public function getLimit(): int
    {
        return $this->limit;
    }

    public static function parsePositiveInteger(mixed $value, string $field): int
    {
        if ((! is_int($value) && ! is_string($value))
            || ! preg_match('/^[1-9][0-9]*$/D', (string) $value)
            || strlen((string) $value) > strlen((string) PHP_INT_MAX)
            || (strlen((string) $value) === strlen((string) PHP_INT_MAX)
                && strcmp((string) $value, (string) PHP_INT_MAX) > 0)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'message_cursor.invalid_integer', ['field' => $field]);
        }
        return (int) $value;
    }
}
