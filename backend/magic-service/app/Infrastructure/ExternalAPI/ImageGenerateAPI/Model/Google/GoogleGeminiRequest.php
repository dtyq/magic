<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Google;

use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\ImageGenerateRequest;

class GoogleGeminiRequest extends ImageGenerateRequest
{
    protected float $temperature = 0.7;

    protected int $candidateCount = 1;

    protected int $maxOutputTokens = 2048;

    protected float $topP = 0.95;

    protected array $responseModalities = ['TEXT', 'IMAGE'];

    protected array $safetySettings = [];

    protected array $referImages = [];

    public function getTemperature(): float
    {
        return $this->temperature;
    }

    public function setTemperature(float $temperature): void
    {
        $this->temperature = $temperature;
    }

    public function getCandidateCount(): int
    {
        return $this->candidateCount;
    }

    public function setCandidateCount(int $candidateCount): void
    {
        $this->candidateCount = $candidateCount;
    }

    public function getMaxOutputTokens(): int
    {
        return $this->maxOutputTokens;
    }

    public function setMaxOutputTokens(int $maxOutputTokens): void
    {
        $this->maxOutputTokens = $maxOutputTokens;
    }

    public function getTopP(): float
    {
        return $this->topP;
    }

    public function setTopP(float $topP): void
    {
        $this->topP = $topP;
    }

    public function getResponseModalities(): array
    {
        return $this->responseModalities;
    }

    public function setResponseModalities(array $responseModalities): void
    {
        $this->responseModalities = $responseModalities;
    }

    public function getSafetySettings(): array
    {
        return $this->safetySettings;
    }

    public function setSafetySettings(array $safetySettings): void
    {
        $this->safetySettings = $safetySettings;
    }

    public function getReferImages(): array
    {
        return $this->referImages;
    }

    public function setReferImages(array $referImages): void
    {
        $this->referImages = $referImages;
    }

    public function getGenerationConfig(): array
    {
        return [
            'temperature' => $this->temperature,
            'candidateCount' => $this->candidateCount,
            'maxOutputTokens' => $this->maxOutputTokens,
            'topP' => $this->topP,
            'responseModalities' => $this->responseModalities,
        ];
    }
}
