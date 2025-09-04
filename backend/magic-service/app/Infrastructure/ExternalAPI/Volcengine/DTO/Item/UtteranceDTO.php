<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Volcengine\DTO\Item;

use App\Infrastructure\Core\AbstractDTO;
use Hyperf\Codec\Json;

/**
 * Utterance DTO for speech recognition utterance information.
 * 对应 JSON 中的 result.utterances[] 数组元素.
 */
class UtteranceDTO extends AbstractDTO
{
    /**
     * @var array<string, mixed> Additional information like speaker ID
     */
    protected array $additions = [];

    protected int $endTime = 0;

    protected int $startTime = 0;

    protected string $text = '';

    /**
     * @var WordDTO[] Array of word objects
     */
    protected array $words = [];

    public function __construct(array $data = [])
    {
        parent::__construct($data);
    }

    /**
     * @return array<string, mixed>
     */
    public function getAdditions(): array
    {
        return $this->additions;
    }

    public function setAdditions(null|array|string $additions): void
    {
        if ($additions === null) {
            $this->additions = [];
        } elseif (is_string($additions)) {
            $decoded = Json::decode($additions);
            $this->additions = is_array($decoded) ? $decoded : [];
        } else {
            $this->additions = $additions;
        }
    }

    public function getEndTime(): int
    {
        return $this->endTime;
    }

    public function setEndTime(null|int|string $endTime): void
    {
        if ($endTime === null) {
            $this->endTime = 0;
        } else {
            $this->endTime = (int) $endTime;
        }
    }

    public function getStartTime(): int
    {
        return $this->startTime;
    }

    public function setStartTime(null|int|string $startTime): void
    {
        if ($startTime === null) {
            $this->startTime = 0;
        } else {
            $this->startTime = (int) $startTime;
        }
    }

    public function getText(): string
    {
        return $this->text;
    }

    public function setText(?string $text): void
    {
        if ($text === null) {
            $this->text = '';
        } else {
            $this->text = $text;
        }
    }

    /**
     * @return WordDTO[]
     */
    public function getWords(): array
    {
        return $this->words;
    }

    public function setWords(null|array|string $words): void
    {
        if ($words === null) {
            $this->words = [];
        } elseif (is_string($words)) {
            $decoded = Json::decode($words);
            $this->words = is_array($decoded) ? $this->convertWordsArray($decoded) : [];
        } else {
            $this->words = $this->convertWordsArray($words);
        }
    }

    public function addWord(WordDTO $word): void
    {
        $this->words[] = $word;
    }

    /**
     * @param array<mixed> $wordsArray
     * @return WordDTO[]
     */
    private function convertWordsArray(array $wordsArray): array
    {
        $result = [];
        foreach ($wordsArray as $word) {
            if ($word instanceof WordDTO) {
                $result[] = $word;
            } elseif (is_array($word)) {
                $result[] = new WordDTO($word);
            }
        }
        return $result;
    }
}
