/**
 * SUPERSEDED — pre-ultimate-shell page layout.
 *
 * Kept for reference. Do not import: line 9 calls createClient() again, so
 * importing this module creates a second Supabase client and a second auth
 * session alongside supabaseClient.js. The live chrome is mountUltimateShell()
 * in ultimate-shell.js; the live nav is the MENU in that same file.
 */
// js/layout.js

// ==========================================
// SUPABASE CLIENT
// ==========================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const supabaseUrl = 'https://YOUR-PROJECT.supabase.co';
const supabaseKey = 'sb_publishable_REDACTED';
export const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// ULTIMATE POS SIDEBAR & HEADER
// ==========================================
export function renderLayout(activePage) {
    const app = document.getElementById('app');
    
    app.innerHTML = `
    <div style="display:flex;min-height:100vh;font-family:'Inter',sans-serif;">
        <!-- ULTIMATE POS HEADER -->
        <div style="position:fixed;top:0;left:0;right:0;height:56px;background:#1E40AF;display:flex;align-items:center;justify-content:space-between;padding:0 24px;z-index:1000;color:white;">
            <div style="display:flex;align-items:center;gap:16px;">
                <h1 style="font-size:18px;font-weight:800;margin:0;">Axidigetek Group</h1>
                <select id="companySelector" style="background:#1E3A8A;color:white;border:none;padding:6px 12px;border-radius:6px;font-size:12px;cursor:pointer;">
                    <option value="axidigetek">Axidigetek (eCommerce)</option>
                    <option value="delkor">Delkor (Retail & Dist)</option>
                    <option value="fiberk">Fiberk (Electronics)</option>
                    <option value="bnpl">BNPL (Hire Purchase)</option>
                </select>
            </div>
            <div style="display:flex;align-items:center;gap:16px;">
                <span id="currentDate" style="font-size:12px;"></span>
                <button class="btn-logout" style="background:transparent;border:none;color:white;cursor:pointer;font-size:16px;">🚪</button>
            </div>
        </div>

        <!-- ULTIMATE POS SIDEBAR -->
        <aside style="position:fixed;top:56px;bottom:0;left:0;width:240px;background:#1e293b;color:white;overflow-y:auto;padding:20px 0;font-size:13px;">
            <ul style="list-style:none;padding:0;margin:0;">
                <li><a href="/dashboard.html" class="nav-link ${activePage === 'dashboard' ? 'active' : ''}" style="display:flex;align-items:center;gap:10px;padding:10px 20px;text-decoration:none;color:white;"><span>🏠</span> Dashboard</a></li>
                
                <li>
                    <div class="menu-trigger" style="display:flex;align-items:center;gap:10px;padding:10px 20px;cursor:pointer;">
                        <span>👥</span> User Management <span style="margin-left:auto;transform:rotate(0deg);transition:all 0.2s;" class="menu-arrow">▶</span>
                    </div>
                    <ul class="submenu" style="list-style:none;padding:0;margin:0;display:none;background:rgba(0,0,0,0.2);">
                        <li><a href="/users.html" class="nav-link" style="display:block;padding:8px 30px;text-decoration:none;color:#93C5FD;">Users & Roles</a></li>
                    </ul>
                </li>

                <li>
                    <div class="menu-trigger" style="display:flex;align-items:center;gap:10px;padding:10px 20px;cursor:pointer;">
                        <span>📦</span> Products <span style="margin-left:auto;" class="menu-arrow">▶</span>
                    </div>
                    <ul class="submenu" style="list-style:none;padding:0;margin:0;display:none;background:rgba(0,0,0,0.2);">
                        <li><a href="/products.html" class="nav-link ${activePage === 'products' ? 'active' : ''}" style="display:block;padding:8px 30px;text-decoration:none;color:#93C5FD;">List Products</a></li>
                        <li><a href="/stock.html" class="nav-link" style="display:block;padding:8px 30px;text-decoration:none;color:#93C5FD;">Stock</a></li>
                    </ul>
                </li>

                <li>
                    <div class="menu-trigger" style="display:flex;align-items:center;gap:10px;padding:10px 20px;cursor:pointer;">
                        <span>🛒</span> Sales (POS) <span style="margin-left:auto;" class="menu-arrow">▶</span>
                    </div>
                    <ul class="submenu" style="list-style:none;padding:0;margin:0;display:none;background:rgba(0,0,0,0.2);">
                        <li><a href="/pos.html" class="nav-link ${activePage === 'pos' ? 'active' : ''}" style="display:block;padding:8px 30px;text-decoration:none;color:#93C5FD;">POS Screen</a></li>
                        <li><a href="/sales-orders.html" class="nav-link" style="display:block;padding:8px 30px;text-decoration:none;color:#93C5FD;">Sales Orders</a></li>
                    </ul>
                </li>

                <li>
                    <div class="menu-trigger" style="display:flex;align-items:center;gap:10px;padding:10px 20px;cursor:pointer;">
                        <span>📊</span> Finance <span style="margin-left:auto;" class="menu-arrow">▶</span>
                    </div>
                    <ul class="submenu" style="list-style:none;padding:0;margin:0;display:none;background:rgba(0,0,0,0.2);">
                        <li><a href="/accounting-reports.html?r=tb" class="nav-link" style="display:block;padding:8px 30px;text-decoration:none;color:#93C5FD;">Trial Balance</a></li>
                    </ul>
                </li>
            </ul>
        </aside>

        <!-- MAIN CONTENT -->
        <main style="margin-left:240px;margin-top:56px;flex:1;padding:24px;background:#F3F4F6;">
            <div id="page-content"></div>
        </main>
    </div>
    `;

    // Sidebar Menu Toggle Logic
    document.querySelectorAll('.menu-trigger').forEach(trigger => {
        trigger.addEventListener('click', () => {
            const submenu = trigger.nextElementSibling;
            const arrow = trigger.querySelector('.menu-arrow');
            if (submenu.style.display === 'none') {
                submenu.style.display = 'block';
                arrow.style.transform = 'rotate(90deg)';
            } else {
                submenu.style.display = 'none';
                arrow.style.transform = 'rotate(0deg)';
            }
        });
    });

    // Set Date
    document.getElementById('currentDate').innerText = new Date().toLocaleDateString('en-GB');

    // Logout
    document.querySelector('.btn-logout').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '/login.html';
    });

    return document.getElementById('page-content');
}