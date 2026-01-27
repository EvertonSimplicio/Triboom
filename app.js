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
        FINANCEIRO: "financeiro",
        CAIXA: "caixa",
        NOTAS: "notas_entrada",
        APONTAMENTOS: "apontamentos"
    }
};

const STATE = { user: null, route: "dashboard" };

/* =========================================
   2. BANCO DE DADOS (CORRIGIDO: SINGLETON)
   ========================================= */
const DB = {
    _client: null, // Guarda a conexão para não criar várias

    isOnline() { return !!(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_KEY && window.supabase); },
    
    getClient() { 
        // Se já existe conexão, usa ela. Se não, cria uma nova.
        if (!this._client) {
            this._client = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
        }
        return this._client;
    },
    
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

    // --- CRUD GENÉRICO ---
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
            if(!item.created_at && (table==='caixa' || table==='financeiro')) {
                item.created_at = new Date().toISOString();
            }
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
const dataBR = (d) => {
    if(!d) return '--/--/----';
    if(d.includes('T')) d = d.split('T')[0];
    const parts = d.split('-'); 
    return (parts.length === 3) ? parts.reverse().join('/') : d;
};

// --- NAVEGAÇÃO ---
function navegar(rota) {
    STATE.route = rota;
    const tit = $("titulo-secao");
    if(tit) tit.textContent = rota.toUpperCase();
    hideAll();
    const view = $("view-"+rota);
    if(view) view.style.display = "block";
    
    document.querySelectorAll(".sidebar li").forEach(li => li.classList.remove("ativo"));
    const activeLi = document.querySelector(`.sidebar li[data-target="${rota}"]`);
    if(activeLi) activeLi.classList.add("ativo");

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
    if(!tbody) return;
    tbody.innerHTML = "";
    
    lista.forEach(item => {
        let tds = colunas.map(k => `<td>${item[k]||'-'}</td>`).join("");
        tbody.innerHTML += `<tr>${tds}<td><button onclick="excluirItem('${tabela}','${item.id}')" style="background:#e74c3c; color:white; border:none; padding:5px; border-radius:4px; cursor:pointer;">X</button></td></tr>`;
    });
}

async function renderFinanceiro() {
    const lista = await DB.list(CONFIG.TABLES.FINANCEIRO);
    const tbody = $("lista-financeiro");
    if(!tbody) return;
    tbody.innerHTML = "";
    lista.forEach(f => {
        const cor = f.tipo === 'receita' ? '#27ae60' : '#c0392b';
        tbody.innerHTML += `
            <tr>
                <td>${dataBR(f.data)}</td>
                <td>${f.descricao}</td>
                <td style="color:${cor}; font-weight:bold;">${f.tipo.toUpperCase()}</td>
                <td>${moeda(f.valor)}</td>
                <td><button onclick="excluirItem('financeiro','${f.id}')" style="background:#e74c3c; color:white; border:none; padding:5px; border-radius:4px; cursor:pointer;">X</button></td>
            </tr>`;
    });
}

async function renderCaixa() {
    const lista = await DB.list(CONFIG.TABLES.CAIXA);
    const tbody = $("lista-caixa");
    if(!tbody) return;
    tbody.innerHTML = "";
    let saldo = 0;
    
    lista.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

    lista.forEach(c => {
        const val = parseFloat(c.valor);
        if(c.tipo==='entrada') saldo+=val; else saldo-=val;
        const cor = c.tipo==='entrada' ? 'green' : 'red';
        
        tbody.innerHTML += `
            <tr>
                <td>${new Date(c.created_at).toLocaleTimeString()}</td>
                <td>${c.descricao}</td>
                <td>${moeda(val)}</td>
                <td style="color:${cor}; font-weight:bold;">${c.tipo.toUpperCase()}</td>
            </tr>`;
    });
    
    if($("caixa-valor-topo")) $("caixa-valor-topo").textContent = moeda(saldo);
    if($("dash-caixa-saldo")) {
        $("dash-caixa-saldo").textContent = moeda(saldo);
        $("dash-caixa-saldo").style.color = saldo >= 0 ? "green" : "red";
    }
}

async function carregarDashboard() {
    const prods = await DB.list(CONFIG.TABLES.PRODUTOS);
    const funcs = await DB.list(CONFIG.TABLES.FUNCIONARIOS);
    if($("dash-estoque-qtd")) $("dash-estoque-qtd").textContent = prods.length;
    if($("dash-total-funcs")) $("dash-total-funcs").textContent = funcs.length;
    renderCaixa();
}

// --- PONTO ---
async function carregarPonto() {
    const funcs = await DB.list(CONFIG.TABLES.FUNCIONARIOS);
    const sel = $("apontamento-funcionario");
    if(!sel) return;
    
    sel.innerHTML = "";
    funcs.forEach(f => sel.innerHTML += `<option value="${f.id}">${f.nome}</option>`);
    
    sel.onchange = carregarStatusPonto;
    carregarStatusPonto();
}

async function carregarStatusPonto() {
    const fid = $("apontamento-funcionario").value;
    if(!fid) return;
    const data = new Date().toLocaleDateString('pt-BR').split('/').reverse().join('-'); 
    
    if($("apontamento-data")) $("apontamento-data").textContent = dataBR(data);
    
    ["entrada","int-ini","int-fim","saida"].forEach(k => {
        if($("hora-"+k)) $("hora-"+k).textContent = "-";
    });
    
    const lista = await DB.list(CONFIG.TABLES.APONTAMENTOS);
    const ap = lista.find(a => a.funcionario_id === fid && a.data === data);
    
    if($("apontamento-status")) $("apontamento-status").textContent = ap ? "Registro encontrado" : "Nenhum registro hoje";
    
    if(ap) {
        if(ap.entrada) $("hora-entrada").textContent = ap.entrada;
        if(ap.int_ini) $("hora-int-ini").textContent = ap.int_ini;
        if(ap.int_fim) $("hora-int-fim").textContent = ap.int_fim;
        if(ap.saida) $("hora-saida").textContent = ap.saida;
    }
}

async function baterPonto(campo) {
    const fid = $("apontamento-funcionario").value;
    if(!fid) return alert("Selecione funcionário");
    const data = new Date().toLocaleDateString('pt-BR').split('/').reverse().join('-');
    const hora = new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
    
    const lista = await DB.list(CONFIG.TABLES.APONTAMENTOS);
    let ap = lista.find(a => a.funcionario_id === fid && a.data === data);
    
    if(ap && ap[campo]) return alert("Já marcado!");
    
    if(!ap) { ap = {funcionario_id: fid, data: data}; }
    
    let campoDB = "";
    if(campo === "entrada") campoDB = "entrada";
    if(campo === "int_ini") campoDB = "int_ini";
    if(campo === "int_fim") campoDB = "int_fim";
    if(campo === "saida") campoDB = "saida";

    ap[campoDB] = hora; 
    
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
    
    const addInput = (id, label, type="text") => {
        content.innerHTML += `<label style="display:block; margin-top:10px;">${label}</label><input id="mod-${id}" type="${type}" style="width:100%; padding:8px; margin-top:5px; border:1px solid #ccc; border-radius:4px;">`;
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
    else if(tipo === "funcionario") {
        titulo.textContent = "Novo Funcionário";
        addInput("nome","Nome"); addInput("cpf","CPF"); addInput("funcao","Função");
        btn.onclick = async () => {
            await DB.save(CONFIG.TABLES.FUNCIONARIOS, { nome: $("mod-nome").value, cpf: $("mod-cpf").value, funcao: $("mod-funcao").value });
            modal.style.display="none"; navegar("funcionarios");
        };
    }
    else if(tipo === "nota") {
        titulo.textContent = "Nova Nota";
        addInput("numero","Número NF"); addInput("fornecedor","Fornecedor"); addInput("valor","Valor Total","number"); addInput("data","Data Emissão","date");
        btn.onclick = async () => {
            await DB.save(CONFIG.TABLES.NOTAS, { 
                numero: $("mod-numero").value, fornecedor: $("mod-fornecedor").value, 
                valor: Number($("mod-valor").value), data: $("mod-data").value 
            });
            modal.style.display="none"; navegar("notas");
        };
    }
}

// --- EVENTOS GLOBAIS (LOAD) ---
window.addEventListener("load", () => {
    // 1. Botão de Login
    if($("btnLogin")) {
        $("btnLogin").onclick = async () => {
            try {
                const u = await DB.login($("usuario").value, $("senha").value);
                STATE.user = u;
                $("tela-login").style.display="none"; $("tela-dashboard").style.display="flex";
                $("display-nome-usuario").textContent = u.nome;
                navegar("dashboard");
            } catch(e) { $("msg-erro").textContent = e.message; }
        };
    }

    // 2. Botão Sair
    const btnSair = document.querySelector(".btn-sair");
    if(btnSair) btnSair.onclick = () => window.location.reload();
    
    // 3. Menu Lateral
    document.querySelectorAll(".sidebar li").forEach(li => li.onclick = () => navegar(li.dataset.target));
    
    // 4. Botões de Ação
    if($("btnNovoProduto")) $("btnNovoProduto").onclick = () => abrirModal("produto");
    if($("btnNovoFornecedor")) $("btnNovoFornecedor").onclick = () => abrirModal("fornecedor");
    if($("btnNovaDespesa")) $("btnNovaDespesa").onclick = () => abrirModal("despesa");
    if($("btnNovaReceita")) $("btnNovaReceita").onclick = () => abrirModal("receita");
    if($("btnNovoFuncionario")) $("btnNovoFuncionario").onclick = () => abrirModal("funcionario");
    if($("btnNovoUsuario")) $("btnNovoUsuario").onclick = () => alert("Use o banco de dados para criar novos usuários de sistema."); 
    if($("btnNovoNota")) $("btnNovoNota").onclick = () => abrirModal("nota");

    // 5. Ponto
    if($("btnApEntrada")) $("btnApEntrada").onclick = () => baterPonto("entrada");
    if($("btnApIntIni")) $("btnApIntIni").onclick = () => baterPonto("int_ini");
    if($("btnApIntFim")) $("btnApIntFim").onclick = () => baterPonto("int_fim");
    if($("btnApSaida")) $("btnApSaida").onclick = () => baterPonto("saida");
    
    // 6. Caixa Rápido
    if($("btnLancarCaixa")) {
        $("btnLancarCaixa").onclick = async () => {
            const desc = $("caixa-desc").value;
            const val = $("caixa-valor").value;
            if(!desc || !val) return alert("Preencha descrição e valor");
            await DB.save(CONFIG.TABLES.CAIXA, { descricao: desc, valor: Number(val), tipo: $("caixa-tipo").value });
            $("caixa-desc").value=""; $("caixa-valor").value=""; renderCaixa();
        };
    }

    // 7. Fechar Modal
    document.querySelectorAll(".close-modal").forEach(el => {
        el.onclick = () => $("modal-generico").style.display="none";
    });

    // 8. Mobile Menu
    if($("btn-menu-mobile")) {
        $("btn-menu-mobile").onclick = () => {
            const sb = document.querySelector(".sidebar");
            sb.style.left = sb.style.left === "0px" ? "-250px" : "0px";
        };
    }
});

// Helper Global para Excluir
window.excluirItem = async (tabela, id) => {
    if(confirm("Deseja realmente excluir este item?")) {
        await DB.delete(CONFIG.TABLES[tabela.toUpperCase()] || tabela, id);
        navegar(STATE.route); 
    }
};