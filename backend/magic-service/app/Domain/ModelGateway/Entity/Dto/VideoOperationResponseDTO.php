<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\Dto;

use App\Infrastructure\Core\AbstractDTO;

class VideoOperationResponseDTO extends AbstractDTO
{
    protected string $id = '';

    protected string $object = '';

    protected string $modelId = '';

    protected string $status = '';

    protected ?string $createdAt = null;

    protected ?string $updatedAt = null;

    protected array $request = [];

    protected ?VideoOperationQueueDTO $queue = null;

    protected array $output = [];

    protected ?VideoOperationErrorDTO $error = null;

    protected ?array $providerResult = null;

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(string $id): void
    {
        $this->id = $id;
    }

    public function getObject(): string
    {
        return $this->object;
    }

    public function setObject(string $object): void
    {
        $this->object = $object;
    }

    public function getModelId(): string
    {
        return $this->modelId;
    }

    public function setModelId(string $modelId): void
    {
        $this->modelId = $modelId;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function setStatus(string $status): void
    {
        $this->status = $status;
    }

    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(?string $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(?string $updatedAt): void
    {
        $this->updatedAt = $updatedAt;
    }

    public function getRequest(): array
    {
        return $this->request;
    }

    public function setRequest(array $request): void
    {
        $this->request = $request;
    }

    public function getQueue(): ?VideoOperationQueueDTO
    {
        return $this->queue;
    }

    public function setQueue(?VideoOperationQueueDTO $queue): void
    {
        $this->queue = $queue;
    }

    public function getOutput(): array
    {
        return $this->output;
    }

    public function setOutput(array $output): void
    {
        $this->output = $output;
    }

    public function getError(): ?VideoOperationErrorDTO
    {
        return $this->error;
    }

    public function setError(?VideoOperationErrorDTO $error): void
    {
        $this->error = $error;
    }

    public function getProviderResult(): ?array
    {
        return $this->providerResult;
    }

    public function setProviderResult(?array $providerResult): void
    {
        $this->providerResult = $providerResult;
    }

    public function toArray(): array
    {
        $data = parent::toArray();
        if ($this->output === []) {
            unset($data['output']);
        }
        if ($this->error === null) {
            unset($data['error']);
        }
        unset($data['provider_result']);

        return $data;
    }
}
