export default {
  label: 'English',
  lang: 'en',
  link: '/en',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Tutorial', link: '/en/tutorial/magic-info/index' },
      { text: 'Development', link: '/en/development/quick-start/quick-introduction' }
    ],
    sidebar: {
      '/en/tutorial/': [
        {
          text: 'Magic Introduction',
          collapsed: false,
          items: [
            { text: 'What is Magic', link: '/en/tutorial/magic-info/index' },
            { text: 'Terminology', link: '/en/tutorial/magic-info/names' },
            { text: 'Core Features', link: '/en/tutorial/magic-info/core-function' },
            // { text: 'Open Source and Enterprise Edition', link: '/en/tutorial/magic-info/opensource-enterprise' },
          ]
        },
        {
          text: 'Quick Start',
          collapsed: false,
          items: [
            {
              text: 'Create AI Assistant',
              collapsed: false,
              items: [
                { text: 'Key Concepts', link: '/en/tutorial/quick-start/build-a-bot/Key concepts.md' },
                { text: 'Build Your First AI Assistant', link: '/en/tutorial/quick-start/build-a-bot/quickly-build-an-agent' },
                { text: 'Quickly Build an AI Translation Assistant', link: '/en/tutorial/quick-start/build-a-bot/quick-build-AI-translation-assistant' },
               
                { text: 'Tools',
                  collapsed: false,
                  items: 
                  [
                    { text: 'Create Tools',  link: '/en/tutorial/quick-start/build-a-bot/tools/build-a-tool', },
                  ] 
                },
                {
                  text: 'Flow',
                  link: '/en/tutorial/basic/flow/what-is-flow',
                  items: [
                    { text: 'Build a Flow', link: '/en/tutorial/basic/flow/build-a-flow' },
                  ]
                },
              ]
            },
            {
              text: 'Model Management',
              collapsed: false,
              items: [
                { text: 'Large Language Model Management', link: '/en/tutorial/quick-start/manage-llm/llm2' },
              ]
            },
           
          ]
        },
        
        {
          text: 'Basic Concepts',
          collapsed: false,
          items: [
            {
              text: 'Nodes',
              items: [
                {
                  text: 'Basic Nodes',
                  items: [
                    { text: 'Start Node', link: '/en/tutorial/basic/node/start-node' },
                    { text: 'Reply Node', link: '/en/tutorial/basic/node/reply-node' },
                    { text: 'Wait Node', link: '/en/tutorial/basic/node/wait-node' },
                    { text: 'End Node', link: '/en/tutorial/basic/node/end-node' },
                  ]
                },
                {
                  text: 'Large Models',
                  items: [
                    { text: 'Large Model Node', link: '/en/tutorial/basic/node/Large-model' },
                    { text: 'Intent Recognition Node', link: '/en/tutorial/basic/node/Intent-recognition' },
                  ]
                },
                {
                  text: 'Operations',
                  items: [
                    { text: 'Knowledge Retrieval Node', link: '/en/tutorial/basic/node/Knowledge-retrieval' },
                    { text: 'Create Group Chat Node', link: '/en/tutorial/basic/node/Create-group-chat' },
                    { text: 'Image Generation Node', link: '/en/tutorial/basic/node/Image-generation' },
                    { text: 'Personnel Retrieval Node', link: '/en/tutorial/basic/node/Personnel-retrieval' },
                    { text: 'HTTP Request Node', link: '/en/tutorial/basic/node/HTTP-request' },
                    { text: 'Subprocess Node', link: '/en/tutorial/basic/node/Subprocess' },
                    { text: 'Loop Node', link: '/en/tutorial/basic/node/Loop' },
                    { text: 'Selector Node', link: '/en/tutorial/basic/node/Selector' },
                    { text: 'Tool Node', link: '/en/tutorial/basic/node/Tool' },
                    { text: 'Code Execution Node', link: '/en/tutorial/basic/node/Code-execution' },
                    { text: 'Cloud Document Parsing Node', link: '/en/tutorial/basic/node/Cloud-document-parsing' },
                    { text: 'Document Parsing Node', link: '/en/tutorial/basic/node/Document-parsing' },
                    { text: 'Spreadsheet Parsing Node', link: '/en/tutorial/basic/node/Spreadsheet-parsing' },
                  ]
                },
                {
                  text: 'Data Processing',
                  items: [
                    { text: 'Data Storage Node', link: '/en/tutorial/basic/node/Data-storage' },
                    { text: 'Data Loading Node', link: '/en/tutorial/basic/node/Data-loading' },
                    { text: 'Historical Message Query Node', link: '/en/tutorial/basic/node/Historical-message-query' },
                    { text: 'Historical Message Storage Node', link: '/en/tutorial/basic/node/Historical-message-storage' },
                    { text: 'Variable Saving Node', link: '/en/tutorial/basic/node/Variable-saving' },
                    { text: 'Vector Deletion Node', link: '/en/tutorial/basic/node/Vector-deletion' },
                    { text: 'Vector Search Node', link: '/en/tutorial/basic/node/Vector-search' },
                    { text: 'Vector Storage Node', link: '/en/tutorial/basic/node/Vector-storage' },
                    { text: 'Vector Knowledge Base Matching Node', link: '/en/tutorial/basic/node/Vector-knowledge-base-matching' },
                    { text: 'Text Segmentation Node', link: '/en/tutorial/basic/node/Text-segmentation' },
                  ]
                },
              ]
            }
          ],
        },
        {
          text: 'Best Practices',
          collapsed: false,
          items: [
            { text: 'Complex Tasks in One Sentence', link: '/en/tutorial/best-practice/complex-tasks-in-one-sentence' },
            { text: 'Guide to Using the Magic Approval Assistant', link: '/en/tutorial/best-practice/guide-to-using-the-magic-approval-assistant' },
            { text: 'Build a Store Knowledge Assistant', link: '/en/tutorial/best-practice/build-a-store-knowledge-assistant' },
          ]
        }
      ],
      '/en/development/': [
        {
          text: 'Getting Started',
          collapsed: false,
          items: [
            { text: 'Quick Introduction', link: '/en/development/quick-start/quick-introduction' },
            { text: 'Super Magic Installation', link: '/en/development/deploy/super-magic' },
          ]
        },
        {
          text: 'Quick Start',
          collapsed: false,
          items: [
            { text: 'Docker Installation', link: '/en/development/deploy/docker' },
          ]
        },
        {
          text: 'Version Management',
          collapsed: false,
          items: [
            { text: 'Version Planning', link: '/en/development/version/release-planning' },
            { text: 'Version Description', link: '/en/development/version/versions' },
            { text: 'Version Update History', link: '/en/development/version/changelog' },
          ]
        },
        {
          text: 'Configuration Guide',
          collapsed: false,
          items: [
            // { text: 'Contribution Guidelines', link: '/en/development/advanced/CONTRIBUTING' },
            { text: 'Initialization Guide', link: '/en/development/advanced/init' },
            { text: 'Environment Variables', link: '/en/development/deploy/environment' },
            { text: 'Permission Configuration', link: '/en/development/advanced/permission' },
            { text: 'File Driver', link: '/en/development/deploy/file-driver' },
          ]
        }
      ]
    },
    footer: {
      message: 'Released under the Apache 2.0 License',
      copyright: 'Copyright © 2025-present Magic Docs'
    }
  }
} 