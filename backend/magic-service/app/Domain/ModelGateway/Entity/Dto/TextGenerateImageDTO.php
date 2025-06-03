<?php

namespace App\Domain\ModelGateway\Entity\Dto;

class TextGenerateImageDTO extends  AbstractRequestDTO
{
    protected string $model;

    protected string $prompt;

    protected string $size;

    protected int $n;


    public function getPrompt(): string
    {
        return $this->prompt;
    }

    public function setPrompt(string $prompt): void
    {
        $this->prompt = $prompt;
    }

    public function getSize(): string
    {
        return $this->size;
    }

    public function setSize(string $size): void
    {
        $this->size = $size;
    }

    public function getN(): int
    {
        return $this->n;
    }

    public function setN(int $n): void
    {
        $this->n = $n;
    }


    public function getType(): string
    {
        return 'image';
    }
}