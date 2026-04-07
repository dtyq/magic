<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\ValueObject;

use App\Infrastructure\Core\AbstractValueObject;

class VideoGenerationConfig extends AbstractValueObject
{
    /**
     * @var list<string>
     */
    protected array $supportedInputs = [];

    /**
     * @var array<string, mixed>
     */
    protected array $referenceImages = [];

    /**
     * @var array<string, mixed>
     */
    protected array $generation = [];

    /**
     * @var array<string, mixed>
     */
    protected array $constraints = [];

    public function __construct(?array $data = null)
    {
        parent::__construct($data === null ? null : [
            'supported_inputs' => array_values(is_array($data['supported_inputs'] ?? null) ? $data['supported_inputs'] : []),
            'reference_images' => is_array($data['reference_images'] ?? null) ? $data['reference_images'] : [],
            'generation' => is_array($data['generation'] ?? null) ? $data['generation'] : [],
            'constraints' => is_array($data['constraints'] ?? null) ? $data['constraints'] : [],
        ]);
    }

    public function toArray(): array
    {
        return [
            'supported_inputs' => $this->supportedInputs,
            'reference_images' => $this->referenceImages,
            'generation' => $this->generation,
            'constraints' => $this->constraints,
        ];
    }

    public function jsonSerialize(): array
    {
        return $this->toArray();
    }
}
