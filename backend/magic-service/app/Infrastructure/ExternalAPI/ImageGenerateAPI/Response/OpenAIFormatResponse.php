<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response;

use Hyperf\Odin\Contract\Api\Response\ResponseInterface;

class OpenAIFormatResponse implements ResponseInterface
{
    private int $created;

    private array $data;

    private ?ImageUsage $usage;

    private ?string $provider_error_message;

    private ?int $provider_error_code;

    private ?string $provider;

    public function __construct(array $params = [])
    {
        $this->created = $params['created'] ?? time();
        $this->data = $params['data'] ?? [];
        $this->usage = isset($params['usage'])
            ? (is_array($params['usage']) ? ImageUsage::fromArray($params['usage']) : $params['usage'])
            : null;
        $this->provider_error_message = $params['provider_error_message'] ?? null;
        $this->provider_error_code = $params['provider_error_code'] ?? null;
        $this->provider = $params['provider'] ?? null;
    }

    public function getCreated(): int
    {
        return $this->created;
    }

    public function setCreated(int $created): self
    {
        $this->created = $created;
        return $this;
    }

    public function getData(): array
    {
        return $this->data;
    }

    public function setData(array $data): self
    {
        $this->data = $data;
        return $this;
    }

    public function getUsage(): ?ImageUsage
    {
        return $this->usage;
    }

    public function setUsage(?ImageUsage $usage): self
    {
        $this->usage = $usage;
        return $this;
    }

    public function getProviderErrorMessage(): ?string
    {
        return $this->provider_error_message;
    }

    public function setProviderErrorMessage(?string $provider_error_message): self
    {
        $this->provider_error_message = $provider_error_message;
        return $this;
    }

    public function getProviderErrorCode(): ?int
    {
        return $this->provider_error_code;
    }

    public function setProviderErrorCode(?int $provider_error_code): self
    {
        $this->provider_error_code = $provider_error_code;
        return $this;
    }

    public function getProvider(): ?string
    {
        return $this->provider;
    }

    public function setProvider(?string $provider): self
    {
        $this->provider = $provider;
        return $this;
    }

    public function toArray(): array
    {
        $result = [
            'created' => $this->created,
            'data' => $this->data,
            'usage' => $this->usage?->toArray(),
        ];

        if ($this->provider_error_message !== null) {
            $result['provider_error_message'] = $this->provider_error_message;
        }

        if ($this->provider_error_code !== null) {
            $result['provider_error_code'] = $this->provider_error_code;
        }

        if ($this->provider !== null) {
            $result['provider'] = $this->provider;
        }

        return $result;
    }

    public function hasError(): bool
    {
        return $this->provider_error_code !== null || $this->provider_error_message !== null;
    }

    public function isSuccess(): bool
    {
        return ! $this->hasError() && ! empty($this->data);
    }

    public static function buildError(int $code, string $message): OpenAIFormatResponse
    {
        $openAIFormatResponse = new OpenAIFormatResponse();
        $openAIFormatResponse->setCreated(time());
        $openAIFormatResponse->setData([]);
        $openAIFormatResponse->setUsage(null);
        $openAIFormatResponse->setProviderErrorMessage($message);
        $openAIFormatResponse->setProviderErrorCode($code);
        return $openAIFormatResponse;
    }
}
