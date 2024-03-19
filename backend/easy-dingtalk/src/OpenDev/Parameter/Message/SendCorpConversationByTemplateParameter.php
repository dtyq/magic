<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Parameter\Message;

use Dtyq\EasyDingTalk\Kernel\Exceptions\InvalidParameterException;
use Dtyq\EasyDingTalk\OpenDev\Parameter\AbstractParameter;

class SendCorpConversationByTemplateParameter extends AbstractParameter
{
    private int $agentId;

    private string $templateId;

    private array $useridList = [];

    private array $deptIdList = [];

    private array $data = [];

    public function setAgentId(int $agentId): void
    {
        $this->agentId = $agentId;
    }

    public function setTemplateId(string $templateId): void
    {
        $this->templateId = $templateId;
    }

    public function setUseridList(array $useridList): void
    {
        $this->useridList = $useridList;
    }

    public function setDeptIdList(array $deptIdList): void
    {
        $this->deptIdList = $deptIdList;
    }

    public function setData(array $data): void
    {
        $this->data = $data;
    }

    public function getAgentId(): int
    {
        return $this->agentId;
    }

    public function getTemplateId(): string
    {
        return $this->templateId;
    }

    public function getUseridList(): array
    {
        return $this->useridList;
    }

    public function getDeptIdList(): array
    {
        return $this->deptIdList;
    }

    public function getData(): array
    {
        return $this->data;
    }

    protected function validateParams(): void
    {
        if (empty($this->agentId)) {
            throw new InvalidParameterException('agent_id 不能为空');
        }
        if (empty($this->templateId)) {
            throw new InvalidParameterException('template_id 不能为空');
        }
        if (empty($this->useridList) && empty($this->deptIdList)) {
            throw new InvalidParameterException('userid_list 和 dept_id_list 不能同时为空');
        }
    }
}
