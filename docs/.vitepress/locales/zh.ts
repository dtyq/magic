export default {
  label: '简体中文',
  lang: 'zh',
  link: '/zh',
  themeConfig: {
    nav: [
      { text: '首页', link: '/zh/' },
      { text: '使用教程', link: '/zh/tutorial/magic-info/index' },
      { text: '开发文档', link: '/zh/development/quick-start/quick-introduction' }
    ],
    sidebar: {
      '/zh/tutorial/': [
        {
          text: 'Magic介绍',
          collapsed: false,
          items: [
            { text: '什么是Magic', link: '/zh/tutorial/magic-info/index' },
            { text: '名称解释', link: '/zh/tutorial/magic-info/names' },
            { text: '核心功能', link: '/zh/tutorial/magic-info/core-function' },
            // { text: '开源版和企业版', link: '/zh/tutorial/magic-info/opensource-enterprise' },
          ]
        },
        {
          text: '快速开始',
          collapsed: false,
          items: [
            {
              text: '创建AI助理',
              collapsed: false,
              items: [
                { text: '关键概念', link: '/zh/tutorial/quick-start/build-a-bot/Key concepts.md' },
                { text: '搭建第一个AI助理', link: '/zh/tutorial/quick-start/build-a-bot/quickly-build-an-agent' },
                { text: '快速搭建一个AI翻译助理', link: '/zh/tutorial/quick-start/build-a-bot/quick-build-AI-translation-assistant' },
               
                { text: '工具',
                  collapsed: false,
                  items: 
                  [
                    { text: '创建工具',  link: '/zh/tutorial/quick-start/build-a-bot/tools/build-a-tool', },
                  ] 
                },
                {
                  text: '流程',
                  link: '/zh/tutorial/basic/flow/what-is-flow',
                  items: [
                    { text: '搭建一个流程', link: '/zh/tutorial/basic/flow/build-a-flow' },
                    { text: '通过http  api调用流程', link: '/zh/tutorial/basic/flow/use-flow-with-openai' },
                  ]
                },
              ]
            },
            {
              text: '模型管理',
              collapsed: false,
              items: [
                { text: '大模型管理', link: '/zh/tutorial/quick-start/manage-llm/llm2' },
              ]
            },
           
          ]
        },
        {
          text: 'Magic API',
          collapsed: false,
          items: [
            { text: 'Flow API', link: '/zh/tutorial/basic/open-api/flow-open-api' },
          ]
        },
        {
          text: '基础概念',
          collapsed: false,
          items: [
            {
              text: '节点',
              items: [
                {
                  text: '基础节点',
                  items: [
                    { text: '开始节点', link: '/zh/tutorial/basic/node/start-node' },
                    { text: '消息回复节点', link: '/zh/tutorial/basic/node/reply-node' },
                    { text: '等待节点', link: '/zh/tutorial/basic/node/wait-node' },
                    { text: '结束节点', link: '/zh/tutorial/basic/node/end-node' },

                  ]
                },
                {
                  text: '大模型',
                  items: [
                    { text: '大模型节点', link: '/zh/tutorial/basic/node/Large-model' },
                    { text: '意图识别节点', link: '/zh/tutorial/basic/node/Intent-recognition' },

                  ]
                },
                {
                  text: '操作',
                  items: [
                    { text: '知识检索节点', link: '/zh/tutorial/basic/node/Knowledge-retrieval' },
                    { text: '创建群聊节点', link: '/zh/tutorial/basic/node/Create-group-chat' },
                    { text: '图像生成节点', link: '/zh/tutorial/basic/node/Image-generation' },
                    { text: '人员检索节点', link: '/zh/tutorial/basic/node/Personnel-retrieval' },
                    { text: 'HTTP 请求节点', link: '/zh/tutorial/basic/node/HTTP-request' },
                    { text: '子流程节点', link: '/zh/tutorial/basic/node/Subprocess' },

                    { text: '循环节点', link: '/zh/tutorial/basic/node/Loop' },
                    { text: '选择器节点', link: '/zh/tutorial/basic/node/Selector' },
                    { text: '工具节点', link: '/zh/tutorial/basic/node/Tool' },
                    { text: '代码执行节点', link: '/zh/tutorial/basic/node/Code-execution' },

                    { text: '云文档解析节点', link: '/zh/tutorial/basic/node/Cloud-document-parsing' },
                    { text: '文档解析节点', link: '/zh/tutorial/basic/node/Document-parsing' },
                    { text: '电子表格解析节点', link: '/zh/tutorial/basic/node/Spreadsheet-parsing' },
                  ]
                },
                {
                  text: '数据处理',
                  items: [
                    { text: '数据存储节点', link: '/zh/tutorial/basic/node/Data-storage' },
                    { text: '数据加载节点', link: '/zh/tutorial/basic/node/Data-loading' },
                    { text: '历史消息查询节点', link: '/zh/tutorial/basic/node/Historical-message-query' },
                    { text: '历史消息存储节点', link: '/zh/tutorial/basic/node/Historical-message-storage' },
                    { text: '变量保存节点', link: '/zh/tutorial/basic/node/Variable-saving' },
                    { text: '向量删除节点', link: '/zh/tutorial/basic/node/Vector-deletion' },
                    { text: '向量搜索节点', link: '/zh/tutorial/basic/node/Vector-search' },
                    { text: '向量存储节点', link: '/zh/tutorial/basic/node/Vector-storage' },
                    { text: '向量知识库匹配节点', link: '/zh/tutorial/basic/node/Vector-knowledge-base-matching' },
                    { text: '文本切割节点', link: '/zh/tutorial/basic/node/Text-segmentation' },

                  ]
                },


              ]
            }
          ],


        },
        {
          text: '最佳实践',
          collapsed: false,
          items: [
            { text: '一句话实现复杂任务', link: '/zh/tutorial/best-practice/complex-tasks-in-one-sentence' },
            { text: '麦吉审批助理使用指南', link: '/zh/tutorial/best-practice/guide-to-using-the-magic-approval-assistant' },
            { text: '搭建一个门店知识助理', link: '/zh/tutorial/best-practice/build-a-store-knowledge-assistant' },
          ]
        }
      ],
      '/zh/development/': [
        {
          text: '入门介绍',
          collapsed: false,
          items: [
            { text: '入门介绍', link: '/zh/development/quick-start/quick-introduction' },
          ]
        },
        {
          text: '快速启动',
          collapsed: false,
          items: [
            { text: 'Docker 安装', link: '/zh/development/deploy/docker' },
            { text: 'Super Magic 安装', link: '/zh/development/deploy/super-magic' },
          ]
        },

        {
          text: '版本管理',
          collapsed: false,
          items: [
            { text: '版本计划', link: '/zh/development/version/release-planning' },
            { text: '版本说明', link: '/zh/development/version/versions' },
            { text: '版本更新记录', link: '/zh/development/version/changelog' },
          ]
        },
        {
          text: '配置说明',
          collapsed: false,
          items: [
            // { text: '贡献指南', link: '/zh/development/advanced/CONTRIBUTING' },
            { text: '初始化说明', link: '/zh/development/advanced/init' },
            { text: '环境变量', link: '/zh/development/deploy/environment' },
            { text: '权限配置', link: '/zh/development/advanced/permission' },
            { text: '文件驱动', link: '/zh/development/deploy/file-driver' },
          ]
        }
      ]
    },
    footer: {
      message: '基于 Apache 2.0 许可发布',
      copyright: 'Copyright © 2025-present Magic Docs'
    }
  }
} 