<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Bootstrap\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;
use App\Interfaces\Provider\DTO\ConnectivityTestByConfigRequest;

/**
 * 执行初始化请求 DTO.
 */
class BootstrapExecuteRequestDTO extends AbstractRequestDTO
{
    protected array $adminAccount = [];

    protected string $phone = '';

    protected string $password = '';

    protected array $agentInfo = [];

    protected string $agentName = '';

    protected string $agentDescription = '';

    /** 服务商模型配置 */
    protected ?ConnectivityTestByConfigRequest $serviceProviderModel = null;

    /** @var array<string> 选择要同步的官方员工 code，如 data_analysis/design/general/ppt/summary */
    protected array $selectOfficialAgentsCodes = [];

    public function getAdminAccount(): array
    {
        return $this->adminAccount;
    }

    public function setAdminAccount(null|array|string $adminAccount): void
    {
        if (is_string($adminAccount)) {
            $decoded = json_decode($adminAccount, true);
            $adminAccount = is_array($decoded) ? $decoded : [];
        }

        if (! is_array($adminAccount)) {
            $adminAccount = [];
        }

        $this->adminAccount = $adminAccount;
        $this->setPhone((string) ($adminAccount['phone'] ?? ''));
        $this->setPassword((string) ($adminAccount['password'] ?? ''));
    }

    public function getPhone(): string
    {
        return $this->phone;
    }

    public function setPhone(string $phone): void
    {
        $this->phone = trim($phone);
    }

    public function getPassword(): string
    {
        return $this->password;
    }

    public function setPassword(string $password): void
    {
        $this->password = trim($password);
    }

    public function getAgentInfo(): array
    {
        return $this->agentInfo;
    }

    public function setAgentInfo(null|array|string $agentInfo): void
    {
        if (is_string($agentInfo)) {
            $decoded = json_decode($agentInfo, true);
            $agentInfo = is_array($decoded) ? $decoded : [];
        }

        if (! is_array($agentInfo)) {
            $agentInfo = [];
        }

        $this->agentInfo = $agentInfo;
        $this->setAgentName((string) ($agentInfo['name'] ?? ''));
        $this->setAgentDescription((string) ($agentInfo['description'] ?? ''));
    }

    public function getAgentName(): string
    {
        return $this->agentName;
    }

    public function setAgentName(string $agentName): void
    {
        $this->agentName = trim($agentName);
    }

    public function getAgentDescription(): string
    {
        return $this->agentDescription;
    }

    public function setAgentDescription(string $agentDescription): void
    {
        $this->agentDescription = trim($agentDescription);
    }

    /**
     * 获取服务商模型配置（第二步）.
     */
    public function getServiceProviderModel(): ?ConnectivityTestByConfigRequest
    {
        return $this->serviceProviderModel;
    }

    public function setServiceProviderModel(null|array|ConnectivityTestByConfigRequest|string $serviceProviderModel): void
    {
        if ($serviceProviderModel === null) {
            $this->serviceProviderModel = null;
        } elseif ($serviceProviderModel instanceof ConnectivityTestByConfigRequest) {
            $this->serviceProviderModel = $serviceProviderModel;
        } elseif (is_string($serviceProviderModel) && json_validate($serviceProviderModel)) {
            $decoded = json_decode($serviceProviderModel, true);
            $this->serviceProviderModel = is_array($decoded) ? new ConnectivityTestByConfigRequest($decoded) : null;
        } elseif (is_array($serviceProviderModel)) {
            $this->serviceProviderModel = new ConnectivityTestByConfigRequest($serviceProviderModel);
        } else {
            $this->serviceProviderModel = null;
        }
    }

    /**
     * 获取选择要同步的官方员工 code 列表（第三步）.
     *
     * @return array<string>
     */
    public function getSelectOfficialAgentsCodes(): array
    {
        return $this->selectOfficialAgentsCodes;
    }

    public function setSelectOfficialAgentsCodes(null|array|string $selectOfficialAgentsCodes): void
    {
        if ($selectOfficialAgentsCodes === null) {
            $this->selectOfficialAgentsCodes = [];
        } elseif (is_string($selectOfficialAgentsCodes) && json_validate($selectOfficialAgentsCodes)) {
            $decoded = json_decode($selectOfficialAgentsCodes, true);
            $this->selectOfficialAgentsCodes = is_array($decoded) ? array_map('strval', $decoded) : [];
        } elseif (is_array($selectOfficialAgentsCodes)) {
            $this->selectOfficialAgentsCodes = array_map('strval', $selectOfficialAgentsCodes);
        } else {
            $this->selectOfficialAgentsCodes = [];
        }
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'admin_account' => 'required|array',
            'admin_account.phone' => ['required', 'string', 'regex:/^1\d{10}$/'],
            'admin_account.password' => 'required|string',
            'agent_info' => 'sometimes|array',
            'agent_info.name' => 'sometimes|nullable|string|max:255',
            'agent_info.description' => 'sometimes|nullable|string|max:1000',
            'service_provider_model' => 'array|nullable',
            'select_official_agents_codes' => 'array|nullable',
            'select_official_agents_codes.*' => 'string',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [
            'admin_account.required' => 'admin_account is required',
            'admin_account.array' => 'admin_account must be an object',
            'admin_account.phone.required' => 'admin_account.phone is required',
            'admin_account.phone.regex' => 'admin_account.phone is invalid',
            'admin_account.password.required' => 'admin_account.password is required',
            'agent_info.array' => 'agent_info must be an object',
            'agent_info.name.max' => 'agent_info.name length must be at most 255',
            'agent_info.description.max' => 'agent_info.description length must be at most 1000',
            'service_provider_model.array' => 'service_provider_model must be an object',
            'select_official_agents_codes.array' => 'select_official_agents_codes must be an array',
        ];
    }
}
