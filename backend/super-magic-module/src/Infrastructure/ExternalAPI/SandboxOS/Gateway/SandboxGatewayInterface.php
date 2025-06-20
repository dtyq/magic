<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\GatewayResult;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\SandboxStatusResult;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\BatchStatusResult;

/**
 * 沙箱网关接口
 * 定义沙箱生命周期管理和代理转发功能
 */
interface SandboxGatewayInterface
{
    /**
     * 创建沙箱
     * 
     * @param array $config 沙箱配置参数
     * @return GatewayResult 创建结果，成功时data包含sandbox_id
     */
    public function createSandbox(array $config = []): GatewayResult;

    /**
     * 获取单个沙箱状态
     * 
     * @param string $sandboxId 沙箱ID
     * @return SandboxStatusResult 沙箱状态结果
     */
    public function getSandboxStatus(string $sandboxId): SandboxStatusResult;

    /**
     * 批量获取沙箱状态
     * 
     * @param array $sandboxIds 沙箱ID列表
     * @return BatchStatusResult 批量状态结果
     */
    public function getBatchSandboxStatus(array $sandboxIds): BatchStatusResult;

    /**
     * 代理转发请求到沙箱
     * 
     * @param string $sandboxId 沙箱ID
     * @param string $method HTTP方法
     * @param string $path 目标路径
     * @param array $data 请求数据
     * @param array $headers 额外头信息
     * @return GatewayResult 代理结果
     */
    public function proxySandboxRequest(
        string $sandboxId,
        string $method,
        string $path,
        array $data = [],
        array $headers = []
    ): GatewayResult;
} 