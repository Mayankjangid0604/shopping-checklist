// Shared client logic for home page + list page.

const NAME_KEY = "samagri_user_name";

function getStoredName() {
  try { return localStorage.getItem(NAME_KEY) || ""; } catch (e) { return ""; }
}
function setStoredName(name) {
  try { localStorage.setItem(NAME_KEY, name); } catch (e) {}
}

function ensureName(callback) {
  const existing = getStoredName();
  if (existing) return callback(existing);

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <h3>आपका नाम क्या है?</h3>
      <input type="text" id="nameInput" placeholder="जैसे: मायंक" autofocus>
      <div class="modal-actions">
        <button class="primary" id="nameSaveBtn">ठीक है</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const input = overlay.querySelector("#nameInput");
  const save = () => {
    const val = input.value.trim();
    if (!val) { input.focus(); return; }
    setStoredName(val);
    document.body.removeChild(overlay);
    callback(val);
  };
  overlay.querySelector("#nameSaveBtn").addEventListener("click", save);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") save(); });
  setTimeout(() => input.focus(), 50);
}

// ---------------- Home page ----------------

async function renderHome() {
  const main = document.getElementById("homeMain");
  try {
    const catalogue = await fetch("/api/lists").then(r => r.json());
    const details = await Promise.all(
      catalogue.map(c => fetch(`/api/lists/${c.id}`).then(r => r.json()))
    );

    main.innerHTML = "";
    catalogue.forEach((c, i) => {
      const d = details[i];
      const card = document.createElement("a");
      card.href = `/list.html?id=${c.id}`;
      card.className = "list-card";
      card.innerHTML = `
        <div>
          <div class="label">${c.label}</div>
          <div class="sub">${c.sub}</div>
        </div>
        <div class="progress-mini">${d.done} / ${d.total}</div>
      `;
      main.appendChild(card);
    });
  } catch (err) {
    main.innerHTML = `<div class="empty-msg">लोड नहीं हो सका। पेज रीलोड करें।</div>`;
    console.error(err);
  }
}

// ---------------- List page ----------------

function getListIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

async function renderListPage() {
  const listId = getListIdFromUrl();
  const main = document.getElementById("main");
  if (!listId) {
    main.innerHTML = `<div class="empty-msg">सूची नहीं मिली।</div>`;
    return;
  }

  let filter = "all"; // all | pending | done
  let searchTerm = "";
  let listData = null;

  async function load() {
    listData = await fetch(`/api/lists/${listId}`).then(r => r.json());
    if (listData.error) {
      main.innerHTML = `<div class="empty-msg">सूची नहीं मिली।</div>`;
      return;
    }
    document.getElementById("listTitle").textContent = listData.title;
    document.getElementById("listSubtitle").textContent = listData.subtitle || "";
    document.title = listData.title;
    render();
  }

  function render() {
    main.innerHTML = "";
    const { sections, total, done } = listData;

    sections.forEach((section) => {
      const visibleItems = section.items.filter((item) => {
        if (!item.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        if (filter === "pending") return !item.checked;
        if (filter === "done") return item.checked;
        return true;
      });

      if (visibleItems.length === 0) return;

      const doneInSection = section.items.filter(i => i.checked).length;

      const sectionDiv = document.createElement("div");
      sectionDiv.className = "section";
      sectionDiv.innerHTML = `
        <div class="section-title">
          <span>${section.category}</span>
          <span class="count">${doneInSection}/${section.items.length}</span>
        </div>
        <div class="card"></div>
      `;
      main.appendChild(sectionDiv);

      const card = sectionDiv.querySelector(".card");
      visibleItems.forEach((item) => {
        const row = document.createElement("div");
        row.className = "item" + (item.checked ? " done" : "");
        const byLine = item.checked && item.checkedBy
          ? `<div class="item-by">✓ ${escapeHtml(item.checkedBy)} ने लिया</div>`
          : "";
        row.innerHTML = `
          <div class="checkbox">${item.checked ? "✓" : ""}</div>
          <div class="item-main">
            <div class="item-name">${escapeHtml(item.name)}</div>
            ${byLine}
          </div>
          ${item.qty ? `<div class="item-qty">${escapeHtml(item.qty)}</div>` : ""}
        `;
        row.addEventListener("click", () => toggleItem(item));
        card.appendChild(row);
      });
    });

    if (main.children.length === 0) {
      main.innerHTML = `<div class="empty-msg">कोई आइटम नहीं मिला।</div>`;
    }

    document.getElementById("progressBar").style.width = total ? (done / total * 100) + "%" : "0%";
    document.getElementById("progressText").textContent = `${done} / ${total} खरीदा गया`;
    document.getElementById("footerCount").textContent = `${total - done} आइटम बाकी`;
  }

  function toggleItem(item) {
    const newChecked = !item.checked;
    if (newChecked) {
      ensureName((name) => {
        item.checked = true;
        item.checkedBy = name;
        listData.done++;
        render();
        fetch(`/api/lists/${listId}/items/${item.key}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checked: true, by: name })
        }).catch(() => load());
      });
    } else {
      item.checked = false;
      item.checkedBy = "";
      listData.done--;
      render();
      fetch(`/api/lists/${listId}/items/${item.key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checked: false, by: "" })
      }).catch(() => load());
    }
  }

  document.getElementById("searchBox").addEventListener("input", (e) => {
    searchTerm = e.target.value;
    render();
  });

  function setFilter(f) {
    filter = f;
    document.querySelectorAll(".controls button").forEach(b => b.classList.remove("active"));
    document.getElementById(
      f === "all" ? "filterAll" : f === "pending" ? "filterPending" : "filterDone"
    ).classList.add("active");
    render();
  }
  document.getElementById("filterAll").addEventListener("click", () => setFilter("all"));
  document.getElementById("filterPending").addEventListener("click", () => setFilter("pending"));
  document.getElementById("filterDone").addEventListener("click", () => setFilter("done"));

  document.getElementById("resetBtn").addEventListener("click", async () => {
    if (!confirm("सभी आइटम को 'नहीं खरीदा' पर रीसेट करें?")) return;
    await fetch(`/api/lists/${listId}/reset`, { method: "POST" });
    await load();
  });

  // Poll every few seconds so other devices' changes show up
  setInterval(load, 5000);

  await load();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
