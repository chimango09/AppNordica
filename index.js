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
  accessories: [],
  clients: [],
  projects: [],
  purchases: [],
  deletedRecords: [], // Supabase
  localDeletedRecords: JSON.parse(
    localStorage.getItem("studio3d_local_trash") || "[]",
  ),
  trashStatus: "online", // 'online', 'degraded' (local only), 'broken'
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
    insumo: { show: false, editingFilament: null, editingAccessory: null },
    client: { show: false },
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
    const results = await Promise.all([
      supabase.from("filaments").select("*").order("name"),
      supabase.from("accessories").select("*").order("name"),
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

    state.filaments = results[0].data || [];
    state.accessories = results[1].data || [];
    state.clients = results[2].data || [];
    state.projects = results[3].data || [];
    state.purchases = results[4].data || [];
    state.deletedRecords = results[6].data || [];

    // Detectar salud de la papelera
    if (results[6].error) {
      console.warn(
        "Papelera en la nube inaccesible:",
        results[6].error.message,
      );
      state.trashStatus = "degraded";
    } else {
      state.trashStatus = "online";
    }

    if (results[5].data) {
      state.config = {
        energyRateKwh: Number(results[5].data.energy_rate_kwh),
        printerPowerWatts: Number(results[5].data.printer_power_watts),
        defaultProfitMargin: Number(results[5].data.default_profit_margin),
        currency: results[5].data.currency,
      };
    }
  } catch (e) {
    console.error("Error en carga:", e);
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
      <div class="bg-nordic-bronze p-3 rounded-2xl text-nordic-black shadow-lg shadow-nordic-bronze/10">
        <i data-lucide="box" size="24"></i>
      </div>
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

const Header = (title, accent, sub) => `
  <header class="flex flex-col gap-2 mb-12 animate-fade">
    <h2 class="text-4xl font-black text-white uppercase tracking-tighter">${title} <span class="text-nordic-bronze italic">${accent}</span></h2>
    <p class="text-slate-500 text-xs font-bold uppercase tracking-widest">${sub}</p>
  </header>
`;

const DashboardView = () => {
  const delivered = state.projects.filter((p) => p.status === "delivered");
  const revenue = delivered.reduce(
    (acc, p) =>
      acc +
      (p.manual_price ||
        calculateCosts({
          printingHours: p.printing_hours,
          postProcessingCost: p.post_processing_cost,
          complexityMultiplier: p.complexity_multiplier,
          profitMargin: p.profit_margin,
          filaments: p.filaments,
        }).roundedPrice),
    0,
  );
  const investment = state.purchases.reduce((acc, p) => acc + p.amount, 0);
  const activeOrders = state.projects.filter(
    (p) => p.status === "pending" && p.client_id,
  ).length;
  return `
    ${Header("Panel", "Maestro", "Resumen económico del taller")}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
      ${StatCard("Ventas", revenue, "emerald", "trending-up", "Ingresos")}
      ${StatCard("Inversión", investment, "rose", "trending-down", "Compras")}
      <div class="p-8 rounded-[2.5rem] border flex flex-col gap-4 shadow-xl ${revenue >= investment ? "bg-emerald-950/20 border-emerald-500/30" : "bg-rose-950/20 border-rose-500/30"}">
        <div class="flex justify-between items-start"><i data-lucide="bar-chart-3" class="${revenue >= investment ? "text-emerald-500" : "text-rose-500"}"></i></div>
        <div><p class="text-[10px] font-black uppercase text-slate-500 mb-1 tracking-widest">Utilidad Real</p><p class="text-3xl font-black tracking-tighter ${revenue >= investment ? "text-emerald-400" : "text-rose-400"}">${state.config.currency}${formatAR(Math.abs(revenue - investment), 0)}</p></div>
      </div>
      <div class="bg-nordic-gray p-8 rounded-[2.5rem] border border-white/5 flex flex-col gap-4 shadow-xl">
        <div class="flex justify-between items-start"><i data-lucide="package" class="text-nordic-bronze"></i></div>
        <div><p class="text-[10px] font-black uppercase text-slate-500 mb-1 tracking-widest">Pendientes</p><p class="text-3xl font-black text-white tracking-tighter">${activeOrders}</p></div>
      </div>
    </div>
  `;
};

const StatCard = (label, val, color, icon, sub) => `
  <div class="bg-nordic-gray p-8 rounded-[2.5rem] border border-white/5 flex flex-col gap-4 shadow-xl">
    <div class="flex justify-between items-start"><i data-lucide="${icon}" class="text-${color}-500"></i><span class="text-[9px] font-black uppercase text-${color}-500 tracking-widest bg-${color}-500/10 px-3 py-1 rounded-full">${label}</span></div>
    <div><p class="text-[10px] font-black uppercase text-slate-500 mb-1 tracking-widest">${sub}</p><p class="text-3xl font-black text-white tracking-tighter font-mono">${state.config.currency}${formatAR(val, 0)}</p></div>
  </div>
`;

const CatalogView = () => {
  const catalog = state.projects.filter((p) => !p.client_id);
  return `
    ${Header("Catálogo", "de Diseños", "Modelos base listos para producir")}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      ${catalog
        .map((p) => {
          const costs = calculateCosts({
            printingHours: p.printing_hours,
            postProcessingCost: p.post_processing_cost,
            complexityMultiplier: p.complexity_multiplier,
            profitMargin: p.profit_margin,
            filaments: p.filaments,
          });
          return `
          <div class="bg-nordic-gray rounded-[2.5rem] p-8 border border-white/5 bronze-glow group hover:border-nordic-bronze/40 transition-all flex flex-col h-full shadow-2xl">
            <div class="flex justify-between mb-4">
              <h3 class="text-xl font-black text-white tracking-tight leading-tight">${p.name}</h3>
              <div class="flex gap-2">
                <button onclick="window.editProject('${p.id}')" class="p-2 text-slate-500 hover:text-nordic-bronze"><i data-lucide="pencil" size="18"></i></button>
                <button onclick="window.deleteProject('${p.id}', '${p.name}')" class="p-2 text-rose-500/50 hover:text-rose-500"><i data-lucide="trash-2" size="18"></i></button>
              </div>
            </div>
            <p class="text-3xl font-black text-nordic-bronze mb-6 tracking-tighter font-mono">${state.config.currency}${formatAR(costs.roundedPrice, 0)}</p>
            <button onclick="window.sellProject('${p.id}')" class="w-full bg-white/5 text-slate-200 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-nordic-bronze/10 hover:bg-nordic-bronze hover:text-nordic-black transition-all mt-auto">Registrar Venta</button>
          </div>
        `;
        })
        .join("")}
    </div>
  `;
};

const TrashView = () => {
  const allRecords = [
    ...state.deletedRecords.map((r) => ({ ...r, isLocal: false })),
    ...state.localDeletedRecords.map((r) => ({ ...r, isLocal: true })),
  ].sort((a, b) => new Date(b.deleted_at) - new Date(a.deleted_at));

  return `
    ${Header("Papelera", "Híbrida", "Nube + Almacenamiento Local")}
    ${state.trashStatus === "degraded" ? `<div class="bg-nordic-bronze/10 border border-nordic-bronze/20 p-6 rounded-3xl mb-8 flex gap-4 items-center animate-fade"><i data-lucide="info" class="text-nordic-bronze"></i><p class="text-nordic-bronze text-[10px] font-black uppercase tracking-widest">Modo Resiliencia Activo: Tus eliminaciones se están guardando localmente debido a un problema con el esquema de Supabase.</p></div>` : ""}
    
    ${
      allRecords.length === 0
        ? `
      <div class="bg-nordic-gray/30 border border-white/5 rounded-[2.5rem] p-20 text-center animate-fade">
        <div class="bg-nordic-gray w-20 h-20 rounded-2xl flex items-center justify-center text-slate-600 mx-auto mb-6 shadow-inner"><i data-lucide="archive" size="32"></i></div>
        <p class="text-slate-500 font-black uppercase text-xs tracking-[0.2em]">La papelera está vacía</p>
      </div>
    `
        : `
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${allRecords
          .map(
            (r) => `
          <div class="bg-nordic-gray p-8 rounded-[2.5rem] border border-white/5 relative group hover:border-nordic-bronze/40 transition-all shadow-xl">
            <div class="flex justify-between items-start mb-4">
              <div class="bg-nordic-black p-4 rounded-2xl text-slate-500 shadow-inner flex items-center gap-2">
                <i data-lucide="archive" size="18"></i>
                ${r.isLocal ? '<span class="text-[8px] font-black bg-white/5 px-2 py-1 rounded">LOCAL</span>' : '<span class="text-[8px] font-black bg-nordic-bronze/10 text-nordic-bronze px-2 py-1 rounded">NUBE</span>'}
              </div>
              <button onclick="window.restoreRecord('${r.id}', ${r.isLocal})" class="bg-nordic-bronze text-nordic-black px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-nordic-bronzeLight transition-all"><i data-lucide="rotate-ccw" size="14" class="inline mr-2"></i> Restaurar</button>
            </div>
            <h4 class="font-black text-white truncate text-lg">${r.item_name || "Sin nombre"}</h4>
            <p class="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">${r.item_type} • Eliminado: ${new Date(r.deleted_at).toLocaleDateString()}</p>
            <button onclick="window.purgeRecord('${r.id}', ${r.isLocal})" class="absolute bottom-4 right-8 text-[9px] text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity font-black uppercase">Borrar Definitivamente</button>
          </div>
        `,
          )
          .join("")}
      </div>
    `
    }
  `;
};

// --- MOTOR DE ELIMINACIÓN HÍBRIDO ---
const safeDelete = async (type, name, data, table, id) => {
  const recordToSave = {
    id: "trash-" + Date.now(),
    item_type: type,
    item_name: name || "Sin nombre",
    deleted_at: new Date().toISOString(),
    original_data: JSON.stringify(data),
  };

  let savedInTrash = false;

  // 1. Intentar Supabase si no está marcado como roto
  if (state.trashStatus !== "broken") {
    const { error: trashError } = await supabase
      .from("deleted_records")
      .insert([recordToSave]);
    if (!trashError) {
      savedInTrash = true;
    } else {
      console.warn(
        "Fallo Supabase, intentando LocalStorage...",
        trashError.message,
      );
    }
  }

  // 2. Fallback a LocalStorage si falló Supabase
  if (!savedInTrash) {
    state.localDeletedRecords.push(recordToSave);
    localStorage.setItem(
      "studio3d_local_trash",
      JSON.stringify(state.localDeletedRecords),
    );
    savedInTrash = true;
    state.trashStatus = "degraded";
  }

  // 3. Proceder al borrado físico de la tabla original solo si se aseguró en papelera
  if (savedInTrash) {
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .eq("id", id);
    if (deleteError) {
      alert(`Error al borrar original: ${deleteError.message}`);
    } else {
      loadAllData();
    }
  }
};

window.deleteProject = (id, name) =>
  window.showModal("Eliminar Diseño", `¿Borrar '${name}'?`, () => {
    const p = state.projects.find((x) => x.id === id);
    safeDelete("diseño", p.name, p, "projects", id);
  });

window.deleteInsumo = (type, id, name) =>
  window.showModal("Eliminar Material", `¿Borrar '${name}'?`, () => {
    const item = state.filaments.find((f) => f.id === id);
    safeDelete("filamento", name, item, "filaments", id);
  });

window.deletePurchase = (id, name) =>
  window.showModal("Eliminar Gasto", `¿Borrar registro de '${name}'?`, () => {
    const item = state.purchases.find((x) => x.id === id);
    safeDelete("gasto", name, item, "purchases", id);
  });

window.deleteClient = (id, name) =>
  window.showModal("Eliminar Cliente", `¿Borrar '${name}'?`, () => {
    const item = state.clients.find((x) => x.id === id);
    safeDelete("cliente", name, item, "clients", id);
  });

window.restoreRecord = async (id, isLocal) => {
  const r = isLocal
    ? state.localDeletedRecords.find((x) => x.id === id)
    : state.deletedRecords.find((x) => x.id === id);

  if (!r || !r.original_data) return alert("Datos no recuperables.");
  const data = JSON.parse(r.original_data);
  delete data.id; // Evitar conflictos

  let table = "";
  const type = r.item_type.toLowerCase();
  if (type.includes("filamento")) table = "filaments";
  else if (type.includes("diseño") || type.includes("pedido"))
    table = "projects";
  else if (type.includes("gasto")) table = "purchases";
  else if (type.includes("cliente")) table = "clients";

  if (!table) return alert("No se reconoce el tipo: " + type);

  const { error } = await supabase.from(table).insert([data]);
  if (!error) {
    if (isLocal) {
      state.localDeletedRecords = state.localDeletedRecords.filter(
        (x) => x.id !== id,
      );
      localStorage.setItem(
        "studio3d_local_trash",
        JSON.stringify(state.localDeletedRecords),
      );
    } else {
      await supabase.from("deleted_records").delete().eq("id", id);
    }
    loadAllData();
  } else {
    alert("Error al restaurar: " + error.message);
  }
};

window.purgeRecord = async (id, isLocal) => {
  if (
    !confirm(
      "¿Borrar definitivamente de la papelera? Esta acción no se puede deshacer.",
    )
  )
    return;
  if (isLocal) {
    state.localDeletedRecords = state.localDeletedRecords.filter(
      (x) => x.id !== id,
    );
    localStorage.setItem(
      "studio3d_local_trash",
      JSON.stringify(state.localDeletedRecords),
    );
    renderApp();
  } else {
    await supabase.from("deleted_records").delete().eq("id", id);
    loadAllData();
  }
};

// --- EL RESTO DE FUNCIONES SE MANTIENEN IGUAL (COMPATIBILIDAD) ---
window.updateCalc = (field, val) => {
  if (!state.editingProject)
    state.editingProject = {
      name: "",
      printingHours: 0,
      postProcessingCost: 0,
      complexityMultiplier: 1,
      profitMargin: state.config.defaultProfitMargin,
      filaments: [{ filamentId: "", gramsUsed: 0 }],
    };
  if (field === "filamentId" || field === "gramsUsed") {
    if (
      !state.editingProject.filaments ||
      state.editingProject.filaments.length === 0
    )
      state.editingProject.filaments = [{ filamentId: "", gramsUsed: 0 }];
    state.editingProject.filaments[0][field] =
      field === "gramsUsed" ? Number(val) : val;
  } else {
    state.editingProject[field] = isNaN(val) || val === "" ? val : Number(val);
  }
  const costs = calculateCosts(state.editingProject);
  const updates = {
    "total-price-display":
      state.config.currency + formatAR(costs.roundedPrice, 0),
    "breakdown-material":
      state.config.currency + formatAR(costs.totalFilamentCost),
    "breakdown-energy": state.config.currency + formatAR(costs.energyCost),
    "breakdown-labor": state.config.currency + formatAR(costs.laborCost),
    "breakdown-profit": state.config.currency + formatAR(costs.profitAmount),
  };
  for (const [id, value] of Object.entries(updates)) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
  }
};

window.saveProject = async () => {
  const p = state.editingProject;
  if (!p || !p.name) return alert("Nombre requerido.");
  const dbData = {
    name: p.name,
    printing_hours: Number(p.printingHours) || 0,
    post_processing_cost: Number(p.postProcessingCost) || 0,
    complexity_multiplier: Number(p.complexityMultiplier) || 1,
    profit_margin: Number(p.profitMargin) || state.config.defaultProfitMargin,
    filaments: p.filaments || [],
    status: p.status || "pending",
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

window.setTab = (tab) => {
  if (tab === "calculator" && !state.editingProject)
    state.editingProject = {
      name: "",
      printingHours: 0,
      postProcessingCost: 0,
      complexityMultiplier: 1,
      profitMargin: state.config.defaultProfitMargin,
      filaments: [{ filamentId: "", gramsUsed: 0 }],
    };
  state.activeTab = tab;
  renderApp();
};

window.logout = async () => {
  await supabase.auth.signOut();
  state.session = null;
  renderApp();
};

// --- MODALES ---
window.showModal = (title, message, onConfirm, type = "confirm") => {
  state.modal = { isOpen: true, title, message, type, onConfirm };
  renderApp();
};
window.closeModal = () => {
  state.modal.isOpen = false;
  renderApp();
};
window.confirmModal = () => {
  if (state.modal.onConfirm) state.modal.onConfirm();
  window.closeModal();
};

window.showPurchaseModal = () => {
  state.modals.purchase.show = true;
  state.modals.purchase.editing = null;
  renderApp();
};
window.closePurchaseModal = () => {
  state.modals.purchase.show = false;
  renderApp();
};
window.confirmPurchase = async () => {
  const dbData = {
    name: document.getElementById("pur-name").value,
    amount: Number(document.getElementById("pur-amount").value),
    date: Date.now(),
    type: "other",
  };
  const { error } = state.modals.purchase.editing
    ? await supabase
        .from("purchases")
        .update(dbData)
        .eq("id", state.modals.purchase.editing.id)
    : await supabase.from("purchases").insert([dbData]);
  if (!error) {
    window.closePurchaseModal();
    loadAllData();
  } else alert(error.message);
};

window.showInsumoModal = () => {
  state.modals.insumo.show = true;
  state.modals.insumo.editingFilament = null;
  renderApp();
};
window.closeInsumoModal = () => {
  state.modals.insumo.show = false;
  renderApp();
};
window.editInsumo = (type, id) => {
  state.modals.insumo.editingFilament = state.filaments.find(
    (f) => f.id === id,
  );
  state.modals.insumo.show = true;
  renderApp();
};
window.confirmInsumo = async () => {
  const dbData = {
    name: document.getElementById("ins-name").value,
    brand: document.getElementById("ins-brand").value,
    weight_grams: Number(document.getElementById("ins-weight").value),
    price: Number(document.getElementById("ins-price").value),
  };
  if (!state.modals.insumo.editingFilament)
    dbData.remaining_weight = dbData.weight_grams;
  const { error } = state.modals.insumo.editingFilament
    ? await supabase
        .from("filaments")
        .update(dbData)
        .eq("id", state.modals.insumo.editingFilament.id)
    : await supabase.from("filaments").insert([dbData]);
  if (!error) {
    window.closeInsumoModal();
    loadAllData();
  } else alert(error.message);
};

window.showClientModal = () => {
  state.modals.client.show = true;
  renderApp();
};
window.closeClientModal = () => {
  state.modals.client.show = false;
  renderApp();
};
window.saveClient = async () => {
  await supabase
    .from("clients")
    .insert([
      {
        name: document.getElementById("cl-name").value,
        contact: document.getElementById("cl-contact").value,
      },
    ]);
  window.closeClientModal();
  loadAllData();
};

window.sellProject = (id) => {
  state.modals.selectClient.project = state.projects.find((p) => p.id === id);
  state.modals.selectClient.show = true;
  renderApp();
};
window.closeSelectClientModal = () => {
  state.modals.selectClient.show = false;
  renderApp();
};
window.finishSell = async (clientId) => {
  const p = state.modals.selectClient.project;
  const { id, ...rest } = p;
  await supabase
    .from("projects")
    .insert([
      {
        ...rest,
        client_id: clientId,
        status: "pending",
        created_at: Date.now(),
      },
    ]);
  state.modals.selectClient.show = false;
  state.activeTab = "orders";
  loadAllData();
};

window.deliverProject = async (id) => {
  await supabase.from("projects").update({ status: "delivered" }).eq("id", id);
  loadAllData();
};

window.saveConfig = async () => {
  await supabase
    .from("config")
    .upsert({
      energy_rate_kwh: Number(document.getElementById("cfg-energy").value),
      default_profit_margin: Number(
        document.getElementById("cfg-profit").value,
      ),
      id: 1,
    });
  alert("Ajustes guardados.");
  loadAllData();
};

const InventoryView = () => `
  ${Header("Stock", "de Material", "Gestión de insumos y filamentos")}
  <section class="space-y-8">
    <div class="flex justify-between items-end border-b border-white/10 pb-6">
      <h2 class="text-3xl font-black text-white uppercase tracking-tighter">Filamentos</h2>
      <button onclick="window.showInsumoModal()" class="bg-nordic-bronze text-nordic-black px-8 py-4 rounded-2xl font-black text-xs uppercase flex items-center gap-2 shadow-lg hover:scale-105 transition-all"><i data-lucide="plus" size="18"></i> Nuevo Material</button>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      ${state.filaments
        .map(
          (f) => `
        <div class="bg-nordic-gray p-8 rounded-[2.5rem] border border-white/5 relative group hover:border-nordic-bronze/40 transition-all shadow-xl overflow-hidden">
          <div class="absolute top-6 right-6 flex gap-2">
            <button onclick="window.editInsumo('filament', '${f.id}')" class="text-slate-500 hover:text-nordic-bronze"><i data-lucide="pencil" size="16"></i></button>
            <button onclick="window.deleteInsumo('filament', '${f.id}', '${f.name}')" class="text-rose-500/50 hover:text-rose-500"><i data-lucide="trash-2" size="16"></i></button>
          </div>
          <div class="flex items-center gap-4 mb-6">
            <div class="bg-nordic-black p-4 rounded-2xl text-nordic-bronze shadow-inner"><i data-lucide="droplets" size="24"></i></div>
            <div><h4 class="font-black text-white">${f.name}</h4><p class="text-[10px] text-slate-500 uppercase font-black">${f.brand} • ${f.material}</p></div>
          </div>
          <div class="space-y-4">
            <div class="flex justify-between text-[10px] font-black text-slate-500 uppercase"><span>Stock Restante</span><span>${Math.round(f.remaining_weight)}g</span></div>
            <div class="h-1.5 bg-black rounded-full overflow-hidden"><div class="h-full bg-nordic-bronze" style="width: ${(f.remaining_weight / f.weight_grams) * 100}%"></div></div>
            <p class="text-2xl font-black text-nordic-bronze text-right font-mono">${state.config.currency}${formatAR(f.price, 0)}</p>
          </div>
        </div>
      `,
        )
        .join("")}
    </div>
  </section>
`;

const OrdersView = () => {
  const orders = state.projects.filter((p) => p.client_id);
  return `
    ${Header("Ventas", "Realizadas", "Seguimiento de pedidos por cliente")}
    <div class="space-y-6">
      ${orders
        .map((p) => {
          const client = state.clients.find((c) => c.id === p.client_id);
          const costs = calculateCosts({
            printingHours: p.printing_hours,
            postProcessingCost: p.post_processing_cost,
            complexityMultiplier: p.complexity_multiplier,
            profitMargin: p.profit_margin,
            filaments: p.filaments,
          });
          return `
          <div class="bg-nordic-gray p-8 rounded-[2.5rem] border border-white/5 flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl transition-all ${p.status === "delivered" ? "opacity-40" : "bronze-glow"}">
            <div class="flex items-center gap-6">
              <div class="p-5 rounded-2xl bg-nordic-black text-nordic-bronze shadow-inner"><i data-lucide="package" size="28"></i></div>
              <div><p class="text-[10px] font-black text-slate-500 uppercase tracking-widest">${client?.name || "Venta Minorista"}</p><h3 class="text-2xl font-black text-white leading-none">${p.name}</h3></div>
            </div>
            <div class="flex items-center gap-8">
              <div class="text-right font-mono text-3xl font-black text-nordic-bronze">${state.config.currency}${formatAR(p.manual_price || costs.roundedPrice, 0)}</div>
              <div class="flex items-center gap-3">
                <button onclick="window.editProject('${p.id}')" class="p-3 bg-white/5 rounded-xl text-slate-400 hover:text-nordic-bronze"><i data-lucide="pencil" size="20"></i></button>
                ${p.status === "pending" ? `<button onclick="window.deliverProject('${p.id}')" class="bg-nordic-bronze text-nordic-black px-8 py-3 rounded-xl font-black text-[11px] uppercase shadow-lg shadow-nordic-bronze/10">Entregar</button>` : `<div class="text-emerald-500 px-8 py-3 rounded-xl font-black text-[11px] uppercase border border-emerald-500/20 bg-emerald-500/5">Pagado</div>`}
                <button onclick="window.deleteProject('${p.id}', '${p.name}')" class="text-rose-500/30 p-2 hover:text-rose-500 transition-colors"><i data-lucide="trash-2" size="24"></i></button>
              </div>
            </div>
          </div>
        `;
        })
        .join("")}
    </div>
  `;
};

const PurchasesView = () => `
  ${Header("Historial", "de Gastos", "Inversiones y compras del taller")}
  <div class="flex justify-end mb-8">
    <button onclick="window.showPurchaseModal()" class="bg-nordic-bronze text-nordic-black px-8 py-4 rounded-2xl font-black text-xs uppercase flex items-center gap-2 shadow-lg hover:scale-105 transition-all"><i data-lucide="plus" size="18"></i> Registrar Gasto</button>
  </div>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    ${state.purchases
      .map(
        (p) => `
      <div class="bg-nordic-gray p-8 rounded-[2.5rem] border border-white/5 relative group hover:border-nordic-bronze/40 transition-all shadow-xl">
        <div class="flex justify-between items-start mb-4">
          <div class="bg-nordic-black p-4 rounded-2xl text-nordic-bronze shadow-inner"><i data-lucide="coins" size="24"></i></div>
          <div class="flex gap-2">
            <button onclick="window.editPurchase('${p.id}')" class="p-2 text-slate-500 hover:text-nordic-bronze"><i data-lucide="pencil" size="16"></i></button>
            <button onclick="window.deletePurchase('${p.id}', '${p.name}')" class="p-2 text-rose-500/50 hover:text-rose-500"><i data-lucide="trash-2" size="16"></i></button>
          </div>
        </div>
        <h4 class="font-black text-white text-xl">${p.name}</h4>
        <p class="text-[10px] text-slate-500 uppercase font-black mb-4">${p.type === "filament" ? "Insumo" : "Otros"} • ${new Date(p.date).toLocaleDateString()}</p>
        <p class="text-3xl font-black text-nordic-bronze font-mono">${state.config.currency}${formatAR(p.amount, 0)}</p>
      </div>
    `,
      )
      .join("")}
  </div>
`;

const ClientsView = () => `
  ${Header("Cartera", "de Clientes", "Base de datos de compradores")}
  <div class="flex justify-end mb-8">
    <button onclick="window.showClientModal()" class="bg-nordic-bronze text-nordic-black px-8 py-4 rounded-2xl font-black text-xs uppercase flex items-center gap-2 shadow-lg hover:scale-105 transition-all"><i data-lucide="plus" size="18"></i> Nuevo Cliente</button>
  </div>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    ${state.clients
      .map(
        (c) => `
      <div class="bg-nordic-gray p-8 rounded-[2.5rem] border border-white/5 relative group hover:border-nordic-bronze/40 transition-all shadow-xl">
        <button onclick="window.deleteClient('${c.id}', '${c.name}')" class="absolute top-6 right-6 text-rose-500/50 hover:text-rose-500 transition-colors"><i data-lucide="trash-2" size="16"></i></button>
        <div class="flex items-center gap-4 mb-4">
          <div class="bg-nordic-black p-4 rounded-2xl text-nordic-bronze shadow-inner"><i data-lucide="user" size="24"></i></div>
          <div><h4 class="font-black text-white">${c.name}</h4><p class="text-[10px] text-slate-500 uppercase font-black">${c.contact}</p></div>
        </div>
      </div>
    `,
      )
      .join("")}
  </div>
`;

const ConfigView = () => `
  ${Header("Ajustes", "Generales", "Configuración de costos base")}
  <div class="bg-nordic-gray p-10 rounded-[3rem] border border-white/5 space-y-8 shadow-2xl max-w-4xl">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div><label class="text-[10px] font-black uppercase text-slate-500 ml-4 mb-2 block">Costo Energía ($/KWh)</label><input type="number" id="cfg-energy" class="w-full bg-black/40 border border-white/10 p-5 rounded-2xl text-white font-bold outline-none" value="${state.config.energyRateKwh}" /></div>
      <div><label class="text-[10px] font-black uppercase text-slate-500 ml-4 mb-2 block">Ganancia Base (%)</label><input type="number" id="cfg-profit" class="w-full bg-black/40 border border-white/10 p-5 rounded-2xl text-white font-bold outline-none" value="${state.config.defaultProfitMargin}" /></div>
    </div>
    <button onclick="window.saveConfig()" class="w-full bg-nordic-bronze text-nordic-black py-6 rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-nordic-bronzeLight transition-all">Guardar Ajustes</button>
  </div>
`;

// --- RENDER MOTOR ---
const renderApp = () => {
  const root = document.getElementById("root");
  if (!state.session) {
    root.innerHTML = `
      <div class="min-h-screen bg-nordic-black flex items-center justify-center p-6 relative">
        <div class="w-full max-w-md bg-nordic-gray rounded-[3rem] p-12 border border-white/5 shadow-2xl bronze-glow animate-fade">
          <div class="text-center mb-12">
            <div class="bg-nordic-bronze w-20 h-20 rounded-[1.5rem] flex items-center justify-center text-nordic-black mx-auto mb-8 shadow-xl">
              <i data-lucide="box" size="40"></i>
            </div>
            <h2 class="text-3xl font-black text-white tracking-tighter uppercase leading-none">STUDIO<span class="text-nordic-bronze">3D</span></h2>
          </div>
          <form id="auth-form" class="space-y-6">
            <input required type="email" id="email" placeholder="Email de Usuario" class="w-full bg-black/40 border border-white/10 rounded-2xl px-8 py-5 text-white font-bold outline-none focus:border-nordic-bronze transition-all" />
            <input required type="password" id="pass" placeholder="Clave Maestra" class="w-full bg-black/40 border border-white/10 rounded-2xl px-8 py-5 text-white font-bold outline-none focus:border-nordic-bronze transition-all" />
            <button type="submit" class="w-full bg-nordic-bronze text-nordic-black py-6 rounded-[1.5rem] font-black uppercase tracking-widest shadow-lg hover:bg-nordic-bronzeLight transition-all">Entrar al Taller</button>
          </form>
        </div>
      </div>
    `;
    document
      .getElementById("auth-form")
      ?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("email").value;
        const password = document.getElementById("pass").value;
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (!error) {
          state.session = data.session;
          loadAllData();
        } else {
          alert(error.message);
        }
      });
    createIcons({ icons: { Box } });
    return;
  }
  if (state.loading) {
    root.innerHTML = `<div class="min-h-screen bg-nordic-black flex flex-col items-center justify-center gap-6"><div class="loading-spinner"></div><p class="font-black text-nordic-bronze uppercase tracking-[0.3em] text-xs animate-pulse">Conectando Taller...</p></div>`;
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
    case "trash":
      return TrashView();
    case "purchases":
      return PurchasesView();
    case "clients":
      return ClientsView();
    case "orders":
      return OrdersView();
    case "config":
      return ConfigView();
    default:
      return DashboardView();
  }
};

const renderModals = () => `
  ${
    state.modal.isOpen
      ? `
    <div class="fixed inset-0 bg-black/95 backdrop-blur-md z-[300] flex items-center justify-center p-6 animate-fade">
      <div class="bg-nordic-gray border border-nordic-bronze/30 p-8 rounded-[2rem] w-full max-w-md shadow-2xl bronze-glow">
        <div class="flex items-center gap-4 mb-6"><div class="p-3 rounded-xl ${state.modal.type === "confirm" ? "bg-nordic-bronze/10 text-nordic-bronze" : "bg-rose-500/10 text-rose-500"}"><i data-lucide="${state.modal.type === "confirm" ? "info" : "alert-circle"}" size="24"></i></div><h3 class="text-xl font-black text-white uppercase tracking-tight">${state.modal.title}</h3></div>
        <p class="text-slate-400 text-sm leading-relaxed mb-8">${state.modal.message}</p>
        <div class="flex gap-4"><button onclick="window.closeModal()" class="flex-1 py-4 rounded-xl font-bold uppercase text-[10px] tracking-widest text-slate-500 bg-black/20">Cancelar</button><button onclick="window.confirmModal()" class="flex-1 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest bg-nordic-bronze text-nordic-black">Confirmar</button></div>
      </div>
    </div>
  `
      : ""
  }
  ${
    state.modals.purchase.show
      ? `
    <div class="fixed inset-0 bg-black/95 backdrop-blur-md z-[200] flex items-center justify-center p-6 animate-fade">
      <div class="bg-nordic-gray rounded-[2.5rem] w-full max-w-xl p-12 border border-nordic-bronze/30 shadow-2xl bronze-glow">
        <h3 class="text-2xl font-black text-nordic-bronze mb-8 uppercase tracking-tighter">${state.modals.purchase.editing ? "Editar" : "Nuevo"} Gasto</h3>
        <div class="space-y-4 mb-8">
          <input id="pur-name" placeholder="Concepto" class="w-full bg-black/40 p-5 rounded-2xl text-white border border-white/10 outline-none" value="${state.modals.purchase.editing?.name || ""}" />
          <input id="pur-amount" type="number" placeholder="Monto ($)" class="w-full bg-black/40 p-5 rounded-2xl text-white border border-white/10 outline-none" value="${state.modals.purchase.editing?.amount || ""}" />
        </div>
        <div class="flex gap-4"><button onclick="window.closePurchaseModal()" class="flex-1 bg-black/40 text-slate-500 py-5 rounded-2xl font-black uppercase">Cancelar</button><button onclick="window.confirmPurchase()" class="flex-1 bg-nordic-bronze text-nordic-black py-5 rounded-2xl font-black uppercase">Confirmar</button></div>
      </div>
    </div>
  `
      : ""
  }
  ${
    state.modals.insumo.show
      ? `
    <div class="fixed inset-0 bg-black/95 backdrop-blur-md z-[200] flex items-center justify-center p-6 animate-fade">
      <div class="bg-nordic-gray rounded-[2.5rem] w-full max-w-md p-10 border border-nordic-bronze/30 shadow-2xl bronze-glow">
        <h3 class="text-2xl font-black text-nordic-bronze mb-8 uppercase tracking-tighter">${state.modals.insumo.editingFilament ? "Editar" : "Nuevo"} Material</h3>
        <div class="space-y-6 mb-8">
          <input id="ins-name" placeholder="Nombre / Color" class="w-full bg-black/40 p-5 rounded-2xl text-white outline-none border border-white/10 focus:border-nordic-bronze" value="${state.modals.insumo.editingFilament?.name || ""}" />
          <input id="ins-brand" placeholder="Marca" class="w-full bg-black/40 p-5 rounded-2xl text-white outline-none border border-white/10 focus:border-nordic-bronze" value="${state.modals.insumo.editingFilament?.brand || ""}" />
          <div class="grid grid-cols-2 gap-4">
            <input id="ins-weight" type="number" placeholder="Peso (g)" class="w-full bg-black/40 p-5 rounded-2xl text-white border border-white/10" value="${state.modals.insumo.editingFilament?.weight_grams || 1000}" />
            <input id="ins-price" type="number" placeholder="Precio ($)" class="w-full bg-black/40 p-5 rounded-2xl text-white border border-white/10" value="${state.modals.insumo.editingFilament?.price || ""}" />
          </div>
          <button onclick="window.confirmInsumo()" class="w-full bg-nordic-bronze text-nordic-black py-5 rounded-2xl font-black uppercase shadow-xl">Guardar Material</button>
        </div>
        <button onclick="window.closeInsumoModal()" class="w-full bg-black/20 text-slate-500 py-5 rounded-2xl font-black uppercase mt-2">Cancelar</button>
      </div>
    </div>
  `
      : ""
  }
  ${
    state.modals.client.show
      ? `
    <div class="fixed inset-0 bg-black/95 backdrop-blur-sm z-[200] flex items-center justify-center p-6 animate-fade">
      <div class="bg-nordic-gray rounded-[2.5rem] w-full max-w-xl p-12 border border-nordic-bronze/30 shadow-2xl bronze-glow">
        <h3 class="text-2xl font-black text-nordic-bronze mb-8 uppercase tracking-tighter">Registrar Cliente</h3>
        <input id="cl-name" placeholder="Nombre" class="w-full bg-black/40 p-5 rounded-2xl text-white border border-white/10 mb-4 outline-none focus:border-nordic-bronze" />
        <input id="cl-contact" placeholder="Contacto (WhatsApp)" class="w-full bg-black/40 p-5 rounded-2xl text-white border border-white/10 mb-8 outline-none focus:border-nordic-bronze" />
        <div class="flex gap-4"><button onclick="window.closeClientModal()" class="flex-1 bg-black/40 text-slate-500 py-5 rounded-2xl font-black uppercase">Cancelar</button><button onclick="window.saveClient()" class="flex-1 bg-nordic-bronze text-nordic-black py-5 rounded-2xl font-black uppercase">Guardar</button></div>
      </div>
    </div>
  `
      : ""
  }
  ${
    state.modals.selectClient.show
      ? `
    <div class="fixed inset-0 bg-black/95 backdrop-blur-md z-[200] flex items-center justify-center p-6 animate-fade">
      <div class="bg-nordic-gray rounded-[2.5rem] w-full max-w-xl p-12 border border-nordic-bronze/30 shadow-2xl bronze-glow">
        <h3 class="text-2xl font-black text-nordic-bronze mb-8 uppercase tracking-tighter">Asignar Venta</h3>
        <div class="space-y-4 mb-8 max-h-60 overflow-y-auto custom-scrollbar pr-2">
          ${state.clients.map((c) => `<button onclick="window.finishSell('${c.id}')" class="w-full p-6 rounded-2xl border transition-all text-left bg-black/20 border-white/5 text-white hover:border-nordic-bronze/50 group"><span class="font-bold uppercase text-xs tracking-widest group-hover:text-nordic-bronze">${c.name}</span></button>`).join("")}
        </div>
        <button onclick="window.closeSelectClientModal()" class="w-full bg-black/20 text-slate-500 py-5 rounded-2xl font-black uppercase">Cancelar</button>
      </div>
    </div>
  `
      : ""
  }
`;

// --- INIT ---
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
