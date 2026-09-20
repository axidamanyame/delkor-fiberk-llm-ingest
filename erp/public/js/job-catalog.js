/**
 * Delkor-Fiberk jobs — not UPOS. Settings, access keys and seed roles share this list.
 */
const HOME = { 'home.view': true };
const OFFICE = {
  'home.view': true, 'product.view': true, 'product.add': true,
  'purchase.view_all': true, 'sell.view_all': true,
  'stock_transfer.view_all': true, 'stock_adjustment.view_all': true,
  'report.stock': true, 'report.profit_loss': true,
  'user.view': true, 'ops.access': true, 'ops.hub': true,
};

function keyOf(name) {
  return String(name || '').replace(/[^a-z0-9]+/gi, '').toLowerCase();
}

function jobs(family, prefix, perms, names) {
  return names.map((name) => ({
    id: 'r-' + prefix + '-' + keyOf(name).slice(0, 22),
    name,
    family,
    permissions: perms,
  }));
}

const STAR = { '*': true };

export const JOB_GROUPS = [
  {
    id: 'principals',
    label: 'Leadership — Principals',
    keyed: false,
    supabase: true,
    jobs: [
      { name: 'Owner' },
      { name: 'Founder' },
      { name: 'Partner' },
    ],
  },
  {
    id: 'control',
    label: 'Leadership — IT & Systems',
    keyed: false,
    kind: 'head_office',
    supabase: true,
    jobs: [
      { name: 'HQ Admin' },
      { name: 'IT Director' },
      { name: 'Systems Developer' },
      { id: 'r-it-sysadmin', name: 'Systems Administrator', family: 'hq', permissions: STAR, supabase: true },
      { id: 'r-it-netadmin', name: 'Network Administrator', family: 'hq', permissions: STAR, supabase: true },
      { id: 'r-it-erpadmin', name: 'ERP Administrator', family: 'hq', permissions: STAR, supabase: true },
      { id: 'r-it-dbadmin', name: 'Database Administrator', family: 'hq', permissions: STAR, supabase: true },
    ],
  },
  {
    id: 'retail',
    label: 'Retail Operations (Head Office)',
    keyed: true,
    kind: 'head_office',
    jobs: [
      { id: 'r-retail-head', name: 'Head of Retail Operations', family: 'retail', permissions: { ...OFFICE, 'user.edit': true, 'role.view': true } },
      { id: 'r-retail-regional', name: 'Regional Operations Manager', family: 'retail', permissions: OFFICE },
      { id: 'r-retail-area', name: 'Area Manager', family: 'retail', permissions: OFFICE },
      { id: 'r-retail-analyst', name: 'Store Performance Analyst', family: 'retail', permissions: { 'home.view': true, 'report.profit_loss': true, 'report.stock': true, 'sell.view_all': true } },
      { id: 'r-retail-merch', name: 'Retail Merchandising Manager', family: 'retail', permissions: { 'home.view': true, 'product.view': true, 'product.add': true, 'product.edit': true, 'report.stock': true } },
      { id: 'r-retail-visual', name: 'Visual Merchandising Lead', family: 'retail', permissions: { 'home.view': true, 'product.view': true } },
      { id: 'r-retail-train', name: 'Retail Training & Development Manager', family: 'retail', permissions: { 'home.view': true, 'hrm.view_all': true, 'user.view': true } },
      { id: 'r-retail-cx', name: 'Customer Experience Manager', family: 'retail', permissions: { 'home.view': true, 'customer.view_all': true, 'customer.edit': true, 'crm.leads_all': true } },
    ],
  },
  {
    id: 'supply',
    label: 'Supply Chain & Logistics',
    keyed: true,
    kind: 'head_office',
    jobs: [
      { id: 'r-sc-head', name: 'Head of Supply Chain', family: 'supply', permissions: { ...OFFICE, 'ops.receive': true, 'ops.putaway': true, 'ops.count': true } },
      { id: 'r-sc-logistics', name: 'Logistics Manager', family: 'supply', permissions: { 'home.view': true, 'ops.access': true, 'shipment.view_all': true, 'stock_transfer.view_all': true } },
      { id: 'r-sc-dc', name: 'Distribution Center Manager', family: 'supply', permissions: { ...OFFICE, 'ops.receive': true, 'ops.putaway': true } },
      { id: 'r-sc-wh', name: 'Warehouse Operations Manager', family: 'supply', permissions: { ...OFFICE, 'ops.receive': true, 'ops.putaway': true, 'ops.count': true } },
      { id: 'r-sc-inv', name: 'Inventory Control Manager', family: 'supply', permissions: { 'home.view': true, 'product.view': true, 'stock_transfer.view_all': true, 'stock_adjustment.view_all': true, 'report.stock': true, 'ops.count': true } },
      { id: 'r-sc-proc', name: 'Procurement Manager', family: 'supply', permissions: { 'home.view': true, 'purchase.view_all': true, 'purchase.add': true, 'purchase.edit': true, 'supplier.view_all': true } },
      { id: 'r-sc-plan', name: 'Supply Planner', family: 'supply', permissions: { 'home.view': true, 'product.view': true, 'purchase.view_all': true, 'report.stock': true } },
      { id: 'r-sc-fleet', name: 'Fleet Manager', family: 'supply', permissions: { 'home.view': true, 'shipment.view_all': true, 'shipment.add': true, 'shipment.edit': true } },
    ],
  },
  {
    id: 'warehouse',
    label: 'Warehouse & Distribution',
    keyed: true,
    kind: 'head_office',
    jobs: jobs('warehouse', 'wh', OFFICE, [
      'Warehouse Supervisor',
      'Receiving Supervisor',
      'Dispatch Supervisor',
      'Stock Control Supervisor',
      'Quality Assurance Supervisor',
      'Safety & Compliance Officer',
      'Warehouse Systems Coordinator',
    ]),
  },
  {
    id: 'sales',
    label: 'Sales & Commercial',
    keyed: true,
    kind: 'head_office',
    jobs: jobs('sales', 'sl', { 'home.view': true, 'sell.view_all': true, 'customer.view_all': true, 'crm.leads_all': true }, [
      'Head of Sales',
      'Key Account Manager',
      'Territory Sales Manager',
      'Field Sales Manager',
      'Inside Sales Manager',
      'Sales Operations Analyst',
      'CRM Administrator',
    ]),
  },
  {
    id: 'finance',
    label: 'Finance & Accounting',
    keyed: true,
    kind: 'head_office',
    jobs: jobs('finance', 'fn', { 'home.view': true, 'account.access': true, 'account.view': true, 'expense.access_all': true, 'report.profit_loss': true }, [
      'Finance Manager',
      'Financial Controller',
      'Accounts Payable Officer',
      'Accounts Receivable Officer',
      'Cost Accountant',
      'Payroll Manager',
      'Treasury Manager',
      'Budgeting & Forecasting Analyst',
    ]),
  },
  {
    id: 'hr',
    label: 'Human Resources',
    keyed: true,
    kind: 'head_office',
    jobs: jobs('hr', 'hr', { 'home.view': true, 'hrm.view_all': true, 'user.view': true }, [
      'HR Manager',
      'Recruitment Specialist',
      'Training & Development Specialist',
      'HR Business Partner',
      'Compensation & Benefits Analyst',
      'Employee Relations Officer',
    ]),
  },
  {
    id: 'it',
    label: 'IT & Systems',
    keyed: true,
    kind: 'head_office',
    jobs: jobs('it', 'it', { 'home.view': true, 'user.view': true }, [
      'IT Manager',
      'Cybersecurity Analyst',
      'IT Support Lead',
      'Software Developer / Integrations Engineer',
      'Business Systems Analyst',
    ]),
  },
  {
    id: 'marketing',
    label: 'Marketing & Communications',
    keyed: true,
    kind: 'head_office',
    jobs: jobs('marketing', 'mk', { 'home.view': true, 'crm.leads_all': true, 'comm.access': true }, [
      'Marketing Manager',
      'Digital Marketing Specialist',
      'Brand Manager',
      'Social Media Manager',
      'Content Creator',
      'Graphic Designer',
      'Corporate Communications Manager',
    ]),
  },
  {
    id: 'legal',
    label: 'Legal & Compliance',
    keyed: true,
    kind: 'head_office',
    jobs: jobs('legal', 'lg', { 'home.view': true, 'user.view': true }, [
      'Legal Counsel',
      'Contracts Manager',
      'Compliance Officer',
      'Data Protection Officer',
    ]),
  },
  {
    id: 'procurement',
    label: 'Product Sourcing & Procurement',
    keyed: true,
    kind: 'head_office',
    jobs: jobs('procurement', 'pr', { 'home.view': true, 'purchase.view_all': true, 'purchase.add': true, 'supplier.view_all': true }, [
      'Head of Procurement',
      'Supplier Relationship Manager',
      'Sourcing Specialist',
      'Purchase Coordinator',
      'Quality & Standards Officer',
    ]),
  },
  {
    id: 'facilities',
    label: 'Facilities & Administration',
    keyed: true,
    kind: 'head_office',
    jobs: jobs('facilities', 'fa', HOME, [
      'Office Manager',
      'Facilities Manager',
      'Maintenance Coordinator',
      'Administrative Assistant',
      'Document Control Officer',
    ]),
  },
  {
    id: 'fleet',
    label: 'Fleet & Transport',
    keyed: true,
    kind: 'head_office',
    jobs: jobs('fleet', 'fl', { 'home.view': true, 'shipment.view_all': true, 'shipment.add': true }, [
      'Transport Manager',
      'Fleet Coordinator',
      'Driver Compliance Officer',
      'Route Planner',
    ]),
  },
  {
    id: 'support',
    label: 'Customer Support',
    keyed: true,
    kind: 'head_office',
    jobs: jobs('support', 'cs', { 'home.view': true, 'customer.view_all': true, 'crm.leads_all': true, 'comm.access': true }, [
      'Customer Service Manager',
      'Call Center Supervisor',
      'Customer Support Specialist',
      'Escalations Manager',
    ]),
  },
  {
    id: 'qa',
    label: 'Quality Assurance',
    keyed: true,
    kind: 'head_office',
    jobs: jobs('qa', 'qa', { 'home.view': true, 'product.view': true }, [
      'QA Manager',
      'QA Analyst',
      'Standards & Compliance Specialist',
    ]),
  },
  {
    id: 'security',
    label: 'Security',
    keyed: true,
    kind: 'head_office',
    jobs: jobs('security', 'sec', HOME, [
      'Security Manager',
      'Loss Prevention Manager',
      'CCTV Monitoring Officer',
    ]),
  },
  {
    id: 'shop',
    label: 'Shop floor',
    keyed: true,
    kind: 'operations',
    jobs: [
      { name: 'Cashier' },
      { name: 'Sales' },
      { name: 'Inventory' },
    ],
  },
  {
    id: 'field',
    label: 'Field',
    keyed: true,
    kind: 'operations',
    jobs: [
      { name: 'Field Agent' },
      { name: 'Delivery' },
    ],
  },
  {
    id: 'office',
    label: 'Office',
    keyed: true,
    kind: 'head_office',
    jobs: [
      { name: 'Accountant' },
      { name: 'HR Admin' },
      { name: 'Data Entry' },
    ],
  },
  {
    id: 'gate',
    label: 'Onboarding',
    keyed: true,
    kind: 'operations',
    jobs: [{ name: 'Pending' }],
  },
];

const UPOS = /^(store keeper|storekeeper|supplier|waiter|cook|chef|kitchen|superadmin|demo|tables|admin|manager|shop manager|shopmanager|sales associate|agent|customer|client)$/i;

export function isDelkorJob(name) {
  const k = keyOf(name);
  if (!k) return false;
  return allCatalogJobs().some((j) => keyOf(j.name) === k);
}

export function isUpostJob(name) {
  const raw = String(name || '').trim();
  if (!raw) return false;
  if (UPOS.test(raw)) return true;
  return !isDelkorJob(raw);
}

export function allCatalogJobs() {
  return JOB_GROUPS.flatMap((g) => g.jobs.map((j) => ({
    ...j,
    group: g.id,
    groupLabel: g.label,
    keyed: g.keyed !== false,
    kind: g.kind || '',
  })));
}

export function extraSeedRoles() {
  const seen = new Set();
  return allCatalogJobs()
    .filter((j) => j.id && j.permissions)
    .filter((j) => {
      if (seen.has(j.id)) return false;
      seen.add(j.id);
      return true;
    })
    .map((j) => ({
      id: j.id,
      name: j.name,
      code: keyOf(j.name),
      is_system: !!(j.supabase || j.group === 'principals' || j.group === 'control'),
      dashboard_group: (j.family === 'hq' || j.group === 'principals' || j.group === 'control') ? 'hq' : (j.kind === 'head_office' ? 'office' : ''),
      permissions: j.permissions,
    }));
}

export function isSupabaseJob(name) {
  const k = keyOf(name);
  return allCatalogJobs().some((j) => keyOf(j.name) === k && (j.supabase || j.group === 'principals' || j.group === 'control'))
    || /^(owner|founder|partner|hq admin|it director|systems developer|pending)$/i.test(String(name || '').trim());
}

export function catalogCanon() {
  const out = {};
  allCatalogJobs().forEach((j) => {
    if (!j.family) return;
    const k = keyOf(j.name);
    if (!k) return;
    out[k] = { label: j.name, family: j.family };
  });
  return out;
}
