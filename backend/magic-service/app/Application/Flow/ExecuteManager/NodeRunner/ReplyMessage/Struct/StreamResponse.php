<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\ReplyMessage\Struct;

class StreamResponse
{
    private string $llmStreamResponse = '';

    private ?string $llmStreamReasoningResponse = null;

    public function getLlmStreamResponse(): string
    {
        return $this->llmStreamResponse;
    }

    public function getLlmStreamReasoningResponse(): ?string
    {
        return $this->llmStreamReasoningResponse;
    }

    public function appendLLMStreamResponse(string $response): void
    {
        $this->llmStreamResponse .= $response;
    }

    public function appendLLMStreamReasoningResponse(string $response): void
    {
        if (is_null($this->llmStreamReasoningResponse)) {
            $this->llmStreamReasoningResponse = '';
        }
        $this->llmStreamReasoningResponse .= $response;
    }
}
