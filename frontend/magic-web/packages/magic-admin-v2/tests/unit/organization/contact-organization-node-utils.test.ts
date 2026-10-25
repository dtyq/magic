import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  contactUserToSelectorNode,
  selectorNodesFromIds,
} from "../../../src/components/organization-selectors/contact-organization.ts";

describe("organization selector contact node utils", () => {
  it("uses contact user display name before falling back to user id", () => {
    assert.deepEqual(
      contactUserToSelectorNode({
        user_id: "usi_23b256c8323c00ff1fbef5",
        name: "王五",
        avatar_url: "https://example.com/avatar.png",
        job_title: "产品经理",
      }),
      {
        id: "usi_23b256c8323c00ff1fbef5",
        name: "王五",
        type: "user",
        avatarUrl: "https://example.com/avatar.png",
        description: "产品经理",
        raw: {
          user_id: "usi_23b256c8323c00ff1fbef5",
          name: "王五",
          avatar_url: "https://example.com/avatar.png",
          job_title: "产品经理",
        },
      },
    );
  });

  it("preserves existing selector node labels when syncing ids back to form fields", () => {
    assert.deepEqual(
      selectorNodesFromIds({
        departmentIds: [],
        userIds: ["usi_28b0247c0c1c88caf1adfa"],
        existingNodes: [
          {
            id: "usi_28b0247c0c1c88caf1adfa",
            name: "李四",
            type: "user",
            avatarUrl: "https://example.com/user.png",
          },
        ],
      }),
      [
        {
          id: "usi_28b0247c0c1c88caf1adfa",
          name: "李四",
          type: "user",
          avatarUrl: "https://example.com/user.png",
        },
      ],
    );
  });
});
