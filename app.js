/* ==========================================================================
   CONFIGURAÇÃO SUPABASE
   ========================================================================== */
const SUPABASE_URL = 'https://vtrrwwjjcisimtputcbi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_eIS0IVC7POg_K9mcV6pQMQ_OO9BgxW4';
const _db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (id) => document.getElementById(id);
const toast = (msg) => alert(msg);
const money = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/* ==========================================================================
   ESTADO GLOBAL
   ========================================================================== */
let state = {
    user: null,
    produtos: [],
    financeiro: [],
    notas: [],
    usuarios: [],
    grupos: [],
    route: 'dashboard',
    tipoFinanceiro: 'Despesa',
    itemManualNota: [],
    produtoContagem: null
};

/* ==========================================================================
   BACKEND (CONEXÃO SUPABASE)
   ========================================================================== */
const Backend = {
    // LOGIN
    async login(u, s) {
        const { data } = await _db.from('usuarios').select('*').eq('usuario', u).eq('senha', s).maybeSingle();
        return data;
    },

    // PRODUTOS
    async getProdutos() {
        const { data } = await _db.from('produtos').select('*').order('nome');
        state.produtos = data || [];
        return state.produtos;
    },
    async salvarProduto(p) {
        if (p.id) return await _db.from('produtos').update(p).eq('id', p.id);
        return await _db.from('produtos').insert([p]);
    },
    async excluirProduto(id) {
        return await _db.from('produtos').delete().eq('id', id);
    },

    // FINANCEIRO
    async getFinanceiro() {
        const { data } = await _db.from('financeiro').select('*').order('data_vencimento', { ascending: false });
        state.financeiro = data || [];
        return state.financeiro;
    },
    async salvarFinanceiro(dados) {
        return await _db.from('financeiro').insert(dados);
    },
    async excluirFinanceiro(id) {
        return await _db.from('financeiro').delete().eq('id', id);
    },

    // NOTAS
    async getNotas() {
        const { data } = await _db.from('notas_entrada').select('*').order('data', { ascending: false });
        state.notas = data || [];
        return state.notas;
    },
    async salvarNota(nota) {
        return await _db.from('notas_entrada').insert([nota]);
    },
    async excluirNota(id) {
        return await _db.from('notas_entrada').delete().eq('id', id);
    },

    // USUARIOS
    async getUsuarios() {
        const { data } = await _db.from('usuarios').select('*');
        state.usuarios = data || [];
        return state.usuarios;
    },
    async salvarUsuario(u) {
        if(u.id) return await _db.from('usuarios').update(u).eq('id', u.id);
        return await _db.from('usuarios').insert([u]);
    },
    async excluirUsuario(id) {
        return await _db.from('usuarios').delete().eq('id', id);
    },

    // CONFIG / GRUPOS
    async getGrupos() {
        const { data } = await _db.from('ajustes').select('config_json').limit(1).maybeSingle();
        state.grupos = data?.config_json?.grupos || [];
        return state.grupos;
    },
    async saveGrupos(grupos) {
        const { data } = await _db.from('ajustes').select('id').limit(1).maybeSingle();
        if(data) await _db.from('ajustes').update({config_json: {grupos}}).eq('id', data.id);
        else await _db.from('ajustes').insert([{config_json: {grupos}}]);
    }
};

/* ==========================================================================
   INTERFACE & NAVEGAÇÃO
   ========================================================================== */
async function navegar(modulo) {
    state.route = modulo;
    $('titulo-secao').innerText = modulo.toUpperCase().replace('_', ' ');

    document.querySelectorAll('.sidebar li').forEach(li => li.classList.remove('ativo'));
    const activeLi = document.querySelector(`[data-route="${modulo}"]`);
    if (activeLi) activeLi.classList.add('ativo');

    ['view-padrao', 'view-usuarios', 'view-produtos', 'view-configuracoes', 'view-notas-entrada', 'view-financeiro'].forEach(v => $(v).style.display = 'none');
    
    if(modulo === 'produtos') {
        $('view-produtos').style.display = 'block';
        renderProdutos(await Backend.getProdutos());
        updateGrupoSelects();
    } else if(modulo === 'financeiro') {
        $('view-financeiro').style.display = 'block';
        renderFinanceiro(await Backend.getFinanceiro());
    } else if(modulo === 'usuarios') {
        $('view-usuarios').style.display = 'block';
        renderUsuarios(await Backend.getUsuarios());
    } else if(modulo === 'notas_entrada') {
        $('view-notas-entrada').style.display = 'block';
        renderNotas(await Backend.getNotas());
    } else if(modulo === 'configuracoes') {
        $('view-configuracoes').style.display = 'block';
        renderGrupos(await Backend.getGrupos());
    } else {
        $('view-padrao').style.display = 'block';
    }
}

// --- RENDERS ---
function renderProdutos(lista) {
    const termo = $('barra-pesquisa').value.toLowerCase();
    const grp = $('filtro-grupo').value;
    const filtrado = lista.filter(p => (p.nome.toLowerCase().includes(termo) || String(p.codigo).includes(termo)) && (grp === "" || p.grupo === grp));
    
    let totalQtd = 0, totalValor = 0;
    $('tabela-produtos-corpo').innerHTML = filtrado.map(p => {
        totalQtd += p.qtd; totalValor += (p.qtd * p.preco);
        return `<tr>
            <td><b>${p.codigo}</b></td><td>${p.nome}</td><td>${p.grupo}</td><td>${p.qtd}</td>
            <td style="color:#27ae60"><b>${money(p.preco)}</b></td>
            <td>
                <span class="material-icons" onclick="editarProd('${p.id}')" style="cursor:pointer">edit</span>
                <span class="material-icons" style="color:red; cursor:pointer" onclick="delProd('${p.id}')">delete</span>
            </td>
        </tr>`;
    }).join('');
    $('resumo-qtd').innerText = totalQtd; $('resumo-valor').innerText = money(totalValor);
}

function renderFinanceiro(lista) {
    const termo = $('barra-pesquisa-financeiro').value.toLowerCase();
    const filtrado = lista.filter(i => i.descricao.toLowerCase().includes(termo) || i.fornecedor?.toLowerCase().includes(termo));
    
    let rec = 0, desp = 0;
    $('tabela-financeiro-corpo').innerHTML = filtrado.map(i => {
        const val = parseFloat(i.valor);
        i.tipo === 'Receita' ? rec += val : desp += val;
        const cor = i.tipo === 'Receita' ? '#27ae60' : '#e74c3c';
        return `<tr>
            <td>${new Date(i.data_vencimento).toLocaleDateString()}</td>
            <td>${i.descricao}<br><small>${i.fornecedor || ''}</small></td>
            <td><span style="color:${cor}">${i.tipo}</span></td>
            <td style="color:${cor}"><b>${money(val)}</b></td>
            <td>${i.status}</td>
            <td><span class="material-icons" style="color:red; cursor:pointer" onclick="delFin('${i.id}')">delete</span></td>
        </tr>`;
    }).join('');
    $('fin-total-receitas').innerText = money(rec);
    $('fin-total-despesas').innerText = money(desp);
    $('fin-saldo').innerText = money(rec - desp);
}

function renderNotas(lista) {
    $('tabela-notas-corpo').innerHTML = lista.map(n => `<tr>
        <td>${new Date(n.data).toLocaleDateString()}</td><td>${n.numero}</td><td>${n.fornecedor}</td>
        <td>${n.qtd_itens || 0}</td><td style="color:#27ae60"><b>${money(n.valor)}</b></td>
        <td><small>${n.tipo}</small></td>
        <td><span class="material-icons" style="color:red; cursor:pointer" onclick="delNota('${n.id}')">delete</span></td>
    </tr>`).join('');
}

function renderUsuarios(lista) {
    $('tabela-usuarios-corpo').innerHTML = lista.map(u => `<tr>
        <td>${u.nome}</td><td>${u.usuario}</td><td>${u.perfil}</td>
        <td>
            <span class="material-icons" onclick="editUser('${u.id}')" style="cursor:pointer">edit</span>
            <span class="material-icons" style="color:red; cursor:pointer" onclick="delUser('${u.id}')">delete</span>
        </td>
    </tr>`).join('');
}

function renderGrupos(lista) {
    $('tabela-config-grupos').innerHTML = lista.map(g => `<tr><td>${g}</td><td><span class="material-icons" style="color:red; cursor:pointer" onclick="delGrupo('${g}')">delete</span></td></tr>`).join('');
}

/* ==========================================================================
   MODAIS E ACTIONS
   ========================================================================== */
function closeModal(id) { $(id).style.display = 'none'; }
window.onclick = (e) => { if(e.target.classList.contains('modal')) e.target.style.display = 'none'; };

// --- PRODUTOS ---
$('btnAbrirNovoProduto').onclick = () => {
    $('form-produto').reset(); $('is_edit').value = 'false'; $('prod_id_edit').value = '';
    $('modal-produto').style.display = 'block';
};
window.editarProd = (id) => {
    const p = state.produtos.find(x => x.id === id);
    if(!p) return;
    $('is_edit').value = 'true'; $('prod_id_edit').value = p.id;
    $('prod_codigo').value = p.codigo; $('prod_nome').value = p.nome;
    $('prod_grupo').value = p.grupo; $('prod_qtd').value = p.qtd; $('prod_preco').value = p.preco;
    $('modal-produto').style.display = 'block';
};
$('btn-salvar-prod').onclick = async (e) => {
    e.preventDefault();
    const p = {
        id: $('prod_id_edit').value || undefined, codigo: $('prod_codigo').value, nome: $('prod_nome').value,
        grupo: $('prod_grupo').value, qtd: parseFloat($('prod_qtd').value), preco: parseFloat($('prod_preco').value)
    };
    await Backend.salvarProduto(p);
    closeModal('modal-produto'); navegar('produtos');
};
window.delProd = async (id) => { if(confirm('Excluir?')) { await Backend.excluirProduto(id); navegar('produtos'); } };

// --- FINANCEIRO ---
$('btnNovaDespesa').onclick = () => { $('form-financeiro-manual').reset(); $('modal-nova-despesa').style.display = 'block'; };
$('opt-despesa').onclick = () => { state.tipoFinanceiro='Despesa'; $('opt-despesa').classList.add('selected'); $('opt-receita').classList.remove('selected'); };
$('opt-receita').onclick = () => { state.tipoFinanceiro='Receita'; $('opt-receita').classList.add('selected'); $('opt-despesa').classList.remove('selected'); };
$('btn-salvar-fin-manual').onclick = async (e) => {
    e.preventDefault();
    const dados = {
        tipo: state.tipoFinanceiro, valor: parseFloat($('fin_man_valor').value), descricao: $('fin_man_descricao').value,
        fornecedor: $('fin_man_fornecedor').value, data_emissao: $('fin_man_emissao').value,
        data_vencimento: $('fin_man_vencimento').value, status: $('fin_man_status').value
    };
    // Se parcelado, cria loop. Simplificado aqui para 1 registro:
    await Backend.salvarFinanceiro(dados);
    closeModal('modal-nova-despesa'); navegar('financeiro');
};
window.delFin = async (id) => { if(confirm('Excluir?')) { await Backend.excluirFinanceiro(id); navegar('financeiro'); } };

// --- XML IMPORT ---
$('btnImportarXML').onclick = () => { $('file-xml').value = ''; $('modal-importar-xml').style.display = 'block'; };
$('btn-processar-xml').onclick = () => {
    const file = $('file-xml').files[0];
    if(!file) return alert('Selecione um arquivo');
    const reader = new FileReader();
    reader.onload = async (e) => {
        const parser = new DOMParser();
        const xml = parser.parseFromString(e.target.result, "text/xml");
        const nNF = xml.getElementsByTagName("nNF")[0]?.textContent;
        const xNome = xml.getElementsByTagName("xNome")[0]?.textContent;
        const vNF = xml.getElementsByTagName("vNF")[0]?.textContent;
        
        if(nNF) {
            await Backend.salvarNota({ numero: nNF, fornecedor: xNome, valor: parseFloat(vNF), tipo: 'XML Importado', data: new Date() });
            alert(`Nota ${nNF} importada!`);
            closeModal('modal-importar-xml'); navegar('notas_entrada');
        } else alert('XML inválido');
    };
    reader.readAsText(file);
};

// --- PDF ---
$('btnPDFProdutos').onclick = () => html2pdf().from($('tabela-produtos-corpo').parentElement).save('estoque.pdf');
$('btnPDFFinanceiro').onclick = () => html2pdf().from($('tabela-financeiro-corpo').parentElement).save('financeiro.pdf');

// --- USUARIOS ---
$('btnNovoUsuario').onclick = () => { $('form-usuario').reset(); $('usuario_id_edit').value=''; $('modal-usuario').style.display='block'; };
$('btn-salvar-usuario').onclick = async (e) => {
    e.preventDefault();
    const u = { id: $('usuario_id_edit').value || undefined, nome: $('user_nome').value, usuario: $('user_login').value, senha: $('user_senha').value, perfil: $('user_perfil').value };
    await Backend.salvarUsuario(u); closeModal('modal-usuario'); navegar('usuarios');
};
window.delUser = async (id) => { if(confirm('Excluir?')) { await Backend.excluirUsuario(id); navegar('usuarios'); } };
window.editUser = (id) => {
    const u = state.usuarios.find(x => x.id === id);
    if(!u) return;
    $('usuario_id_edit').value = u.id; $('user_nome').value = u.nome; $('user_login').value = u.usuario; $('user_senha').value = u.senha; $('user_perfil').value = u.perfil;
    $('modal-usuario').style.display = 'block';
};

// --- CONFIG ---
$('btnAddGrupo').onclick = async () => {
    const g = $('novo-grupo-nome').value;
    if(g && !state.grupos.includes(g)) { state.grupos.push(g); await Backend.saveGrupos(state.grupos); navegar('configuracoes'); }
};
window.delGrupo = async (g) => {
    state.grupos = state.grupos.filter(x => x !== g); await Backend.saveGrupos(state.grupos); navegar('configuracoes');
};
async function updateGrupoSelects() {
    const grps = await Backend.getGrupos();
    const opts = grps.map(g => `<option value="${g}">${g}</option>`).join('');
    $('prod_grupo').innerHTML = '<option value="">Selecione...</option>' + opts;
    $('filtro-grupo').innerHTML = '<option value="">Todos</option>' + opts;
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    // Verificar login
    const sess = localStorage.getItem('sess_gestao');
    if(sess) { state.user = JSON.parse(sess); initApp(); }

    $('btnLogin').onclick = async () => {
        const u = await Backend.login($('usuario').value, $('senha').value);
        if(u) { state.user = u; localStorage.setItem('sess_gestao', JSON.stringify(u)); initApp(); }
        else $('msg-erro').innerText = 'Erro login';
    };

    $('btnSair').onclick = () => { localStorage.removeItem('sess_gestao'); location.reload(); };

    // Fechar modais
    document.querySelectorAll('.close').forEach(b => b.onclick = function() { this.closest('.modal').style.display='none'; });

    // Navegação Sidebar
    document.querySelectorAll('.sidebar li').forEach(li => li.onclick = () => navegar(li.dataset.route));
    
    // Pesquisas
    $('barra-pesquisa').onkeyup = () => renderProdutos(state.produtos);
    $('barra-pesquisa-financeiro').onkeyup = () => renderFinanceiro(state.financeiro);
});

function initApp() {
    $('tela-login').style.display = 'none';
    $('tela-dashboard').style.display = 'flex';
    $('display-nome-usuario').innerText = state.user.nome;
    navegar('dashboard');
}