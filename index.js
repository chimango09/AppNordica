import { createClient } from "@supabase/supabase-js";
import {
  createIcons,
  LayoutDashboard,
  Database,
  Calculator,
  ShoppingBag,
  ClipboardList,
  Users,
  Settings,
  History,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  Box,
  Droplets,
  Hammer,
  Coins,
  Flame,
  Archive,
  RotateCcw,
  Check,
  User,
  Info,
  AlertCircle,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Package,
  X,
  Truck,
  Sparkles,
  Loader2,
  Wallet,
  ArrowRight,
  ArrowRightCircle,
  PieChart,
  MinusCircle,
  Github,
  ExternalLink,
  Terminal,
  ChevronDown,
  ChevronUp,
  Wrench,
  Trash,
} from "lucide";

// --- CONFIGURACIÓN SUPABASE ---
const supabaseUrl = "https://dzapbmqthpbrjguzuoki.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6YXBibXF0aHBicmpndXp1b2tpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNTc2MDgsImV4cCI6MjA4NTczMzYwOH0.lk8kw04c_nJo8JbADh2pYl7KUY1eNKUas351jmx-9Ic";
const supabase = createClient(supabaseUrl, supabaseKey);

// --- ESTADO GLOBAL ---
let state = {
  session: null,
  loading: true,
  activeTab: "dashboard",
  filaments: [],
  clients: [],
  projects: [],
  purchases: [],
  localDeletedRecords: JSON.parse(
    localStorage.getItem("studio3d_local_trash") || "[]",
  ),
  config: {
    energyRateKwh: 150,
    printerPowerWatts: 200,
    defaultProfitMargin: 100,
    currency: "$",
  },

  // UI State
  modals: {
    insumo: { show: false, editing: null },
    client: { show: false },
    purchase: { show: false },
    selectClient: { show: false, project: null },
  },
  editingProject: null,
};

// --- HELPERS ---
const formatAR = (val, decimals = 2) =>
  new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val || 0);

const calculateCosts = (project) => {
  if (!project)
    return {
      totalFilamentCost: 0,
      energyCost: 0,
      laborCost: 0,
      subtotal: 0,
      profitAmount: 0,
      roundedPrice: 0,
    };

  const hours = Number(project.printingHours) || 0;
  const labor = Number(project.postProcessingCost) || 0;
  const margin =
    Number(project.profitMargin) || state.config.defaultProfitMargin;
  const complexity = Number(project.complexityMultiplier) || 1;

  let totalFilamentCost = 0;
  (project.filaments || []).forEach((pf) => {
    const f = state.filaments.find((fill) => fill.id === pf.filamentId);
    if (f) {
      const grams = Number(pf.gramsUsed) || 0;
      totalFilamentCost += (grams * f.price) / f.weight_grams;
    }
  });

  const energyCost =
    hours *
    (state.config.printerPowerWatts / 1000) *
    state.config.energyRateKwh;
  const baseProduction = totalFilamentCost + energyCost + labor;
  const subtotal = baseProduction * complexity;
  const profitAmount = subtotal * (margin / 100);
  const totalPrice = subtotal + profitAmount;
  const roundedPrice = Math.ceil(totalPrice / 100) * 100;

  return {
    totalFilamentCost,
    energyCost,
    laborCost: labor,
    subtotal,
    profitAmount,
    roundedPrice,
  };
};

// --- SERVICIOS ---
const loadAllData = async () => {
  if (!state.session) return;
  state.loading = true;
  renderApp();
  try {
    const [fils, clis, projs, purs, conf] = await Promise.all([
      supabase.from("filaments").select("*").order("name"),
      supabase.from("clients").select("*").order("name"),
      supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("purchases")
        .select("*")
        .order("date", { ascending: false }),
      supabase.from("config").select("*").limit(1).maybeSingle(),
    ]);

    state.filaments = fils.data || [];
    state.clients = clis.data || [];
    state.projects = projs.data || [];
    state.purchases = purs.data || [];

    if (conf.data) {
      state.config = {
        energyRateKwh: Number(conf.data.energy_rate_kwh),
        printerPowerWatts: Number(conf.data.printer_power_watts),
        defaultProfitMargin: Number(conf.data.default_profit_margin),
        currency: conf.data.currency || "$",
      };
    }
  } catch (e) {
    console.error("Error cargando datos:", e);
  } finally {
    state.loading = false;
    renderApp();
  }
};

// --- VIEWS ---
const NavBtn = (id, icon, label) => `
  <button onclick="window.setTab('${id}')" class="flex items-center gap-4 px-6 py-4 rounded-2xl transition-all w-full text-left group ${state.activeTab === id ? "bg-nordic-bronze text-nordic-black font-black shadow-lg shadow-nordic-bronze/10" : "text-slate-500 hover:bg-white/5 hover:text-nordic-bronze"}">
    <i data-lucide="${icon}" size="18" class="${state.activeTab === id ? "text-nordic-black" : "group-hover:text-nordic-bronze"}"></i>
    <span class="text-[11px] font-black uppercase tracking-widest">${label}</span>
  </button>
`;

const DashboardView = () => {
  const delivered = state.projects.filter((p) => p.status === "delivered");
  const revenue = delivered.reduce(
    (acc, p) => acc + (p.manual_price || calculateCosts(p).roundedPrice),
    0,
  );
  const investment = state.purchases.reduce((acc, p) => acc + p.amount, 0);
  const critical = state.filaments.filter(
    (f) => f.remaining_weight / f.weight_grams < 0.15,
  );

  return `
    <header class="mb-12"><h2 class="text-4xl font-black text-white uppercase tracking-tighter">Panel <span class="text-nordic-bronze italic">Maestro</span></h2></header>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
      <div class="bg-nordic-gray p-8 rounded-[2.5rem] border border-white/5 shadow-xl">
        <p class="text-[10px] font-black uppercase text-slate-500 mb-1 tracking-widest">Ingresos</p>
        <p class="text-3xl font-black text-emerald-400 tracking-tighter">${state.config.currency}${formatAR(revenue, 0)}</p>
      </div>
      <div class="bg-nordic-gray p-8 rounded-[2.5rem] border border-white/5 shadow-xl">
        <p class="text-[10px] font-black uppercase text-slate-500 mb-1 tracking-widest">Inversión</p>
        <p class="text-3xl font-black text-rose-400 tracking-tighter">${state.config.currency}${formatAR(investment, 0)}</p>
      </div>
      <div class="bg-nordic-gray p-8 rounded-[2.5rem] border border-white/5 shadow-xl">
        <p class="text-[10px] font-black uppercase text-slate-500 mb-1 tracking-widest">Balance</p>
        <p class="text-3xl font-black text-white tracking-tighter">${state.config.currency}${formatAR(revenue - investment, 0)}</p>
      </div>
      <div class="bg-nordic-gray p-8 rounded-[2.5rem] border border-white/5 shadow-xl">
        <p class="text-[10px] font-black uppercase text-slate-500 mb-1 tracking-widest">Insumos Críticos</p>
        <p class="text-3xl font-black text-nordic-bronze tracking-tighter">${critical.length}</p>
      </div>
    </div>
  `;
};

const CalculatorView = () => {
  // Asegurar que state.editingProject existe antes de intentar renderizar
  if (!state.editingProject) {
    state.editingProject = {
      name: "",
      printingHours: 0,
      postProcessingCost: 0,
      complexityMultiplier: 1,
      profitMargin: state.config.defaultProfitMargin,
      filaments: [{ filamentId: "", gramsUsed: 0 }],
    };
  }

  const p = state.editingProject;
  const costs = calculateCosts(p);

  return `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-fade">
      <div class="space-y-8">
        <header><h2 class="text-4xl font-black text-white uppercase tracking-tighter">${p.id ? "Editar" : "Nueva"} <span class="text-nordic-bronze italic">Cotización</span></h2></header>
        <div class="bg-nordic-gray p-8 rounded-[2.5rem] border border-white/5 space-y-6 shadow-xl">
          <input oninput="window.updateCalc('name', this.value)" placeholder="Nombre de la pieza" class="w-full bg-black/40 border border-white/10 p-5 rounded-2xl text-white font-bold outline-none focus:border-nordic-bronze" value="${p.name}" />
          <div class="grid grid-cols-2 gap-6">
            <div><label class="text-[9px] font-black uppercase text-slate-500 ml-4 mb-2 block">Horas Impresión</label><input type="number" oninput="window.updateCalc('printingHours', this.value)" class="w-full bg-black/40 border border-white/10 p-5 rounded-2xl text-white font-bold outline-none" value="${p.printingHours}" /></div>
            <div><label class="text-[9px] font-black uppercase text-slate-500 ml-4 mb-2 block">Mano de Obra ($)</label><input type="number" oninput="window.updateCalc('postProcessingCost', this.value)" class="w-full bg-black/40 border border-white/10 p-5 rounded-2xl text-white font-bold outline-none" value="${p.postProcessingCost}" /></div>
          </div>
          
          <div class="space-y-4">
            <div class="flex justify-between items-center ml-4"><label class="text-[9px] font-black uppercase text-slate-500">Materiales Usados</label><button onclick="window.addFilamentRow()" class="text-nordic-bronze text-[10px] font-black uppercase hover:underline">+ Agregar Otro</button></div>
            ${p.filaments
              .map(
                (pf, idx) => `
              <div class="flex gap-2 animate-fade">
                <select onchange="window.updateFilamentRow(${idx}, 'filamentId', this.value)" class="flex-1 bg-black/40 border border-white/10 p-5 rounded-2xl text-white outline-none focus:border-nordic-bronze">
                  <option value="">Filamento...</option>
                  ${state.filaments.map((f) => `<option value="${f.id}" ${pf.filamentId === f.id ? "selected" : ""}>${f.name} (${Math.round(f.remaining_weight)}g)</option>`).join("")}
                </select>
                <input type="number" oninput="window.updateFilamentRow(${idx}, 'gramsUsed', this.value)" placeholder="Grs" class="w-24 bg-black/40 border border-white/10 p-5 rounded-2xl text-white font-bold outline-none" value="${pf.gramsUsed}" />
                ${idx > 0 ? `<button onclick="window.removeFilamentRow(${idx})" class="text-rose-500 p-2"><i data-lucide="trash-2" size="20"></i></button>` : ""}
              </div>
            `,
              )
              .join("")}
          </div>

          <div class="grid grid-cols-2 gap-6">
            <div><label class="text-[9px] font-black uppercase text-slate-500 ml-4 mb-2 block">Ganancia (%)</label><input type="number" oninput="window.updateCalc('profitMargin', this.value)" class="w-full bg-black/40 border border-white/10 p-5 rounded-2xl text-white font-bold outline-none" value="${p.profitMargin}" /></div>
            <div><label class="text-[9px] font-black uppercase text-slate-500 ml-4 mb-2 block">Multiplicador x</label><input type="number" step="0.1" oninput="window.updateCalc('complexityMultiplier', this.value)" class="w-full bg-black/40 border border-white/10 p-5 rounded-2xl text-white font-bold outline-none" value="${p.complexityMultiplier}" /></div>
          </div>
        </div>
      </div>
      <div class="lg:sticky lg:top-8 h-fit">
        <div class="bg-nordic-gray p-10 rounded-[3.5rem] border-2 border-nordic-bronze/40 shadow-2xl bronze-glow space-y-8">
          <div><p class="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2">Precio Final Sugerido</p><h2 class="text-7xl font-black text-nordic-bronze tracking-tighter font-mono">${state.config.currency}${formatAR(costs.roundedPrice, 0)}</h2></div>
          <div class="space-y-3 bg-black/40 p-5 rounded-2xl border border-white/5 shadow-inner">
             <div class="flex justify-between text-[10px] font-bold"><span>Total Materiales</span><span>${state.config.currency}${formatAR(costs.totalFilamentCost)}</span></div>
             <div class="flex justify-between text-[10px] font-bold"><span>Total Energía</span><span>${state.config.currency}${formatAR(costs.energyCost)}</span></div>
             <div class="flex justify-between text-[10px] font-bold"><span>Ganancia Líquida</span><span class="text-emerald-500 font-black">${state.config.currency}${formatAR(costs.profitAmount)}</span></div>
          </div>
          <button onclick="window.saveProject()" class="w-full bg-nordic-bronze text-nordic-black py-6 rounded-3xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:scale-[1.02] transition-all">Guardar en Catálogo</button>
        </div>
      </div>
    </div>
  `;
};

const CatalogView = () => `
  <header class="flex justify-between items-end mb-12">
    <div><h2 class="text-4xl font-black text-white uppercase tracking-tighter">Catálogo <span class="text-nordic-bronze italic">de Diseños</span></h2></div>
    <button onclick="window.setTab('calculator')" class="bg-nordic-bronze text-nordic-black px-8 py-4 rounded-2xl font-black text-xs uppercase shadow-lg">+ Nuevo Diseño</button>
  </header>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
    ${state.projects
      .filter((p) => p.status === "catalog")
      .map(
        (p) => `
      <div class="bg-nordic-gray rounded-[2.5rem] p-8 border border-white/5 bronze-glow flex flex-col h-full shadow-2xl">
        <div class="flex justify-between mb-4"><h3 class="text-xl font-black text-white tracking-tight">${p.name}</h3><div class="flex gap-2">
          <button onclick="window.editProject('${p.id}')" class="text-slate-500 hover:text-nordic-bronze"><i data-lucide="pencil" size="18"></i></button>
          <button onclick="window.deleteItem('diseño', '${p.id}')" class="text-rose-500/50 hover:text-rose-500"><i data-lucide="trash-2" size="18"></i></button>
        </div></div>
        <p class="text-3xl font-black text-nordic-bronze mb-6 font-mono">${state.config.currency}${formatAR(calculateCosts(p).roundedPrice, 0)}</p>
        <button onclick="window.initSell('${p.id}')" class="w-full bg-white/5 text-slate-200 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-nordic-bronze/10 hover:bg-nordic-bronze hover:text-nordic-black transition-all mt-auto">Registrar Venta</button>
      </div>
    `,
      )
      .join("")}
  </div>
`;

const OrdersView = () => `
  <header class="mb-12"><h2 class="text-4xl font-black text-white uppercase tracking-tighter">Ventas <span class="text-nordic-bronze italic">y Pedidos</span></h2></header>
  <div class="space-y-6">
    ${state.projects
      .filter((p) => p.status === "pending")
      .map((p) => {
        const client = state.clients.find((c) => c.id === p.client_id);
        return `
        <div class="bg-nordic-gray p-8 rounded-[2.5rem] border border-white/5 flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl bronze-glow animate-fade">
          <div class="flex items-center gap-6"><div class="p-5 rounded-2xl bg-nordic-black text-nordic-bronze shadow-inner"><i data-lucide="package" size="28"></i></div>
            <div><p class="text-[10px] font-black text-slate-500 uppercase tracking-widest">${client?.name || "Cliente Particular"}</p><h3 class="text-2xl font-black text-white">${p.name}</h3></div>
          </div>
          <div class="flex items-center gap-8"><div class="text-right font-mono text-3xl font-black text-nordic-bronze">${state.config.currency}${formatAR(calculateCosts(p).roundedPrice, 0)}</div>
            <button onclick="window.deliverProject('${p.id}')" class="bg-nordic-bronze text-nordic-black px-8 py-3 rounded-xl font-black text-[11px] uppercase shadow-lg hover:scale-105 transition-all">Entregar y Cobrar</button>
          </div>
        </div>
      `;
      })
      .join("")}
  </div>
`;

// --- LOGICA GLOBAL ---
window.setTab = (tab) => {
  if (tab === "calculator") {
    state.editingProject = {
      name: "",
      printingHours: 0,
      postProcessingCost: 0,
      complexityMultiplier: 1,
      profitMargin: state.config.defaultProfitMargin,
      filaments: [{ filamentId: "", gramsUsed: 0 }],
    };
  }
  state.activeTab = tab;
  renderApp();
};

window.updateCalc = (field, val) => {
  if (!state.editingProject) return;
  state.editingProject[field] = isNaN(val) || val === "" ? val : Number(val);
  renderApp();
};

window.addFilamentRow = () => {
  state.editingProject.filaments.push({ filamentId: "", gramsUsed: 0 });
  renderApp();
};

window.removeFilamentRow = (idx) => {
  state.editingProject.filaments.splice(idx, 1);
  renderApp();
};

window.updateFilamentRow = (idx, field, val) => {
  state.editingProject.filaments[idx][field] =
    field === "gramsUsed" ? Number(val) : val;
  renderApp();
};

window.saveProject = async () => {
  const p = state.editingProject;
  if (!p.name) return alert("Nombre requerido");
  const dbData = { ...p, status: "catalog", created_at: Date.now() };
  delete dbData.id;
  const { error } = await supabase.from("projects").insert([dbData]);
  if (!error) {
    state.activeTab = "catalog";
    state.editingProject = null;
    loadAllData();
  } else alert(error.message);
};

window.initSell = (id) => {
  state.modals.selectClient.project = state.projects.find((x) => x.id === id);
  state.modals.selectClient.show = true;
  renderApp();
};

window.finishSell = async (clientId) => {
  const p = state.modals.selectClient.project;
  const { id, ...rest } = p;
  const newOrder = {
    ...rest,
    client_id: clientId,
    status: "pending",
    created_at: Date.now(),
  };
  await supabase.from("projects").insert([newOrder]);
  state.modals.selectClient.show = false;
  state.activeTab = "orders";
  loadAllData();
};

window.deliverProject = async (id) => {
  const p = state.projects.find((x) => x.id === id);
  if (!p) return;
  for (const pf of p.filaments) {
    const f = state.filaments.find((fill) => fill.id === pf.filamentId);
    if (f) {
      await supabase
        .from("filaments")
        .update({
          remaining_weight: Math.max(0, f.remaining_weight - pf.gramsUsed),
        })
        .eq("id", f.id);
    }
  }
  await supabase.from("projects").update({ status: "delivered" }).eq("id", id);
  loadAllData();
};

window.deleteItem = async (type, id) => {
  if (confirm(`¿Eliminar ${type}?`)) {
    const table =
      type === "diseño" || type === "pedido" ? "projects" : "filaments";
    await supabase.from(table).delete().eq("id", id);
    loadAllData();
  }
};

window.logout = async () => {
  await supabase.auth.signOut();
  state.session = null;
  renderApp();
};

// --- RENDER MOTOR ---
const renderApp = () => {
  const root = document.getElementById("root");
  if (!state.session) {
    root.innerHTML = `<div class="min-h-screen bg-nordic-black flex items-center justify-center p-6"><div class="w-full max-w-md bg-nordic-gray rounded-[3rem] p-12 border border-white/5 shadow-2xl bronze-glow animate-fade"><h2 class="text-3xl font-black text-white text-center mb-12">STUDIO<span class="text-nordic-bronze">3D</span></h2><form id="auth-form" class="space-y-6"><input required type="email" id="email" placeholder="Email" class="w-full bg-black/40 border border-white/10 rounded-2xl px-8 py-5 text-white font-bold outline-none" /><input required type="password" id="pass" placeholder="Clave" class="w-full bg-black/40 border border-white/10 rounded-2xl px-8 py-5 text-white font-bold outline-none" /><button type="submit" class="w-full bg-nordic-bronze text-nordic-black py-6 rounded-[1.5rem] font-black uppercase tracking-widest">Acceder</button></form></div></div>`;
    document
      .getElementById("auth-form")
      ?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const { data, error } = await supabase.auth.signInWithPassword({
          email: document.getElementById("email").value,
          password: document.getElementById("pass").value,
        });
        if (!error) {
          state.session = data.session;
          loadAllData();
        } else alert("Error de acceso");
      });
    return;
  }

  if (state.loading) {
    root.innerHTML = `<div class="min-h-screen bg-nordic-black flex items-center justify-center"><div class="loading-spinner"></div></div>`;
    return;
  }

  root.innerHTML = `
    <div class="min-h-screen flex flex-col md:flex-row bg-nordic-black text-slate-300 font-sans">
      <aside class="w-full md:w-80 bg-nordic-gray border-r border-white/5 p-8 flex flex-col gap-2 h-screen sticky top-0 overflow-y-auto">
        <div class="flex items-center gap-4 mb-10"><h1 class="text-2xl font-black text-white uppercase tracking-tighter">STUDIO<span class="text-nordic-bronze">3D</span></h1></div>
        <nav class="flex-1 space-y-1">
          ${NavBtn("dashboard", "layout-dashboard", "Resumen")}
          ${NavBtn("catalog", "shopping-bag", "Catálogo")}
          ${NavBtn("orders", "clipboard-list", "Ventas")}
          ${NavBtn("inventory", "database", "Inventario")}
          <div class="h-px bg-white/5 my-6"></div>
          ${NavBtn("calculator", "calculator", "Cotizar")}
          ${NavBtn("config", "settings", "Ajustes")}
        </nav>
        <button onclick="window.logout()" class="mt-8 flex items-center gap-4 px-6 py-4 text-rose-500 hover:bg-rose-950/20 rounded-xl font-black uppercase text-[10px] transition-all"><i data-lucide="log-out" size="16"></i> Salir</button>
      </aside>
      <main class="flex-1 p-6 md:p-12 overflow-y-auto"><div class="max-w-6xl mx-auto">
        ${state.activeTab === "dashboard" ? DashboardView() : ""}
        ${state.activeTab === "catalog" ? CatalogView() : ""}
        ${state.activeTab === "orders" ? OrdersView() : ""}
        ${
          state.activeTab === "inventory"
            ? `
          <header class="flex justify-between items-end mb-12"><div><h2 class="text-4xl font-black text-white uppercase tracking-tighter">Insumos <span class="text-nordic-bronze italic">y Filamento</span></h2></div>
          <button onclick="state.modals.insumo.show = true; renderApp();" class="bg-nordic-bronze text-nordic-black px-8 py-4 rounded-2xl font-black text-xs uppercase shadow-lg">+ Nuevo Material</button></header>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${state.filaments
              .map(
                (f) => `
              <div class="bg-nordic-gray p-8 rounded-[2.5rem] border border-white/5 relative group hover:border-nordic-bronze/40 transition-all shadow-xl">
                <div class="flex items-center gap-4 mb-6"><div class="bg-nordic-black p-4 rounded-2xl text-nordic-bronze shadow-inner"><i data-lucide="droplets" size="24"></i></div>
                  <div><h4 class="font-black text-white">${f.name}</h4><p class="text-[10px] text-slate-500 uppercase font-black">${f.brand}</p></div>
                </div>
                <div class="space-y-4">
                  <div class="flex justify-between text-[10px] font-black text-slate-500 uppercase"><span>Stock: ${Math.round(f.remaining_weight)}g</span></div>
                  <div class="h-1.5 bg-black rounded-full overflow-hidden"><div class="h-full bg-nordic-bronze" style="width: ${(f.remaining_weight / f.weight_grams) * 100}%"></div></div>
                </div>
              </div>
            `,
              )
              .join("")}
          </div>
        `
            : ""
        }
        ${state.activeTab === "calculator" ? CalculatorView() : ""}
      </div></main>
      ${
        state.modals.selectClient.show
          ? `
        <div class="fixed inset-0 bg-black/95 backdrop-blur-md z-[200] flex items-center justify-center p-6 animate-fade">
          <div class="bg-nordic-gray rounded-[2.5rem] w-full max-w-xl p-12 border border-nordic-bronze/30 shadow-2xl bronze-glow">
            <h3 class="text-2xl font-black text-nordic-bronze mb-8 uppercase tracking-tighter">Asignar Venta</h3>
            <div class="space-y-4 mb-8">
              ${state.clients.map((c) => `<button onclick="window.finishSell('${c.id}')" class="w-full p-6 rounded-2xl border transition-all text-left bg-black/20 border-white/5 text-white hover:border-nordic-bronze/50 group"><span class="font-bold uppercase text-xs tracking-widest">${c.name}</span></button>`).join("")}
              <button onclick="state.modals.selectClient.show = false; renderApp();" class="w-full bg-white/5 text-slate-500 py-4 rounded-2xl font-black uppercase text-[10px]">Cerrar</button>
            </div>
          </div>
        </div>
      `
          : ""
      }
      ${
        state.modals.insumo.show
          ? `
        <div class="fixed inset-0 bg-black/95 backdrop-blur-md z-[200] flex items-center justify-center p-6 animate-fade">
          <div class="bg-nordic-gray rounded-[2.5rem] w-full max-w-md p-10 border border-nordic-bronze/30 shadow-2xl">
            <h3 class="text-2xl font-black text-nordic-bronze mb-8 uppercase tracking-tighter">Nuevo Material</h3>
            <div class="space-y-6">
              <input id="ins-name" placeholder="Nombre / Color" class="w-full bg-black/40 p-5 rounded-2xl text-white outline-none border border-white/10" />
              <input id="ins-brand" placeholder="Marca" class="w-full bg-black/40 p-5 rounded-2xl text-white outline-none border border-white/10" />
              <div class="grid grid-cols-2 gap-4">
                <input id="ins-weight" type="number" placeholder="Peso (g)" class="w-full bg-black/40 p-5 rounded-2xl text-white border border-white/10" />
                <input id="ins-price" type="number" placeholder="Precio ($)" class="w-full bg-black/40 p-5 rounded-2xl text-white border border-white/10" />
              </div>
              <button onclick="window.confirmInsumo()" class="w-full bg-nordic-bronze text-nordic-black py-5 rounded-2xl font-black uppercase">Guardar Material</button>
              <button onclick="state.modals.insumo.show = false; renderApp();" class="w-full text-slate-500 font-bold uppercase text-[10px]">Cancelar</button>
            </div>
          </div>
        </div>
      `
          : ""
      }
    </div>
  `;

  createIcons({
    icons: {
      LayoutDashboard,
      Database,
      Calculator,
      ShoppingBag,
      ClipboardList,
      Users,
      Settings,
      History,
      LogOut,
      Plus,
      Pencil,
      Trash2,
      Box,
      Droplets,
      Hammer,
      Coins,
      Flame,
      Archive,
      RotateCcw,
      Check,
      User,
      Info,
      AlertCircle,
      BarChart3,
      TrendingUp,
      TrendingDown,
      Package,
      X,
      Truck,
      Sparkles,
      Loader2,
      Wallet,
      ArrowRight,
      ArrowRightCircle,
      PieChart,
      MinusCircle,
      Github,
      ExternalLink,
      Terminal,
      ChevronDown,
      ChevronUp,
      Wrench,
      Trash,
    },
  });
};

window.confirmInsumo = async () => {
  const dbData = {
    name: document.getElementById("ins-name").value,
    brand: document.getElementById("ins-brand").value,
    weight_grams: Number(document.getElementById("ins-weight").value),
    price: Number(document.getElementById("ins-price").value),
    remaining_weight: Number(document.getElementById("ins-weight").value),
  };
  const { error } = await supabase.from("filaments").insert([dbData]);
  if (!error) {
    state.modals.insumo.show = false;
    loadAllData();
  } else alert(error.message);
};

const init = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  state.session = session;
  if (session) await loadAllData();
  else {
    state.loading = false;
    renderApp();
  }
};
init();
