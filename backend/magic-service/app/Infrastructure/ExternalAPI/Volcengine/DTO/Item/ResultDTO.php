<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Volcengine\DTO\Item;

use App\Infrastructure\Core\AbstractDTO;
use Hyperf\Codec\Json;

/**
 * Result DTO for speech recognition result information.
 * 对应 JSON 中的 result 对象
 */
class ResultDTO extends AbstractDTO
{
    /**
     * @var array<string, mixed> Additional information
     */
    protected array $additions = [];

    protected string $text = '';

    /**
     * @var UtteranceDTO[] Array of utterance objects
     */
    protected array $utterances = [];

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
     * @return UtteranceDTO[]
     */
    public function getUtterances(): array
    {
        return $this->utterances;
    }

    public function setUtterances(null|array|string $utterances): void
    {
        if ($utterances === null) {
            $this->utterances = [];
        } elseif (is_string($utterances)) {
            $decoded = Json::decode($utterances);
            $this->utterances = is_array($decoded) ? $this->convertUtterancesArray($decoded) : [];
        } else {
            $this->utterances = $this->convertUtterancesArray($utterances);
        }
    }

    public function addUtterance(UtteranceDTO $utterance): void
    {
        $this->utterances[] = $utterance;
    }

    /**
     * @param array<mixed> $utterancesArray
     * @return UtteranceDTO[]
     */
    private function convertUtterancesArray(array $utterancesArray): array
    {
        $result = [];
        foreach ($utterancesArray as $utterance) {
            if ($utterance instanceof UtteranceDTO) {
                $result[] = $utterance;
            } elseif (is_array($utterance)) {
                $result[] = new UtteranceDTO($utterance);
            }
        }
        return $result;
    }
}
