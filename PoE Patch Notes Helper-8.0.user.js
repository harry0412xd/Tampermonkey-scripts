// ==UserScript==
// @name         PoE Patch Notes Helper
// @namespace    https://greasyfork.org/users/you
// @version      8.0
// @description  Auto-detects PoE1/PoE2, correct poedb + wiki links, collapsible panel, longest-match priority
// @author       You + Grok
// @match        https://www.pathofexile.com/forum/view-thread/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect      poedb.tw
// @connect      poe2db.tw
// @run-at       document-end
// ==/UserScript==

(() => {
    'use strict';

    let currentGame = "";
    let isCollapsed = false;

    const itemsByClass = {};
    const allItems = [];
    const enabled = new Set();
    let processed = false;
    let useWiki = false;

    const JSON_URLS = {
        poe: "https://cdn.poedb.tw/json/autocomplete_us.9ad36531a19f4750.json",
        poe2: "https://poe2db.tw/json/autocompletecb_us.072aba88649ad94a.json"
    };


    GM_addStyle(`
        a.poe2db-item { color:inherit !important; text-decoration:none !important; cursor:default !important; }
        a.poe2db-item.active { color:#d4af37 !important; text-decoration:underline !important; cursor:pointer !important; }
        a.poe2db-item.active:hover { color:#ffeb8c !important; }

        #poe2db-overlay {
            position:fixed; top:10px; right:10px; width:300px; background:#111;
            border:2px solid #d4af37; border-radius:10px; z-index:99999;
            font-family:Arial,sans-serif; font-size:13px; color:#fff;
            box-shadow:0 8px 30px rgba(0,0,0,0.9); user-select:none; transition:all 0.3s;
        }
        #poe2db-header {
            padding:10px 12px; background:#222; border-radius:8px 8px 0 0;
            cursor:pointer; display:flex; justify-content:space-between; align-items:center;
        }
        #poe2db-header:hover { background:#333; }
        #poe2db-content {
            padding:12px; max-height:80vh; overflow-y:auto; display:block;
        }
        #poe2db-overlay.collapsed #poe2db-content { display:none; }
        #poe2db-overlay.collapsed { width:auto; }

        #poe2db-overlay button {
            width:100%; padding:8px; margin:6px 0; border:none; border-radius:6px;
            font-weight:bold; cursor:pointer;
        }
        #site-toggle { background:#d4af37; color:#000; }
        #game-toggle { background:#444; color:#ccc; font-size:12px; }
        #game-toggle.poe2 { background:#8B5CF6; color:#fff; }
        #game-toggle.poe1 { background:#E91E63; color:#fff; }

        .poe2db-class-btn {
            padding:6px 10px; margin:3px 0; border-radius:5px;
            cursor:pointer; background:#333; color:#aaa; text-align:left;
        }
        .poe2db-class-btn.active { background:#d4af37; color:#000; }

        .status { font-size:11px; color:#888; text-align:center; margin-top:8px; }
    `);

    const overlay = document.createElement('div');
    overlay.id = 'poe2db-overlay';
    overlay.innerHTML = `
        <div id="poe2db-header">
            <strong style="color:#d4af37;">Item Links</strong>
            <span id="collapse-btn">−</span>
        </div>
        <div id="poe2db-content">
            <button id="site-toggle">→ poedb.tw</button>
            <button id="game-toggle">Detecting...</button>
            <div class="status" id="status">Loading...</div>
            <div id="class-list">Loading classes...</div>
        </div>`;
    document.body.appendChild(overlay);

    const header = overlay.querySelector('#poe2db-header');
    const content = overlay.querySelector('#poe2db-content');
    const collapseBtn = overlay.querySelector('#collapse-btn');
    const btnSite = overlay.querySelector('#site-toggle');
    const btnGame = overlay.querySelector('#game-toggle');
    const statusEl = overlay.querySelector('#status');
    const classList = overlay.querySelector('#class-list');

    // Collapse / expand
    header.onclick = () => {
        isCollapsed = !isCollapsed;
        overlay.classList.toggle('collapsed', isCollapsed);
        collapseBtn.textContent = isCollapsed ? '+' : '−';
    };

    btnSite.onclick = () => {
        useWiki = !useWiki;
        btnSite.textContent = useWiki ? '→ poewiki.net' : '→ poedb.tw';
        updateAllHrefs();
    };

    btnGame.onclick = () => {
        currentGame = currentGame=="poe2" ? "poe" : "poe2";
		btnGame.textContent = currentGame;
        reloadDatabase();
    };


    function detectGameFromPage() {
        const titleEl = document.querySelector('.newsPost h3, .title h1, .content h1, h1');
        if (titleEl && titleEl.textContent.includes('Path of Exile 2')) {
            currentGame = "poe2"
        } else {
            currentGame = "poe"
        }
        btnGame.textContent = currentGame;
    }

    function getDbUrl(value) {
        const v = encodeURIComponent(value);
        return useWiki ?  `https://${currentGame}wiki.net/wiki/${v}` : `https://${currentGame}db.tw/us/${v}`;
    }

    function updateAllHrefs() {
        document.querySelectorAll('a.poe2db-item').forEach(a => {
            a.href = getDbUrl(a.innerText.replace(' ', '_'));
        });
    }

    function slug(cls) { return 'cls-' + cls.replace(/[^a-z0-9]/gi, '-'); }

    function toggleClass(cls) {
        const willEnable = !enabled.has(cls);
        if (willEnable && !processed) {
            scanAndInjectAll();
            processed = true;
        }
        if (willEnable) enabled.add(cls);
        else enabled.delete(cls);

        document.querySelectorAll(`a.poe2db-item.${slug(cls)}`)
                .forEach(a => a.classList.toggle('active', willEnable));
        updateButton(cls);
    }

    function updateButton(cls) {
        const btn = classList.querySelector(`[data-cls="${CSS.escape(cls)}"]`);
        if (btn) btn.classList.toggle('active', enabled.has(cls));
    }

    function scanAndInjectAll() {
        allItems.sort((a, b) => b.label.length - a.label.length);

        const container = document.querySelector('.newsPost, .content, .postBody, .layoutBox1') || document.body;
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
        const nodes = [];
        let n;
        while (n = walker.nextNode()) {
            if (n.nodeValue.trim() && !n.parentNode.closest('a,script,style')) nodes.push(n);
        }

        nodes.forEach(textNode => {
            let text = textNode.nodeValue;
            if (!text.trim()) return;
            let newHtml = text;
            let changed = false;

            for (const item of allItems) {
                const regex = new RegExp(`(^|\\s)(${escapeRegExp(item.label)})($|\\s|[\\p{P}\\p{Z}])`, 'giu');
                if (regex.test(newHtml)) {
                    const clsSlug = slug(item.cls);
                    const activeClass = enabled.has(item.cls) ? 'active' : '';
                    newHtml = newHtml.replace(regex,
                        `$1<a href="${getDbUrl(item.value)}" target="_blank" ` +
                        `class="poe2db-item ${clsSlug} ${activeClass}" ` +
                        `data-value="${item.value}">$2</a>$3`);
                    changed = true;
                }
            }

            if (changed) {
                const div = document.createElement('div');
                div.innerHTML = newHtml;
                while (div.firstChild) {
                    textNode.parentNode.insertBefore(div.firstChild, textNode);
                }
                textNode.parentNode.removeChild(textNode);
            }
        });
    }

    function escapeRegExp(s) {
        return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function reloadDatabase() {
        allItems.length = 0;
        Object.keys(itemsByClass).forEach(k => delete itemsByClass[k]);
        enabled.clear();
        processed = false;
        classList.innerHTML = '<div style="text-align:center;color:#888;">Loading...</div>';
        statusEl.textContent = 'Loading database...';

        GM_xmlhttpRequest({
            method: "GET",
            url: JSON_URLS[currentGame],
            onload: res => {
                if (res.status !== 200) {
                    statusEl.textContent = `Failed (${currentGame})`;
                    return;
                }
                const data = JSON.parse(res.responseText);
                data.forEach(item => {
                    if (!item.label || !item.value) return;
                    const cls = item.class?.trim() || "Misc";
                    if (!itemsByClass[cls]) itemsByClass[cls] = new Set();
                    itemsByClass[cls].add(item.label.trim());
                    allItems.push({ label: item.label.trim(), value: item.value.trim(), cls });
                });

                const classes = Object.keys(itemsByClass).sort((a,b) => a==="Misc"?1:b==="Misc"?-1:a.localeCompare(b));
                classList.innerHTML = '';
                classes.forEach(cls => {
                    const btn = document.createElement('div');
                    btn.textContent = `${cls} (${itemsByClass[cls].size})`;
                    btn.dataset.cls = cls;
                    btn.className = 'poe2db-class-btn';
                    btn.onclick = () => toggleClass(cls);
                    classList.appendChild(btn);
                });

                statusEl.textContent = `${currentGame} ready · ${allItems.length} items`;
            }
        });
    }


    // Start
    detectGameFromPage();
    reloadDatabase();

})();