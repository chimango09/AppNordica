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
  deletedRecords: [],
  localDeletedRecords: JSON.parse(
    localStorage.getItem("studio3d_local_trash") || "[]",
  ),
  trashStatus: "online",
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
  editingProject: null, // Se inicializa al entrar a 'calculator'
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

// --- SERVICIOS DE DATOS ---
const loadAllData = async () => {
  if (!state.session) return;
  state.loading = true;
  renderApp();
  try {
    const [fils, clis, projs, purs, conf, trash] = await Promise.all([
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
      supabase
        .from("deleted_records")
        .select("*")
        .order("deleted_at", { ascending: false }),
    ]);

    state.filaments = fils.data || [];
    state.clients = clis.data || [];
    state.projects = projs.data || [];
    state.purchases = purs.data || [];
    state.deletedRecords = trash.data || [];
    state.trashStatus = trash.error ? "degraded" : "online";

    if (conf.data) {
      state.config = {
        energyRateKwh: Number(conf.data.energy_rate_kwh),
        printerPowerWatts: Number(conf.data.printer_power_watts),
        defaultProfitMargin: Number(conf.data.default_profit_margin),
        currency: conf.data.currency || "$",
      };
    }
  } catch (e) {
    console.error("Error en carga:", e);
  } finally {
    state.loading = false;
    renderApp();
  }
};

// --- COMPONENTES DE NAVEGACIÓN ---
const NavBtn = (id, icon, label) => `
  <button onclick="window.setTab('${id}')" class="flex items-center gap-4 px-6 py-4 rounded-2xl transition-all w-full text-left group ${state.activeTab === id ? "bg-nordic-bronze text-nordic-black font-black shadow-lg shadow-nordic-bronze/10" : "text-slate-500 hover:bg-white/5 hover:text-nordic-bronze"}">
    <i data-lucide="${icon}" size="18" class="${state.activeTab === id ? "text-nordic-black" : "group-hover:text-nordic-bronze"}"></i>
    <span class="text-[11px] font-black uppercase tracking-widest">${label}</span>
  </button>
`;

const Sidebar = () => `
  <aside class="w-full md:w-80 bg-nordic-gray border-r border-white/5 p-8 flex flex-col gap-2 h-screen sticky top-0 overflow-y-auto z-[100]">
    <div class="flex items-center gap-4 mb-10">
      <div class="bg-nordic-bronze p-3 rounded-2xl text-nordic-black shadow-lg shadow-nordic-bronze/10"><i data-lucide="box" size="24"></i></div>
      <h1 class="text-2xl font-black text-white uppercase tracking-tighter">STUDIO<span class="text-nordic-bronze">3D</span></h1>
    </div>
    <nav class="flex-1 space-y-1">
      ${NavBtn("dashboard", "layout-dashboard", "Resumen")}
      ${NavBtn("catalog", "shopping-bag", "Catálogo")}
      ${NavBtn("orders", "clipboard-list", "Ventas")}
      ${NavBtn("inventory", "database", "Inventario")}
      ${NavBtn("purchases", "coins", "Gastos")}
      ${NavBtn("clients", "users", "Clientes")}
      <div class="h-px bg-white/5 my-6"></div>
      ${NavBtn("calculator", "calculator", "Cotizar")}
      ${NavBtn("trash", "history", "Papelera")}
      ${NavBtn("config", "settings", "Ajustes")}
    </nav>
    <button onclick="window.logout()" class="mt-8 flex items-center gap-4 px-6 py-4 text-rose-500 hover:bg-rose-950/20 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all">
      <i data-lucide="log-out" size="16"></i> Salir
    </button>
  </aside>
`;

// --- VISTAS ---
const DashboardView = () => {
  const delivered = state.projects.filter((p) => p.status === "delivered");
  const revenue = delivered.reduce(
    (acc, p) => acc + (p.manual_price || calculateCosts(p).roundedPrice),
    0,
  );
  const investment = state.purchases.reduce((acc, p) => acc + p.amount, 0);
  const criticalInsumos = state.filaments.filter(
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
        <p class="text-[10px] font-black uppercase text-slate-500 mb-1 tracking-widest">Utilidad</p>
        <p class="text-3xl font-black text-white tracking-tighter">${state.config.currency}${formatAR(revenue - investment, 0)}</p>
      </div>
      <div class="bg-nordic-gray p-8 rounded-[2.5rem] border border-white/5 shadow-xl">
        <p class="text-[10px] font-black uppercase text-slate-500 mb-1 tracking-widest">Insumos Críticos</p>
        <p class="text-3xl font-black text-nordic-bronze tracking-tighter">${criticalInsumos.length}</p>
      </div>
    </div>
    ${
      criticalInsumos.length > 0
        ? `
      <div class="bg-rose-500/5 border border-rose-500/20 p-8 rounded-[2.5rem] animate-fade">
        <h3 class="text-xs font-black uppercase text-rose-500 tracking-[0.2em] mb-4">Reponer Urgente</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${criticalInsumos.map((f) => `<div class="bg-black/20 p-4 rounded-2xl flex justify-between items-center"><span class="font-bold text-white">${f.name}</span><span class="text-rose-500 font-black">${Math.round(f.remaining_weight)}g</span></div>`).join("")}
        </div>
      </div>
    `
        : ""
    }
  `;
};

const CalculatorView = () => {
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
        <header><h2 class="text-4xl font-black text-white uppercase tracking-tighter">${p.id ? "Editar" : "Nueva"} <span class="text-nordic-bronze italic">Pieza</span></h2></header>
        <div class="bg-nordic-gray p-8 rounded-[2.5rem] border border-white/5 space-y-6 shadow-xl">
          <div><label class="text-[9px] font-black uppercase text-slate-500 ml-4 mb-2 block">Nombre del Diseño</label>
          <input oninput="window.updateCalc('name', this.value)" placeholder="Ej: Maceta Articulated" class="w-full bg-black/40 border border-white/10 p-5 rounded-2xl text-white font-bold outline-none focus:border-nordic-bronze transition-all" value="${p.name}" /></div>
          
          <div class="grid grid-cols-2 gap-6">
            <div><label class="text-[9px] font-black uppercase text-slate-500 ml-4 mb-2 block">Horas Impresión</label>
            <input type="number" oninput="window.updateCalc('printingHours', this.value)" class="w-full bg-black/40 border border-white/10 p-5 rounded-2xl text-white font-bold outline-none" value="${p.printingHours}" /></div>
            <div><label class="text-[9px] font-black uppercase text-slate-500 ml-4 mb-2 block">Post-Procesado ($)</label>
            <input type="number" oninput="window.updateCalc('postProcessingCost', this.value)" class="w-full bg-black/40 border border-white/10 p-5 rounded-2xl text-white font-bold outline-none" value="${p.postProcessingCost}" /></div>
          </div>
          
          <div class="space-y-4">
            <div class="flex justify-between items-center ml-4"><label class="text-[9px] font-black uppercase text-slate-500">Filamentos Utilizados</label>
            <button onclick="window.addFilamentRow()" class="text-nordic-bronze text-[10px] font-black uppercase hover:underline">+ Otro Material</button></div>
            ${p.filaments
              .map(
                (pf, idx) => `
              <div class="flex gap-2 group animate-fade">
                <select onchange="window.updateFilamentRow(${idx}, 'filamentId', this.value)" class="flex-1 bg-black/40 border border-white/10 p-5 rounded-2xl text-white outline-none focus:border-nordic-bronze">
                  <option value="">Seleccionar...</option>
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
            <div><label class="text-[9px] font-black uppercase text-slate-500 ml-4 mb-2 block">Margen (%)</label>
            <input type="number" oninput="window.updateCalc('profitMargin', this.value)" class="w-full bg-black/40 border border-white/10 p-5 rounded-2xl text-white font-bold outline-none" value="${p.profitMargin}" /></div>
            <div><label class="text-[9px] font-black uppercase text-slate-500 ml-4 mb-2 block">Complejidad x</label>
            <input type="number" step="0.1" oninput="window.updateCalc('complexityMultiplier', this.value)" class="w-full bg-black/40 border border-white/10 p-5 rounded-2xl text-white font-bold outline-none" value="${p.complexityMultiplier}" /></div>
          </div>
        </div>
      </div>
      <div class="lg:sticky lg:top-8 h-fit">
        <div class="bg-nordic-gray p-10 rounded-[3.5rem] border-2 border-nordic-bronze/40 shadow-2xl bronze-glow space-y-8">
          <div><p class="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2">Sugerido para el Cliente</p>
          <h2 class="text-7xl font-black text-nordic-bronze tracking-tighter font-mono">${state.config.currency}${formatAR(costs.roundedPrice, 0)}</h2></div>
          <div class="space-y-3 bg-black/40 p-5 rounded-2xl border border-white/5 shadow-inner text-xs">
             <div class="flex justify-between"><span>Costo Materiales</span><span>${state.config.currency}${formatAR(costs.totalFilamentCost)}</span></div>
             <div class="flex justify-between"><span>Costo Energía</span><span>${state.config.currency}${formatAR(costs.energyCost)}</span></div>
             <div class="flex justify-between font-black text-emerald-500 pt-2 border-t border-white/5"><span>Ganancia Líquida</span><span>${state.config.currency}${formatAR(costs.profitAmount)}</span></div>
          </div>
          <button onclick="window.saveProject()" class="w-full bg-nordic-bronze text-nordic-black py-6 rounded-3xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:scale-[1.02] transition-all">Guardar en el Taller</button>
        </div>
      </div>
    </div>
  `;
};

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
  state.editingProject[field] =
    isNaN(val) || val === ""
      ? val
      : field === "complexityMultiplier"
        ? parseFloat(val)
        : parseInt(val);
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
  if (!p.name) return alert("El nombre es obligatorio.");
  const dbData = {
    name: p.name,
    printing_hours: p.printingHours,
    post_processing_cost: p.postProcessingCost,
    complexity_multiplier: p.complexityMultiplier,
    profit_margin: p.profitMargin,
    filaments: p.filaments.filter((f) => f.filamentId && f.gramsUsed > 0),
    status: p.status || "catalog",
    created_at: Date.now(),
  };
  const { error } = p.id
    ? await supabase.from("projects").update(dbData).eq("id", p.id)
    : await supabase.from("projects").insert([dbData]);
  if (!error) {
    state.activeTab = "catalog";
    state.editingProject = null;
    loadAllData();
  } else alert(error.message);
};

window.deliverProject = async (id) => {
  const p = state.projects.find((x) => x.id === id);
  if (!p) return;
  for (const pf of p.filaments) {
    const f = state.filaments.find((fill) => fill.id === pf.filamentId);
    if (f) {
      const newWeight = f.remaining_weight - pf.gramsUsed;
      await supabase
        .from("filaments")
        .update({ remaining_weight: Math.max(0, newWeight) })
        .eq("id", f.id);
    }
  }
  await supabase.from("projects").update({ status: "delivered" }).eq("id", id);
  loadAllData();
};

// --- MÁS VISTAS (RESTANTE) ---
const CatalogView = () => `
  <header class="flex justify-between items-end mb-12">
    <div><h2 class="text-4xl font-black text-white uppercase tracking-tighter">Catálogo <span class="text-nordic-bronze italic">de Modelos</span></h2></div>
    <button onclick="window.setTab('calculator')" class="bg-nordic-bronze text-nordic-black px-8 py-4 rounded-2xl font-black text-xs uppercase shadow-lg hover:scale-105 transition-all">+ Nuevo Modelo</button>
  </header>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
    ${state.projects
      .filter((p) => p.status === "catalog")
      .map(
        (p) => `
      <div class="bg-nordic-gray rounded-[2.5rem] p-8 border border-white/5 bronze-glow flex flex-col h-full shadow-2xl animate-fade">
        <div class="flex justify-between mb-4"><h3 class="text-xl font-black text-white tracking-tight">${p.name}</h3><div class="flex gap-2">
          <button onclick="window.editProject('${p.id}')" class="text-slate-500 hover:text-nordic-bronze"><i data-lucide="pencil" size="18"></i></button>
          <button onclick="window.deleteItem('diseño', '${p.id}')" class="text-rose-500/50 hover:text-rose-500"><i data-lucide="trash-2" size="18"></i></button>
        </div></div>
        <p class="text-3xl font-black text-nordic-bronze mb-6 font-mono">${state.config.currency}${formatAR(calculateCosts(p).roundedPrice, 0)}</p>
        <button onclick="window.initSell('${p.id}')" class="w-full bg-white/5 text-slate-200 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-nordic-bronze/10 hover:bg-nordic-bronze hover:text-nordic-black transition-all mt-auto">Vender Pieza</button>
      </div>
    `,
      )
      .join("")}
  </div>
`;

const TrashView = () => {
  const all = [
    ...state.deletedRecords.map((r) => ({ ...r, isLocal: false })),
    ...state.localDeletedRecords.map((r) => ({ ...r, isLocal: true })),
  ].sort((a, b) => new Date(b.deleted_at) - new Date(a.deleted_at));
  return `
    <header class="mb-12"><h2 class="text-4xl font-black text-white uppercase tracking-tighter">Papelera <span class="text-nordic-bronze italic">Híbrida</span></h2></header>
    ${
      all.length === 0
        ? `<div class="p-20 text-center opacity-30 font-black uppercase tracking-widest">Vacío</div>`
        : `
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${all
          .map(
            (r) => `
          <div class="bg-nordic-gray p-8 rounded-[2.5rem] border border-white/5 relative group animate-fade shadow-xl">
            <h4 class="font-black text-white mb-1">${r.item_name}</h4>
            <p class="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-6">${r.item_type} • ${r.isLocal ? "LOCAL" : "NUBE"}</p>
            <button onclick="window.restoreRecord('${r.id}', ${r.isLocal})" class="w-full bg-nordic-bronze text-nordic-black py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] transition-all">Restaurar</button>
          </div>
        `,
          )
          .join("")}
      </div>
    `
    }
  `;
};

// --- LOGICA DE PAPELERA Y OTROS ---
window.editProject = (id) => {
  const p = state.projects.find((x) => x.id === id);
  state.editingProject = {
    id: p.id,
    name: p.name,
    printingHours: p.printing_hours,
    postProcessingCost: p.post_processing_cost,
    complexityMultiplier: p.complexity_multiplier,
    profitMargin: p.profit_margin,
    filaments: p.filaments || [{ filamentId: "", gramsUsed: 0 }],
    status: p.status,
  };
  state.activeTab = "calculator";
  renderApp();
};

window.initSell = (id) => {
  state.modals.selectClient.project = state.projects.find((x) => x.id === id);
  state.modals.selectClient.show = true;
  renderApp();
};

window.deleteItem = async (type, id) => {
  if (!confirm(`¿Mover ${type} a la papelera?`)) return;
  const table =
    type === "diseño" || type === "pedido" ? "projects" : "filaments";
  const item =
    type === "diseño" || type === "pedido"
      ? state.projects.find((x) => x.id === id)
      : state.filaments.find((x) => x.id === id);

  const rec = {
    id: "tr-" + Date.now(),
    item_type: type,
    item_name: item.name,
    deleted_at: new Date().toISOString(),
    original_data: JSON.stringify(item),
  };
  const { error } = await supabase.from("deleted_records").insert([rec]);
  if (error) {
    state.localDeletedRecords.push(rec);
    localStorage.setItem(
      "studio3d_local_trash",
      JSON.stringify(state.localDeletedRecords),
    );
  }

  await supabase.from(table).delete().eq("id", id);
  loadAllData();
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
    root.innerHTML = `<div class="min-h-screen bg-nordic-black flex items-center justify-center p-6"><div class="w-full max-w-md bg-nordic-gray rounded-[3rem] p-12 border border-white/5 shadow-2xl bronze-glow animate-fade"><h2 class="text-3xl font-black text-white text-center mb-12 uppercase tracking-tighter leading-none">STUDIO<span class="text-nordic-bronze">3D</span></h2><form id="auth-form" class="space-y-6"><input required type="email" id="email" placeholder="Usuario" class="w-full bg-black/40 border border-white/10 rounded-2xl px-8 py-5 text-white font-bold outline-none focus:border-nordic-bronze transition-all" /><input required type="password" id="pass" placeholder="Clave" class="w-full bg-black/40 border border-white/10 rounded-2xl px-8 py-5 text-white font-bold outline-none focus:border-nordic-bronze transition-all" /><button type="submit" class="w-full bg-nordic-bronze text-nordic-black py-6 rounded-[1.5rem] font-black uppercase tracking-widest shadow-xl">Acceder al Taller</button></form></div></div>`;
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
        } else alert("Acceso denegado");
      });
    return;
  }

  if (state.loading) {
    root.innerHTML = `<div class="min-h-screen bg-nordic-black flex items-center justify-center"><div class="loading-spinner"></div></div>`;
    return;
  }

  root.innerHTML = `
    <div class="min-h-screen flex flex-col md:flex-row bg-nordic-black text-slate-300 font-sans">
      ${Sidebar()}
      <main class="flex-1 p-6 md:p-12 overflow-y-auto bg-nordic-black"><div class="max-w-6xl mx-auto">
        ${state.activeTab === "dashboard" ? DashboardView() : ""}
        ${state.activeTab === "calculator" ? CalculatorView() : ""}
        ${state.activeTab === "catalog" ? CatalogView() : ""}
        ${state.activeTab === "trash" ? TrashView() : ""}
        ${
          state.activeTab === "inventory"
            ? `
          <header class="flex justify-between items-end mb-12"><div><h2 class="text-4xl font-black text-white uppercase tracking-tighter">Insumos <span class="text-nordic-bronze italic">y Filamento</span></h2></div>
          <button onclick="state.modals.insumo.show = true; renderApp();" class="bg-nordic-bronze text-nordic-black px-8 py-4 rounded-2xl font-black text-xs uppercase shadow-lg">+ Nuevo Material</button></header>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${state.filaments
              .map(
                (f) => `
              <div class="bg-nordic-gray p-8 rounded-[2.5rem] border border-white/5 relative group hover:border-nordic-bronze/40 transition-all shadow-xl animate-fade">
                <div class="flex items-center gap-4 mb-6"><div class="bg-nordic-black p-4 rounded-2xl text-nordic-bronze shadow-inner"><i data-lucide="droplets" size="24"></i></div>
                  <div><h4 class="font-black text-white">${f.name}</h4><p class="text-[10px] text-slate-500 uppercase font-black">${f.brand}</p></div>
                </div>
                <div class="space-y-4">
                  <div class="flex justify-between text-[10px] font-black text-slate-500 uppercase"><span>Stock: ${Math.round(f.remaining_weight)}g</span></div>
                  <div class="h-1.5 bg-black rounded-full overflow-hidden"><div class="h-full bg-nordic-bronze" style="width: ${(f.remaining_weight / f.weight_grams) * 100}%"></div></div>
                  <p class="text-2xl font-black text-nordic-bronze text-right font-mono">${state.config.currency}${formatAR(f.price, 0)}</p>
                </div>
                <button onclick="window.deleteItem('filamento', '${f.id}')" class="absolute top-6 right-6 text-rose-500/30 hover:text-rose-500"><i data-lucide="trash-2" size="16"></i></button>
              </div>
            `,
              )
              .join("")}
          </div>
        `
            : ""
        }
        ${
          state.activeTab === "orders"
            ? `
          <header class="mb-12"><h2 class="text-4xl font-black text-white uppercase tracking-tighter">Ventas <span class="text-nordic-bronze italic">Activas</span></h2></header>
          <div class="space-y-6">
            ${state.projects
              .filter((p) => p.status === "pending")
              .map(
                (p) => `
              <div class="bg-nordic-gray p-8 rounded-[2.5rem] border border-white/5 flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl bronze-glow animate-fade">
                <div class="flex items-center gap-6"><div class="p-5 rounded-2xl bg-nordic-black text-nordic-bronze shadow-inner"><i data-lucide="package" size="28"></i></div>
                  <div><h3 class="text-2xl font-black text-white">${p.name}</h3><p class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Pedido en curso</p></div>
                </div>
                <div class="flex items-center gap-8"><div class="text-right font-mono text-3xl font-black text-nordic-bronze">${state.config.currency}${formatAR(calculateCosts(p).roundedPrice, 0)}</div>
                  <button onclick="window.deliverProject('${p.id}')" class="bg-nordic-bronze text-nordic-black px-8 py-3 rounded-xl font-black text-[11px] uppercase shadow-lg hover:scale-105 transition-all">Entregar y Cobrar</button>
                </div>
              </div>
            `,
              )
              .join("")}
          </div>
        `
            : ""
        }
      </div></main>

      ${
        state.modals.selectClient.show
          ? `
        <div class="fixed inset-0 bg-black/95 backdrop-blur-md z-[200] flex items-center justify-center p-6 animate-fade">
          <div class="bg-nordic-gray rounded-[2.5rem] w-full max-w-xl p-12 border border-nordic-bronze/30 shadow-2xl bronze-glow text-center">
            <h3 class="text-2xl font-black text-nordic-bronze mb-8 uppercase tracking-tighter">Asignar Venta</h3>
            <p class="text-slate-400 mb-8">Selecciona el cliente para registrar la salida de material.</p>
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
              <input id="ins-name" placeholder="Nombre (Ej: PLA Silk Gold)" class="w-full bg-black/40 p-5 rounded-2xl text-white outline-none border border-white/10" />
              <input id="ins-brand" placeholder="Marca (Ej: Grilon3)" class="w-full bg-black/40 p-5 rounded-2xl text-white outline-none border border-white/10" />
              <div class="grid grid-cols-2 gap-4">
                <input id="ins-weight" type="number" placeholder="Peso (g)" class="w-full bg-black/40 p-5 rounded-2xl text-white border border-white/10" />
                <input id="ins-price" type="number" placeholder="Costo ($)" class="w-full bg-black/40 p-5 rounded-2xl text-white border border-white/10" />
              </div>
              <button onclick="window.confirmInsumo()" class="w-full bg-nordic-bronze text-nordic-black py-5 rounded-2xl font-black uppercase shadow-xl">Guardar Material</button>
              <button onclick="state.modals.insumo.show = false; renderApp();" class="w-full text-slate-500 font-bold uppercase text-[10px] mt-2">Cancelar</button>
            </div>
          </div>
        </div>
      `
          : ""
      }
    </div>
  `;

  createIcons();
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

window.confirmInsumo = async () => {
  const weight = Number(document.getElementById("ins-weight").value);
  const dbData = {
    name: document.getElementById("ins-name").value,
    brand: document.getElementById("ins-brand").value,
    weight_grams: weight,
    price: Number(document.getElementById("ins-price").value),
    remaining_weight: weight,
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
