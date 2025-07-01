<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Speech\Entity\Dto;

use App\Infrastructure\Core\AbstractDTO;

class SpeechRequestDTO extends AbstractDTO
{
    protected string $modelName = 'bigmodel';

    protected bool $enableItn = true;

    protected bool $enablePunc = false;

    protected bool $enableDdc = false;

    protected bool $enableSpeakerInfo = true;

    protected bool $enableChannelSplit = false;

    protected bool $showUtterances = false;

    protected bool $vadSegment = false;

    protected ?int $endWindowSize = null;

    protected ?string $sensitiveWordsFilter = null;

    protected ?SpeechCorpusDTO $corpus = null;

    protected ?string $callback = null;

    protected ?string $callbackData = null;

    public function __construct(array $data = [])
    {
        parent::__construct($data);
    }

    public function getModelName(): string
    {
        return $this->modelName;
    }

    public function setModelName(string $modelName): void
    {
        $this->modelName = $modelName;
    }

    public function isEnableItn(): bool
    {
        return $this->enableItn;
    }

    public function setEnableItn(bool $enableItn): void
    {
        $this->enableItn = $enableItn;
    }

    public function isEnablePunc(): bool
    {
        return $this->enablePunc;
    }

    public function setEnablePunc(bool $enablePunc): void
    {
        $this->enablePunc = $enablePunc;
    }

    public function isEnableDdc(): bool
    {
        return $this->enableDdc;
    }

    public function setEnableDdc(bool $enableDdc): void
    {
        $this->enableDdc = $enableDdc;
    }

    public function isEnableSpeakerInfo(): bool
    {
        return $this->enableSpeakerInfo;
    }

    public function setEnableSpeakerInfo(bool $enableSpeakerInfo): void
    {
        $this->enableSpeakerInfo = $enableSpeakerInfo;
    }

    public function isEnableChannelSplit(): bool
    {
        return $this->enableChannelSplit;
    }

    public function setEnableChannelSplit(bool $enableChannelSplit): void
    {
        $this->enableChannelSplit = $enableChannelSplit;
    }

    public function isShowUtterances(): bool
    {
        return $this->showUtterances;
    }

    public function setShowUtterances(bool $showUtterances): void
    {
        $this->showUtterances = $showUtterances;
    }

    public function isVadSegment(): bool
    {
        return $this->vadSegment;
    }

    public function setVadSegment(bool $vadSegment): void
    {
        $this->vadSegment = $vadSegment;
    }

    public function getEndWindowSize(): ?int
    {
        return $this->endWindowSize;
    }

    public function setEndWindowSize(?int $endWindowSize): void
    {
        $this->endWindowSize = $endWindowSize;
    }

    public function getSensitiveWordsFilter(): ?string
    {
        return $this->sensitiveWordsFilter;
    }

    public function setSensitiveWordsFilter(?string $sensitiveWordsFilter): void
    {
        $this->sensitiveWordsFilter = $sensitiveWordsFilter;
    }

    public function getCorpus(): ?SpeechCorpusDTO
    {
        return $this->corpus;
    }

    public function setCorpus(null|array|SpeechCorpusDTO $corpus): void
    {
        if (is_array($corpus)) {
            $corpus = new SpeechCorpusDTO($corpus);
        }
        $this->corpus = $corpus;
    }

    public function getCallback(): ?string
    {
        return $this->callback;
    }

    public function setCallback(?string $callback): void
    {
        $this->callback = $callback;
    }

    public function getCallbackData(): ?string
    {
        return $this->callbackData;
    }

    public function setCallbackData(?string $callbackData): void
    {
        $this->callbackData = $callbackData;
    }
}
