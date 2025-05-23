<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

/**
 * Token Usage Value Object.
 */
class TokenUsage
{
    /**
     * Constructor.
     */
    public function __construct(
        private ?int $inputTokens,
        private ?int $outputTokens,
        private ?int $totalTokens,
        private ?InputTokensDetails $inputTokensDetails,
        private ?OutputTokensDetails $outputTokensDetails,
        private ?string $modelId,
        private ?string $modelName
    ) {
    }

    /**
     * Creates an instance from an array.
     * Returns null if the provided data is null or empty.
     *
     * @param null|array $data Data array
     * @return null|self Returns an instance of TokenUsage or null
     */
    public static function fromArray(?array $data): ?self
    {
        if (empty($data)) {
            return null;
        }

        return new self(
            $data['input_tokens'] ?? null,
            $data['output_tokens'] ?? null,
            $data['total_tokens'] ?? null,
            isset($data['input_tokens_details']) && is_array($data['input_tokens_details']) ? InputTokensDetails::fromArray($data['input_tokens_details']) : null,
            isset($data['output_tokens_details']) && is_array($data['output_tokens_details']) ? OutputTokensDetails::fromArray($data['output_tokens_details']) : null,
            $data['model_id'] ?? null,
            $data['model_name'] ?? null
        );
    }

    /**
     * Converts the object to an array.
     */
    public function toArray(): array
    {
        return [
            'input_tokens' => $this->inputTokens,
            'output_tokens' => $this->outputTokens,
            'total_tokens' => $this->totalTokens,
            'input_tokens_details' => $this->inputTokensDetails?->toArray(),
            'output_tokens_details' => $this->outputTokensDetails?->toArray(),
            'model_id' => $this->modelId,
            'model_name' => $this->modelName,
        ];
    }

    public function getInputTokens(): ?int
    {
        return $this->inputTokens;
    }

    public function getOutputTokens(): ?int
    {
        return $this->outputTokens;
    }

    public function getTotalTokens(): ?int
    {
        return $this->totalTokens;
    }

    public function getInputTokensDetails(): ?InputTokensDetails
    {
        return $this->inputTokensDetails;
    }

    public function getOutputTokensDetails(): ?OutputTokensDetails
    {
        return $this->outputTokensDetails;
    }

    public function getModelId(): ?string
    {
        return $this->modelId;
    }

    public function getModelName(): ?string
    {
        return $this->modelName;
    }
}
