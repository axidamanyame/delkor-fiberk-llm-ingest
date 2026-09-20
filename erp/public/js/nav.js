/**
 * SUPERSEDED — predates the shell.
 *
 * Kept for reference. The live sidebar and topbar are built by
 * mountUltimateShell() from the MENU array in ultimate-shell.js, which also
 * owns nav filtering, RBAC trimming and active-row state. Importing this
 * module would render a second, unstyled nav.
 */
/** Shared sidebar + topbar navigation for all pages */

export function renderShellNav(navListEl, activePath, role = "agent") {
  const items = [
    { section: "Operations" },
    { href: "/axidigetek-dashboard.html", label: "Home", icon: "🏠", match: "dashboard" },
    { href: "/products.html", label: "Products", icon: "📦", match: "products" },
    { href: "/purchase-orders.html", label: "Purchases", icon: "⬇️", match: "purchase" },
    { href: "/sales-orders.html", label: "Sell", icon: "⬆️", match: "sales-orders" },
    { href: "/stock.html", label: "Stock", icon: "📊", match: "stock" },
    { section: "People" },
    { href: "/customers.html", label: "Customers", icon: "👤", match: "customers" },
    { href: "/suppliers.html", label: "Suppliers", icon: "🏭", match: "suppliers" },
    { href: "/visits.html", label: "Visits", icon: "📍", match: "visits" },
    { href: "/crm.html", label: "CRM / Leads", icon: "💼", match: "crm" },
    { section: "Finance & HR" },
    { href: "/accounting.html", label: "Accounting", icon: "💰", match: "accounting" },
    { href: "/payroll.html", label: "Payroll", icon: "👥", match: "payroll" },
    { href: "/reports.html", label: "Reports", icon: "📈", match: "reports" },
  ];

  if (role === "admin" || role === "hq") {
    items.push({ section: "Admin" });
    items.push({ href: "/settings.html", label: "Settings", icon: "⚙️", match: "settings" });
  }

  const path = activePath || window.location.pathname;
  let html = "";
  items.forEach(i => {
    if (i.section) {
      html += `<li class="nav-section" style="list-style:none;pointer-events:none;">${i.section}</li>`;
      return;
    }
    const active = path.includes(i.match) || path.endsWith(i.href);
    html += `<li><a href="${i.href}" class="${active ? "active" : ""}">
      <span class="icon">${i.icon}</span> ${i.label}
    </a></li>`;
  });
  navListEl.innerHTML = html;
}

export function filterNav(searchInput, navListEl) {
  const q = (searchInput.value || "").toLowerCase().trim();
  navListEl.querySelectorAll("li").forEach(li => {
    if (li.classList.contains("nav-section")) {
      li.style.display = q ? "none" : "";
      return;
    }
    const text = li.textContent.toLowerCase();
    li.style.display = !q || text.includes(q) ? "" : "none";
  });
}
