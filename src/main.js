import Web3 from "web3";
import "./style.css";

const STORAGE_KEY = "educert-chain-demo-v1";
const BASE_URL = import.meta.env.BASE_URL || "./";

const $ = (id) => document.getElementById(id);

const els = {
  connectWallet: $("connect-wallet"),
  demoReset: $("demo-reset"),
  appAlert: $("app-alert"),
  modeStatus: $("mode-status"),
  currentAccount: $("current-account"),
  networkStatus: $("network-status"),
  contractAddress: $("contract-address"),
  studentCount: $("student-count"),
  credentialCount: $("credential-count"),
  grantCount: $("grant-count"),
  txCount: $("tx-count"),
  registerStudent: $("register-student"),
  profileResult: $("profile-result"),
  issueCredential: $("issue-credential"),
  generatedId: $("generated-id"),
  generatedHash: $("generated-hash"),
  copyGenerated: $("copy-generated"),
  verifyCredential: $("verify-credential"),
  verifyResult: $("verify-result"),
  recordCourse: $("record-course"), // Might be null
  courseResult: $("course-result"), // Might be null
  grantAccess: $("grant-access"),
  shareResult: $("share-result"),
  registrySearch: $("registry-search"),
  registryList: $("registry-list"),
  refreshRegistry: $("refresh-registry"),
  ledgerList: $("ledger-list"),
  exportDemo: $("export-demo"),
};

const state = {
  mode: "demo",
  account: "",
  config: null,
  web3: null,
  contract: null,
  demo: loadDemoState(),
  lastCredentialId: "",
};

function publicUrl(fileName) {
  return `${BASE_URL}${fileName}`;
}

function loadDemoState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return {
    account: createDemoAddress(),
    students: {},
    credentials: {},
    credentialIds: [],
    grants: {},
    blocks: [],
  };
}

function saveDemoState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.demo));
}

function createDemoAddress() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function setBusy(button, busy) {
  if (!button) return;
  button.disabled = busy;
  if (busy) {
    button._originalText = button.innerHTML;
    button.innerHTML = '<span class="loading-spin">⌛</span> Ishlanmoqda...';
  } else {
    button.innerHTML = button._originalText || "Bajarish";
  }
}

function value(id) {
  const el = $(id);
  return el ? el.value.trim() : "";
}

function setValue(id, nextValue) {
  const el = $(id);
  if (el) el.value = nextValue;
}

function showAlert(message, tone = "success") {
  if (!els.appAlert) return;
  els.appAlert.textContent = message;
  els.appAlert.className = `alert ${tone}`;
  els.appAlert.hidden = false;
  clearTimeout(showAlert.timer);
  showAlert.timer = setTimeout(() => {
    els.appAlert.hidden = true;
  }, 4000);
}

function shortText(text, head = 8, tail = 6) {
  if (!text || text === "-") return "-";
  if (text.length <= head + tail + 3) return text;
  return `${text.slice(0, head)}...${text.slice(-tail)}`;
}

function formatDate(input) {
  const date = typeof input === "number" ? new Date(input * 1000) : new Date(input);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("uz-UZ", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stableStringify(input) {
  if (input === null || typeof input !== "object") return JSON.stringify(input);
  if (Array.isArray(input)) return `[${input.map((item) => stableStringify(item)).join(",")}]`;
  const keys = Object.keys(input).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(input[key])}`).join(",")}}`;
}

async function sha256Hex(input) {
  const data = new TextEncoder().encode(String(input));
  const hash = await crypto.subtle.digest("SHA-256", data);
  return `0x${Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function hashObject(input) {
  return sha256Hex(stableStringify(input));
}

async function studentKey(studentId) {
  return sha256Hex(`student:${studentId}`);
}

function toScoreContract(score) {
  return Math.round(Number(score || 0) * 100);
}

function fromScoreContract(score) {
  return Number(score || 0) / 100;
}

function defaultWallet(inputValue) {
  return inputValue || state.account || state.demo.account;
}

async function loadContractConfig() {
  try {
    const response = await fetch(publicUrl("contracts.json"), { cache: "no-store" });
    if (!response.ok) return null;
    const config = await response.json();
    if (!config.deployed || !config.address) return config;

    const artifactResponse = await fetch(publicUrl(config.artifactPath || "EduChainRegistry.json"), {
      cache: "no-store",
    });
    const artifact = await artifactResponse.json();
    return { ...config, abi: artifact.abi };
  } catch {
    return null;
  }
}

async function connectWallet() {
  try {
    if (!window.ethereum) {
      state.mode = "demo";
      state.account = state.demo.account;
      refreshUi();
      showAlert("MetaMask topilmadi. Demo Ledger faol.", "success");
      return;
    }

    setBusy(els.connectWallet, true);
    const config = await loadContractConfig();
    const web3 = new Web3(window.ethereum);
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    state.account = accounts[0];

    if (config?.deployed && config.address && config.abi) {
      state.mode = "contract";
      state.config = config;
      state.web3 = web3;
      state.contract = new web3.eth.Contract(config.abi, config.address);
      showAlert("Hamyon ulandi. Blockchain faol.", "success");
    } else {
      state.mode = "demo";
      showAlert("Hamyon ulandi. Demo rejimda davom eting.", "success");
    }

    await refreshUi();
  } catch (error) {
    showAlert(error.message || "Xatolik yuz berdi.", "error");
  } finally {
    setBusy(els.connectWallet, false);
  }
}

async function bootstrap() {
  state.config = await loadContractConfig();
  state.account = state.demo.account;
  wireEvents();
  prefillWallets();
  await refreshUi();
}

function prefillWallets() {
  const wallet = state.demo.account;
  ["profile-wallet", "credential-wallet", "course-wallet"].forEach(id => {
    if (!value(id)) setValue(id, wallet);
  });
  if (!value("viewer-wallet")) setValue("viewer-wallet", createDemoAddress());
}

function wireEvents() {
  els.connectWallet?.addEventListener("click", connectWallet);
  els.demoReset?.addEventListener("click", resetDemo);
  els.registerStudent?.addEventListener("click", handleRegisterStudent);
  els.issueCredential?.addEventListener("click", handleIssueCredential);
  els.copyGenerated?.addEventListener("click", copyToClipboard(state.lastCredentialId, "ID nusxalandi"));
  els.verifyCredential?.addEventListener("click", handleVerifyCredential);
  els.recordCourse?.addEventListener("click", handleRecordCourse);
  els.grantAccess?.addEventListener("click", handleGrantAccess);
  els.refreshRegistry?.addEventListener("click", refreshRegistry);
  els.registrySearch?.addEventListener("input", () => renderRegistry());
  els.exportDemo?.addEventListener("click", exportDemoJson);

  if (window.ethereum) {
    window.ethereum.on("accountsChanged", () => window.location.reload());
    window.ethereum.on("chainChanged", () => window.location.reload());
  }

  // Handle dynamic copy buttons
  document.addEventListener('click', (e) => {
    if (e.target.closest('.copy-btn')) {
      const text = e.target.closest('.copy-btn').dataset.copy;
      navigator.clipboard.writeText(text);
      showAlert("Nusxa olindi!", "success");
    }
  });
}

function copyToClipboard(text, msg) {
  return async () => {
    const content = typeof text === 'function' ? text() : text;
    if (!content) return showAlert("Nusxa olish uchun ma'lumot yo'q", "error");
    await navigator.clipboard.writeText(content);
    showAlert(msg || "Nusxalandi", "success");
  }
}

async function refreshUi() {
  if (els.modeStatus) els.modeStatus.textContent = state.mode === "contract" ? "🟢 Real Blockchain" : "🟡 Demo Ledger";
  if (els.currentAccount) els.currentAccount.textContent = shortText(state.account || state.demo.account);
  
  if (els.networkStatus) {
    els.networkStatus.textContent = state.mode === "contract" ? state.config?.networkName : "Offline Demo";
  }
  if (els.contractAddress) {
    els.contractAddress.textContent = state.config?.address ? shortText(state.config.address) : "Noma'lum";
  }

  await updateMetrics();
  await refreshRegistry();
  renderLedger();
}

async function updateMetrics() {
  let sCount = Object.keys(state.demo.students).length;
  let cCount = state.demo.credentialIds.length;
  let gCount = Object.keys(state.demo.grants).length;
  let tCount = state.demo.blocks.length;

  if (state.mode === "contract" && state.contract) {
    try {
      sCount = await state.contract.methods.getStudentCount().call();
      cCount = await state.contract.methods.getCredentialCount().call();
      gCount = await state.contract.methods.grantCount().call();
      tCount = "∞";
    } catch {}
  }

  if (els.studentCount) els.studentCount.textContent = sCount;
  if (els.credentialCount) els.credentialCount.textContent = cCount;
  if (els.grantCount) els.grantCount.textContent = gCount;
  if (els.txCount) els.txCount.textContent = tCount;
}

async function handleRegisterStudent() {
  setBusy(els.registerStudent, true);
  try {
    const profile = {
      studentId: value("profile-student-id"),
      wallet: defaultWallet(value("profile-wallet")),
      displayName: value("profile-name"),
      program: value("profile-program"),
      metadataCID: value("profile-cid"),
    };

    if (!profile.studentId || !profile.displayName) throw new Error("Barcha maydonlarni to'ldiring.");
    profile.dataHash = await hashObject(profile);
    profile.studentKey = await studentKey(profile.studentId);

    if (state.mode === "contract") {
      await state.contract.methods.registerStudent(
        profile.studentKey, profile.studentId, profile.wallet, 
        profile.dataHash, profile.metadataCID, profile.displayName, profile.program
      ).send({ from: state.account });
    } else {
      state.demo.students[profile.studentId] = { ...profile, updatedAt: new Date().toISOString() };
      await appendDemoBlock("STUDENT_REGISTERED", { id: profile.studentId, name: profile.displayName });
      saveDemoState();
    }

    if (els.profileResult) els.profileResult.innerHTML = `✅ Muvaffaqiyatli: <code>${profile.studentKey}</code>`;
    showAlert("Profil saqlandi.");
    await refreshUi();
  } catch (error) {
    showAlert(error.message, "error");
  } finally {
    setBusy(els.registerStudent, false);
  }
}

async function handleIssueCredential() {
  setBusy(els.issueCredential, true);
  try {
    const cred = {
      studentId: value("credential-student-id"),
      studentWallet: defaultWallet(value("credential-wallet")),
      credentialType: value("credential-type"),
      title: value("credential-title"),
      institution: value("issuer-name"),
      score: Number(value("credential-score")),
      metadataCID: value("credential-cid"),
      issuedAt: Math.floor(Date.now() / 1000),
      issuer: state.account || state.demo.account,
    };

    if (!cred.studentId || !cred.title) throw new Error("Ma'lumotlar yetarli emas.");
    cred.studentKey = await studentKey(cred.studentId);
    cred.dataHash = await hashObject(cred);
    cred.id = await sha256Hex(`cred:${cred.studentId}:${cred.title}:${Date.now()}`);

    if (state.mode === "contract") {
      await state.contract.methods.issueCredential(
        cred.id, cred.studentKey, cred.studentWallet, cred.credentialType,
        cred.title, cred.institution, cred.metadataCID, cred.dataHash, toScoreContract(cred.score)
      ).send({ from: state.account });
    } else {
      state.demo.credentials[cred.id] = { ...cred, revoked: false };
      state.demo.credentialIds.unshift(cred.id);
      await appendDemoBlock("CREDENTIAL_ISSUED", { id: cred.id, type: cred.credentialType });
      saveDemoState();
    }

    state.lastCredentialId = cred.id;
    if (els.generatedId) els.generatedId.textContent = cred.id;
    if (els.generatedHash) els.generatedHash.textContent = cred.dataHash;
    setValue("verify-id", cred.id);
    showAlert("Hujjat blockchain'ga qo'shildi.");
    await refreshUi();
  } catch (error) {
    showAlert(error.message, "error");
  } finally {
    setBusy(els.issueCredential, false);
  }
}

async function handleVerifyCredential() {
  const id = value("verify-id");
  if (!id) return showAlert("ID kiriting", "error");
  
  setBusy(els.verifyCredential, true);
  if (els.verifyResult) els.verifyResult.innerHTML = "🔍 Blockchain tarmog'idan qidirilmoqda...";
  
  try {
    // Artificial delay for "feel"
    await new Promise(r => setTimeout(r, 800));
    
    let result;
    if (state.mode === "contract") {
      const raw = await state.contract.methods.verifyCredential(id).call();
      result = {
        valid: raw[0], title: raw[4], institution: raw[5], score: fromScoreContract(raw[8]), revoked: raw[10]
      };
    } else {
      const c = state.demo.credentials[id];
      result = c ? { valid: true, ...c } : { valid: false };
    }

    if (els.verifyResult) {
      if (result.valid) {
        els.verifyResult.className = "verify-result valid";
        els.verifyResult.innerHTML = `
          <div style="color: var(--success); font-weight: 700; margin-bottom: 0.5rem;">✅ Tasdiqlandi</div>
          <strong>Hujjat:</strong> ${result.title}<br>
          <strong>Muassasa:</strong> ${result.institution}<br>
          <strong>Ball:</strong> ${result.score}
        `;
      } else {
        els.verifyResult.className = "verify-result invalid";
        els.verifyResult.innerHTML = "❌ Hujjat haqiqiy emas yoki topilmadi.";
      }
    }
  } catch (error) {
    if (els.verifyResult) els.verifyResult.innerHTML = "⚠️ Tekshirib bo'lmadi.";
  } finally {
    setBusy(els.verifyCredential, false);
  }
}

async function handleGrantAccess() {
  setBusy(els.grantAccess, true);
  try {
    const grant = {
      studentId: value("share-student-id"),
      viewer: value("viewer-wallet"),
      days: Number(value("share-days")),
      purpose: value("share-purpose"),
    };
    if (!grant.studentId || !grant.viewer) throw new Error("Ma'lumotlarni to'ldiring.");
    
    const expiresAt = Math.floor(Date.now() / 1000) + (grant.days * 86400);
    const sKey = await studentKey(grant.studentId);

    if (state.mode === "contract") {
      await state.contract.methods.grantAccess(sKey, grant.viewer, expiresAt, grant.purpose).send({ from: state.account });
    } else {
      const gId = await sha256Hex(`grant:${grant.studentId}:${grant.viewer}`);
      state.demo.grants[gId] = { ...grant, expiresAt };
      await appendDemoBlock("ACCESS_GRANTED", { to: grant.viewer });
      saveDemoState();
    }

    if (els.shareResult) els.shareResult.textContent = "✅ Ruxsat berildi.";
    showAlert("Ruxsat tasdiqlandi.");
    await refreshUi();
  } catch (error) {
    showAlert(error.message, "error");
  } finally {
    setBusy(els.grantAccess, false);
  }
}

async function handleRecordCourse() {
  // Gracefully handle if trigger doesn't exist anymore
  if (!els.recordCourse) return;
  // (Existing logic if needed, but we removed it from UI to focus on core)
}

async function appendDemoBlock(action, payload) {
  const block = {
    number: state.demo.blocks.length + 1,
    action,
    payload,
    timestamp: new Date().toISOString(),
    hash: await sha256Hex(Date.now() + action),
  };
  state.demo.blocks.unshift(block);
  return block;
}

async function refreshRegistry() {
  if (!els.registryList) return;
  const term = els.registrySearch?.value.toLowerCase() || "";
  
  let items = [];
  if (state.mode === "contract") {
    try {
      const count = await state.contract.methods.getCredentialCount().call();
      for (let i = count - 1; i >= 0 && items.length < 20; i--) {
        const id = await state.contract.methods.getCredentialIdAt(i).call();
        const raw = await state.contract.methods.getCredential(id).call();
        items.push({ id, title: raw[5], institution: raw[6], type: raw[4], student: raw[2] });
      }
    } catch {}
  } else {
    items = state.demo.credentialIds.map(id => ({ id, ...state.demo.credentials[id] }));
  }

  const filtered = items.filter(i => 
    i.title.toLowerCase().includes(term) || i.id.toLowerCase().includes(term) || i.institution.toLowerCase().includes(term)
  );

  els.registryList.innerHTML = filtered.map(i => `
    <div class="registry-item">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <span class="badge ${i.type === 'DIPLOMA' ? 'valid' : 'course'}">${i.type}</span>
          <h3>${i.title}</h3>
        </div>
        <button class="copy-btn" data-copy="${i.id}" title="ID nusxalash" style="background: none; border: none; cursor: pointer; font-size: 1.2rem;">📋</button>
      </div>
      <div class="meta-line">ID: <code>${shortText(i.id, 10, 8)}</code></div>
      <div class="meta-line">Muassasa: ${i.institution}</div>
      <div class="meta-line">Talaba: ${shortText(i.studentWallet || i.student, 6, 4)}</div>
    </div>
  `).join("");
  
  if (!filtered.length) els.registryList.innerHTML = "<p style='color: var(--text-muted); grid-column: span 2; text-align: center;'>Hech nima topilmadi.</p>";
}

function renderLedger() {
  if (!els.ledgerList) return;
  const blocks = state.demo.blocks.slice(0, 5);
  els.ledgerList.innerHTML = blocks.map(b => `
    <div class="registry-item" style="border-left: 4px solid var(--accent);">
      <div style="display: flex; justify-content: space-between;">
        <strong>#${b.number} ${b.action}</strong>
        <small style="color: var(--text-muted)">${formatDate(b.timestamp)}</small>
      </div>
      <div class="meta-line">Batch: <code>${shortText(b.hash, 12, 10)}</code></div>
    </div>
  `).join("") || "<p style='color: var(--text-muted);'>Hali tranzaksiyalar yo'q.</p>";
}

async function resetDemo() {
  if (!confirm("Barcha demo ma'lumotlarni o'chirishni tasdiqlaysizmi?")) return;
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}

function exportDemoJson() {
  const blob = new Blob([JSON.stringify(state.demo, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "educert-ledger.json";
  a.click();
}

bootstrap();
