/**
 * JSON Schema 模拟数据
 */

export default {
    key: "root",
    type: "object",
    properties: {
        type: {
            type: "string",
            value: null,
            title: "type",
            description: "",
        },
        attributes: {
            type: "array",
            value: null,
            title: "attributes",
            description: "",
            items: {
                type: "object",
                value: null,
                title: "对象",
                description: "",
                properties: {
                    key: {
                        type: "string",
                        value: null,
                        title: "key",
                        description: "",
                    },
                    language: {
                        type: "string",
                        value: null,
                        title: "language",
                        description: "",
                    },
                    name: {
                        type: "string",
                        value: null,
                        title: "name",
                        description: "",
                    },
                    value: {
                        type: "string",
                        value: null,
                        title: "value",
                        description: "",
                    },
                },
                required: ["key", "language", "name", "value"],
            }
        },
        attributes_01: {
            type: "array",
            value: null,
            title: "attributes",
            description: "",
            items: {
                type: "object",
                value: null,
                title: "0",
                description: "",
                properties: {
                    key: {
                        type: "string",
                        value: null,
                        title: "key",
                        description: "",
                    },
                    language: {
                        type: "string",
                        value: null,
                        title: "language",
                        description: "",
                    },
                    name: {
                        type: "string",
                        value: null,
                        title: "name",
                        description: "",
                    },
                    value: {
                        type: "string",
                        value: null,
                        title: "value",
                        description: "",
                    },
                },
                required: ["key", "language", "name", "value"],
            },
            expression_key: "component-9527.attributes_01",
            properties: {}
        },

        string_key: {
            type: "object",
            key: "string_key",
            sort: 0,
            title: "数据类型为string",
            description: "desc",
            items: null,
            properties: {
                attributes: {
                    type: "array",
                    value: null,
                    title: "attributes",
                    description: "",
                    items: {
                        type: "object",
                        value: null,
                        title: "对象",
                        description: "",
                        properties: {
                            key: {
                                type: "string",
                                value: null,
                                title: "key",
                                description: "",
                            },
                            language: {
                                type: "string",
                                value: null,
                                title: "language",
                                description: "",
                            },
                            name: {
                                type: "string",
                                value: null,
                                title: "name",
                                description: "",
                            },
                            value: {
                                type: "string",
                                value: null,
                                title: "value",
                                description: "",
                            },
                        },
                        required: ["key", "language", "name", "value"],
                    }
                },
                attributes_01: {
                    type: "array",
                    value: null,
                    title: "attributes",
                    description: "",
                    items: {
                        type: "object",
                        value: null,
                        title: "0",
                        description: "",
                        properties: {
                            key: {
                                type: "string",
                                value: null,
                                title: "key",
                                description: "",
                            },
                            language: {
                                type: "string",
                                value: null,
                                title: "language",
                                description: "",
                            },
                            name: {
                                type: "string",
                                value: null,
                                title: "name",
                                description: "",
                            },
                            value: {
                                type: "string",
                                value: null,
                                title: "value",
                                description: "",
                            },
                        },
                        required: ["key", "language", "name", "value"],
                    },
                    expression_key: "component-9527.attributes_01",
                    properties: {}
                },
            },
            required: null,
            value: null,
        },
    },
    required: ["type", "attributes"],
}