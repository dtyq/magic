<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Stub\Domain;

use App\Domain\Chat\Service\MagicLLMDomainService;

/**
 * @internal
 */
class MagicLLMDomainServiceStub extends MagicLLMDomainService
{
    public function searchWithBing(string $query, null|bool|string $language = false): array
    {
        return [
            [
                'id' => 'https://api.bing.microsoft.com/api/v7/#WebPages.0',
                'name' => 'ARL(Asset Reconnaissance Lighthouse)资产侦察灯塔系统',
                'url' => 'https://github.com/Aabyss-Team/ARL',
                'datePublished' => '2024-10-16 15:10:43',
                'datePublishedDisplayText' => '2024-10-16 15:10:43',
                'isFamilyFriendly' => true,
                'displayUrl' => 'https://github.com/Aabyss-Team/ARL',
                'snippet' => 'ARL (Asset Reconnaissance Lighthouse)资产侦察灯塔系统. 1# 注明. 因为灯塔ARL的官方开源项目被删除了，所以建立了本开源项目留作备份，本项目所有内容均来自于 TophantTechnology/ARL 最新版本. ARL官方开源项目关闭的具体原因请看： https://mp.weixin.qq.com/s/hM3t3lYQVqDOlrLKz3_TSQ. ARL-NPoC（ARL核心）的最新源码备份： https://github.com/Aabyss-Team/ARL-NPoC. arl_file（ARL相关构建）的最新备份： https://github.com/Aabyss-Team/arl_files.',
                'dateLastCrawled' => '2024-10-16 15:10:43',
                'cachedPageUrl' => 'http://cncc.bingj.com/cache.aspx?q=%E7%81%AF%E5%A1%94%E5%BC%95%E6%93%8E&d=4945530744419986&mkt=zh-CN&setlang=zh-CN&w=PiMd349mKgnI96oFxU0XsQTRzvw548pH',
                'language' => 'en',
                'isNavigational' => false,
                'noCache' => false,
            ],
            [
                'id' => 'https://api.bing.microsoft.com/api/v7/#WebPages.1',
                'name' => '腾讯灯塔融合引擎的设计与实践-腾讯云开发者社区-腾讯云',
                'url' => 'https://cloud.tencent.com/developer/article/2219100',
                'datePublished' => '2024-10-16 15:10:43',
                'datePublishedDisplayText' => '2024-10-16 15:10:43',
                'isFamilyFriendly' => true,
                'displayUrl' => 'https://cloud.tencent.com/developer/article/2219100',
                'snippet' => '本文分享的主题是 腾讯灯塔 融合引擎的设计与实践，主要围绕以下四个方面进行介绍： 1. 背景介绍. 2. 挑战与融合分析引擎的解法. 3. 实践总结. 4. 未来演进方向. 分享作者｜冯国敬 腾讯 后台开发工程师. 一. 背景介绍. 腾讯灯塔是一款端到端的全链路数据产品套件，旨在帮助产品、研发、运营和数据科学团队 30 分钟内做出更可信及时的决策，促进用户增长和留存。 2020 年后数据量仍然呈爆炸性增长的趋势，且业务变化更加迅速、分析需求更加复杂，传统的模式无法投入更多的时间来规划数据模型。 我们面临一个海量、实时和自定义的三角难题。 不同引擎都在致力于去解决这个问题。',
                'dateLastCrawled' => '2024-10-16 15:10:43',
                'cachedPageUrl' => 'http://cncc.bingj.com/cache.aspx?q=%E7%81%AF%E5%A1%94%E5%BC%95%E6%93%8E&d=4735030109934171&mkt=zh-CN&setlang=zh-CN&w=55TpfZ1tgzNpPgJrco_c-mdoWXPNultg',
                'language' => 'en',
                'isNavigational' => false,
                'noCache' => false,
            ],
            [
                'id' => 'https://api.bing.microsoft.com/api/v7/#WebPages.2',
                'name' => '信息收集——搭建你的灯塔（ARL） - FreeBuf网络安全行业门户',
                'url' => 'https://www.freebuf.com/sectool/349664.html',
                'datePublished' => '2024-10-16 15:10:43',
                'datePublishedDisplayText' => '2024-10-16 15:10:43',
                'isFamilyFriendly' => true,
                'displayUrl' => 'https://www.freebuf.com/sectool/349664.html',
                'snippet' => '具体功能： 其中文件泄露经常会找到一些敏感文件（可能是我运气好 [doge]） 解除限制. 灯塔默认是无法扫描edu,org,gov网站的，但是可以解除限制. 首先打开 /ARL/docker目录下的config-docker.yaml，注释掉这三行. 编辑. 然后进入 /ARL/app目录，打开config.py和config.yaml.example文件，相应位置修改为. 编辑. 之后进入web容器中修改配置，使用命令docker ps查看，找到NAME为arl_web的一行复制CONTAINER ID，如图圈中的参数. 编辑. 输入命令docker exec -it (你的CONTAINER ID值) /bin/bash. 编辑.',
                'dateLastCrawled' => '2024-10-16 15:10:43',
                'cachedPageUrl' => 'http://cncc.bingj.com/cache.aspx?q=%E7%81%AF%E5%A1%94%E5%BC%95%E6%93%8E&d=4647387004557550&mkt=zh-CN&setlang=zh-CN&w=VdHh5_9GN1hBY2oY__8aPcs5C5wmC6i7',
                'language' => 'en',
                'isNavigational' => false,
                'noCache' => false,
            ],
            [
                'id' => 'https://api.bing.microsoft.com/api/v7/#WebPages.3',
                'name' => '灯塔引擎 - 助力连锁经营行业数字化转型',
                'url' => 'https://www.dtyq.com/',
                'datePublished' => '2024-10-16 15:10:43',
                'datePublishedDisplayText' => '2024-10-16 15:10:43',
                'isFamilyFriendly' => true,
                'displayUrl' => 'https://www.dtyq.com',
                'snippet' => '广东灯塔引擎科技有限公司，是一家专注于连锁经营行业的数智化解决方案提供商。. • 一站式解决方案：我们提供全套核心技术应用服务，包括技术研发、系统实施、智能运维、智慧决策和大数据分析，为客户的连锁业务提供完整的解决方案。. • 全面智能化 ...',
                'dateLastCrawled' => '2024-10-16 15:10:43',
                'cachedPageUrl' => 'http://cncc.bingj.com/cache.aspx?q=%E7%81%AF%E5%A1%94%E5%BC%95%E6%93%8E&d=5053270008094152&mkt=zh-CN&setlang=zh-CN&w=XY93sySUQ8L59i0phxcRUA1JeOZwlyft',
                'language' => 'en',
                'isNavigational' => false,
                'noCache' => false,
            ],
            [
                'id' => 'https://api.bing.microsoft.com/api/v7/#WebPages.4',
                'name' => 'ARL 资产灯塔系统安装和使用文档 - GitHub Pages',
                'url' => 'https://tophanttechnology.github.io/ARL-doc/',
                'datePublished' => '2024-10-16 15:10:43',
                'datePublishedDisplayText' => '2024-10-16 15:10:43',
                'isFamilyFriendly' => true,
                'displayUrl' => 'https://tophanttechnology.github.io/ARL-doc',
                'snippet' => 'ARL(Asset Reconnaissance Lighthouse)资产侦察灯塔系统旨在快速侦察与目标关联的互联网资产，构建基础资产信息库。 协助甲方安全团队或者渗透测试人员有效侦察和检索资产，以攻击者视角持续探测资产风险，协助用户时刻洞察资产动态，掌握安全防护薄弱点，快速 ...',
                'dateLastCrawled' => '2024-10-16 15:10:43',
                'cachedPageUrl' => 'http://cncc.bingj.com/cache.aspx?q=%E7%81%AF%E5%A1%94%E5%BC%95%E6%93%8E&d=4785422958534490&mkt=zh-CN&setlang=zh-CN&w=ElCfk_kwjIKAKJdmzzIfhiSKN8_6tGWY',
                'language' => 'en',
                'isNavigational' => false,
                'noCache' => false,
            ],
            [
                'id' => 'https://api.bing.microsoft.com/api/v7/#WebPages.5',
                'name' => '从“制造”到“智造”：“灯塔”经验助力中国制造业转型升级',
                'url' => 'https://www.mckinsey.com.cn/%E4%BB%8E%E5%88%B6%E9%80%A0%E5%88%B0%E6%99%BA%E9%80%A0%EF%BC%9A%E7%81%AF%E5%A1%94%E7%BB%8F%E9%AA%8C%E5%8A%A9%E5%8A%9B%E4%B8%AD%E5%9B%BD%E5%88%B6/',
                'datePublished' => '2024-10-16 15:10:43',
                'datePublishedDisplayText' => '2024-10-16 15:10:43',
                'isFamilyFriendly' => true,
                'displayUrl' => 'https://www.mckinsey.com.cn/从制造到智造：灯塔...',
                'snippet' => '从“制造”到“智造”：“灯塔”经验助力中国制造业转型升级. 作者：Karel Eloot，侯文皓，Francisco Betti，Enno de Boer和Yves Giraud. 作为中国实体经济的主体，制造业是推动中国经济发展乃至全球制造业持续增长的重要引擎。. 站在历史与未来交汇的新起点上 ...',
                'dateLastCrawled' => '2024-10-16 15:10:43',
                'cachedPageUrl' => 'http://cncc.bingj.com/cache.aspx?q=%E7%81%AF%E5%A1%94%E5%BC%95%E6%93%8E&d=4935428983423158&mkt=zh-CN&setlang=zh-CN&w=nss5pY5CutHEX4bOln8TFwbaBwkcx6D0',
                'language' => 'en',
                'isNavigational' => false,
                'noCache' => false,
            ],
            [
                'id' => 'https://api.bing.microsoft.com/api/v7/#WebPages.6',
                'name' => '资产侦察之灯塔系统-ARL 快速侦察相关资产 - 雨苁ℒ',
                'url' => 'https://www.ddosi.org/arl/',
                'datePublished' => '2024-10-16 15:10:43',
                'datePublishedDisplayText' => '2024-10-16 15:10:43',
                'isFamilyFriendly' => true,
                'displayUrl' => 'https://www.ddosi.org/arl',
                'snippet' => 'ARL(Asset Reconnaissance Lighthouse)资产侦察灯塔系统旨在快速侦察与目标关联的互联网资产，构建基础资产信息库。 协助甲方安全团队或者渗透测试人员有效侦察和检索资产，以攻击者视角持续探测资产风险，协助用户时刻洞察资产动态，掌握安全防护薄弱点，快速 ...',
                'dateLastCrawled' => '2024-10-16 15:10:43',
                'cachedPageUrl' => 'http://cncc.bingj.com/cache.aspx?q=%E7%81%AF%E5%A1%94%E5%BC%95%E6%93%8E&d=4889996822853925&mkt=zh-CN&setlang=zh-CN&w=4jMPcucuoGOvtrB94WunDL24vDnqXc5S',
                'language' => 'en',
                'isNavigational' => false,
                'noCache' => false,
            ],
            [
                'id' => 'https://api.bing.microsoft.com/api/v7/#WebPages.7',
                'name' => '灯塔索引',
                'url' => 'http://www.dotaindex.com/',
                'datePublished' => '2024-10-16 15:10:43',
                'datePublishedDisplayText' => '2024-10-16 15:10:43',
                'isFamilyFriendly' => true,
                'displayUrl' => 'www.dotaindex.com',
                'snippet' => 'Alzheimers & Dementia | Lecanemab 规划：复杂疗法安全有效管理的蓝图。. Alzheimers & Dementia | 症状前、前驱和症状性额颞叶痴呆的社会规范知识受损。. Alzheimers & Dementia | IL6 受体抑制剂：通过药物靶点孟德尔随机化探索多种疾病的治疗潜力。. Alzheimers & Dementia | Aquaporin-4 ...',
                'dateLastCrawled' => '2024-10-16 15:10:43',
                'cachedPageUrl' => 'http://www.dotaindex.com/',
                'language' => 'en',
                'isNavigational' => false,
                'noCache' => false,
            ],
        ];
    }
}
