/* =========================================
   1. CONFIGURAÇÃO E DADOS
   ========================================= */
const API_URL = (typeof ENV !== 'undefined') ? ENV.SUPABASE_URL : "";
const API_KEY = (typeof ENV !== 'undefined') ? ENV.SUPABASE_KEY : "";

const CONFIG = {
    SUPABASE_URL: API_URL,
    SUPABASE_KEY: API_KEY,
    TABLES: {
        USUARIOS: "usuarios",
        FUNCIONARIOS: "funcionarios",
        FORNECEDORES: "fornecedores",
        PRODUTOS: "produtos",
        FINANCEIRO: "financeiro", // Contas a pagar/receber
        CAIXA: "caixa",           // Movimento diário
        NOTAS: "notas_entrada",
        APONTAMENTOS: "apontamentos"
    }
};

const STATE = { user: null, route: "dashboard" };

/* =========================================
   2. BANCO DE DADOS (LOCAL + ONLINE)
   ========================================= */
const DB = {
    isOnline() { return !!(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_KEY && window.supabase); },
    getClient() { return window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY); },
    
    // --- LOCAL STORAGE CORE ---
    getDB() {
        const s = localStorage.getItem("triboom_full_v1");
        if(s) return JSON.parse(s);
        const init = { 
            usuarios:[{id:"1", nome:"Admin", login:"admin", senha:"admin", perfil:"Admin", ativo:true}], 
            funcionarios:[], fornecedores:[], produtos:[], financeiro:[], caixa:[], notas:[], apontamentos:[] 
        };
        localStorage.setItem("triboom_full_v1", JSON.stringify(init));
        return init;
    },
    saveDB(data) { localStorage.setItem("triboom_full_v1", JSON.stringify(data)); },
    genId() { return Math.random().toString(36).substr(2, 9); },

    // --- CRUD GENÉRICO (Funciona para tudo) ---
    async list(table) {
        if(this.isOnline()) {
            const {data} = await this.getClient().from(table).select("*");
            return data || [];
        }
        return this.getDB()[table] || [];
    },
    async save(table, item) {
        if(this.isOnline()) {
            const pl = {...item}; if(!pl.id) delete pl.id;
            const {error} = await this.getClient().from(table).upsert(pl);
            if(error) throw error; return;
        }
        const db = this.getDB();
        db[table] = db[table] || [];
        if(item.id) {
            const idx = db[table].findIndex(x => x.id === item.id);
            if(idx >= 0) db[table][idx] = item;
        } else {
            item.id = this.genId();
            if(table==='caixa' || table==='financeiro') item.created_at = new Date().toISOString();
            db[table].push(item);
        }
        this.saveDB(db);
    },
    async delete(table, id) {
        if(this.isOnline()) {
            await this.getClient().from(table).delete().eq("id", id); return;
        }
        const db = this.getDB();
        db[table] = db[table].filter(x => x.id !== id);
        this.saveDB(db);
    },
    
    // --- LOGIN ---
    async login(login, senha) {
        // Tenta local primeiro para admin padrão
        const db = this.getDB();
        const localUser = db.usuarios.find(u => u.login === login && u.senha === senha);
        if(localUser) return localUser;

        if(this.isOnline()) {
            const {data} = await this.getClient().from("usuarios").select("*").eq("login",login).maybeSingle();
            if(data && data.senha === senha) return data;
        }
        throw new Error("Login inválido.");
    }
};

/* =========================================
   3. INTERFACE (VIEW)
   ========================================= */
const $ = (id) => document.getElementById(id);
const show = (id) => { const el=$(id); if(el) el.style.display='block'; };
const hideAll = () => document.querySelectorAll(".view-section").forEach(e => e.style.display='none');
const moeda = (v) => parseFloat(v||0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
const dataBR = (d) => new Date(d).toLocaleDateString('pt-BR');

// --- NAVEGAÇÃO ---
function navegar(rota) {
    STATE.route = rota;
    $("titulo-secao").textContent = rota.toUpperCase();
    hideAll();
    const view = $("view-"+rota);
    if(view) view.style.display = "block";
    
    // Carrega dados da tela
    if(rota === "dashboard") carregarDashboard();
    if(rota === "produtos") renderTable("produtos", ["codigo","nome","grupo","qtd","preco"]);
    if(rota === "financeiro") renderFinanceiro();
    if(rota === "caixa") renderCaixa();
    if(rota === "notas") renderTable("notas", ["numero","fornecedor","data","valor"]);
    if(rota === "funcionarios") renderTable("funcionarios", ["nome","cpf","funcao"]);
    if(rota === "fornecedores") renderTable("fornecedores", ["nome","contato","telefone"]);
    if(rota === "usuarios") renderTable("usuarios", ["nome","login","perfil"]);
    if(rota === "apontamento") carregarPonto();
}

// --- RENDERIZADORES ---
async function renderTable(tabela, colunas) {
    const lista = await DB.list(CONFIG.TABLES[tabela.toUpperCase()] || tabela);
    const tbody = $("lista-"+tabela);
    if(!tbody) return; // Algumas tabelas tem IDs diferentes, tratamos abaixo
    tbody.innerHTML = "";
    
    lista.forEach(item => {
        let tds = colunas.map(k => `<td>${item[k]||'-'}</td>`).join("");
        tbody.innerHTML += `<tr>${tds}<td><button onclick="excluirItem('${tabela}','${item.id}')" style="background:red; color:white; border:none; padding:5px;">X</button></td></tr>`;
    });
}

async function renderFinanceiro() {
    const lista = await DB.list(CONFIG.TABLES.FINANCEIRO);
    const tbody = $("lista-financeiro");
    tbody.innerHTML = "";
    lista.forEach(f => {
        const cor = f.tipo === 'receita' ? 'green' : 'red';
        tbody.innerHTML += `
            <tr>
                <td>${dataBR(f.data)}</td>
                <td>${f.descricao}</td>
                <td style="color:${cor}">${f.tipo.toUpperCase()}</td>
                <td>${moeda(f.valor)}</td>
                <td><button onclick="excluirItem('financeiro','${f.id}')">X</button></td>
            </tr>`;
    });
}

async function renderCaixa() {
    const lista = await DB.list(CONFIG.TABLES.CAIXA);
    const tbody = $("lista-caixa");
    tbody.innerHTML = "";
    let saldo = 0;
    lista.forEach(c => {
        const val = parseFloat(c.valor);
        if(c.tipo==='entrada') saldo+=val; else saldo-=val;
        tbody.innerHTML += `<tr><td>${new Date(c.created_at).toLocaleTimeString()}</td><td>${c.descricao}</td><td>${moeda(val)}</td><td>${c.tipo}</td></tr>`;
    });
    $("caixa-valor-topo").textContent = moeda(saldo);
    $("dash-caixa-saldo").textContent = moeda(saldo);
}

async function carregarDashboard() {
    const prods = await DB.list(CONFIG.TABLES.PRODUTOS);
    const funcs = await DB.list(CONFIG.TABLES.FUNCIONARIOS);
    $("dash-estoque-qtd").textContent = prods.length;
    $("dash-total-funcs").textContent = funcs.length;
    renderCaixa(); // Atualiza saldo
}

// --- PONTO ---
async function carregarPonto() {
    const funcs = await DB.list(CONFIG.TABLES.FUNCIONARIOS);
    const sel = $("apontamento-funcionario");
    sel.innerHTML = "";
    funcs.forEach(f => sel.innerHTML += `<option value="${f.id}">${f.nome}</option>`);
    
    sel.onchange = carregarStatusPonto;
    carregarStatusPonto();
}

async function carregarStatusPonto() {
    const fid = $("apontamento-funcionario").value;
    if(!fid) return;
    const data = new Date().toLocaleDateString('pt-BR').split('/').reverse().join('-'); // YYYY-MM-DD
    $("apontamento-data").textContent = dataBR(data);
    
    ["entrada","int-ini","int-fim","saida"].forEach(k => $("hora-"+k).textContent = "-");
    
    // Busca apontamento (simplificado)
    const lista = await DB.list(CONFIG.TABLES.APONTAMENTOS);
    const ap = lista.find(a => a.funcionario_id === fid && a.data === data);
    
    if(ap) {
        $("apontamento-status").textContent = "Registro encontrado";
        if(ap.entrada) $("hora-entrada").textContent = ap.entrada;
        if(ap.int_ini) $("hora-int-ini").textContent = ap.int_ini;
        if(ap.int_fim) $("hora-int-fim").textContent = ap.int_fim;
        if(ap.saida) $("hora-saida").textContent = ap.saida;
    } else {
        $("apontamento-status").textContent = "Nenhum registro hoje";
    }
}

async function baterPonto(campo) {
    const fid = $("apontamento-funcionario").value;
    if(!fid) return alert("Selecione funcionário");
    const data = new Date().toLocaleDateString('pt-BR').split('/').reverse().join('-');
    const hora = new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
    
    // Lógica simples: busca, atualiza ou cria
    const lista = await DB.list(CONFIG.TABLES.APONTAMENTOS);
    let ap = lista.find(a => a.funcionario_id === fid && a.data === data);
    
    if(ap && ap[campo]) return alert("Já marcado!");
    
    if(!ap) { ap = {funcionario_id: fid, data: data}; }
    ap[campo] = hora; // ex: ap.entrada = "08:00"
    
    // Mapeamento nomes campos
    const map = { "btnApEntrada":"entrada", "btnApIntIni":"int_ini", "btnApIntFim":"int_fim", "btnApSaida":"saida" };
    
    await DB.save(CONFIG.TABLES.APONTAMENTOS, ap);
    carregarStatusPonto();
    alert("Ponto registrado: " + hora);
}

// --- MODAIS DINÂMICOS ---
function abrirModal(tipo) {
    const modal = $("modal-generico");
    const titulo = $("modal-titulo");
    const content = $("modal-form-content");
    const btn = $("btnModalSalvar");
    
    modal.style.display = "block";
    content.innerHTML = "";
    
    // Construtor de formulário
    const addInput = (id, label, type="text") => {
        content.innerHTML += `<label>${label}</label><input id="mod-${id}" type="${type}" style="width:100%; padding:8px; margin-bottom:10px;">`;
    };

    if(tipo === "produto") {
        titulo.textContent = "Novo Produto";
        addInput("codigo","Código"); addInput("nome","Nome"); addInput("grupo","Grupo"); addInput("qtd","Quantidade","number"); addInput("preco","Preço Venda","number");
        btn.onclick = async () => {
            await DB.save(CONFIG.TABLES.PRODUTOS, {
                codigo: $("mod-codigo").value, nome: $("mod-nome").value, grupo: $("mod-grupo").value,
                qtd: Number($("mod-qtd").value), preco: Number($("mod-preco").value)
            });
            modal.style.display="none"; navegar("produtos");
        };
    }
    else if(tipo === "fornecedor") {
        titulo.textContent = "Novo Fornecedor";
        addInput("nome","Razão Social"); addInput("contato","Nome Contato"); addInput("telefone","Telefone");
        btn.onclick = async () => {
            await DB.save(CONFIG.TABLES.FORNECEDORES, { nome: $("mod-nome").value, contato: $("mod-contato").value, telefone: $("mod-telefone").value });
            modal.style.display="none"; navegar("fornecedores");
        };
    }
    else if(tipo === "despesa" || tipo === "receita") {
        titulo.textContent = tipo === "despesa" ? "Nova Despesa" : "Nova Receita";
        addInput("desc","Descrição"); addInput("valor","Valor (R$)","number"); addInput("data","Data","date");
        btn.onclick = async () => {
            await DB.save(CONFIG.TABLES.FINANCEIRO, { 
                descricao: $("mod-desc").value, valor: Number($("mod-valor").value), 
                data: $("mod-data").value, tipo: tipo 
            });
            modal.style.display="none"; navegar("financeiro");
        };
    }
    // Adicione outros tipos (nota, funcionario) seguindo o padrão...
    else if(tipo === "funcionario") {
        titulo.textContent = "Novo Funcionário";
        addInput("nome","Nome"); addInput("cpf","CPF"); addInput("funcao","Função");
        btn.onclick = async () => {
            await DB.save(CONFIG.TABLES.FUNCIONARIOS, { nome: $("mod-nome").value, cpf: $("mod-cpf").value, funcao: $("mod-funcao").value });
            modal.style.display="none"; navegar("funcionarios");
        };
    }
}

// --- EVENTOS GLOBAIS ---
window.addEventListener("load", () => {
    // Login
    $("btnLogin").onclick = async () => {
        try {
            const u = await DB.login($("usuario").value, $("senha").value);
            STATE.user = u;
            $("tela-login").style.display="none"; $("tela-dashboard").style.display="flex";
            $("display-nome-usuario").textContent = u.nome;
            navegar("dashboard");
        } catch(e) { $("msg-erro").textContent = e.message; }
    };
    $(".btn-sair").onclick = () => window.location.reload();
    
    // Menu
    document.querySelectorAll(".sidebar li").forEach(li => li.onclick = () => navegar(li.dataset.target));
    
    // Botões de Ação
    $("btnNovoProduto").onclick = () => abrirModal("produto");
    $("btnNovoFornecedor").onclick = () => abrirModal("fornecedor");
    $("btnNovaDespesa").onclick = () => abrirModal("despesa");
    $("btnNovaReceita").onclick = () => abrirModal("receita");
    $("btnNovoFuncionario").onclick = () => abrirModal("funcionario");
    $("btnNovoUsuario").onclick = () => alert("Use a tela de usuários antiga ou crie lógica similar no app.js"); 

    // Ponto
    $("btnApEntrada").onclick = () => baterPonto("entrada");
    $("btnApIntIni").onclick = () => baterPonto("int_ini");
    $("btnApIntFim").onclick = () => baterPonto("int_fim");
    $("btnApSaida").onclick = () => baterPonto("saida");
    
    // Caixa Rápido
    $("btnLancarCaixa").onclick = async () => {
        const desc = $("caixa-desc").value;
        const val = $("caixa-valor").value;
        if(!desc || !val) return alert("Preencha tudo");
        await DB.save(CONFIG.TABLES.CAIXA, { descricao: desc, valor: Number(val), tipo: $("caixa-tipo").value });
        $("caixa-desc").value=""; $("caixa-valor").value=""; renderCaixa();
    };

    // Fechar Modal
    $(".close-modal").onclick = () => $("modal-generico").style.display="none";
});

// Helper Global para Excluir
window.excluirItem = async (tabela, id) => {
    if(confirm("Excluir item?")) {
        await DB.delete(CONFIG.TABLES[tabela.toUpperCase()] || tabela, id);
        // Recarrega a tela atual
        navegar(STATE.route); 
    }
};