<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Model;

use App\Domain\ModelAdmin\Constant\ModelType;
use App\Domain\ModelAdmin\Constant\ServiceProviderCategory;
use App\Domain\ModelAdmin\Constant\ServiceProviderType;
use App\Domain\ModelAdmin\Constant\Status;
use App\Domain\ModelAdmin\Entity\ServiceProviderConfigEntity;
use App\Domain\ModelAdmin\Entity\ServiceProviderEntity;
use App\Domain\ModelAdmin\Entity\ServiceProviderModelsEntity;
use App\Domain\ModelAdmin\Entity\ValueObject\ServiceProviderConfig;
use App\Domain\ModelAdmin\Service\Provider\VLM\MiracleVisionProvider;
use App\Domain\ModelAdmin\Service\ServiceProviderDomainService;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateModelType;
use HyperfTest\Cases\BaseTest;

/**
 * @internal
 */
class ServiceProviderServiceTest extends BaseTest
{
    public function test333()
    {
        $di = di(ServiceProviderDomainService::class);
        $di->initOrganizationServiceProviders('drtterk25jqo', ServiceProviderCategory::VLM);
    }

    public function testSaveServiceProvider()
    {
        $aiVendorDomainService = $this->getServiceProviderService();
        $aiVendorEntity = new ServiceProviderEntity();
        $aiVendorEntity->setName('OPENAI');
        $aiVendorEntity->setDescription('OPENAI');
        $aiVendorEntity->setProviderType(ServiceProviderType::NORMAL->value);
        $aiVendorEntity->setCategory(ServiceProviderCategory::LLM->value);
        $aiVendorEntity->setStatus(Status::ACTIVE->value);
        $aiVendorDomainService->addServiceProvider($aiVendorEntity, ['DT001']);
        // 校验是否保存成功
        $this->assertNotNull($aiVendorEntity->getId());
        // 校验其他组织是否添加成功该服务商
        $aiVendorConfigDTO = $aiVendorDomainService->getServiceProviderConfigDetail((string) $aiVendorEntity->getId(), 'DT001');
        $this->assertNotNull($aiVendorConfigDTO);
    }

    public function testGetServiceProvider()
    {
        $aiVendorDomainService = $this->getServiceProviderService();
        $aiVendorEntities = $aiVendorDomainService->getAllServiceProvider(1, 1);
        $aiVendorEntity = $aiVendorDomainService->getServiceProviderById($aiVendorEntities[0]->getId());
        var_dump($aiVendorEntity);
        $this->assertNotNull($aiVendorEntity->getId());
    }

    // 服务商添加模型
    public function testAddModelToServiceProvider()
    {
        $aiVendorDomainService = $this->getServiceProviderService();
        $aiVendorEntities = $aiVendorDomainService->getAllServiceProvider(1, 100);
        $aiVendorEntity = $aiVendorEntities[2];
        $aiModelEntity = new ServiceProviderModelsEntity();
        $aiModelEntity->setServiceProviderConfigId($aiVendorEntity->getId());
        $aiModelEntity->setName('gpt4o');
        $aiModelEntity->setDescription('gpt4o');
        $aiModelEntity->setModelVersion('gpt4o');
        $aiModelEntity->setCategory(ServiceProviderCategory::LLM->value);
        $aiModelEntity->setModelType(ModelType::LLM->value);
        $aiModelEntity->setSort(1);
        $aiVendorDomainService->saveModelsToServiceProvider([$aiModelEntity], $aiModelEntity->getServiceProviderConfigId());
        $this->assertNotNull($aiModelEntity->getId());
    }

    // 当前组织获取服务商
    public function testGetServiceProviderByOrganizationCode()
    {
        $org = 'DT001';
        $aiVendorDomainService = $this->getServiceProviderService();
        $vendorsByOrganization = $aiVendorDomainService->getServiceProviderConfigs($org);
        var_dump($vendorsByOrganization);
    }

    // 获取服务商详细信息
    public function testGetServiceProviderDetail()
    {
        $id = '751040621307113472';
        $org = 'DT001';
        $aiVendorDomainService = $this->getServiceProviderService();
        $aiVendorConfigDTO = $aiVendorDomainService->getServiceProviderConfigDetail($id, $org);
        var_dump($aiVendorConfigDTO);
    }

    // 保存服务商配置
    public function testSaveServiceProviderConfig()
    {
        $id = 751172167703973888;
        $org = 'DT001';
        $serviceProviderId = 751172167095799808;
        $config = [];
        $status = Status::ACTIVE->value;
        $aiVendorDomainService = $this->getServiceProviderService();
        $aiVendorConfigEntity = new ServiceProviderConfigEntity();
        $aiVendorConfigEntity->setId($id);
        $aiVendorConfigEntity->setOrganizationCode($org);
        $aiVendorConfigEntity->setServiceProviderId($serviceProviderId);
        $aiVendorConfigEntity->setConfig($config);
        $aiVendorConfigEntity->setStatus($status);
        $aiVendorDomainService->updateServiceProviderConfig($aiVendorConfigEntity);
        $aiVendorDTO = $aiVendorDomainService->getServiceProviderById($id);
        $this->assertEquals($aiVendorDTO->getStatus(), $status);
    }

    // 激活/关闭模型
    public function testUpdateModelStatus()
    {
        $org = 'DT001';
        $aiVendorDomainService = $this->getServiceProviderService();
        $aiVendorConfigDTOS = $aiVendorDomainService->getServiceProviderConfigs($org);
        $id = $aiVendorConfigDTOS[0]->getId();
        $aiVendorConfigDTO = $aiVendorDomainService->getServiceProviderConfigDetail($id, $org);
        $models = $aiVendorConfigDTO->getModels();
        $aiVendorDomainService->updateModelStatus('751173869710639104', Status::ACTIVE, $org);
    }

    // 获取组织下所有可用的模型
    public function testGetAllModelByOrganization()
    {
        $org = 'DT001';
        $aiVendorDomainService = $this->getServiceProviderService();
        $aiVendorConfigDTOS = $aiVendorDomainService->getActiveModelsByOrganizationCode($org, ServiceProviderCategory::LLM);
        var_dump($aiVendorConfigDTOS);
    }

    // 获取模型列表通过 add 的方式进行增加
    public function testConnectivityTest()
    {
        $serviceProviderConfig = new ServiceProviderConfig();
        $serviceProviderConfig->setAk('');
        $serviceProviderConfig->setSk('');
        $serviceProviderConfig->setApiKey('');

        $VLMVolcengineProvider = new MiracleVisionProvider();

        $connectResponse = $VLMVolcengineProvider->connectivityTestByModel($serviceProviderConfig, 'high_aes_general_v21_L');
        var_dump($connectResponse);
    }

    public function testInitServiceProvider()
    {
        $service = $this->getServiceProviderService();
        $service->getServiceProviderConfig('flux1-dev', '', 'DT001');
    }

    public function testGetServiceProviderByModel()
    {
        $service = $this->getServiceProviderService();
        $serviceProviderResponse = $service->getMiracleVisionServiceProviderConfig(ImageGenerateModelType::getMiracleVisionModes()[0], 'DT001');
        var_dump($serviceProviderResponse);
    }

    protected function getServiceProviderService(): ServiceProviderDomainService
    {
        return di(ServiceProviderDomainService::class);
    }
}
