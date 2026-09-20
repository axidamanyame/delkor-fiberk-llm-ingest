/**
 * Client Group classification only. Never write people, customers, or agents here.
 */
export const CLIENT_GROUP_TREE = [
  {
    group_name: 'Investors',
    description: 'Equity and capital. Not shop customers.',
    children: [
      { id: 'a1000000-0000-4000-8000-000000000001', sub_group: 'Individual Investor', description: 'A person investing their own capital.' },
      { id: 'a1000000-0000-4000-8000-000000000002', sub_group: 'Corporate Investor', description: 'A company investing as an entity.' },
      { id: 'a1000000-0000-4000-8000-000000000003', sub_group: 'Angel Investor', description: 'An individual backing early-stage operations.' },
      { id: 'a1000000-0000-4000-8000-000000000004', sub_group: 'Venture Capital', description: 'A fund investing for growth and return.' },
    ],
  },
  {
    group_name: 'Partners',
    description: 'Operating and channel partners. Not goods suppliers.',
    children: [
      { id: 'a2000000-0000-4000-8000-000000000001', sub_group: 'Strategic Partner', description: 'Long-term alignment on market or brand.' },
      { id: 'a2000000-0000-4000-8000-000000000002', sub_group: 'Business Partner', description: 'Shared commercial activity with the group.' },
      { id: 'a2000000-0000-4000-8000-000000000003', sub_group: 'Technology Partner', description: 'Systems, platforms, or technical capability.' },
      { id: 'a2000000-0000-4000-8000-000000000004', sub_group: 'Distribution Partner', description: 'Reach, logistics, or last-mile distribution.' },
    ],
  },
  {
    group_name: 'Consultants',
    description: 'Advisors we retain. Not employees.',
    children: [
      { id: 'a3000000-0000-4000-8000-000000000001', sub_group: 'Financial Consultant', description: 'Accounts, tax, treasury, or capital advice.' },
      { id: 'a3000000-0000-4000-8000-000000000002', sub_group: 'Technical Consultant', description: 'Product, engineering, or systems advice.' },
      { id: 'a3000000-0000-4000-8000-000000000003', sub_group: 'Legal Consultant', description: 'Contracts, compliance, and legal advice.' },
      { id: 'a3000000-0000-4000-8000-000000000004', sub_group: 'Business Consultant', description: 'Operations, process, and commercial advice.' },
    ],
  },
];

export function flattenClientGroups() {
  const now = new Date().toISOString();
  return CLIENT_GROUP_TREE.flatMap((g) => g.children.map((c) => ({
    id: c.id,
    group_name: g.group_name,
    sub_group: c.sub_group,
    description: c.description,
    status: 'Active',
    created_at: now,
    updated_at: now,
  })));
}

export function subsFor(groupName) {
  const g = CLIENT_GROUP_TREE.find((x) => x.group_name === groupName);
  return g ? g.children.slice() : [];
}

export function findClientGroup(id) {
  return flattenClientGroups().find((r) => String(r.id) === String(id)) || null;
}
