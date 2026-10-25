import type { ContactOrganizationApi } from "@magic-admin-v2/api/contact-organization/api";
import type { ContactTokenPage } from "@magic-admin-v2/api/contact-organization/types";
import type {
	ContactDepartmentLike,
	ContactDepartmentSelectorNode,
	ContactOrganizationSelectorAdapters,
	ContactUserLike,
	ContactUserSelectorNode,
	NormalizedContactPage,
	OrganizationSelectorNode,
	SelectorNodesFromIdsParams,
} from "./types";

export function contactDepartmentToSelectorNode(
	department: ContactDepartmentLike,
): OrganizationSelectorNode {
	const id = department.department_id ?? department.id ?? "";

	return {
		id,
		name: department.i18n_name || department.name || id,
		type: "department",
		memberCount: department.employee_sum ?? department.user_count ?? department.member_count,
		hasChildren: Boolean(
			department.has_child ||
				department.have_children ||
				Number(department.children_count) > 0,
		),
		raw: department,
	};
}

export function contactUserToSelectorNode(user: ContactUserLike): OrganizationSelectorNode {
	const id = user.user_id ?? user.id ?? "";
	const name =
		user.nickname ||
		user.name ||
		user.real_name ||
		user.user_name ||
		user.email ||
		user.phone ||
		id;

	return {
		id,
		name,
		type: "user",
		avatarUrl: user.avatar_url || user.avatar,
		description: [
			formatContactDepartments(user.departments),
			user.job_title || user.position,
			user.work_number,
			user.email,
			user.phone,
		]
			.filter(Boolean)
			.join(" · "),
		raw: user,
	};
}

export function selectorNodesFromIds({
	departmentIds,
	existingNodes = [],
	userIds,
}: SelectorNodesFromIdsParams): OrganizationSelectorNode[] {
	const existingNodeMap = new Map(
		existingNodes.map((node) => [`${node.type}:${node.id}`, node]),
	);

	return [
		...departmentIds.map<OrganizationSelectorNode>((id) => {
			return existingNodeMap.get(`department:${id}`) ?? {
				id,
				name: id,
				type: "department",
			};
		}),
		...userIds.map<OrganizationSelectorNode>((id) => {
			return existingNodeMap.get(`user:${id}`) ?? {
				id,
				name: id,
				type: "user",
			};
		}),
	];
}

function formatContactDepartments(departments?: Array<string | { name?: string }>) {
	return departments
		?.map((department) => (typeof department === "string" ? department : department.name))
		.filter(Boolean)
		.join(" / ");
}

/**
 * 将 Magic 联系人协议适配为公共组织选择器协议。
 */
export function createContactOrganizationSelectorAdapters(
	api: ContactOrganizationApi,
): ContactOrganizationSelectorAdapters {
	const loadChildren: ContactOrganizationSelectorAdapters["loadChildren"] = async ({
		includeMembers,
		parentId,
		signal,
	}) => {
		const departmentId = parentId || "-1";
		const [departments, users] = await Promise.all([
			fetchAllContactTokenPages((pageToken) =>
				api.getDepartmentChildren(
					{ departmentId, pageToken, sumType: 2 },
					{ signal },
				),
			),
			includeMembers
				? fetchAllContactTokenPages((pageToken) =>
						api.getDepartmentUsers({ departmentId, pageToken }, { signal }),
					)
				: Promise.resolve([]),
		]);

		return [
			...departments.map(contactDepartmentToCompatibleNode),
			...users.map(contactUserToCompatibleNode),
		];
	};

	const searchMembers: ContactOrganizationSelectorAdapters["searchMembers"] = async ({
		pageToken,
		query,
		signal,
	}) => {
		const result = normalizeContactTokenPage(
			await api.searchUsers({ pageToken, query, queryType: 1 }, { signal }),
		);

		return {
			items: result.items.map(contactUserToCompatibleNode),
			hasMore: result.hasMore,
			pageToken: result.pageToken,
		};
	};

	return { loadChildren, searchMembers };
}

export function normalizeContactTokenPage<TItem>(
	result: ContactTokenPage<TItem>,
): NormalizedContactPage<TItem> {
	const pageToken = result.next_page_token || result.page_token || undefined;

	return {
		items: result.items ?? result.list ?? result.data ?? [],
		hasMore: Boolean(pageToken && (result.has_more ?? true)),
		pageToken,
	};
}

export async function fetchAllContactTokenPages<TItem>(
	fetchPage: (pageToken?: string) => Promise<ContactTokenPage<TItem>>,
) {
	const items: TItem[] = [];
	const visitedTokens = new Set<string>();
	let pageToken: string | undefined;
	let shouldContinue = true;

	while (shouldContinue) {
		const page = normalizeContactTokenPage(await fetchPage(pageToken));
		items.push(...page.items);

		shouldContinue =
			page.hasMore &&
			Boolean(page.pageToken) &&
			!visitedTokens.has(page.pageToken ?? "");
		if (!shouldContinue) {
			return items;
		}

		visitedTokens.add(page.pageToken!);
		pageToken = page.pageToken;
	}

	return items;
}

export function contactDepartmentToCompatibleNode(
	department: ContactDepartmentLike,
): ContactDepartmentSelectorNode {
	return {
		...department,
		...contactDepartmentToSelectorNode(department),
		dataType: "department",
		type: "department",
	}
}

export function contactUserToCompatibleNode(
	user: ContactUserLike,
): ContactUserSelectorNode {
	return {
		...user,
		...contactUserToSelectorNode(user),
		dataType: "user",
		type: "user",
	}
}
