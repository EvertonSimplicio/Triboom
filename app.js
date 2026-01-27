/* =========================================
   CONFIGURAÇÃO (PREENCHA PARA FICAR ONLINE)
   ========================================= */
const CONFIG = {
    // Coloque seus dados do Supabase aqui para salvar na nuvem/online
    SUPABASE_URL: "",  // Ex: "https://xyz.supabase.co"
    SUPABASE_KEY: "",  // Ex: "eyJhbGci..."
    
    TABLES: {
        USUARIOS: "usuarios",
        FUNCIONARIOS: "funcionarios",
        APONTAMENTOS: "apontamentos"
    }
};

const STATE = {
    user: null,
    funcionarios: [],
    route: "dashboard"
};

/* =========================================
   BANCO DE DADOS (LOCAL + ONLINE)
   ========================================= */
const DB = {
    // Verifica se tem configuração online
    isOnline() {
        return !!(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_KEY && window.supabase);
    },

    getClient() {
        return window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
    },

    // --- LOCAL STORAGE HELPERS ---
    getStorage() {
        const s = localStorage.getItem("triboom_db_v1");
        if (s) return JSON.parse(s);
        const inicial = {
            usuarios: [{id:"1", nome:"Admin", login:"admin", senha:"admin", perfil:"Admin", ativo:true}],
            funcionarios: [],
            apontamentos: []
        };
        localStorage.setItem("triboom_db_v1", JSON.stringify(inicial));
        return inicial;
    },
    setStorage(data) {
        localStorage.setItem("triboom_db_v1", JSON.stringify(data));
    },
    gerarId() {
        return Math.random().toString(36).substr(2, 9);
    },

    // --- MÉTODOS UNIFICADOS ---

    async login(login, senha) {
        // MODO ONLINE
        if (this.isOnline()) {
            const sb = this.getClient();
            const { data, error } = await sb
                .from(CONFIG.TABLES.USUARIOS)
                .select("*")
                .eq("login", login)
                .maybeSingle(); // Traz 1 ou null
            
            if (error) throw error;
            if (!data || !data.ativo) throw new Error("Usuário inválido ou inativo (Online).");
            if (data.senha !== senha) throw new Error("Senha incorreta.");
            return data;
        }

        // MODO LOCAL
        await new Promise(r => setTimeout(r, 300)); // Charme
        const db = this.getStorage();
        const user = db.usuarios.find(u => u.login === login && u.senha === senha && u.ativo);
        if (!user) throw new Error("Usuário não encontrado (Local). Tente 'admin' / 'admin'.");
        return user;
    },

    async getUsuarios() {
        if (this.isOnline()) {
            const { data, error } = await this.getClient().from(CONFIG.TABLES.USUARIOS).select("*");
            if(error) throw error;
            return data || [];
        }
        return this.getStorage().usuarios;
    },

    async salvarUsuario(user) {
        if (this.isOnline()) {
            const sb = this.getClient();
            const payload = { ...user };
            // Supabase gera ID sozinho se for insert, ou usa o existente
            if (!payload.id) delete payload.id; 
            
            // Upsert (Atualiza se tiver ID, Cria se não tiver)
            const { error } = await sb.from(CONFIG.TABLES.USUARIOS).upsert(payload);
            if(error) throw error;
            return;
        }

        // LOCAL
        const db = this.getStorage();
        if (user.id) {
            const idx = db.usuarios.findIndex(u => u.id === user.id);
            if (idx >= 0) db.usuarios[idx] = user;
        } else {
            user.id = this.gerarId();
            user.ativo = true;
            db.usuarios.push(user);
        }
        this.setStorage(db);
    },

    async excluirUsuario(id) {
        if (this.isOnline()) {
            const { error } = await this.getClient().from(CONFIG.TABLES.USUARIOS).delete().eq("id", id);
            if(error) throw error;
            return;
        }
        const db = this.getStorage();
        db.usuarios = db.usuarios.filter(u => u.id !== id);
        this.setStorage(db);
    },

    async getFuncionarios() {
        if (this.isOnline()) {
            const { data, error } = await this.getClient()
                .from(CONFIG.TABLES.FUNCIONARIOS)
                .select("*")
                .order("nome", {ascending: true});
            if(error) throw error;
            return data || [];
        }
        return this.getStorage().funcionarios;
    },

    async salvarFuncionario(func) {
        if (this.isOnline()) {
            const sb = this.getClient();
            const payload = { ...func };
            if (!payload.id) delete payload.id;
            
            const { error } = await sb.from(CONFIG.TABLES.FUNCIONARIOS).upsert(payload);
            if(error) throw error;
            return;
        }

        const db = this.getStorage();
        if (func.id) {
            const idx = db.funcionarios.findIndex(f => f.id === func.id);
            if (idx >= 0) db.funcionarios[idx] = func;
        } else {
            func.id = this.gerarId();
            func.ativo = true;
            db.funcionarios.push(func);
        }
        this.setStorage(db);
    },

    async excluirFuncionario(id) {
        if (this.isOnline()) {
            const { error } = await this.getClient().from(CONFIG.TABLES.FUNCIONARIOS).delete().eq("id", id);
            if(error) throw error;
            return;
        }
        const db = this.getStorage();
        db.funcionarios = db.funcionarios.filter(f => f.id !== id);
        this.setStorage(db);
    },

    async getApontamento(funcionario_id, data) {
        if (this.isOnline()) {
            const { data: res, error } = await this.getClient()
                .from(CONFIG.TABLES.APONTAMENTOS)
                .select("*")
                .eq("funcionario_id", funcionario_id)
                .eq("data", data)
                .maybeSingle();
            if(error) throw error;
            return res;
        }
        const db = this.getStorage();
        return db.apontamentos.find(a => a.funcionario_id === funcionario_id && a.data === data);
    },

    async salvarApontamento(payload) {
        if (this.isOnline()) {
            const sb = this.getClient();
            // Verifica se já existe para pegar o ID correto (para update)
            const { data: existe } = await sb.from(CONFIG.TABLES.APONTAMENTOS)
                .select("id")
                .eq("funcionario_id", payload.funcionario_id)
                .eq("data", payload.data)
                .maybeSingle();
            
            const dados = { ...payload };
            if (existe) dados.id = existe.id; // Garante que é update

            const { error } = await sb.from(CONFIG.TABLES.APONTAMENTOS).upsert(dados);
            if(error) throw error;
            return;
        }

        // LOCAL
        const db = this.getStorage();
        let idx = db.apontamentos.findIndex(a => a.funcionario_id === payload.funcionario_id && a.data === payload.data);
        
        let ap;
        if (idx >= 0) {
            ap = { ...db.apontamentos[idx], ...payload };
            db.apontamentos[idx] = ap;
        } else {
            ap = { id: this.gerarId(), ...payload };
            db.apontamentos.push(ap);
        }
        this.setStorage(db);
        return ap;
    }
};

/* =========================================
   UI HELPERS & NAVEGAÇÃO
   ========================================= */
const $ = (id) => document.getElementById(id);
const hide = (id) => { const el=$(id); if(el) el.style.display = 'none'; };
const hojeISO = () => new Date().toLocaleDateString('pt-BR').split('/').reverse().join('-');
const agoraHora = () => new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});

function navegar(tela) {
    STATE.route = tela;
    const tit = $("titulo-secao");
    if(tit) tit.textContent = tela.toUpperCase();

    document.querySelectorAll(".view-section").forEach(d => d.style.display = "none");
    const view = $("view-" + tela);
    if(view) view.style.display = "block";

    document.querySelectorAll(".sidebar li").forEach(li => li.classList.remove("ativo"));
    const li = document.querySelector(`.sidebar li[data-target="${tela}"]`);
    if(li) li.classList.add("ativo");

    if (tela === "funcionarios") carregarListaFuncionarios();
    if (tela === "usuarios") carregarListaUsuarios();
    if (tela === "apontamento") prepararTelaApontamento();
    if (tela === "dashboard") carregarDashboard();
}

/* =========================================
   LÓGICA DAS TELAS
   ========================================= */

// LOGIN
async function tentarLogin() {
    const user = $("usuario").value;
    const pass = $("senha").value;
    const btn = $("btnLogin");
    const msg = $("msg-erro");
    
    try {
        msg.textContent = "Verificando...";
        btn.disabled = true;
        const usuarioLogado = await DB.login(user, pass);
        
        STATE.user = usuarioLogado;
        localStorage.setItem("triboom_last_user", JSON.stringify(usuarioLogado));
        
        $("display-nome-usuario").textContent = usuarioLogado.nome;
        hide("tela-login");
        $("tela-dashboard").style.display = "flex";
        navegar("dashboard");
    } catch (e) {
        msg.textContent = e.message;
    } finally {
        btn.disabled = false;
    }
}

function fazerLogout() {
    STATE.user = null;
    localStorage.removeItem("triboom_last_user");
    window.location.reload();
}

// DASHBOARD
async function carregarDashboard() {
    try {
        const funcs = await DB.getFuncionarios();
        $("total-funcs").textContent = funcs.length;
        $("data-hoje").textContent = new Date().toLocaleDateString('pt-BR');
    } catch(e) { console.error(e); }
}

// FUNCIONÁRIOS
async function carregarListaFuncionarios() {
    try {
        const lista = await DB.getFuncionarios();
        STATE.funcionarios = lista;
        const tbody = $("lista-funcionarios-corpo");
        tbody.innerHTML = "";
        
        lista.forEach(f => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${f.nome}</td>
                <td>${f.cpf || '-'}</td>
                <td>${f.funcao || '-'}</td>
                <td><button class="btn-excluir" data-id="${f.id}">Excluir</button></td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll(".btn-excluir").forEach(btn => {
            btn.onclick = async () => {
                if(confirm("Excluir funcionário?")) {
                    await DB.excluirFuncionario(btn.dataset.id);
                    carregarListaFuncionarios();
                }
            };
        });
    } catch(e) { alert("Erro ao carregar lista: " + e.message); }
}

// USUÁRIOS
async function carregarListaUsuarios() {
    try {
        const lista = await DB.getUsuarios();
        const tbody = $("lista-usuarios-corpo");
        tbody.innerHTML = "";
        
        lista.forEach(u => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${u.nome}</td>
                <td>${u.login}</td>
                <td>${u.perfil}</td>
                <td><button class="btn-excluir" data-id="${u.id}">Excluir</button></td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll(".btn-excluir").forEach(btn => {
            btn.onclick = async () => {
                if(confirm("Excluir usuário?")) {
                    await DB.excluirUsuario(btn.dataset.id);
                    carregarListaUsuarios();
                }
            };
        });
    } catch(e) { alert("Erro usuarios: " + e.message); }
}

// APONTAMENTO
async function prepararTelaApontamento() {
    try {
        const lista = await DB.getFuncionarios();
        const sel = $("apontamento-funcionario");
        sel.innerHTML = "";
        
        lista.forEach(f => {
            const opt = document.createElement("option");
            opt.value = f.id;
            opt.textContent = f.nome;
            sel.appendChild(opt);
        });

        carregarApontamentoDoDia();
        
        if (STATE.user.perfil === "Admin") {
            $("btnApEditar").style.display = "inline-block";
        } else {
            $("btnApEditar").style.display = "none";
            hide("apontamento-manual");
        }
    } catch(e) { console.error(e); }
}

async function carregarApontamentoDoDia() {
    const fid = $("apontamento-funcionario").value;
    if(!fid) return;
    
    // Reseta visual
    ["entrada", "int-ini", "int-fim", "saida"].forEach(k => {
        $(`apontamento-hora-${k}`).textContent = "-";
    });
    $("apontamento-status").textContent = "Carregando...";

    try {
        const data = hojeISO();
        const ap = await DB.getApontamento(fid, data);
        
        $("apontamento-data").textContent = new Date().toLocaleDateString('pt-BR');
        $("apontamento-status").textContent = ap ? (ap.locked ? "Finalizado" : "Em andamento") : "Sem lançamento";
        
        if(ap) {
            $("apontamento-hora-entrada").textContent = ap.entrada || "-";
            $("apontamento-hora-int-ini").textContent = ap.int_inicio || "-";
            $("apontamento-hora-int-fim").textContent = ap.int_fim || "-";
            $("apontamento-hora-saida").textContent = ap.saida || "-";
        }
    } catch (e) { console.error(e); }
}

async function registrarPonto(campo) {
    const fid = $("apontamento-funcionario").value;
    if(!fid) { alert("Selecione um funcionário!"); return; }
    
    const data = hojeISO();
    const hora = agoraHora();
    const obs = $("apontamento-obs").value;

    try {
        const atual = await DB.getApontamento(fid, data);
        if(atual && atual[campo]) throw new Error("Horário já marcado!");
        if(campo === 'saida' && atual && atual.locked) throw new Error("Dia já encerrado.");

        // Monta objeto
        const payload = { funcionario_id: fid, data };
        if (atual) {
            // Se já tem dados, preserva
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

    } catch (e) {
        alert("Atenção: " + e.message);
    }
}

/* =========================================
   STARTUP
   ========================================= */
window.addEventListener("load", () => {
    // Binds
    $("btnLogin").onclick = tentarLogin;
    document.querySelector(".btn-sair").onclick = fazerLogout;
    document.querySelectorAll(".sidebar li").forEach(li => {
        li.onclick = () => navegar(li.dataset.target);
    });

    // Binds Apontamento
    $("btnApEntrada").onclick = () => registrarPonto("entrada");
    $("btnApIntIni").onclick = () => registrarPonto("int_inicio");
    $("btnApIntFim").onclick = () => registrarPonto("int_fim");
    $("btnApSaida").onclick = () => registrarPonto("saida");
    $("apontamento-funcionario").onchange = carregarApontamentoDoDia;

    // Modais e CRUD
    const modalUser = $("modal-usuario");
    const modalFunc = $("modal-funcionario");
    document.querySelectorAll(".close-modal").forEach(span => {
        span.onclick = () => { modalUser.style.display="none"; modalFunc.style.display="none"; };
    });

    $("btnNovoUsuario").onclick = () => {
        $("usuario_id_edit").value = ""; $("user_nome").value = "";
        modalUser.style.display = "block";
    };
    $("btnNovoFuncionario").onclick = () => {
        $("func_id_edit").value = ""; $("func_nome").value = "";
        modalFunc.style.display = "block";
    };

    $("btnSalvarUsuario").onclick = async () => {
        try {
            const id = $("usuario_id_edit").value;
            const nome = $("user_nome").value;
            const login = $("user_login").value;
            const senha = $("user_senha").value;
            const perfil = $("user_perfil").value;
            if(!nome || !login) throw new Error("Preencha nome e login");
            
            await DB.salvarUsuario({id:id||null, nome, login, senha, perfil, ativo:true});
            modalUser.style.display = "none";
            carregarListaUsuarios();
            alert("Salvo!");
        } catch(e) { alert(e.message); }
    };

    $("btnSalvarFuncionario").onclick = async () => {
        try {
            const id = $("func_id_edit").value;
            const nome = $("func_nome").value;
            const cpf = $("func_cpf").value;
            const funcao = $("func_funcao").value;
            if(!nome) throw new Error("Nome obrigatório");

            await DB.salvarFuncionario({id:id||null, nome, cpf, funcao, ativo:true});
            modalFunc.style.display = "none";
            carregarListaFuncionarios();
            alert("Salvo!");
        } catch(e) { alert(e.message); }
    };

    // Auto Login (Recuperar Sessão)
    const saved = localStorage.getItem("triboom_last_user");
    if(saved) {
        STATE.user = JSON.parse(saved);
        $("tela-login").style.display = "none";
        $("tela-dashboard").style.display = "flex";
        $("display-nome-usuario").textContent = STATE.user.nome;
        navegar("dashboard");
    }
});