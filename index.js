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
  trashStatus: "online",
  config: {
    energyRateKwh: 150,
    printerPowerWatts: 200,
    defaultProfitMargin: 100,
    currency: "$",
  },

  // UI State
  modal: {
    isOpen: false,
    title: "",
    message: "",
    type: "confirm",
    onConfirm: null,
  },
  modals: {
    purchase: { show: false, editing: null },
    insumo: { show: false, editingFilament: null },
    client: { show: false },
    selectClient: { show: false, project: null },
  },
  editingProject: null,
};

// --- HELPERS DE NEGOCIO ---
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
      supabase.from("deleted_records").select("*"),
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

const Sidebar = () => `
  <aside class="w-full md:w-80 bg-nordic-gray border-r border-white/5 p-8 flex flex-col gap-2 shadow-2xl z-[100] h-screen sticky top-0 overflow-y-auto custom-scrollbar">
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
    <button onclick="window.logout()" class="mt-8 flex items-center gap-4 px-6 py-4 text-rose-500 hover:bg-rose-950/20 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all"><i data-lucide="log-out" size="16"></i> Salir</button>
  </aside>
`;

const Header = (title, accent, sub) => `
  <header class="flex flex-col gap-2 mb-12 animate-fade">
    <h2 class="text-4xl font-black text-white uppercase tracking-tighter">${title} <span class="text-nordic-bronze italic">${accent}</span></h2>
    <p class="text-slate-500 text-xs font-bold uppercase tracking-widest">${sub}</p>
  </header>
`;

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
    ${Header("Panel", "Maestro", "Resumen económico y alertas")}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
      ${StatCard("Ventas Totales", revenue, "emerald", "trending-up", "Ingresos")}
      ${StatCard("Inversión", investment, "rose", "trending-down", "Egresos")}
      <div class="p-8 rounded-[2.5rem] border flex flex-col gap-4 shadow-xl ${revenue >= investment ? "bg-emerald-950/20 border-emerald-500/30" : "bg-rose-950/20 border-rose-500/30"}">
        <div class="flex justify-between items-start"><i data-lucide="bar-chart-3" class="${revenue >= investment ? "text-emerald-500" : "text-rose-500"}"></i></div>
        <div><p class="text-[10px] font-black uppercase text-slate-500 mb-1 tracking-widest">Utilidad Estimada</p><p class="text-3xl font-black tracking-tighter ${revenue >= investment ? "text-emerald-400" : "text-rose-400"}">${state.config.currency}${formatAR(revenue - investment, 0)}</p></div>
      </div>
      <div class="bg-nordic-gray p-8 rounded-[2.5rem] border border-white/5 flex flex-col gap-4 shadow-xl">
        <div class="flex justify-between items-start"><i data-lucide="package" class="text-nordic-bronze"></i></div>
        <div><p class="text-[10px] font-black uppercase text-slate-500 mb-1 tracking-widest">Insumos Críticos</p><p class="text-3xl font-black text-white tracking-tighter">${criticalInsumos.length}</p></div>
      </div>
    </div>

    ${
      criticalInsumos.length > 0
        ? `
      <section class="animate-fade">
        <h3 class="text-xl font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2"><i data-lucide="alert-circle" class="text-rose-500"></i> Reposición Urgente</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          ${criticalInsumos
            .map(
              (f) => `
            <div class="bg-rose-500/5 border border-rose-500/20 p-6 rounded-3xl flex items-center justify-between">
              <div><p class="font-black text-white uppercase text-xs">${f.name}</p><p class="text-[10px] text-rose-500 font-bold">${Math.round(f.remaining_weight)}g restantes</p></div>
              <button onclick="window.setTab('inventory')" class="p-2 bg-rose-500/20 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all"><i data-lucide="arrow-right" size="16"></i></button>
            </div>
          `,
            )
            .join("")}
        </div>
      </section>
    `
        : ""
    }
  `;
};

const StatCard = (label, val, color, icon, sub) => `
  <div class="bg-nordic-gray p-8 rounded-[2.5rem] border border-white/5 flex flex-col gap-4 shadow-xl">
    <div class="flex justify-between items-start"><i data-lucide="${icon}" class="text-${color}-500"></i><span class="text-[9px] font-black uppercase text-${color}-500 tracking-widest bg-${color}-500/10 px-3 py-1 rounded-full">${label}</span></div>
    <div><p class="text-[10px] font-black uppercase text-slate-500 mb-1 tracking-widest">${sub}</p><p class="text-3xl font-black text-white tracking-tighter font-mono">${state.config.currency}${formatAR(val, 0)}</p></div>
  </div>
`;

const CalculatorView = () => {
  const p = state.editingProject || {
    name: "",
    printingHours: 0,
    postProcessingCost: 0,
    complexityMultiplier: 1,
    profitMargin: state.config.defaultProfitMargin,
    filaments: [{ filamentId: "", gramsUsed: 0 }],
  };
  const costs = calculateCosts(p);

  return `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-fade">
      <div class="space-y-8">
        <header><h2 class="text-4xl font-black text-white uppercase tracking-tighter">${p.id ? "Editar" : "Nueva"} <span class="text-nordic-bronze italic">Pieza</span></h2></header>
        <div class="bg-nordic-gray p-8 rounded-[2.5rem] border border-white/5 space-y-6 shadow-xl">
          <input oninput="window.updateCalc('name', this.value)" placeholder="Nombre del diseño" class="w-full bg-black/40 border border-white/10 p-5 rounded-2xl text-white font-bold outline-none focus:border-nordic-bronze" value="${p.name}" />
          <div class="grid grid-cols-2 gap-6">
            <div><label class="text-[9px] font-black uppercase text-slate-500 ml-4 mb-2 block">Horas Impresión</label><input type="number" oninput="window.updateCalc('printingHours', this.value)" class="w-full bg-black/40 border border-white/10 p-5 rounded-2xl text-white font-bold outline-none" value="${p.printingHours}" /></div>
            <div><label class="text-[9px] font-black uppercase text-slate-500 ml-4 mb-2 block">Post-Procesado ($)</label><input type="number" oninput="window.updateCalc('postProcessingCost', this.value)" class="w-full bg-black/40 border border-white/10 p-5 rounded-2xl text-white font-bold outline-none" value="${p.postProcessingCost}" /></div>
          </div>
          
          <div class="space-y-4">
            <div class="flex justify-between items-center ml-4"><label class="text-[9px] font-black uppercase text-slate-500">Materiales Utilizados</label><button onclick="window.addFilamentRow()" class="text-nordic-bronze text-[10px] font-black uppercase">+ Agregar Otro</button></div>
            ${p.filaments
              .map(
                (pf, idx) => `
              <div class="flex gap-2 group">
                <select onchange="window.updateFilamentRow(${idx}, 'filamentId', this.value)" class="flex-1 bg-black/40 border border-white/10 p-5 rounded-2xl text-white outline-none focus:border-nordic-bronze">
                  <option value="">Seleccionar Filamento...</option>
                  ${state.filaments.map((f) => `<option value="${f.id}" ${pf.filamentId === f.id ? "selected" : ""}>${f.name} (${Math.round(f.remaining_weight)}g)</option>`).join("")}
                </select>
                <input type="number" oninput="window.updateFilamentRow(${idx}, 'gramsUsed', this.value)" placeholder="Grs" class="w-24 bg-black/40 border border-white/10 p-5 rounded-2xl text-white font-bold outline-none" value="${pf.gramsUsed}" />
                ${idx > 0 ? `<button onclick="window.removeFilamentRow(${idx})" class="text-rose-500 opacity-50 hover:opacity-100 p-2"><i data-lucide="x" size="20"></i></button>` : ""}
              </div>
            `,
              )
              .join("")}
          </div>

          <div class="grid grid-cols-2 gap-6">
            <div><label class="text-[9px] font-black uppercase text-slate-500 ml-4 mb-2 block">Margen Ganancia (%)</label><input type="number" oninput="window.updateCalc('profitMargin', this.value)" class="w-full bg-black/40 border border-white/10 p-5 rounded-2xl text-white font-bold outline-none" value="${p.profitMargin}" /></div>
            <div><label class="text-[9px] font-black uppercase text-slate-500 ml-4 mb-2 block">Multiplicador Dificultad</label><input type="number" step="0.1" oninput="window.updateCalc('complexityMultiplier', this.value)" class="w-full bg-black/40 border border-white/10 p-5 rounded-2xl text-white font-bold outline-none" value="${p.complexityMultiplier}" /></div>
          </div>
        </div>
      </div>
      <div class="lg:sticky lg:top-8 h-fit">
        <div class="bg-nordic-gray p-10 rounded-[3.5rem] border-2 border-nordic-bronze/40 shadow-2xl bronze-glow space-y-8">
          <div><p class="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2">Precio de Venta Sugerido</p><h2 class="text-7xl font-black text-nordic-bronze tracking-tighter font-mono">${state.config.currency}${formatAR(costs.roundedPrice, 0)}</h2></div>
          <div class="space-y-3 bg-black/40 p-5 rounded-2xl border border-white/5 shadow-inner">
             <div class="flex justify-between text-[10px] font-bold"><span>Costo Filamentos</span><span>${state.config.currency}${formatAR(costs.totalFilamentCost)}</span></div>
             <div class="flex justify-between text-[10px] font-bold"><span>Costo Eléctrico</span><span>${state.config.currency}${formatAR(costs.energyCost)}</span></div>
             <div class="flex justify-between text-[10px] font-bold"><span>Mano de Obra</span><span>${state.config.currency}${formatAR(costs.laborCost)}</span></div>
             <div class="h-px bg-white/5"></div>
             <div class="flex justify-between text-[10px] font-black text-emerald-500"><span>Ganancia Líquida</span><span>${state.config.currency}${formatAR(costs.profitAmount)}</span></div>
          </div>
          <button onclick="window.saveProject()" class="w-full bg-nordic-bronze text-nordic-black py-6 rounded-3xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:scale-[1.02] transition-all">Guardar en Catálogo</button>
        </div>
      </div>
    </div>
  `;
};

// --- LOGICA DE ACTUALIZACION ---
window.updateCalc = (field, val) => {
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
  if (!p.name) return alert("El nombre es obligatorio.");

  const dbData = {
    name: p.name,
    printing_hours: Number(p.printingHours) || 0,
    post_processing_cost: Number(p.postProcessingCost) || 0,
    complexity_multiplier: Number(p.complexityMultiplier) || 1,
    profit_margin: Number(p.profitMargin) || state.config.defaultProfitMargin,
    filaments: p.filaments.filter((f) => f.filamentId && f.gramsUsed > 0),
    status: p.status || "catalog",
    created_at: Date.now(),
  };

  const { error } = p.id
    ? await supabase.from("projects").update(dbData).eq("id", p.id)
    : await supabase.from("projects").insert([dbData]);
  if (!error) {
    state.editingProject = null;
    state.activeTab = "catalog";
    loadAllData();
  } else {
    alert("Error: " + error.message);
  }
};

window.deliverProject = async (id) => {
  const p = state.projects.find((x) => x.id === id);
  if (!p) return;

  // 1. Descontar stock de cada filamento usado
  const updates = p.filaments.map(async (pf) => {
    const f = state.filaments.find((fill) => fill.id === pf.filamentId);
    if (f) {
      const newWeight = f.remaining_weight - pf.gramsUsed;
      return supabase
        .from("filaments")
        .update({ remaining_weight: Math.max(0, newWeight) })
        .eq("id", f.id);
    }
  });

  await Promise.all(updates);

  // 2. Marcar proyecto como entregado
  await supabase.from("projects").update({ status: "delivered" }).eq("id", id);

  loadAllData();
};

// --- SISTEMA DE PAPELERA (REUTILIZANDO LOGICA HIBRIDA PARA GITHUB PAGES) ---
const safeDelete = async (type, name, data, table, id) => {
  const recordToSave = {
    id: "trash-" + Date.now(),
    item_type: type,
    item_name: name || "Sin nombre",
    deleted_at: new Date().toISOString(),
    original_data: JSON.stringify(data),
  };

  // Intentar guardar en Supabase, si falla, usar LocalStorage
  const { error } = await supabase
    .from("deleted_records")
    .insert([recordToSave]);
  if (error) {
    state.localDeletedRecords.push(recordToSave);
    localStorage.setItem(
      "studio3d_local_trash",
      JSON.stringify(state.localDeletedRecords),
    );
  }

  await supabase.from(table).delete().eq("id", id);
  loadAllData();
};

// --- MÁS VISTAS ---
const CatalogView = () => {
  const catalog = state.projects.filter((p) => p.status === "catalog");
  return `
    ${Header("Diseños", "Guardados", "Templates del taller")}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      ${catalog
        .map((p) => {
          const costs = calculateCosts(p);
          return `
          <div class="bg-nordic-gray rounded-[2.5rem] p-8 border border-white/5 bronze-glow group hover:border-nordic-bronze/40 transition-all flex flex-col h-full shadow-2xl">
            <div class="flex justify-between mb-4">
              <h3 class="text-xl font-black text-white tracking-tight leading-tight">${p.name}</h3>
              <div class="flex gap-2">
                <button onclick="window.editProject('${p.id}')" class="p-2 text-slate-500 hover:text-nordic-bronze"><i data-lucide="pencil" size="18"></i></button>
                <button onclick="window.deleteItem('diseño', '${p.id}')" class="p-2 text-rose-500/50 hover:text-rose-500"><i data-lucide="trash-2" size="18"></i></button>
              </div>
            </div>
            <p class="text-3xl font-black text-nordic-bronze mb-6 tracking-tighter font-mono">${state.config.currency}${formatAR(costs.roundedPrice, 0)}</p>
            <button onclick="window.initSell('${p.id}')" class="w-full bg-white/5 text-slate-200 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-nordic-bronze/10 hover:bg-nordic-bronze hover:text-nordic-black transition-all mt-auto">Registrar Venta</button>
          </div>
        `;
        })
        .join("")}
    </div>
  `;
};

const OrdersView = () => {
  const orders = state.projects.filter((p) => p.status === "pending");
  return `
    ${Header("Órdenes", "Activas", "Trabajos en proceso")}
    <div class="space-y-6">
      ${orders
        .map((p) => {
          const client = state.clients.find((c) => c.id === p.client_id);
          const costs = calculateCosts(p);
          return `
          <div class="bg-nordic-gray p-8 rounded-[2.5rem] border border-white/5 flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl bronze-glow animate-fade">
            <div class="flex items-center gap-6">
              <div class="p-5 rounded-2xl bg-nordic-black text-nordic-bronze shadow-inner"><i data-lucide="package" size="28"></i></div>
              <div><p class="text-[10px] font-black text-slate-500 uppercase tracking-widest">${client?.name || "Venta Minorista"}</p><h3 class="text-2xl font-black text-white leading-none">${p.name}</h3></div>
            </div>
            <div class="flex items-center gap-8">
              <div class="text-right font-mono text-3xl font-black text-nordic-bronze">${state.config.currency}${formatAR(p.manual_price || costs.roundedPrice, 0)}</div>
              <div class="flex items-center gap-3">
                <button onclick="window.deliverProject('${p.id}')" class="bg-nordic-bronze text-nordic-black px-8 py-3 rounded-xl font-black text-[11px] uppercase shadow-lg hover:scale-105 transition-all">Entregar y Cobrar</button>
                <button onclick="window.deleteItem('pedido', '${p.id}')" class="text-rose-500/30 p-2 hover:text-rose-500"><i data-lucide="trash-2" size="24"></i></button>
              </div>
            </div>
          </div>
        `;
        })
        .join("")}
    </div>
  `;
};

const InventoryView = () => `
  ${Header("Materiales", "Disponibles", "Stock de filamentos")}
  <div class="flex justify-end mb-8"><button onclick="window.showInsumoModal()" class="bg-nordic-bronze text-nordic-black px-8 py-4 rounded-2xl font-black text-xs uppercase flex items-center gap-2 shadow-lg"><i data-lucide="plus" size="18"></i> Nuevo Filamento</button></div>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    ${state.filaments
      .map(
        (f) => `
      <div class="bg-nordic-gray p-8 rounded-[2.5rem] border border-white/5 relative group hover:border-nordic-bronze/40 transition-all shadow-xl overflow-hidden">
        <div class="absolute top-6 right-6 flex gap-2">
          <button onclick="window.editInsumo('${f.id}')" class="text-slate-500 hover:text-nordic-bronze"><i data-lucide="pencil" size="16"></i></button>
          <button onclick="window.deleteItem('filamento', '${f.id}')" class="text-rose-500/50 hover:text-rose-500"><i data-lucide="trash-2" size="16"></i></button>
        </div>
        <div class="flex items-center gap-4 mb-6">
          <div class="bg-nordic-black p-4 rounded-2xl text-nordic-bronze shadow-inner"><i data-lucide="droplets" size="24"></i></div>
          <div><h4 class="font-black text-white">${f.name}</h4><p class="text-[10px] text-slate-500 uppercase font-black">${f.brand} • ${f.material}</p></div>
        </div>
        <div class="space-y-4">
          <div class="flex justify-between text-[10px] font-black text-slate-500 uppercase"><span>Stock: ${Math.round(f.remaining_weight)}g</span><span>Capacidad: ${f.weight_grams}g</span></div>
          <div class="h-1.5 bg-black rounded-full overflow-hidden"><div class="h-full bg-nordic-bronze" style="width: ${(f.remaining_weight / f.weight_grams) * 100}%"></div></div>
          <p class="text-2xl font-black text-nordic-bronze text-right font-mono">${state.config.currency}${formatAR(f.price, 0)}</p>
        </div>
      </div>
    `,
      )
      .join("")}
  </div>
`;

// --- ACCIONES UI ---
window.setTab = (tab) => {
  if (tab === "calculator" && !state.editingProject) {
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

window.finishSell = async (clientId) => {
  const p = state.modals.selectClient.project;
  const { id, ...rest } = p; // Clonar sin el ID original para crear una instancia nueva
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

window.deleteItem = (type, id) => {
  const msg = `¿Seguro que deseas eliminar este ${type}? Se moverá a la papelera.`;
  if (confirm(msg)) {
    let table = "";
    let item = null;
    if (type === "diseño" || type === "pedido") {
      table = "projects";
      item = state.projects.find((x) => x.id === id);
    }
    if (type === "filamento") {
      table = "filaments";
      item = state.filaments.find((x) => x.id === id);
    }
    if (table && item) safeDelete(type, item.name, item, table, id);
  }
};

window.logout = async () => {
  await supabase.auth.signOut();
  state.session = null;
  renderApp();
};

// --- MODALES ---
const renderModals = () => `
  ${
    state.modals.selectClient.show
      ? `
    <div class="fixed inset-0 bg-black/95 backdrop-blur-md z-[200] flex items-center justify-center p-6 animate-fade">
      <div class="bg-nordic-gray rounded-[2.5rem] w-full max-w-xl p-12 border border-nordic-bronze/30 shadow-2xl bronze-glow">
        <div class="flex justify-between items-center mb-8">
          <h3 class="text-2xl font-black text-nordic-bronze uppercase tracking-tighter">Asignar Cliente</h3>
          <button onclick="state.modals.selectClient.show = false; renderApp();" class="text-slate-500 hover:text-white"><i data-lucide="x" size="24"></i></button>
        </div>
        <div class="space-y-4 mb-8 max-h-60 overflow-y-auto custom-scrollbar pr-2">
          ${state.clients.map((c) => `<button onclick="window.finishSell('${c.id}')" class="w-full p-6 rounded-2xl border transition-all text-left bg-black/20 border-white/5 text-white hover:border-nordic-bronze/50 group"><span class="font-bold uppercase text-xs tracking-widest group-hover:text-nordic-bronze">${c.name}</span></button>`).join("")}
          <button onclick="window.setTab('clients')" class="w-full p-6 rounded-2xl border border-dashed border-white/10 text-slate-500 text-center font-black uppercase text-[10px] tracking-widest hover:border-nordic-bronze">+ Crear Cliente Nuevo</button>
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
        <h3 class="text-2xl font-black text-nordic-bronze mb-8 uppercase tracking-tighter">Gestionar Material</h3>
        <div class="space-y-6">
          <input id="ins-name" placeholder="Nombre / Color" class="w-full bg-black/40 p-5 rounded-2xl text-white outline-none border border-white/10 focus:border-nordic-bronze" value="${state.modals.insumo.editingFilament?.name || ""}" />
          <input id="ins-brand" placeholder="Marca" class="w-full bg-black/40 p-5 rounded-2xl text-white outline-none border border-white/10" value="${state.modals.insumo.editingFilament?.brand || ""}" />
          <div class="grid grid-cols-2 gap-4">
            <input id="ins-weight" type="number" placeholder="Peso Total (g)" class="w-full bg-black/40 p-5 rounded-2xl text-white border border-white/10" value="${state.modals.insumo.editingFilament?.weight_grams || 1000}" />
            <input id="ins-price" type="number" placeholder="Costo ($)" class="w-full bg-black/40 p-5 rounded-2xl text-white border border-white/10" value="${state.modals.insumo.editingFilament?.price || ""}" />
          </div>
          <button onclick="window.confirmInsumo()" class="w-full bg-nordic-bronze text-nordic-black py-5 rounded-2xl font-black uppercase shadow-xl">Guardar Cambios</button>
          <button onclick="state.modals.insumo.show = false; renderApp();" class="w-full text-slate-500 font-bold uppercase text-[10px]">Cancelar</button>
        </div>
      </div>
    </div>
  `
      : ""
  }
`;

window.showInsumoModal = () => {
  state.modals.insumo.editingFilament = null;
  state.modals.insumo.show = true;
  renderApp();
};
window.editInsumo = (id) => {
  state.modals.insumo.editingFilament = state.filaments.find(
    (f) => f.id === id,
  );
  state.modals.insumo.show = true;
  renderApp();
};
window.confirmInsumo = async () => {
  const name = document.getElementById("ins-name").value;
  const brand = document.getElementById("ins-brand").value;
  const weight = Number(document.getElementById("ins-weight").value);
  const price = Number(document.getElementById("ins-price").value);

  const dbData = { name, brand, weight_grams: weight, price };
  if (!state.modals.insumo.editingFilament) dbData.remaining_weight = weight;

  const { error } = state.modals.insumo.editingFilament
    ? await supabase
        .from("filaments")
        .update(dbData)
        .eq("id", state.modals.insumo.editingFilament.id)
    : await supabase.from("filaments").insert([dbData]);
  if (!error) {
    state.modals.insumo.show = false;
    loadAllData();
  } else alert(error.message);
};

// --- RENDER MOTOR ---
const renderApp = () => {
  const root = document.getElementById("root");
  if (!state.session) {
    root.innerHTML = `<div class="min-h-screen bg-nordic-black flex items-center justify-center p-6"><div class="w-full max-w-md bg-nordic-gray rounded-[3rem] p-12 border border-white/5 shadow-2xl bronze-glow animate-fade"><div class="text-center mb-12"><div class="bg-nordic-bronze w-20 h-20 rounded-[1.5rem] flex items-center justify-center text-nordic-black mx-auto mb-8 shadow-xl"><i data-lucide="box" size="40"></i></div><h2 class="text-3xl font-black text-white tracking-tighter uppercase leading-none">STUDIO<span class="text-nordic-bronze">3D</span></h2></div><form id="auth-form" class="space-y-6"><input required type="email" id="email" placeholder="Usuario" class="w-full bg-black/40 border border-white/10 rounded-2xl px-8 py-5 text-white font-bold outline-none focus:border-nordic-bronze transition-all" /><input required type="password" id="pass" placeholder="Clave" class="w-full bg-black/40 border border-white/10 rounded-2xl px-8 py-5 text-white font-bold outline-none focus:border-nordic-bronze transition-all" /><button type="submit" class="w-full bg-nordic-bronze text-nordic-black py-6 rounded-[1.5rem] font-black uppercase tracking-widest shadow-lg hover:bg-nordic-bronzeLight transition-all">Acceder</button></form></div></div>`;
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
        } else alert("Acceso Denegado");
      });
    createIcons({ icons: { Box } });
    return;
  }

  if (state.loading) {
    root.innerHTML = `<div class="min-h-screen bg-nordic-black flex flex-col items-center justify-center gap-6"><div class="loading-spinner"></div><p class="font-black text-nordic-bronze uppercase tracking-[0.3em] text-xs animate-pulse">Sincronizando Taller...</p></div>`;
    return;
  }

  root.innerHTML = `
    <div class="min-h-screen flex flex-col md:flex-row bg-nordic-black text-slate-300 font-sans">
      ${Sidebar()}
      <main class="flex-1 p-6 md:p-12 overflow-y-auto bg-nordic-black"><div class="max-w-6xl mx-auto">${renderTab()}</div></main>
      ${renderModals()}
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

const renderTab = () => {
  switch (state.activeTab) {
    case "dashboard":
      return DashboardView();
    case "inventory":
      return InventoryView();
    case "catalog":
      return CatalogView();
    case "calculator":
      return CalculatorView();
    case "orders":
      return OrdersView();
    default:
      return DashboardView();
  }
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
