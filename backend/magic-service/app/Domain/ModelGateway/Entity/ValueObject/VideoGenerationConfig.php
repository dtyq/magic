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

    /**
     * @var array<string, mixed>
     */
    protected array $inputModes = [];

    public function __construct(?array $data = null)
    {
        parent::__construct($data === null ? null : [
            'supported_inputs' => array_values(is_array($data['supported_inputs'] ?? null) ? $data['supported_inputs'] : []),
            'reference_images' => is_array($data['reference_images'] ?? null) ? $data['reference_images'] : [],
            'generation' => is_array($data['generation'] ?? null) ? $data['generation'] : [],
            'constraints' => is_array($data['constraints'] ?? null) ? $data['constraints'] : [],
            'input_modes' => is_array($data['input_modes'] ?? null) ? $data['input_modes'] : [],
        ]);
    }

    public function toArray(): array
    {
        return [
            'supported_inputs' => $this->supportedInputs,
            'reference_images' => $this->referenceImages,
            'generation' => $this->generation,
            'constraints' => $this->constraints,
            'input_modes' => $this->inputModes,
        ];
    }

    public function hasInputModes(): bool
    {
        return $this->inputModes !== [];
    }

    public function supportsInputMode(string $inputMode): bool
    {
        return array_key_exists($inputMode, $this->inputModes);
    }

    public function supportsFrameRole(string $inputMode, string $frameRole): bool
    {
        if (! $this->hasInputModes()) {
            return true;
        }

        $inputModeConfig = $this->inputModes[$inputMode] ?? null;
        if (! is_array($inputModeConfig)) {
            return false;
        }

        $frameRoles = $inputModeConfig['frame_roles'] ?? [];

        return is_array($frameRoles) && ($frameRoles === [] || in_array($frameRole, $frameRoles, true));
    }

    public function hasSupportedInputs(): bool
    {
        return $this->supportedInputs !== [];
    }

    public function supportsInput(string $input): bool
    {
        return in_array($input, $this->supportedInputs, true);
    }

    public function jsonSerialize(): array
    {
        return $this->toArray();
    }
}
