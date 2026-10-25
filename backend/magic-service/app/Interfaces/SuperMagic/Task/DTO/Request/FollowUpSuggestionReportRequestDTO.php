<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Task\DTO\Request;

use App\Domain\Chat\Entity\ValueObject\GeneratedSuggestionStatus;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

/**
 * 校验沙箱上报的追加问题状态。
 * 模型仍按 3 条、200 字符生成。这里放宽到 5 条，超长条目跳过，不修改保留下来的文本。
 */
class FollowUpSuggestionReportRequestDTO
{
    private const MAX_SUGGESTIONS = 5;

    private const MAX_SUGGESTION_LENGTH = 200;

    /**
     * @param string[] $suggestions
     */
    private function __construct(
        public readonly string $taskId,
        public readonly GeneratedSuggestionStatus $status,
        public readonly array $suggestions,
    ) {
    }

    /**
     * @param array<string, mixed> $payload
     */
    public static function fromPayload(array $payload): self
    {
        $status = $payload['status'] ?? null;
        $allowsSuggestions = $status === GeneratedSuggestionStatus::Done->value;
        $allowedKeys = $allowsSuggestions ? ['task_id', 'status', 'suggestions'] : ['task_id', 'status'];
        $taskId = $payload['task_id'] ?? null;
        $statusValid = is_int($status) && GeneratedSuggestionStatus::tryFrom($status) !== null;
        $taskIdValid = is_string($taskId) && preg_match('/^[1-9]\d*$/', $taskId) === 1;
        if (array_diff(array_keys($payload), $allowedKeys) !== [] || ! $statusValid || ! $taskIdValid) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'parameter_validation_error');
        }

        $suggestions = [];
        if ($allowsSuggestions) {
            $rawSuggestions = $payload['suggestions'] ?? null;
            if (! is_array($rawSuggestions) || ! array_is_list($rawSuggestions)) {
                ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'parameter_validation_error');
            }
            foreach ($rawSuggestions as $suggestion) {
                if (! is_string($suggestion) || $suggestion === '') {
                    ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'parameter_validation_error');
                }
                if (mb_strlen($suggestion) > self::MAX_SUGGESTION_LENGTH) {
                    continue;
                }
                $suggestions[] = $suggestion;
                if (count($suggestions) >= self::MAX_SUGGESTIONS) {
                    break;
                }
            }
        }

        return new self($taskId, GeneratedSuggestionStatus::from($status), $suggestions);
    }
}
