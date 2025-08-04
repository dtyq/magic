<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Agent\Facade;

use App\Application\Agent\Service\AgentAppService;
use App\Application\Agent\Service\MagicAgentAppService;
use App\Application\Chat\Service\MagicAccountAppService;
use App\Application\Chat\Service\MagicUserContactAppService;
use App\Domain\Agent\Constant\InstructGroupPosition;
use App\Domain\Agent\Constant\InstructType;
use App\Domain\Agent\Constant\MagicAgentQueryStatus;
use App\Domain\Agent\Constant\MagicAgentVersionStatus;
use App\Domain\Agent\Constant\StatusIcon;
use App\Domain\Agent\Constant\SystemInstructType;
use App\Domain\Agent\Constant\TextColor;
use App\Domain\Agent\DTO\MagicAgentDTO;
use App\Domain\Agent\DTO\MagicAgentVersionDTO;
use App\Domain\Agent\Entity\MagicAgentVersionEntity;
use App\Domain\Agent\Entity\ValueObject\Query\MagicAgentQuery;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\AddFriendType;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Agent\Assembler\AgentAssembler;
use App\Interfaces\Agent\Assembler\FileAssembler;
use App\Interfaces\Agent\Assembler\MagicAgentAssembler;
use App\Interfaces\Agent\Assembler\MagicBotThirdPlatformChatAssembler;
use App\Interfaces\Agent\DTO\MagicBotThirdPlatformChatDTO;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Flow\Assembler\Flow\MagicFlowAssembler;
use App\Interfaces\Flow\DTO\Flow\MagicFlowDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\RequestInterface;
use Throwable;

#[ApiResponse('low_code')]
class MagicAgentApi extends AbstractApi
{
    #[Inject]
    protected MagicAgentAppService $magicAgentAppService;

    #[Inject]
    protected MagicUserContactAppService $userAppService;

    #[Inject]
    protected MagicAccountAppService $accountAppService;

    #[Inject]
    protected MagicAgentAssembler $magicAgentAssembler;

    #[Inject]
    protected MagicBotThirdPlatformChatAssembler $magicAgentThirdPlatformChatAssembler;

    #[Inject]
    protected AgentAppService $agentAppService;

    public function queries()
    {
        /** @var MagicUserAuthorization $authentication */
        $authentication = $this->getAuthorization();
        $inputs = $this->request->all();
        $query = new MagicAgentQuery($inputs);
        $agentName = $inputs['agent_name'] ?? $inputs['robot_name'] ?? '';
        $query->setOrder(['id' => 'desc']);
        $page = $this->createPage();
        $query->setAgentName($agentName);
        $data = $this->magicAgentAppService->queries($authentication, $query, $page);
        return $this->magicAgentAssembler->createPageListAgentDTO($data['total'], $data['list'], $page, $data['avatars']);
    }

    public function queriesAvailable()
    {
        /** @var MagicUserAuthorization $authentication */
        $authentication = $this->getAuthorization();
        $inputs = $this->request->all();
        $query = new MagicAgentQuery($inputs);
        $query->setOrder(['id' => 'desc']);
        $page = Page::createNoPage();
        $data = $this->agentAppService->queriesAvailable($authentication, $query, $page);
        return AgentAssembler::createAvailableList($page, $data['total'], $data['list'], $data['icons']);
    }

    // 创建/修改助理
    public function saveAgent(RequestInterface $request, ?string $agentId = null)
    {
        /** @var MagicUserAuthorization $authorization */
        $authorization = $this->getAuthorization();
        $inputs = $request->all();

        $agentId = $agentId ?? $inputs['id'] ?? '';

        $magicAgentDTO = new MagicAgentDTO();
        $userId = $authorization->getId();
        $organizationCode = $authorization->getOrganizationCode();
        $agentName = $inputs['agent_name'] ?? $inputs['robot_name'] ?? '';
        $agentAvatar = $inputs['agent_avatar'] ?? $inputs['robot_avatar'] ?? '';
        $agentDescription = $inputs['agent_description'] ?? $inputs['robot_description'] ?? '';
        $magicAgentDTO->setCurrentUserId($userId);
        $magicAgentDTO->setCurrentOrganizationCode($organizationCode);

        $magicAgentDTO->setAgentAvatar(FileAssembler::formatPath($agentAvatar));
        $magicAgentDTO->setAgentName($agentName);
        $magicAgentDTO->setAgentDescription($agentDescription);

        $magicAgentDTO->setRobotAvatar(FileAssembler::formatPath($agentAvatar));
        $magicAgentDTO->setRobotName($agentName);
        $magicAgentDTO->setRobotDescription($agentDescription);

        $magicAgentDTO->setId($agentId);

        $magicAgentEntity = $this->magicAgentAppService->saveAgent($authorization, $magicAgentDTO);
        $entityArray = $magicAgentEntity->toArray();
        $entityArray['robot_avatar'] = $magicAgentEntity->getAgentAvatar();
        $entityArray['robot_version_id'] = $magicAgentEntity->getAgentVersionId();
        $entityArray['robot_name'] = $magicAgentEntity->getAgentName();
        $entityArray['bot_description'] = $magicAgentEntity->getAgentDescription();
        return $entityArray;
    }

    // 删除助理
    public function deleteAgentById(RequestInterface $request, ?string $agentId = null)
    {
        /** @var MagicUserAuthorization $authorization */
        $authorization = $this->getAuthorization();
        $agentId = $agentId ?? $request->input('bot_id');
        return $this->magicAgentAppService->deleteAgentById($authorization, $agentId);
    }

    // 获取当前用户的助理

    /**
     * @deprecated
     */
    public function getAgentsByUserId(RequestInterface $request)
    {
        /** @var MagicUserAuthorization $authenticatable */
        $authenticatable = $this->getAuthorization();
        $page = (int) $request->input('page', 1);
        $pageSize = (int) $request->input('page_size', 10);
        $agentName = $request->input('agent_name') ?? $request->input('robot_name') ?? '';
        $queryType = $request->input('query_type', MagicAgentQueryStatus::ALL->value);
        $userId = $authenticatable->getId();
        $agentsByUserIdPage = $this->magicAgentAppService->getAgentsByUserIdPage($userId, $page, $pageSize, $agentName, MagicAgentQueryStatus::from($queryType));
        foreach ($agentsByUserIdPage['list'] as &$agent) {
            $agent['bot_version_id'] = $agent['agent_version_id'];
            $agent['robot_avatar'] = $agent['agent_avatar'];
            $agent['robot_name'] = $agent['agent_name'];
            $agent['robot_description'] = $agent['agent_description'];
            $agent['bot_version'] = $agent['agent_version'];
        }
        return $agentsByUserIdPage;
    }

    // 获取发布版本的助理
    public function getAgentVersionById(RequestInterface $request, ?string $agentVersionId = null)
    {
        /** @var MagicUserAuthorization $authenticatable */
        $authenticatable = $this->getAuthorization();
        $agentVersionId = $agentVersionId ?? $request->input('bot_version_id');
        $magicAgentVO = $this->magicAgentAppService->getAgentVersionByIdForUser($agentVersionId, $authenticatable);
        $magicFlowDTO = MagicFlowAssembler::createMagicFlowDTO($magicAgentVO->getMagicFlowEntity());
        return $this->magicAgentAssembler::createAgentV1Response($magicAgentVO, $magicFlowDTO);
    }

    // 获取企业内部的助理
    public function getAgentsByOrganization(RequestInterface $request)
    {
        /** @var MagicUserAuthorization $authenticatable */
        $authenticatable = $this->getAuthorization();
        $page = (int) $request->input('page', 1);
        $pageSize = (int) $request->input('page_size', 10);
        $agentName = $request->input('agent_name') ?? $request->input('robot_name') ?? '';
        return $this->magicAgentAppService->getAgentsByOrganizationPage($authenticatable, $page, $pageSize, $agentName);
    }

    // 获取应用市场助理
    public function getAgentsFromMarketplace(RequestInterface $request)
    {
        $this->getAuthorization();
        $page = (int) $request->input('page', 1);
        $pageSize = (int) $request->input('page_size', 10);
        return $this->magicAgentAppService->getAgentsFromMarketplacePage($page, $pageSize);
    }

    // 发布助理版本

    /**
     * @throws Throwable
     */
    public function releaseAgentVersion(RequestInterface $request)
    {
        /** @var MagicUserAuthorization $authorization */
        $authorization = $this->getAuthorization();
        $inputs = $request->all();
        $magicAgentVersionDTO = new MagicAgentVersionDTO($inputs);

        $agentId = $inputs['agent_id'] ?? $inputs['bot_id'];
        $magicAgentVersionDTO->setAgentId($agentId);

        $magicFlowDO = null;
        if (! empty($inputs['magic_flow'])) {
            $magicFLowDTO = new MagicFlowDTO($inputs['magic_flow']);
            $magicFlowDO = MagicFlowAssembler::createMagicFlowDO($magicFLowDTO);
        }

        $thirdPlatformList = null;
        if (isset($inputs['third_platform_list'])) {
            $thirdPlatformList = [];
            foreach ($inputs['third_platform_list'] as $thirdPlatform) {
                $thirdPlatformChatDTO = new MagicBotThirdPlatformChatDTO($thirdPlatform);
                $thirdPlatformList[] = $this->magicAgentThirdPlatformChatAssembler->createDO($thirdPlatformChatDTO);
            }
        }

        $result = $this->magicAgentAppService->releaseAgentVersion($authorization, $magicAgentVersionDTO, $magicFlowDO, $thirdPlatformList);
        /**
         * @var MagicAgentVersionEntity $magicAgentVersionEntity
         */
        $magicAgentVersionEntity = $result['data'];

        $userDTO = new MagicUserEntity();
        $userDTO->setAvatarUrl($magicAgentVersionEntity->getAgentAvatar());
        $userDTO->setNickName($magicAgentVersionEntity->getAgentName());
        $userDTO->setDescription($magicAgentVersionEntity->getAgentDescription());
        $userEntity = $this->accountAppService->aiRegister($userDTO, $authorization, $magicAgentVersionEntity->getFlowCode());
        $result['user'] = $userEntity;

        if ($result['is_add_friend']) {
            $friendId = $userEntity->getUserId();
            // 添加好友，助理默认同意好友
            $this->userAppService->addFriend($authorization, $friendId, AddFriendType::PASS);
        }
        return $result;
    }

    // 查询助理的版本记录
    public function getReleaseAgentVersions(RequestInterface $request, ?string $agentId = null)
    {
        /** @var MagicUserAuthorization $authenticatable */
        $authenticatable = $this->getAuthorization();
        $agentId = $agentId ?? $request->input('bot_id');
        return $this->magicAgentAppService->getReleaseAgentVersions($authenticatable, $agentId);
    }

    // 获取助理最新版本号
    public function getAgentMaxVersion(RequestInterface $request, ?string $agentId = null)
    {
        /** @var MagicUserAuthorization $authorization */
        $authorization = $this->getAuthorization();
        $agentId = $agentId ?? $request->input('bot_id');
        return $this->magicAgentAppService->getAgentMaxVersion($authorization, $agentId);
    }

    // 启用｜禁用助理
    public function updateAgentStatus(RequestInterface $request, ?string $agentId = null)
    {
        /** @var MagicUserAuthorization $authorization */
        $authorization = $this->getAuthorization();
        $agentId = $agentId ?? $request->input('bot_id');
        $status = (int) $request->input('status');
        $this->magicAgentAppService->updateAgentStatus($authorization, $agentId, MagicAgentVersionStatus::from($status));
    }

    // 改变助理发布到组织的状态
    public function updateAgentEnterpriseStatus(RequestInterface $request, ?string $agentId = null)
    {
        /** @var MagicUserAuthorization $authorization */
        $authorization = $this->getAuthorization();
        $agentId = $agentId ?? $request->input('bot_id');
        $status = (int) $request->input('status');
        $this->magicAgentAppService->updateAgentEnterpriseStatus($authorization, $agentId, $status, $authorization->getId());
    }

    // 获取助理详情
    public function getAgentDetailByAgentId(RequestInterface $request, ?string $agentId = null)
    {
        /** @var MagicUserAuthorization $authenticatable */
        $authenticatable = $this->getAuthorization();
        $agentId = $agentId ?? $request->input('bot_id');
        $magicAgentAssembler = new MagicAgentAssembler();
        $magicAgentVO = $this->magicAgentAppService->getAgentDetail($agentId, $authenticatable);
        $magicFlowDTO = MagicFlowAssembler::createMagicFlowDTO($magicAgentVO->getMagicFlowEntity());
        return $magicAgentAssembler::createAgentV1Response($magicAgentVO, $magicFlowDTO);
    }

    /**
     * @throws Throwable
     */
    public function registerAgentAndAddFriend(RequestInterface $request, ?string $agentVersionId = null)
    {
        /** @var MagicUserAuthorization $authorization */
        $authorization = $this->getAuthorization();
        $agentVersionId = $agentVersionId ?? $request->input('bot_version_id');
        $magicAgentVersionEntity = $this->magicAgentAppService->getAgentById($agentVersionId, $authorization);
        $userDTO = MagicUserEntity::fromMagicAgentVersionEntity($magicAgentVersionEntity);
        $aiCode = $magicAgentVersionEntity->getFlowCode();
        $userEntity = $this->accountAppService->aiRegister($userDTO, $authorization, $aiCode);
        $friendId = $userEntity->getUserId();
        // 添加好友，助理默认同意好友
        $this->userAppService->addFriend($authorization, $friendId, AddFriendType::PASS);

        return $userEntity;
    }

    public function isUpdated(RequestInterface $request, ?string $agentId = null)
    {
        /** @var MagicUserAuthorization $authenticatable */
        $authenticatable = $this->getAuthorization();
        $agentId = $agentId ?? $request->input('bot_id');
        return $this->magicAgentAppService->isUpdated($authenticatable, $agentId);
    }

    // 根据 userId 获取发布版本的助理详情
    public function getDetailByUserId(RequestInterface $request, ?string $userId = null)
    {
        $this->getAuthorization();
        $userId = $userId ?? $request->input('user_id');
        $magicAgentVersionEntity = $this->magicAgentAppService->getDetailByUserId($userId);
        if (! $magicAgentVersionEntity) {
            return [];
        }
        return $magicAgentVersionEntity->toArray();
    }

    // 获取交互指令类型
    public function getInstructTypeOptions()
    {
        return InstructType::getTypeOptions();
    }

    // 获取交互指令组类型
    public function getInstructGroupTypeOptions()
    {
        return InstructGroupPosition::getTypeOptions();
    }

    public function getInstructionStateColorOptions()
    {
        return TextColor::getColorOptions();
    }

    public function getInstructionIconColorOptions()
    {
        return StatusIcon::getValues();
    }

    public function getSystemInstructTypeOptions()
    {
        return SystemInstructType::getTypeOptions();
    }

    public function saveInstruct(RequestInterface $request, ?string $agentId = null)
    {
        /** @var MagicUserAuthorization $authenticatable */
        $authenticatable = $this->getAuthorization();
        $instructs = $request->input('instructs');
        $agentId = $agentId ?? $request->input('bot_id');
        return $this->magicAgentAppService->saveInstruct($authenticatable, $agentId, $instructs);
    }

    // 获取聊天模式可用助理列表
    public function getChatModeAvailableAgents()
    {
        /** @var MagicUserAuthorization $authenticatable */
        $authenticatable = $this->getAuthorization();
        $inputs = $this->request->all();
        $query = new MagicAgentQuery($inputs);
        $query->setOrder(['id' => 'desc']);

        // 创建分页对象
        $page = $this->createPage();

        // 获取全量数据
        $data = $this->magicAgentAppService->getChatModeAvailableAgents($authenticatable, $query);

        // 在 API 层进行分页处理
        return AgentAssembler::createChatModelAvailableList($page, $data['total'], $data['list']);
    }
}
