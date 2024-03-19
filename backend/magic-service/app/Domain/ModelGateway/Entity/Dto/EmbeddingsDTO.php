<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\Dto;

class EmbeddingsDTO extends AbstractRequestDTO
{
    protected array|string $input = '';

    protected ?string $user = null;

    public function getType(): string
    {
        return 'embedding';
    }

    public function getInput(): array|string
    {
        return $this->input;
    }

    public function setInput(array|string $input): void
    {
        $this->input = $input;
    }

    public function getUser(): ?string
    {
        return $this->user;
    }

    public function setUser(?string $user): void
    {
        $this->user = $user;
    }

    public function getModel(): string
    {
        return $this->model;
    }

    public function setModel(int|string $model): void
    {
        $this->model = (string) $model;
    }

    public function getIps(): array
    {
        return $this->ips;
    }

    public function setIps(array $ips): void
    {
        $this->ips = $ips;
    }

    public function getAccessToken(): string
    {
        return $this->accessToken;
    }

    public function setAccessToken(string $accessToken): void
    {
        $this->accessToken = $accessToken;
    }

    public function getCallMethod(): string
    {
        return AbstractRequestDTO::METHOD_EMBEDDINGS;
    }
}
