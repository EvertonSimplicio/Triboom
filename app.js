/* =========================================
   CONFIGURAÇÃO
   ========================================= */
const CONFIG = {
    SUPABASE_URL: "",  // Opcional: Para usar online
    SUPABASE_KEY: "",  // Opcional
    TABLES: {
        USUARIOS: "usuarios",
        FUNCIONARIOS: "funcionarios",
        APONTAMENTOS: "apontamentos",
        CAIXA: "caixa"
    }
};

const STATE = {
    user: null,
    funcionarios: [],
    route: "dashboard"
};

/* =========================================
   BANCO DE DADOS (DB)
   ========================================= */
const DB = {
    isOnline() {
        return !!(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_KEY && window.supabase);
    },
    getClient() {
        return window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
    },
    // --- LOCAL STORAGE ---
    getStorage() {
        const s = localStorage.getItem("triboom_db_v2");
        if (s) return JSON.parse(s);
        const inicial = {
            usuarios: [{id:"1", nome:"Admin", login:"admin", senha:"admin", perfil:"Admin", ativo:true}],
            funcionarios: [],
            apontamentos: [],
            caixa: []
        };
        localStorage.setItem("triboom_db_v2", JSON.stringify(inicial));
        return inicial;
    },
    setStorage(data) {
        localStorage.setItem("triboom_db_v2", JSON.stringify(data));
    },
    gerarId() {
        return Math.random().toString(36).substr(2, 9);
    },

    // --- MÉTODOS GERAIS ---
    async login(login, senha) {
        if (this.isOnline()) {
            const { data, error } = await this.getClient().from(CONFIG.TABLES.USUARIOS).select("*").eq("login", login).maybeSingle();
            if (error) throw error;
            if (!data || !data.ativo) throw new Error("Usuário inválido.");
            if (data.senha !== senha) throw new Error("Senha incorreta.");
            return data;
        }
        // Local
        await new Promise(r => setTimeout(r, 200));
        const db = this.getStorage();
        const user = db.usuarios.find(u => u.login === login && u.senha === senha && u.ativo);
        if (!user) throw new Error("Usuário ou senha incorretos.");
        return user;
    },

    // --- USUARIOS ---
    async getUsuarios() {
        if (this.isOnline()) {
            const { data } = await this.getClient().from(CONFIG.TABLES.USUARIOS).select("*");
            return data || [];
        }
        return this.getStorage().usuarios;
    },
    async salvarUsuario(user) {
        if (this.isOnline()) {
            const sb = this.getClient();
            const pl = {...user}; if(!pl.id) delete pl.id;
            await sb.from(CONFIG.TABLES.USUARIOS).upsert(pl);
            return;
        }
        const db = this.getStorage();
        if(user.id) {
            const idx = db.usuarios.findIndex(u=>u.id===user.id);
            if(idx>=0) db.usuarios[idx]=user;
        } else {
            user.id = this.gerarId();
            user.ativo = true;
            db.usuarios.push(user);
        }
        this.setStorage(db);
    },
    async excluirUsuario(id) {
        if (this.isOnline()) await this.getClient().from(CONFIG.TABLES.USUARIOS).delete().eq("id", id);
        else {
            const db = this.getStorage();
            db.usuarios = db.usuarios.filter(u=>u.id!==id);
            this.setStorage(db);
        }
    },

    // --- FUNCIONARIOS ---
    async getFuncionarios() {
        if (this.isOnline()) {
            const { data } = await this.getClient().from(CONFIG.TABLES.FUNCIONARIOS).select("*").order("nome");
            return data || [];
        }
        return this.getStorage().funcionarios;
    },
    async salvarFuncionario(func) {
        if (this.isOnline()) {
            const pl = {...func}; if(!pl.id) delete pl.id;
            await this.getClient().from(CONFIG.TABLES.FUNCIONARIOS).upsert(pl);
            return;
        }
        const db = this.getStorage();
        if(func.id) {
            const idx = db.funcionarios.findIndex(f=>f.id===func.id);
            if(idx>=0) db.funcionarios[idx]=func;
        } else {
            func.id = this.gerarId();
            func.ativo = true;
            db.funcionarios.push(func);
        }
        this.setStorage(db);
    },
    async excluirFuncionario(id) {
        if (this.isOnline()) await this.getClient().from(CONFIG.TABLES.FUNCIONARIOS).delete().eq("id", id);
        else {
            const db = this.getStorage();
            db.funcionarios = db.funcionarios.filter(f=>f.id!==id);
            this.setStorage(db);
        }
    },

    // --- APONTAMENTOS ---
    async getApontamento(fid, data) {
        if (this.isOnline()) {
            const { data: res } = await this.getClient().from(CONFIG.TABLES.APONTAMENTOS).select("*").eq("funcionario_id", fid).eq("data", data).maybeSingle();
            return res;
        }
        const db = this.getStorage();
        return db.apontamentos.find(a => a.funcionario_id === fid && a.data === data);
    },
    async salvarApontamento(payload) {
        if (this.isOnline()) {
            const sb = this.getClient();
            const {data: existe} = await sb.from(CONFIG.TABLES.APONTAMENTOS).select("id").eq("funcionario_id", payload.funcionario_id).eq("data", payload.data).maybeSingle();
            const dados = {...payload};
            if(existe) dados.id = existe.id;
            await sb.from(CONFIG.TABLES.APONTAMENTOS).upsert(dados);
            return;
        }
        const db = this.getStorage();
        const idx = db.apontamentos.findIndex(a => a.funcionario_id === payload.funcionario_id && a.data === payload.data);
        if(idx>=0) {
            db.apontamentos[idx] = {...db.apontamentos[idx], ...payload};
        } else {
            db.apontamentos.push({id: this.gerarId(), ...payload});
        }
        this.setStorage(db);
    },
    async getRelatorio(fid, ini, fim) {
        // Filtragem simples
        if (this.isOnline()) {
            let q = this.getClient().from(CONFIG.TABLES.APONTAMENTOS).select("*").gte("data", ini).lte("data", fim);
            if(fid) q = q.eq("funcionario_id", fid);
            const { data } = await q.order("data");
            return data || [];
        }
        const db = this.getStorage();
        return db.apontamentos.filter(a => {
            if(fid && a.funcionario_id !== fid) return false;
            return a.data >= ini && a.data <= fim;
        }).sort((a,b) => a.data.localeCompare(b.data));
    },

    // --- CAIXA ---
    async getCaixa() {
        if (this.isOnline()) {
            const { data } = await this.getClient().from(CONFIG.TABLES.CAIXA).select("*").order("created_at", {ascending: false});
            return data || [];
        }
        const db = this.getStorage();
        return (db.caixa || []).sort((a,b) => b.id.localeCompare(a.id)); // simulando ordem reversa
    },
    async lancarCaixa(item) {
        if (this.isOnline()) {
            await this.getClient().from(CONFIG.TABLES.CAIXA).insert([item]);
            return;
        }
        const db = this.getStorage();
        db.caixa = db.caixa || [];
        item.id = this.gerarId();
        item.data = new Date().toISOString();
        db.caixa.push(item);
        this.setStorage(db);
    },
    async excluirCaixa(id) {
         if (this.isOnline()) await this.getClient().from(CONFIG.TABLES.CAIXA).delete().eq("id", id);
         else {
             const db = this.getStorage();
             db.caixa = db.caixa.filter(c => c.id !== id);
             this.setStorage(db);
         }
    }
};

/* =========================================
   INTERFACE (UI)
   ========================================= */
const $ = (id) => document.getElementById(id);
const hide = (id) => { const el=$(id); if(el) el.style.display = 'none'; };
const hojeISO = () => new Date().toLocaleDateString('pt-BR').split('/').reverse().join('-');
const agoraHora = () => new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
const moeda = (v) => parseFloat(v).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});

function navegar(tela) {
    STATE.route = tela;
    const tit = $("titulo-secao");
    if(tit) tit.textContent = tela.toUpperCase();

    // Views
    document.querySelectorAll(".view-section").forEach(d => d.style.display = "none");
    const view = $("view-" + tela);
    if(view) view.style.display = "block";

    // Menu
    document.querySelectorAll(".sidebar li").forEach(li => li.classList.remove("ativo"));
    const li = document.querySelector(`.sidebar li[data-target="${tela}"]`);
    if(li) li.classList.add("ativo");

    // Loads Específicos
    if (tela === "funcionarios") carregarFuncionarios();
    if (tela === "usuarios") carregarUsuarios();
    if (tela === "apontamento") prepararApontamento();
    if (tela === "dashboard") carregarDashboard();
    if (tela === "relatorios") prepararRelatorios();
    if (tela === "caixa") carregarCaixa();
}

// --- LOGICAS ESPECIFICAS ---

// RELATÓRIOS
async function prepararRelatorios() {
    const lista = await DB.getFuncionarios();
    const sel = $("rel-func-select");
    sel.innerHTML = '<option value="">Todos</option>';
    lista.forEach(f => {
        sel.innerHTML += `<option value="${f.id}">${f.nome}</option>`;
    });
    // Datas padrão (Mês atual)
    const hoje = new Date();
    const dia1 = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    $("rel-data-ini").value = dia1.toISOString().split('T')[0];
    $("rel-data-fim").value = hojeISO();
    
    // Auto carregar
    carregarTabelaRelatorio();
}

async function carregarTabelaRelatorio() {
    const fid = $("rel-func-select").value;
    const ini = $("rel-data-ini").value;
    const fim = $("rel-data-fim").value;
    
    const dados = await DB.getRelatorio(fid, ini, fim);
    const tbody = $("lista-relatorios-corpo");
    tbody.innerHTML = "";
    
    if(dados.length === 0) {
        tbody.innerHTML = "<tr><td colspan='6'>Nenhum registro encontrado.</td></tr>";
        return;
    }

    dados.forEach(d => {
        tbody.innerHTML += `
            <tr>
                <td>${d.data.split('-').reverse().join('/')}</td>
                <td>${d.entrada || '-'}</td>
                <td>${d.int_inicio || '-'}</td>
                <td>${d.int_fim || '-'}</td>
                <td>${d.saida || '-'}</td>
                <td>${d.obs || ''}</td>
            </tr>
        `;
    });
}

// CAIXA
async function carregarCaixa() {
    const items = await DB.getCaixa();
    const tbody = $("lista-caixa-corpo");
    tbody.innerHTML = "";
    
    let saldo = 0;
    
    items.forEach(c => {
        const val = parseFloat(c.valor);
        if(c.tipo === 'entrada') saldo += val;
        else saldo -= val;
        
        const cor = c.tipo === 'entrada' ? 'green' : 'red';
        const icone = c.tipo === 'entrada' ? '⬆' : '⬇';

        tbody.innerHTML += `
            <tr>
                <td>${new Date(c.data || new Date()).toLocaleDateString('pt-BR')}</td>
                <td>${c.descricao}</td>
                <td style="color:${cor}">${icone} ${c.tipo.toUpperCase()}</td>
                <td>${moeda(val)}</td>
                <td><button class="btn-excluir" onclick="apagarCaixa('${c.id}')">X</button></td>
            </tr>
        `;
    });
    
    const elSaldo = $("caixa-saldo-topo");
    elSaldo.textContent = moeda(saldo);
    elSaldo.style.color = saldo >= 0 ? "#27ae60" : "#c0392b";
}

async function lancarCaixa() {
    const desc = $("caixa-desc").value;
    const val = $("caixa-valor").value;
    const tipo = $("caixa-tipo").value;

    if(!desc || !val) return alert("Preencha descrição e valor!");

    await DB.lancarCaixa({
        descricao: desc,
        valor: parseFloat(val),
        tipo: tipo
    });

    $("caixa-desc").value = "";
    $("caixa-valor").value = "";
    carregarCaixa();
}

// Global para poder chamar no onclick do HTML gerado via JS
window.apagarCaixa = async (id) => {
    if(confirm("Excluir lançamento?")) {
        await DB.excluirCaixa(id);
        carregarCaixa();
    }
};


// --- OUTROS (DASHBOARD/CRUD) ---
async function carregarDashboard() {
    const funcs = await DB.getFuncionarios();
    $("total-funcs").textContent = funcs.length;
    $("data-hoje").textContent = new Date().toLocaleDateString('pt-BR');
    
    // Saldo dashboard
    const cx = await DB.getCaixa();
    let s = 0;
    cx.forEach(x => {
        if(x.tipo==='entrada') s += parseFloat(x.valor);
        else s -= parseFloat(x.valor);
    });
    $("dash-saldo").textContent = moeda(s);
}

async function carregarFuncionarios() {
    const lista = await DB.getFuncionarios();
    STATE.funcionarios = lista;
    const tbody = $("lista-funcionarios-corpo");
    tbody.innerHTML = "";
    lista.forEach(f => {
        tbody.innerHTML += `<tr>
            <td>${f.nome}</td>
            <td>${f.cpf||'-'}</td>
            <td>${f.funcao||'-'}</td>
            <td><button class="btn-excluir" onclick="delFunc('${f.id}')">Excluir</button></td>
        </tr>`;
    });
}
window.delFunc = async (id) => { if(confirm("Excluir?")) { await DB.excluirFuncionario(id); carregarFuncionarios(); }};

async function carregarUsuarios() {
    const lista = await DB.getUsuarios();
    const tbody = $("lista-usuarios-corpo");
    tbody.innerHTML = "";
    lista.forEach(u => {
        tbody.innerHTML += `<tr>
            <td>${u.nome}</td>
            <td>${u.login}</td>
            <td>${u.perfil}</td>
            <td><button class="btn-excluir" onclick="delUser('${u.id}')">Excluir</button></td>
        </tr>`;
    });
}
window.delUser = async (id) => { if(confirm("Excluir?")) { await DB.excluirUsuario(id); carregarUsuarios(); }};

// --- APONTAMENTO ---
async function prepararApontamento() {
    const lista = await DB.getFuncionarios();
    const sel = $("apontamento-funcionario");
    sel.innerHTML = "";
    lista.forEach(f => {
        sel.innerHTML += `<option value="${f.id}">${f.nome}</option>`;
    });
    carregarApontamentoDoDia();
    
    if (STATE.user.perfil === "Admin") {
        $("btnApEditar").style.display = "inline-block";
    } else {
        $("btnApEditar").style.display = "none";
        hide("apontamento-manual");
    }
}

async function carregarApontamentoDoDia() {
    const fid = $("apontamento-funcionario").value;
    if(!fid) return;
    
    ["entrada", "int-ini", "int-fim", "saida"].forEach(k => $(`apontamento-hora-${k}`).textContent = "-");
    $("apontamento-status").textContent = "Carregando...";

    const ap = await DB.getApontamento(fid, hojeISO());
    
    $("apontamento-data").textContent = new Date().toLocaleDateString('pt-BR');
    $("apontamento-status").textContent = ap ? (ap.locked ? "Finalizado" : "Em andamento") : "Sem lançamento";
    
    if(ap) {
        $("apontamento-hora-entrada").textContent = ap.entrada || "-";
        $("apontamento-hora-int-ini").textContent = ap.int_inicio || "-";
        $("apontamento-hora-int-fim").textContent = ap.int_fim || "-";
        $("apontamento-hora-saida").textContent = ap.saida || "-";
    }
}

async function registrarPonto(campo) {
    const fid = $("apontamento-funcionario").value;
    if(!fid) return alert("Selecione um funcionário!");
    
    const data = hojeISO();
    const hora = agoraHora();
    const obs = $("apontamento-obs").value;

    try {
        const atual = await DB.getApontamento(fid, data);
        if(atual && atual[campo]) throw new Error("Horário já marcado!");
        if(campo === 'saida' && atual && atual.locked) throw new Error("Dia já encerrado.");

        const payload = { funcionario_id: fid, data };
        if (atual) {
            payload.entrada = atual.entrada;
            payload.int_inicio = atual.int_inicio;
            payload.int_fim = atual.int_fim;
            payload.saida = atual.saida;
        }
        
        payload[campo] = hora;
        if(obs) payload.obs = obs;
        if(campo === 'saida') payload.locked = true;

        await DB.salvarApontamento(payload);
        carregarApontamentoDoDia();
        alert("Marcado: " + hora);
    } catch (e) { alert("Atenção: " + e.message); }
}

// --- STARTUP ---
window.addEventListener("load", () => {
    // Binds
    $("btnLogin").onclick = DB.login.bind(DB, $("usuario").value, $("senha").value); 
    // Fix bind login
    $("btnLogin").onclick = async () => {
         try {
             const u = await DB.login($("usuario").value, $("senha").value);
             STATE.user = u;
             localStorage.setItem("triboom_last_user_v2", JSON.stringify(u));
             hide("tela-login");
             $("tela-dashboard").style.display = "flex";
             $("display-nome-usuario").textContent = u.nome;
             navegar("dashboard");
         } catch(e) { $("msg-erro").textContent = e.message; }
    };
    
    document.querySelector(".btn-sair").onclick = () => {
        STATE.user = null;
        localStorage.removeItem("triboom_last_user_v2");
        window.location.reload();
    };

    document.querySelectorAll(".sidebar li").forEach(li => {
        li.onclick = () => navegar(li.dataset.target);
    });

    // Apontamento
    $("btnApEntrada").onclick = () => registrarPonto("entrada");
    $("btnApIntIni").onclick = () => registrarPonto("int_inicio");
    $("btnApIntFim").onclick = () => registrarPonto("int_fim");
    $("btnApSaida").onclick = () => registrarPonto("saida");
    $("apontamento-funcionario").onchange = carregarApontamentoDoDia;

    // Relatorio
    $("btnGerarRelatorio").onclick = carregarTabelaRelatorio;

    // Caixa
    $("btnLancarCaixa").onclick = lancarCaixa;

    // Modais e CRUDs
    const mUser = $("modal-usuario"), mFunc = $("modal-funcionario");
    document.querySelectorAll(".close-modal").forEach(s => s.onclick = () => { mUser.style.display="none"; mFunc.style.display="none"; });
    
    $("btnNovoUsuario").onclick = () => { $("usuario_id_edit").value=""; $("user_nome").value=""; mUser.style.display="block"; };
    $("btnNovoFuncionario").onclick = () => { $("func_id_edit").value=""; $("func_nome").value=""; mFunc.style.display="block"; };

    $("btnSalvarUsuario").onclick = async () => {
        try {
            await DB.salvarUsuario({
                id: $("usuario_id_edit").value || null,
                nome: $("user_nome").value,
                login: $("user_login").value,
                senha: $("user_senha").value,
                perfil: $("user_perfil").value,
                ativo: true
            });
            mUser.style.display="none"; carregarUsuarios(); alert("Salvo!");
        } catch(e){alert(e.message);}
    };

    $("btnSalvarFuncionario").onclick = async () => {
        try {
            await DB.salvarFuncionario({
                id: $("func_id_edit").value || null,
                nome: $("func_nome").value,
                cpf: $("func_cpf").value,
                funcao: $("func_funcao").value,
                ativo: true
            });
            mFunc.style.display="none"; carregarFuncionarios(); alert("Salvo!");
        } catch(e){alert(e.message);}
    };
    
    // Auto Login
    const saved = localStorage.getItem("triboom_last_user_v2");
    if(saved) {
        try {
            STATE.user = JSON.parse(saved);
            hide("tela-login");
            $("tela-dashboard").style.display = "flex";
            $("display-nome-usuario").textContent = STATE.user.nome;
            navegar("dashboard");
        } catch(e){}
    }
});