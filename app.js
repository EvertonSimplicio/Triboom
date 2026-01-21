/* ==========================================================================
   CONFIGURAÇÃO SUPABASE
   ========================================================================== */
// OBS: As variáveis SUPABASE_URL e SUPABASE_KEY vêm do arquivo config.js

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
    fornecedores: [],
    funcionarios: [],
    route: 'dashboard',
    tipoFinanceiro: 'Despesa',
    
    // Auxiliares
    itensNotaManual: [], 
    produtoContagemSelecionado: null,
    itensContagem: [] 
};

/* ==========================================================================
   BACKEND
   ========================================================================== */
const Backend = {
    async login(u, s) {
        const { data } = await _db.from('usuarios').select('*').eq('usuario', u).eq('senha', s).maybeSingle();
        return data;
    },
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
    async atualizarEstoqueBatch(itens) {
        for (const item of itens) {
            await _db.from('produtos').update({ qtd: item.novaQtd }).eq('id', item.id);
        }
        return true;
    },
    async processarEntradaEstoque(itens) {
        for (const item of itens) {
            const { data: existente } = await _db.from('produtos').select('*').eq('codigo', item.codigo).maybeSingle();
            if (existente) {
                const novaQtd = Number(existente.qtd) + Number(item.qtd);
                await _db.from('produtos').update({ qtd: novaQtd, preco: item.preco }).eq('id', existente.id);
            } else {
                await _db.from('produtos').insert([{
                    codigo: item.codigo, nome: item.nome, grupo: 'Geral',
                    qtd: Number(item.qtd), preco: Number(item.preco)
                }]);
            }
        }
    },
    async getFinanceiro() {
        const { data } = await _db.from('financeiro').select('*').order('data_vencimento', { ascending: false });
        state.financeiro = data || [];
        return state.financeiro;
    },
    async salvarFinanceiro(dados) {
        if(dados.id) return await _db.from('financeiro').update(dados).eq('id', dados.id);
        return await _db.from('financeiro').insert(dados);
    },
    async salvarFinanceiroLote(listaDados) {
        // Salva múltiplas linhas de uma vez (para parcelas)
        return await _db.from('financeiro').insert(listaDados);
    },
    async excluirFinanceiro(id) {
        return await _db.from('financeiro').delete().eq('id', id);
    },
    async baixarLote(ids) {
        const { error } = await _db.from('financeiro').update({ status: 'Pago' }).in('id', ids);
        if(error) throw error;
        return true;
    },
    async getNotas() {
        const { data, error } = await _db.from('notas_entrada').select('*').order('created_at', { ascending: false });
        if(error) console.error("Erro notas:", error);
        state.notas = data || [];
        return state.notas;
    },
    async salvarNota(nota) {
        if(nota.id) return await _db.from('notas_entrada').update(nota).eq('id', nota.id).select();
        return await _db.from('notas_entrada').insert([nota]).select();
    },
    async excluirNota(id) {
        return await _db.from('notas_entrada').delete().eq('id', id);
    },
    async getUsuarios() {
        const { data } = await _db.from('usuarios').select('*');
        state.usuarios = data || [];
        return state.usuarios;
    },
    async salvarUsuario(u) {
        try {
            // Normaliza e valida campos
            const u2 = {
                ...u,
                nome: (u.nome || '').trim(),
                usuario: (u.usuario || '').trim(),
                senha: (u.senha || '').toString(),
                perfil: (u.perfil || 'Usuario').trim()
            };
            if(!u2.nome || !u2.usuario || !u2.senha) {
                throw new Error('Preencha Nome, Login e Senha.');
            }

            const resp = u2.id
                ? await _db.from('usuarios').update(u2).eq('id', u2.id)
                : await _db.from('usuarios').insert([u2]);

            if(resp.error) throw resp.error;
            return resp.data;
        } catch(err) {
            // Repassa para o caller mostrar mensagem
            throw err;
        }
    },
    async excluirUsuario(id) {
        const resp = await _db.from('usuarios').delete().eq('id', id);
        if(resp.error) throw resp.error;
        return resp.data;
    },
    async getGrupos() {
        const { data } = await _db.from('ajustes').select('config_json').limit(1).maybeSingle();
        state.grupos = data?.config_json?.grupos || [];
        return state.grupos;
    },
    async saveGrupos(grupos) {
        const { data } = await _db.from('ajustes').select('id').limit(1).maybeSingle();
        if(data) await _db.from('ajustes').update({config_json: {grupos}}).eq('id', data.id);
        else await _db.from('ajustes').insert([{config_json: {grupos}}]);
    },
    // --- FORNECEDORES ---
    async getFornecedores(includeInativos = false) {
        let q = _db.from('fornecedores').select('*').order('nome');
        if(!includeInativos) q = q.eq('ativo', true);
        const { data, error } = await q;
        if(error) console.error("Erro fornecedores:", error);
        state.fornecedores = data || [];
        return state.fornecedores;
    },
    async salvarFornecedor(f) {
        if (f.id) return await _db.from('fornecedores').update(f).eq('id', f.id);
        return await _db.from('fornecedores').insert([f]);
    },
    async excluirFornecedor(id) {
        return await _db.from('fornecedores').delete().eq('id', id);
    },

    // --- FUNCIONÁRIOS ---
    async getFuncionarios(includeInativos = false) {
        let q = _db.from('funcionarios').select('*').order('nome');
        if(!includeInativos) q = q.eq('ativo', true);
        const { data, error } = await q;
        if(error) console.error("Erro funcionarios:", error);
        state.funcionarios = data || [];
        return state.funcionarios;
    },
    async salvarFuncionario(f) {
        if (f.id) return await _db.from('funcionarios').update(f).eq('id', f.id);
        return await _db.from('funcionarios').insert([f]);
    },
    async excluirFuncionario(id) {
        return await _db.from('funcionarios').delete().eq('id', id);
    },

};

/* ==========================================================================
   NAVEGAÇÃO
   ========================================================================== */
async function navegar(modulo) {
    state.route = modulo;
    $('titulo-secao').innerText = modulo.toUpperCase().replace('_', ' ');

    document.querySelectorAll('.sidebar li').forEach(li => li.classList.remove('ativo'));
    const activeLi = document.querySelector(`[data-route="${modulo}"]`);
    if (activeLi) activeLi.classList.add('ativo');

    ['view-padrao','view-produtos','view-notas-entrada','view-financeiro','view-relatorios','view-funcionarios','view-fornecedores','view-usuarios','view-configuracoes'].forEach(v => $(v).style.display = 'none');
    
    if(modulo === 'produtos') {
        $('view-produtos').style.display = 'block';
        renderProdutos(await Backend.getProdutos());
        updateGrupoSelects();
    } else if(modulo === 'financeiro') {
        $('view-financeiro').style.display = 'block';
        injetarControlesFinanceiros();
        await Backend.getFornecedores(false);
        atualizarSelectFornecedores();
        renderFinanceiro(await Backend.getFinanceiro());
    } else if(modulo === 'relatorios') {
        $('view-relatorios').style.display = 'block';
        await prepararRelatorios();
        renderRelatorios();
    } else if(modulo === 'funcionarios') {
        $('view-funcionarios').style.display = 'block';
        renderFuncionarios(await Backend.getFuncionarios(true));
    } else if(modulo === 'fornecedores') {
        $('view-fornecedores').style.display = 'block';
        await Backend.getFornecedores(true);
        renderFornecedores(state.fornecedores);
        atualizarSelectFornecedores();
    } else if(modulo === 'usuarios') {
        $('view-usuarios').style.display = 'block';
        renderUsuarios(await Backend.getUsuarios());
    } else if(modulo === 'notas_entrada') {
        $('view-notas-entrada').style.display = 'block';
        if(state.produtos.length === 0) await Backend.getProdutos();
        await Backend.getFornecedores(false);
        atualizarSelectFornecedores();
        renderNotas(await Backend.getNotas());
    } else if(modulo === 'configuracoes') {
        $('view-configuracoes').style.display = 'block';
        renderGrupos(await Backend.getGrupos());
    } else {
        $('view-padrao').style.display = 'block';
    }
}

// ==========================================================================
// RENDERIZAÇÃO
// ==========================================================================
function safeDate(dateStr) {
    if(!dateStr) return "-";
    if(dateStr.length === 10) return new Date(dateStr + 'T00:00:00').toLocaleDateString();
    return new Date(dateStr).toLocaleDateString();
}

function renderNotas(lista) {
    const tbody = $('tabela-notas-corpo');
    if(!tbody) return;
    
    tbody.innerHTML = lista.map(n => `<tr>
        <td>${safeDate(n.data)}</td>
        <td>${n.numero || '-'}</td>
        <td>${n.fornecedor || '-'}</td>
        <td>${n.qtd_itens || 0}</td>
        <td style="color:#27ae60"><b>${money(n.valor)}</b></td>
        <td><small>${n.tipo || 'Manual'}</small></td>
        <td>
            <span class="material-icons" style="cursor:pointer; margin-right:8px;" onclick="editarNota('${n.id}')">edit</span>
            <span class="material-icons" style="color:red; cursor:pointer" onclick="delNota('${n.id}')">delete</span>
        </td>
    </tr>`).join('');
}

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
                <span class="material-icons" onclick="editarProd('${p.id}')" style="cursor:pointer; margin-right:5px;">edit</span>
                <span class="material-icons" style="color:red; cursor:pointer" onclick="delProd('${p.id}')">delete</span>
            </td>
        </tr>`;
    }).join('');
    $('resumo-qtd').innerText = totalQtd; $('resumo-valor').innerText = money(totalValor);
}

function injetarControlesFinanceiros() {
    if(document.getElementById('filtro-status-fin')) return;
    const toolbar = document.querySelector('#view-financeiro .filters');
    if(toolbar) {
        const select = document.createElement('select'); select.id = 'filtro-status-fin';
        select.innerHTML = '<option value="">Todos Status</option><option value="Pendente">Pendente</option><option value="Pago">Pago</option>';
        select.style.padding = '10px'; select.style.borderRadius = '5px'; select.style.border = '1px solid #ddd'; select.style.marginLeft = '10px';
        select.onchange = async () => renderFinanceiro(state.financeiro);
        toolbar.appendChild(select);
    }
    const toolbarBtn = document.querySelector('#view-financeiro .toolbar > div:last-child');
    if(toolbarBtn) {
        const btnBatch = document.createElement('button'); btnBatch.id = 'btn-baixa-lote'; btnBatch.className = 'btn-action';
        btnBatch.innerHTML = '<span class="material-icons">done_all</span> Baixar Selecionados';
        btnBatch.style.backgroundColor = '#27ae60'; btnBatch.style.display = 'none'; btnBatch.onclick = realizarBaixaEmLote;
        toolbarBtn.insertBefore(btnBatch, toolbarBtn.firstChild);
    }
}

function renderFinanceiro(lista) {
    const termo = $('barra-pesquisa-financeiro').value.toLowerCase();
    const statusFiltro = $('filtro-status-fin') ? $('filtro-status-fin').value : "";
    const filtrado = lista.filter(i => {
        const matchTexto = i.descricao.toLowerCase().includes(termo) || i.fornecedor?.toLowerCase().includes(termo);
        const matchStatus = statusFiltro === "" || i.status === statusFiltro;
        return matchTexto && matchStatus;
    });
    let rec = 0, desp = 0;
    const tbody = $('tabela-financeiro-corpo');
    const theadRow = document.querySelector('#view-financeiro thead tr');
    if(theadRow && !theadRow.querySelector('.th-check')) {
        const th = document.createElement('th'); th.className='th-check'; th.width='30px';
        th.innerHTML = '<input type="checkbox" onchange="toggleAllFin(this)">';
        theadRow.insertBefore(th, theadRow.firstChild);
    }
    tbody.innerHTML = filtrado.map(i => {
        const val = parseFloat(i.valor); i.tipo === 'Receita' ? rec += val : desp += val;
        const cor = i.tipo === 'Receita' ? '#27ae60' : '#e74c3c';
        const isPago = i.status === 'Pago';
        return `<tr>
            <td><input type="checkbox" class="check-fin" value="${i.id}" onchange="checkFinChanged()"></td>
            <td>${safeDate(i.data_vencimento)}</td>
            <td>${i.descricao}<br><small>${i.fornecedor || ''}</small></td>
            <td><span style="color:${cor}">${i.tipo}</span></td>
            <td style="color:${cor}"><b>${money(val)}</b></td>
            <td><span style="padding:4px 8px; border-radius:4px; background:${isPago ? '#dff9fb':'#ffeaa7'}; color:${isPago ? '#2c3e50':'#d35400'}; font-size:12px;">${i.status}</span></td>
            <td><span class="material-icons" style="cursor:pointer; margin-right:5px; color:#666;" onclick="editarFin('${i.id}')">edit</span><span class="material-icons" style="color:red; cursor:pointer" onclick="delFin('${i.id}')">delete</span></td>
        </tr>`;
    }).join('');
    $('fin-total-receitas').innerText = money(rec); $('fin-total-despesas').innerText = money(desp); $('fin-saldo').innerText = money(rec - desp);
    checkFinChanged();
}
window.toggleAllFin = (source) => { document.querySelectorAll('.check-fin').forEach(c => c.checked = source.checked); checkFinChanged(); };
window.checkFinChanged = () => { const selecionados = document.querySelectorAll('.check-fin:checked').length; const btn = $('btn-baixa-lote'); if(btn) btn.style.display = selecionados > 0 ? 'flex' : 'none'; };
async function realizarBaixaEmLote() {
    const ids = Array.from(document.querySelectorAll('.check-fin:checked')).map(c => c.value); if(ids.length === 0) return;
    if(!confirm(`Deseja marcar ${ids.length} itens como PAGO?`)) return;
    try { await Backend.baixarLote(ids); alert('Baixa realizada com sucesso!'); renderFinanceiro(await Backend.getFinanceiro()); } catch(e) { alert('Erro: ' + e.message); }
}
function renderUsuarios(lista) {
    $('tabela-usuarios-corpo').innerHTML = lista.map(u => `<tr><td>${u.nome}</td><td>${u.usuario}</td><td>${u.perfil}</td><td><span class="material-icons" onclick="editUser('${u.id}')" style="cursor:pointer">edit</span><span class="material-icons" style="color:red; cursor:pointer" onclick="delUser('${u.id}')">delete</span></td></tr>`).join('');
}
function renderGrupos(lista) { $('tabela-config-grupos').innerHTML = lista.map(g => `<tr><td>${g}</td><td><span class="material-icons" style="color:red; cursor:pointer" onclick="delGrupo('${g}')">delete</span></td></tr>`).join(''); }

/* ==========================================================================
   MODAIS E ACTIONS
   ========================================================================== */

/* ==========================================================================
   FORNECEDORES (SELECTS) + FUNCIONÁRIOS + FORNECEDORES (CRUD)
   ========================================================================== */
function _norm(s){ return (s||'').toString().trim().toLowerCase(); }
function _esc(s){ return (s||'').toString().replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

function atualizarSelectFornecedores() {
    const ativos = (state.fornecedores || []).filter(f => f.ativo !== false);
    const opts = ativos.map(f => `<option value="${_esc(f.nome)}">${_esc(f.nome)}</option>`).join('');
    ['nota_fornecedor','fin_man_fornecedor'].forEach(id => {
        const sel = $(id);
        if(!sel) return;
        const atual = sel.value;
        sel.innerHTML = `<option value="">Selecione...</option>` + opts;
        if(atual) {
            const existe = Array.from(sel.options).some(o => _norm(o.value) === _norm(atual));
            if(existe) sel.value = atual;
            else sel.insertAdjacentHTML('afterbegin', `<option value="${_esc(atual)}" selected>(Antigo) ${_esc(atual)}</option>`);
        }
    });

    // filtro de fornecedor no relatório
    const rf = $('rel_fornecedor');
    if(rf) {
        const atual = rf.value;
        rf.innerHTML = `<option value="">Todos Fornecedores</option>` + opts;
        if(atual) {
            const existe = Array.from(rf.options).some(o => _norm(o.value) === _norm(atual));
            if(existe) rf.value = atual;
            else rf.insertAdjacentHTML('afterbegin', `<option value="${_esc(atual)}" selected>(Antigo) ${_esc(atual)}</option>`);
        }
    }
}

function abrirModalFornecedor(f = null) {
    $('forn_id').value = f?.id || '';
    $('forn_nome').value = f?.nome || '';
    $('forn_cnpj').value = f?.cnpj_cpf || '';
    $('forn_telefone').value = f?.telefone || '';
    $('forn_email').value = f?.email || '';
    $('forn_endereco').value = f?.endereco || '';
    $('forn_cidade').value = f?.cidade || '';
    $('forn_uf').value = f?.uf || '';
    $('forn_obs').value = f?.observacoes || '';
    $('forn_ativo').value = (f?.ativo === false) ? 'false' : 'true';
    $('modal-fornecedor').style.display = 'block';
    setTimeout(() => $('forn_nome').focus(), 80);
}
function abrirModalFuncionario(f = null) {
    $('func_id').value = f?.id || '';
    $('func_nome').value = f?.nome || '';
    $('func_cargo').value = f?.cargo || '';
    $('func_telefone').value = f?.telefone || '';
    $('func_email').value = f?.email || '';
    $('func_salario').value = (f?.salario ?? '');
    $('func_admissao').value = f?.data_admissao || '';
    $('func_obs').value = f?.observacoes || '';
    $('func_ativo').value = (f?.ativo === false) ? 'false' : 'true';
    $('modal-funcionario').style.display = 'block';
    setTimeout(() => $('func_nome').focus(), 80);
}

function renderFornecedores(lista) {
    const termo = _norm($('busca-fornecedores')?.value);
    const filtroAtivo = $('filtro-fornecedores-ativo')?.value;
    let arr = (lista || state.fornecedores || []).slice();

    if(termo) arr = arr.filter(f => _norm(f.nome).includes(termo) || _norm(f.cnpj_cpf).includes(termo) || _norm(f.telefone).includes(termo));
    if(filtroAtivo === 'true') arr = arr.filter(f => f.ativo !== false);
    if(filtroAtivo === 'false') arr = arr.filter(f => f.ativo === false);

    $('tabela-fornecedores-corpo').innerHTML = arr.map(f => `
        <tr>
            <td><b>${_esc(f.nome)}</b></td>
            <td>${_esc(f.cnpj_cpf || '')}</td>
            <td>${_esc((f.telefone||'') + (f.email ? ' / ' + f.email : ''))}</td>
            <td>
                <span class="tag ${f.ativo === false ? 'pendente' : 'pago'}" style="cursor:pointer" onclick="toggleFornecedor('${f.id}')">
                    ${f.ativo === false ? 'Inativo' : 'Ativo'}
                </span>
            </td>
            <td>
                <span class="material-icons action-btn edit" onclick="editarFornecedor('${f.id}')">edit</span>
                <span class="material-icons action-btn delete" onclick="excluirFornecedor('${f.id}')">delete</span>
            </td>
        </tr>
    `).join('') || `<tr><td colspan="5" style="text-align:center;color:#999">Nenhum fornecedor</td></tr>`;
}

function renderFuncionarios(lista) {
    const termo = _norm($('busca-funcionarios')?.value);
    const filtroAtivo = $('filtro-funcionarios-ativo')?.value;
    let arr = (lista || state.funcionarios || []).slice();

    if(termo) arr = arr.filter(f => _norm(f.nome).includes(termo) || _norm(f.cargo).includes(termo) || _norm(f.telefone).includes(termo));
    if(filtroAtivo === 'true') arr = arr.filter(f => f.ativo !== false);
    if(filtroAtivo === 'false') arr = arr.filter(f => f.ativo === false);

    $('tabela-funcionarios-corpo').innerHTML = arr.map(f => `
        <tr>
            <td><b>${_esc(f.nome)}</b></td>
            <td>${_esc(f.cargo || '')}</td>
            <td>${_esc((f.telefone||'') + (f.email ? ' / ' + f.email : ''))}</td>
            <td>
                <span class="tag ${f.ativo === false ? 'pendente' : 'pago'}" style="cursor:pointer" onclick="toggleFuncionario('${f.id}')">
                    ${f.ativo === false ? 'Inativo' : 'Ativo'}
                </span>
            </td>
            <td>
                <span class="material-icons action-btn edit" onclick="editarFuncionario('${f.id}')">edit</span>
                <span class="material-icons action-btn delete" onclick="excluirFuncionario('${f.id}')">delete</span>
            </td>
        </tr>
    `).join('') || `<tr><td colspan="5" style="text-align:center;color:#999">Nenhum funcionário</td></tr>`;
}

window.editarFornecedor = (id) => { const f = (state.fornecedores||[]).find(x => x.id == id); abrirModalFornecedor(f); };
window.editarFuncionario = (id) => { const f = (state.funcionarios||[]).find(x => x.id == id); abrirModalFuncionario(f); };

window.toggleFornecedor = async (id) => {
    const f = (state.fornecedores||[]).find(x => x.id == id);
    if(!f) return;
    await Backend.salvarFornecedor({ id, ativo: !(f.ativo !== false) ? true : false });
    await Backend.getFornecedores(true);
    renderFornecedores(state.fornecedores);
    atualizarSelectFornecedores();
};
window.toggleFuncionario = async (id) => {
    const f = (state.funcionarios||[]).find(x => x.id == id);
    if(!f) return;
    await Backend.salvarFuncionario({ id, ativo: !(f.ativo !== false) ? true : false });
    state.funcionarios = await Backend.getFuncionarios(true);
    renderFuncionarios(state.funcionarios);
};

window.excluirFornecedor = async (id) => {
    if(!confirm('Excluir este fornecedor?')) return;
    await Backend.excluirFornecedor(id);
    await Backend.getFornecedores(true);
    renderFornecedores(state.fornecedores);
    atualizarSelectFornecedores();
};
window.excluirFuncionario = async (id) => {
    if(!confirm('Excluir este funcionário?')) return;
    await Backend.excluirFuncionario(id);
    state.funcionarios = await Backend.getFuncionarios(true);
    renderFuncionarios(state.funcionarios);
};

/* ==========================================================================
   RELATÓRIOS (FILTROS + GRÁFICOS)
   ========================================================================== */
let _chartStatus = null;
let _chartFornecedor = null;

function _toDate(value) {
  if(!value) return null;
  if(typeof value === 'string' && value.length === 10) return new Date(value + 'T00:00:00');
  return new Date(value);
}

async function prepararRelatorios() {
    // carrega dados
    if(state.produtos.length === 0) await Backend.getProdutos();
    if(state.financeiro.length === 0) await Backend.getFinanceiro();
    if(state.notas.length === 0) await Backend.getNotas();
    if(state.fornecedores.length === 0) await Backend.getFornecedores(false);

    // selects mês/ano
    const selMes = $('rel_mes');
    const selAno = $('rel_ano');
    if(selMes && selMes.options.length === 0) {
        const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
        selMes.innerHTML = meses.map((m, idx) => `<option value="${idx+1}">${m}</option>`).join('');
        const anoAtual = new Date().getFullYear();
        const anos = [];
        for(let a = anoAtual - 4; a <= anoAtual + 1; a++) anos.push(a);
        selAno.innerHTML = anos.map(a => `<option value="${a}">${a}</option>`).join('');
        selMes.value = String(new Date().getMonth() + 1);
        selAno.value = String(anoAtual);
    }

    atualizarSelectFornecedores();
}

function _aplicarVisibilidadeRel(tipo) {
    const show = (id, ok) => { const el = $(id); if(el) el.style.display = ok ? 'block' : 'none'; };
    if(tipo === 'resumo') {
        show('rel-bloco-resumo', true);
        show('rel-bloco-estoque-cards', true);
        show('rel-bloco-graficos', true);
        show('rel-bloco-financeiro', false);
        show('rel-bloco-notas', false);
        show('rel-bloco-estoque', false);
    } else if(tipo === 'financeiro') {
        show('rel-bloco-resumo', true);
        show('rel-bloco-estoque-cards', false);
        show('rel-bloco-graficos', true);
        show('rel-bloco-financeiro', true);
        show('rel-bloco-notas', false);
        show('rel-bloco-estoque', false);
    } else if(tipo === 'notas') {
        show('rel-bloco-resumo', false);
        show('rel-bloco-estoque-cards', true);
        show('rel-bloco-graficos', false);
        show('rel-bloco-financeiro', false);
        show('rel-bloco-notas', true);
        show('rel-bloco-estoque', false);
    } else if(tipo === 'estoque') {
        show('rel-bloco-resumo', false);
        show('rel-bloco-estoque-cards', true);
        show('rel-bloco-graficos', false);
        show('rel-bloco-financeiro', false);
        show('rel-bloco-notas', false);
        show('rel-bloco-estoque', true);
    } else { // todos
        show('rel-bloco-resumo', true);
        show('rel-bloco-estoque-cards', true);
        show('rel-bloco-graficos', true);
        show('rel-bloco-financeiro', true);
        show('rel-bloco-notas', true);
        show('rel-bloco-estoque', true);
    }
}

function renderRelatorios() {
    const mes = parseInt($('rel_mes')?.value || (new Date().getMonth() + 1), 10);
    const ano = parseInt($('rel_ano')?.value || new Date().getFullYear(), 10);
    const tipoRel = $('rel_tipo')?.value || 'todos';
    const statusFiltro = $('rel_status')?.value || '';
    const fornecedorFiltro = $('rel_fornecedor')?.value || '';

    _aplicarVisibilidadeRel(tipoRel);

    const inicio = new Date(ano, mes - 1, 1);
    const fim = new Date(ano, mes, 1);

    let finPeriodo = (state.financeiro || []).filter(f => {
        const d = _toDate(f.data_vencimento);
        return d && d >= inicio && d < fim;
    });
    let notasPeriodo = (state.notas || []).filter(n => {
        const d = _toDate(n.data);
        return d && d >= inicio && d < fim;
    });

    if(statusFiltro) finPeriodo = finPeriodo.filter(f => (f.status||'') === statusFiltro);
    if(fornecedorFiltro) {
        finPeriodo = finPeriodo.filter(f => _norm(f.fornecedor) === _norm(fornecedorFiltro));
        notasPeriodo = notasPeriodo.filter(n => _norm(n.fornecedor) === _norm(fornecedorFiltro));
    }

    // Totais financeiro
    let receitas = 0, despesas = 0;
    finPeriodo.forEach(i => {
        const v = parseFloat(i.valor || 0);
        if(i.tipo === 'Receita') receitas += v; else despesas += v;
    });

    // Estoque
    let qtdEstoque = 0, valorEstoque = 0;
    (state.produtos || []).forEach(p => {
        const q = parseFloat(p.qtd || 0);
        const pr = parseFloat(p.preco || 0);
        qtdEstoque += q;
        valorEstoque += (q * pr);
    });

    if($('rel-receitas')) $('rel-receitas').innerText = money(receitas);
    if($('rel-despesas')) $('rel-despesas').innerText = money(despesas);
    if($('rel-saldo')) $('rel-saldo').innerText = money(receitas - despesas);
    if($('rel-estoque-qtd')) $('rel-estoque-qtd').innerText = String(qtdEstoque);
    if($('rel-estoque-valor')) $('rel-estoque-valor').innerText = money(valorEstoque);
    if($('rel-notas')) $('rel-notas').innerText = String(notasPeriodo.length);

    // Tabela financeiro
    const corpoFin = $('rel-financeiro-corpo');
    if(corpoFin) {
        const linhas = finPeriodo
            .sort((a,b) => (_toDate(b.data_vencimento) - _toDate(a.data_vencimento)))
            .slice(0, 300)
            .map(i => {
                const cor = i.tipo === 'Receita' ? '#27ae60' : '#e74c3c';
                return `<tr>
                    <td>${safeDate(i.data_vencimento)}</td>
                    <td>${_esc(i.descricao || '')}<br><small>${_esc(i.fornecedor || '')}</small></td>
                    <td><span style="color:${cor}">${i.tipo}</span></td>
                    <td style="color:${cor}"><b>${money(i.valor)}</b></td>
                    <td>${_esc(i.status || '')}</td>
                </tr>`;
            }).join('');
        corpoFin.innerHTML = linhas || `<tr><td colspan="5" style="text-align:center; color:#999;">Nenhum lançamento no período</td></tr>`;
    }

    // Tabela notas
    const corpoNotas = $('rel-notas-corpo');
    if(corpoNotas) {
        const linhas = notasPeriodo
            .sort((a,b) => (_toDate(b.data) - _toDate(a.data)))
            .slice(0, 300)
            .map(n => `<tr>
                <td>${safeDate(n.data)}</td>
                <td>${_esc(n.numero || '-')}</td>
                <td>${_esc(n.fornecedor || '-')}</td>
                <td>${n.qtd_itens || 0}</td>
                <td style="color:#27ae60"><b>${money(n.valor)}</b></td>
                <td><small>${_esc(n.tipo || 'Manual')}</small></td>
            </tr>`).join('');
        corpoNotas.innerHTML = linhas || `<tr><td colspan="6" style="text-align:center; color:#999;">Nenhuma nota no período</td></tr>`;
    }

    // Baixo estoque
    const corpoBaixo = $('rel-baixo-estoque-corpo');
    if(corpoBaixo) {
        const low = (state.produtos || [])
            .slice()
            .sort((a,b) => parseFloat(a.qtd || 0) - parseFloat(b.qtd || 0))
            .slice(0, 15);
        corpoBaixo.innerHTML = low.map(p => `<tr>
            <td><b>${_esc(p.codigo)}</b></td>
            <td>${_esc(p.nome)}</td>
            <td>${_esc(p.grupo || '-')}</td>
            <td><b>${p.qtd}</b></td>
        </tr>`).join('') || `<tr><td colspan="4" style="text-align:center; color:#999;">Sem produtos</td></tr>`;
    }

    // Gráficos (despesas)
    const despesasPeriodo = finPeriodo.filter(i => i.tipo === 'Despesa');
    const somaStatus = { Pago: 0, Pendente: 0 };
    despesasPeriodo.forEach(i => {
        const st = (i.status === 'Pago') ? 'Pago' : 'Pendente';
        somaStatus[st] += parseFloat(i.valor || 0);
    });

    const porFornecedor = {};
    despesasPeriodo.forEach(i => {
        const k = (i.fornecedor || 'Sem fornecedor').toString();
        porFornecedor[k] = (porFornecedor[k] || 0) + parseFloat(i.valor || 0);
    });
    const top = Object.entries(porFornecedor).sort((a,b) => b[1]-a[1]).slice(0,10);
    const labelsF = top.map(x => x[0]);
    const valuesF = top.map(x => x[1]);

    const ctxS = $('chart-despesas-status');
    if(ctxS) {
        if(_chartStatus) _chartStatus.destroy();
        _chartStatus = new Chart(ctxS, {
            type: 'doughnut',
            data: { labels: ['Pago','Pendente'], datasets: [{ data: [somaStatus.Pago, somaStatus.Pendente] }] },
            options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
        });
    }

    const ctxF = $('chart-despesas-fornecedor');
    if(ctxF) {
        if(_chartFornecedor) _chartFornecedor.destroy();
        _chartFornecedor = new Chart(ctxF, {
            type: 'bar',
            data: { labels: labelsF, datasets: [{ label: 'Despesas', data: valuesF }] },
            options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { maxRotation: 45, minRotation: 0 } } } }
        });
    }
}


function closeModal(id) { $(id).style.display = 'none'; }
window.onclick = (e) => { if(e.target.classList.contains('modal')) e.target.style.display = 'none'; };

// --- PRODUTOS ---
$('btnAbrirNovoProduto').onclick = () => { $('form-produto').reset(); $('is_edit').value = 'false'; $('prod_id_edit').value = ''; $('modal-produto').style.display = 'block'; setTimeout(() => $('prod_codigo').focus(), 100); };
$('prod_codigo').addEventListener('keydown', (e) => { if(e.key === "Enter") { e.preventDefault(); $('prod_nome').focus(); } });
window.editarProd = (id) => {
    const p = state.produtos.find(x => x.id == id); if(!p) return;
    $('is_edit').value = 'true'; $('prod_id_edit').value = p.id;
    $('prod_codigo').value = p.codigo; $('prod_nome').value = p.nome; $('prod_grupo').value = p.grupo; $('prod_qtd').value = p.qtd; $('prod_preco').value = p.preco;
    $('modal-produto').style.display = 'block';
};
$('btn-salvar-prod').onclick = async (e) => {
    e.preventDefault();
    const p = { id: $('prod_id_edit').value || undefined, codigo: $('prod_codigo').value, nome: $('prod_nome').value, grupo: $('prod_grupo').value, qtd: parseFloat($('prod_qtd').value), preco: parseFloat($('prod_preco').value) };
    await Backend.salvarProduto(p); closeModal('modal-produto'); navegar('produtos');
};
window.delProd = async (id) => { if(confirm('Excluir?')) { await Backend.excluirProduto(id); navegar('produtos'); } };

// --- NOTAS DE ENTRADA ---
function injetarBotaoFinanceiroNaNota() {
    const actionsDiv = document.querySelector('#form-nota-manual .actions'); if(!actionsDiv) return;
    if(document.getElementById('btn-lancar-fin-manual-nota')) return;
    const btn = document.createElement('button'); btn.type = 'button'; btn.id = 'btn-lancar-fin-manual-nota'; btn.className = 'btn-action'; btn.style.backgroundColor = '#e67e22'; btn.style.marginLeft = '10px';
    btn.innerHTML = '<span class="material-icons" style="font-size:16px; vertical-align:middle;">attach_money</span> Lançar no Contas a Pagar';
    btn.onclick = () => {
        const idNota = $('nota_id_edicao').value; const fornecedor = $('nota_fornecedor').value; const numero = $('nota_numero').value;
        let valTotal = 0; state.itensNotaManual.forEach(i => valTotal += (i.qtd * i.preco));
    if(!$('nota_fornecedor').value) { alert('Selecione um fornecedor cadastrado.'); btn.disabled = false; btn.innerText = 'Salvar'; return; }
        if(valTotal === 0) return alert("A nota não tem valor.");
        const notaObj = { id: idNota, numero: numero, fornecedor: fornecedor, valor: valTotal, parcelas_xml: null };
        if(idNota) { const notaOriginal = state.notas.find(n => n.id == idNota); if(notaOriginal && notaOriginal.parcelas_xml) { notaObj.parcelas_xml = notaOriginal.parcelas_xml; } }
        closeModal('modal-nota-manual'); preencherFinanceiroComNota(notaObj);
    };
    const btnSalvar = $('btn-salvar-nota'); actionsDiv.insertBefore(btn, btnSalvar);
}

$('btnLancarNotaManual').onclick = () => {
    $('form-nota-manual').reset(); state.itensNotaManual = [];
    $('nota_is_edit').value = 'false'; $('nota_id_edicao').value = '';
    $('titulo-modal-nota').innerText = "Lançamento Manual de Nota";
    renderItensNotaManual(); $('modal-nota-manual').style.display = 'block';
    injetarBotaoFinanceiroNaNota();
};

function renderItensNotaManual() {
    const tbody = $('tabela-itens-nota-manual'); let totalQtd = 0, totalValor = 0;
    if(state.itensNotaManual.length === 0) { tbody.innerHTML = ''; $('msg-sem-itens').style.display = 'block'; } else {
        $('msg-sem-itens').style.display = 'none';
        tbody.innerHTML = state.itensNotaManual.map((item, idx) => {
            totalQtd++; const totItem = Number(item.qtd) * Number(item.preco); totalValor += totItem;
            return `<tr><td>${item.codigo || '-'}</td><td>${item.nome}</td><td>${item.qtd}</td><td>${money(item.preco)}</td><td>${money(totItem)}</td><td><span class="material-icons" style="color:red; cursor:pointer" onclick="removerItemNota(${idx})">delete</span></td></tr>`;
        }).join('');
    }
    $('display-total-qtd').innerText = totalQtd; $('display-total-valor').innerText = money(totalValor);
}
$('btnAddItemNota').onclick = () => {
    const nome = $('input-item-busca').value; const codigo = $('input-item-codigo').value; const qtd = parseFloat($('input-item-qtd').value); const preco = parseFloat($('input-item-preco').value);
    if(!nome || !qtd || !preco) return alert('Preencha os dados do item.');
    state.itensNotaManual.push({ nome, codigo, qtd, preco });
    renderItensNotaManual(); $('input-item-busca').value = ''; $('input-item-codigo').value = ''; $('input-item-qtd').value = ''; $('input-item-preco').value = ''; $('input-item-busca').focus();
};
window.removerItemNota = (idx) => { state.itensNotaManual.splice(idx, 1); renderItensNotaManual(); };
$('input-item-busca').onkeyup = () => {
    const termo = $('input-item-busca').value.toLowerCase(); const lista = $('lista-sugestoes-manual');
    if(termo.length < 2) { lista.style.display = 'none'; return; }
    const encontrados = state.produtos.filter(p => p.nome.toLowerCase().includes(termo));
    if(encontrados.length > 0) { lista.style.display = 'block'; lista.innerHTML = encontrados.map(p => `<li onclick="selecionarItemNota('${p.id}')"><strong>${p.nome}</strong> (R$ ${p.preco})</li>`).join(''); } else lista.style.display = 'none';
};
window.selecionarItemNota = (id) => {
    const p = state.produtos.find(x => x.id == id);
    if(p) { $('input-item-busca').value = p.nome; $('input-item-codigo').value = p.codigo; $('input-item-preco').value = p.preco; $('lista-sugestoes-manual').style.display = 'none'; $('input-item-qtd').focus(); }
};
$('btn-salvar-nota').onclick = async (e) => {
    e.preventDefault(); const btn = $('btn-salvar-nota'); btn.disabled = true; btn.innerText = "Salvando...";
    let valTotal = 0; state.itensNotaManual.forEach(i => valTotal += (i.qtd * i.preco));
    const novaNota = {
        id: $('nota_id_edicao').value || undefined, numero: $('nota_numero').value, data: $('nota_data').value,
        fornecedor: $('nota_fornecedor').value, qtd_itens: state.itensNotaManual.length, valor: valTotal, tipo: 'Manual', itens_json: state.itensNotaManual
    };
    try {
        await Backend.salvarNota(novaNota);
        if(!novaNota.id && state.itensNotaManual.length > 0) {
            try { await Backend.processarEntradaEstoque(state.itensNotaManual); } catch(e) { console.error("Erro estoque", e); }
        }
        closeModal('modal-nota-manual'); 
        alert('Nota salva com sucesso!'); 
        navegar('notas_entrada');
    } catch (err) { alert('Erro ao salvar nota: ' + err.message); }
    btn.disabled = false; btn.innerText = "Salvar Nota Completa";
};
window.editarNota = (id) => {
    const n = state.notas.find(x => x.id == id); if(!n) return;
    $('nota_is_edit').value = 'true'; $('nota_id_edicao').value = n.id; $('titulo-modal-nota').innerText = `Editar Nota ${n.numero}`;
    $('nota_numero').value = n.numero; $('nota_data').value = n.data; $('nota_fornecedor').value = n.fornecedor;
    state.itensNotaManual = n.itens_json || []; renderItensNotaManual(); 
    $('modal-nota-manual').style.display = 'block';
    injetarBotaoFinanceiroNaNota();
};
window.delNota = async (id) => { if(confirm('Excluir?')) { await Backend.excluirNota(id); navegar('notas_entrada'); } };

// --- FINANCEIRO (Criação e Edição) ---
function injetarCamposParcelamento() {
    const form = $('form-financeiro-manual'); if(!form) return;
    if(document.getElementById('check_parcelado')) return;
    const div = document.createElement('div');
    div.innerHTML = `
        <div style="margin:10px 0; padding:10px; background:#f8f9fa; border:1px solid #ddd; border-radius:5px;">
            <label style="display:flex; align-items:center; cursor:pointer; font-weight:bold;">
                <input type="checkbox" id="check_parcelado" style="margin-right:8px;"> Habilitar Parcelamento?
            </label>
            <div id="area-parcelas" style="display:none; margin-top:10px; border-top:1px dashed #ccc; padding-top:10px;">
                <label>Qtd Parcelas:</label>
                <input type="number" id="fin_man_qtd_parc" value="1" min="1" style="width:60px; padding:5px; margin-left:5px;">
                <div id="container-parcelas-geradas" style="margin-top:10px; max-height:200px; overflow-y:auto; display:flex; flex-direction:column; gap:5px;"></div>
            </div>
        </div>
    `;
    const btnSalvar = $('btn-salvar-fin-manual');
    if(btnSalvar) form.insertBefore(div, btnSalvar.parentElement); else form.appendChild(div);
    $('check_parcelado').onchange = () => { const checked = $('check_parcelado').checked; $('area-parcelas').style.display = checked ? 'block' : 'none'; if(checked) gerarParcelasVisuais(); };
    $('fin_man_qtd_parc').onchange = gerarParcelasVisuais;
}

$('btnNovaDespesa').onclick = () => { 
    injetarCamposParcelamento();
    $('form-financeiro-manual').reset(); $('fin_man_id').value = ''; 
    $('container-parcelas-geradas').innerHTML = ''; $('area-parcelas').style.display = 'none';
    $('modal-nova-despesa').style.display = 'block'; 
};
$('opt-despesa').onclick = () => { state.tipoFinanceiro='Despesa'; $('opt-despesa').classList.add('selected'); $('opt-receita').classList.remove('selected'); };
$('opt-receita').onclick = () => { state.tipoFinanceiro='Receita'; $('opt-receita').classList.add('selected'); $('opt-despesa').classList.remove('selected'); };

window.gerarParcelasVisuais = () => {
    const container = $('container-parcelas-geradas'); if(!container) return; container.innerHTML = ""; 
    const qtd = parseInt($('fin_man_qtd_parc').value) || 1;
    const valorTotal = parseFloat($('fin_man_valor').value) || 0;
    const dataInicial = $('fin_man_vencimento').value ? new Date($('fin_man_vencimento').value) : new Date();
    dataInicial.setMinutes(dataInicial.getMinutes() + dataInicial.getTimezoneOffset());
    const valorParcela = (valorTotal / qtd).toFixed(2);
    for(let i=0; i<qtd; i++) {
        let novaData = new Date(dataInicial); novaData.setMonth(novaData.getMonth() + i);
        const dataStr = novaData.toISOString().split('T')[0];
        container.innerHTML += `<div style="display:flex; gap:5px; align-items:center;"><span style="font-size:12px; width:25px;">${i+1}x</span><input type="date" class="parc-data" value="${dataStr}" style="flex:1; padding:5px;"><input type="number" class="parc-valor" value="${valorParcela}" style="width:80px; padding:5px;"></div>`;
    }
};
$('fin_man_vencimento').onchange = gerarParcelasVisuais; $('fin_man_valor').onkeyup = gerarParcelasVisuais;

window.editarFin = (id) => {
    injetarCamposParcelamento();
    const item = state.financeiro.find(x => x.id == id); if(!item) return;
    if(!document.getElementById('fin_man_id')) { const inputId = document.createElement('input'); inputId.type = 'hidden'; inputId.id = 'fin_man_id'; $('form-financeiro-manual').appendChild(inputId); }
    $('fin_man_id').value = item.id; $('fin_man_valor').value = item.valor; $('fin_man_descricao').value = item.descricao;
    $('fin_man_fornecedor').value = item.fornecedor; $('fin_man_emissao').value = item.data_emissao; $('fin_man_vencimento').value = item.data_vencimento; $('fin_man_status').value = item.status;
    if(item.tipo === 'Receita') $('opt-receita').click(); else $('opt-despesa').click();
    $('check_parcelado').checked = false; $('area-parcelas').style.display = 'none'; $('modal-nova-despesa').style.display = 'block';
};

/* --- CORREÇÃO PRINCIPAL AQUI --- */
$('btn-salvar-fin-manual').onclick = async (e) => {
    e.preventDefault();
    injetarCamposParcelamento(); // Garante que a caixa de parcelas existe para verificação
    
    const isEdit = $('fin_man_id') && $('fin_man_id').value !== "";
    const checkboxParcelado = document.getElementById('check_parcelado');
    // Verifica se checkbox existe e está marcado
    const isParcelado = checkboxParcelado && checkboxParcelado.checked && !isEdit; 
    
    const dadosBase = { tipo: state.tipoFinanceiro, descricao: $('fin_man_descricao').value, fornecedor: $('fin_man_fornecedor').value, data_emissao: $('fin_man_emissao').value, status: $('fin_man_status').value };
    if(!dadosBase.fornecedor) { alert('Selecione um fornecedor cadastrado.'); return; }

    if(isEdit) {
        dadosBase.id = $('fin_man_id').value; dadosBase.valor = parseFloat($('fin_man_valor').value); dadosBase.data_vencimento = $('fin_man_vencimento').value;
        await Backend.salvarFinanceiro(dadosBase);
    } else {
        if(isParcelado) {
            // Garante que as parcelas visuais estão lá
            const container = $('container-parcelas-geradas');
            if(!container || container.innerHTML.trim() === "") {
                gerarParcelasVisuais(); // Força gerar se estiver vazio
            }
            
            const inputsData = document.querySelectorAll('.parc-data'); 
            const inputsValor = document.querySelectorAll('.parc-valor'); 
            const lista = [];
            
            inputsData.forEach((inp, idx) => { 
                lista.push({ 
                    ...dadosBase, 
                    descricao: `${dadosBase.descricao} (${idx+1}/${inputsData.length})`, 
                    data_vencimento: inp.value, 
                    valor: parseFloat(inputsValor[idx].value) 
                }); 
            });
            
            if(lista.length > 0) {
                await Backend.salvarFinanceiroLote(lista); 
            } else {
                alert("Erro ao gerar parcelas. Tente novamente.");
                return;
            }
        } else {
            // Salvar normal (único)
            dadosBase.valor = parseFloat($('fin_man_valor').value); 
            dadosBase.data_vencimento = $('fin_man_vencimento').value;
            await Backend.salvarFinanceiro(dadosBase);
        }
    }
    closeModal('modal-nova-despesa'); navegar('financeiro');
};
window.delFin = async (id) => { if(confirm('Excluir?')) { await Backend.excluirFinanceiro(id); navegar('financeiro'); } };


// --- FLUXO NOTA -> FINANCEIRO ---
function preencherFinanceiroComNota(nota) {
    injetarCamposParcelamento();
    $('form-financeiro-manual').reset(); $('fin_man_id').value = ''; 
    const container = $('container-parcelas-geradas'); if(container) container.innerHTML = '';
    
    $('opt-despesa').click();
    $('fin_man_fornecedor').value = nota.fornecedor;
    $('fin_man_descricao').value = `Ref. Nota ${nota.numero}`;
    $('fin_man_emissao').value = new Date().toISOString().split('T')[0];
    $('fin_man_status').value = 'Pendente';
    
    if(nota.parcelas_xml && nota.parcelas_xml.length > 0) {
        $('fin_man_valor').value = nota.valor; $('check_parcelado').checked = true; $('area-parcelas').style.display = 'block'; $('fin_man_qtd_parc').value = nota.parcelas_xml.length;
        gerarParcelasVisuais();
        setTimeout(() => {
            const inputsData = document.querySelectorAll('.parc-data'); const inputsValor = document.querySelectorAll('.parc-valor');
            nota.parcelas_xml.forEach((p, idx) => { if(inputsData[idx]) inputsData[idx].value = p.vencimento; if(inputsValor[idx]) inputsValor[idx].value = p.valor; });
        }, 100);
    } else {
        $('fin_man_valor').value = nota.valor; const hoje = new Date(); hoje.setDate(hoje.getDate() + 30); $('fin_man_vencimento').valueAsDate = hoje;
        $('check_parcelado').checked = false; $('area-parcelas').style.display = 'none';
    }
    $('modal-nova-despesa').style.display = 'block';
}

// --- CONTAGEM ---
$('btnAbrirContagem').onclick = () => { state.itensContagem = []; state.produtoContagemSelecionado = null; $('lista-contagem-corpo').innerHTML = ''; $('msg-vazio-contagem').style.display = 'block'; $('input-busca-contagem').value = ''; $('input-qtd-contagem').value = ''; $('input-qtd-contagem').disabled = true; $('btn-add-contagem').disabled = true; $('obs-contagem').value = ''; $('modal-contagem').style.display = 'block'; };
$('input-busca-contagem').onkeyup = () => {
    const termo = $('input-busca-contagem').value.toLowerCase(); const lista = $('lista-sugestoes-contagem'); lista.innerHTML = '';
    if(termo.length < 1) { lista.style.display = 'none'; return; }
    const enc = state.produtos.filter(p => p.nome.toLowerCase().includes(termo) || String(p.codigo).includes(termo));
    if(enc.length > 0) { lista.style.display = 'block'; lista.innerHTML = enc.map(p => `<li onclick="selecionarProdutoContagem('${p.id}')"><strong>${p.nome}</strong> <small>(${p.codigo}) | ${p.qtd}</small></li>`).join(''); } else lista.style.display = 'none';
};
window.selecionarProdutoContagem = (id) => { const p = state.produtos.find(x => x.id == id); if(p) { state.produtoContagemSelecionado = p; $('input-busca-contagem').value = p.nome; $('lista-sugestoes-contagem').style.display = 'none'; $('input-qtd-contagem').disabled = false; $('btn-add-contagem').disabled = false; $('input-qtd-contagem').focus(); } };
$('btn-add-contagem').onclick = () => {
    if(!state.produtoContagemSelecionado) return; const qtd = parseFloat($('input-qtd-contagem').value); if(isNaN(qtd)) return alert("Informe a quantidade.");
    const p = state.produtoContagemSelecionado; const diff = qtd - p.qtd; const cor = diff > 0 ? 'green' : (diff < 0 ? 'red' : 'gray'); const sinal = diff > 0 ? '+' : '';
    $('msg-vazio-contagem').style.display = 'none';
    const tr = document.createElement('tr'); tr.innerHTML = `<td>${p.nome}</td><td>${p.qtd}</td><td style="font-weight:bold;background:#fff3cd;">${qtd}</td><td style="color:${cor};font-weight:bold;">${sinal}${diff}</td><td><span class="material-icons" style="color:red;cursor:pointer;" onclick="removerItemContagem(this, '${p.id}')">delete</span></td>`;
    $('lista-contagem-corpo').appendChild(tr);
    state.itensContagem.push({ id: p.id, novaQtd: qtd });
    $('input-busca-contagem').value = ''; $('input-qtd-contagem').value = ''; $('input-qtd-contagem').disabled = true; $('btn-add-contagem').disabled = true; state.produtoContagemSelecionado = null; $('input-busca-contagem').focus();
};
window.removerItemContagem = (btn, id) => { btn.closest('tr').remove(); state.itensContagem = state.itensContagem.filter(i => i.id != id); if(state.itensContagem.length === 0) $('msg-vazio-contagem').style.display = 'block'; };
$('btnSalvarContagem').onclick = async () => {
    if (!state.itensContagem || state.itensContagem.length === 0) return alert("Nenhum item na contagem.");
    const btn = $('btnSalvarContagem');
    const oldText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "Processando...";
    try {
        await Backend.atualizarEstoqueBatch(state.itensContagem);
        // Recarrega produtos e volta para a tela de produtos
        await Backend.getProdutos();
        closeModal('modal-contagem');
        navegar('produtos');
    } catch (e) {
        console.error(e);
        alert(e?.message || 'Erro ao salvar contagem.');
    } finally {
        btn.disabled = false;
        btn.innerText = oldText || "Concluir";
    }
};

// --- XML IMPORT ---
$('btnImportarXML').onclick = () => { $('file-xml').value = ''; $('modal-importar-xml').style.display = 'block'; };
$('btn-processar-xml').onclick = () => {
    const file = $('file-xml').files[0]; if(!file) return alert('Selecione um arquivo');
    const reader = new FileReader();
    reader.onload = async (e) => {
        const parser = new DOMParser(); const xml = parser.parseFromString(e.target.result, "text/xml");
        const nNF = xml.getElementsByTagName("nNF")[0]?.textContent; const xNome = xml.getElementsByTagName("xNome")[0]?.textContent; const vNF = xml.getElementsByTagName("vNF")[0]?.textContent;
        const itensXML = []; const dets = xml.getElementsByTagName("det");
        for(let i=0; i<dets.length; i++) {
            const prod = dets[i].getElementsByTagName("prod")[0];
            if(prod) {
                const cEAN = prod.getElementsByTagName("cEAN")[0]?.textContent; const cProd = prod.getElementsByTagName("cProd")[0]?.textContent;
                const codigoFinal = (cEAN && cEAN !== "SEM GTIN" && cEAN.trim() !== "") ? cEAN : cProd;
                itensXML.push({ codigo: codigoFinal, nome: prod.getElementsByTagName("xProd")[0]?.textContent, qtd: parseFloat(prod.getElementsByTagName("qCom")[0]?.textContent), preco: parseFloat(prod.getElementsByTagName("vUnCom")[0]?.textContent) });
            }
        }
        const parcelasXML = []; const dups = xml.getElementsByTagName("dup");
        for(let i=0; i<dups.length; i++) { parcelasXML.push({ vencimento: dups[i].getElementsByTagName("dVenc")[0]?.textContent, valor: dups[i].getElementsByTagName("vDup")[0]?.textContent }); }
        if(nNF) {
            const notaXML = { numero: nNF, fornecedor: xNome, valor: parseFloat(vNF), tipo: 'XML Importado', data: new Date(), qtd_itens: itensXML.length, itens_json: itensXML, parcelas_xml: parcelasXML };
            await Backend.salvarNota(notaXML);
            try { await Backend.processarEntradaEstoque(itensXML); } catch(e) { console.error(e); }
            alert(`Nota ${nNF} importada!`); closeModal('modal-importar-xml'); navegar('notas_entrada');
        } else alert('XML inválido');
    };
    reader.readAsText(file);
};

// --- PDF & USUARIOS ---
$('btnPDFProdutos').onclick = () => html2pdf().set({ margin: 10, filename: 'estoque.pdf' }).from($('tabela-produtos-corpo').parentElement).save();
$('btnPDFFinanceiro').onclick = () => html2pdf().set({ margin: 10, filename: 'financeiro.pdf' }).from($('tabela-financeiro-corpo').parentElement).save();
$('btnNovoUsuario').onclick = () => { $('form-usuario').reset(); $('usuario_id_edit').value=''; $('modal-usuario').style.display='block'; };
$('btn-salvar-usuario').onclick = async (e) => {
    e.preventDefault();
    try {
        const u = {
            id: $('usuario_id_edit').value || undefined,
            nome: $('user_nome').value,
            usuario: $('user_login').value,
            senha: $('user_senha').value,
            perfil: $('user_perfil').value
        };
        await Backend.salvarUsuario(u);
        closeModal('modal-usuario');
        navegar('usuarios');
        toast('Usuário salvo com sucesso!');
    } catch(err) {
        // Mensagens comuns do Supabase
        const msg = (err && (err.message || err.details)) ? (err.message || err.details) : String(err);
        // Dica para RLS
        if(String(msg).toLowerCase().includes('row-level security') || String(msg).toLowerCase().includes('rls') || String(msg).toLowerCase().includes('permission denied')) {
            toast('Erro ao salvar usuário: permissão negada (RLS). No Supabase, desative RLS na tabela usuarios ou crie uma policy permitindo INSERT/UPDATE.');
        } else if(String(msg).toLowerCase().includes('duplicate key') || String(msg).toLowerCase().includes('unique')) {
            toast('Erro ao salvar usuário: esse Login já existe. Use outro login.');
        } else {
            toast('Erro ao salvar usuário: ' + msg);
        }
    }
}; await Backend.salvarUsuario(u); closeModal('modal-usuario'); navegar('usuarios'); };
window.delUser = async (id) => { if(confirm('Excluir?')) { await Backend.excluirUsuario(id); navegar('usuarios'); } };
window.editUser = (id) => { const u = state.usuarios.find(x => x.id == id); if(!u) return; $('usuario_id_edit').value = u.id; $('user_nome').value = u.nome; $('user_login').value = u.usuario; $('user_senha').value = u.senha; $('user_perfil').value = u.perfil; $('modal-usuario').style.display = 'block'; };

// --- CONFIG ---
$('btnAddGrupo').onclick = async () => { const g = $('novo-grupo-nome').value; if(g && !state.grupos.includes(g)) { state.grupos.push(g); await Backend.saveGrupos(state.grupos); navegar('configuracoes'); } };
window.delGrupo = async (g) => { state.grupos = state.grupos.filter(x => x !== g); await Backend.saveGrupos(state.grupos); navegar('configuracoes'); };
async function updateGrupoSelects() {
    const grps = await Backend.getGrupos();
    const opts = (grps || []).map(g => `<option value="${g}">${g}</option>`).join('');
    const selProd = $('prod_grupo');
    if (selProd) selProd.innerHTML = `<option value="">Selecione...</option>` + opts;

    const selFiltro = $('filtro-grupo');
    if (selFiltro) selFiltro.innerHTML = `<option value="">Todos Grupos</option>` + opts;
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    const sess = localStorage.getItem('sess_gestao');
    if(sess) { state.user = JSON.parse(sess); initApp(); }

    $('btnLogin').onclick = async () => {
        const u = await Backend.login($('usuario').value, $('senha').value);
        if(u) {
            state.user = u;
            localStorage.setItem('sess_gestao', JSON.stringify(u));
            initApp();
        } else {
            $('msg-erro').innerText = 'Erro login';
        }
    };

    $('btnSair').onclick = () => { localStorage.removeItem('sess_gestao'); location.reload(); };

    document.querySelectorAll('.close').forEach(b => b.onclick = function() { this.closest('.modal').style.display='none'; });
    window.onclick = (e) => { if(e.target.classList.contains('modal')) e.target.style.display = 'none'; };

    document.querySelectorAll('.sidebar li').forEach(li => li.onclick = () => navegar(li.dataset.route));

    // Pesquisas existentes
    if($('barra-pesquisa')) $('barra-pesquisa').onkeyup = () => renderProdutos(state.produtos);
    if($('barra-pesquisa-financeiro')) $('barra-pesquisa-financeiro').onkeyup = () => renderFinanceiro(state.financeiro);

    // Fornecedores
    if($('btnNovoFornecedor')) $('btnNovoFornecedor').onclick = async () => {
        await Backend.getFornecedores(true);
        abrirModalFornecedor();
    };
    if($('btn-salvar-fornecedor')) $('btn-salvar-fornecedor').onclick = async () => {
        const nome = $('forn_nome').value.trim();
        if(!nome) return alert('Informe o nome do fornecedor.');
        const payload = {
            id: $('forn_id').value || undefined,
            nome,
            cnpj_cpf: $('forn_cnpj').value.trim() || null,
            telefone: $('forn_telefone').value.trim() || null,
            email: $('forn_email').value.trim() || null,
            endereco: $('forn_endereco').value.trim() || null,
            cidade: $('forn_cidade').value.trim() || null,
            uf: $('forn_uf').value.trim().toUpperCase() || null,
            observacoes: $('forn_obs').value.trim() || null,
            ativo: $('forn_ativo').value === 'true'
        };
        await Backend.salvarFornecedor(payload);
        closeModal('modal-fornecedor');
        await Backend.getFornecedores(true);
        renderFornecedores(state.fornecedores);
        atualizarSelectFornecedores();
    };
    if($('busca-fornecedores')) $('busca-fornecedores').onkeyup = () => renderFornecedores(state.fornecedores);
    if($('filtro-fornecedores-ativo')) $('filtro-fornecedores-ativo').onchange = () => renderFornecedores(state.fornecedores);

    // Funcionários
    if($('btnNovoFuncionario')) $('btnNovoFuncionario').onclick = async () => {
        await Backend.getFuncionarios(true);
        abrirModalFuncionario();
    };
    if($('btn-salvar-funcionario')) $('btn-salvar-funcionario').onclick = async () => {
        const nome = $('func_nome').value.trim();
        if(!nome) return alert('Informe o nome do funcionário.');
        const payload = {
            id: $('func_id').value || undefined,
            nome,
            cargo: $('func_cargo').value.trim() || null,
            telefone: $('func_telefone').value.trim() || null,
            email: $('func_email').value.trim() || null,
            salario: $('func_salario').value ? parseFloat($('func_salario').value) : 0,
            data_admissao: $('func_admissao').value || null,
            observacoes: $('func_obs').value.trim() || null,
            ativo: $('func_ativo').value === 'true'
        };
        await Backend.salvarFuncionario(payload);
        closeModal('modal-funcionario');
        await Backend.getFuncionarios(true);
        renderFuncionarios(state.funcionarios);
    };
    if($('busca-funcionarios')) $('busca-funcionarios').onkeyup = () => renderFuncionarios(state.funcionarios);
    if($('filtro-funcionarios-ativo')) $('filtro-funcionarios-ativo').onchange = () => renderFuncionarios(state.funcionarios);

    // Relatórios
    if($('btnGerarRelatorio')) $('btnGerarRelatorio').onclick = () => renderRelatorios();
    if($('rel_tipo')) $('rel_tipo').onchange = () => renderRelatorios();
    if($('rel_status')) $('rel_status').onchange = () => renderRelatorios();
    if($('rel_fornecedor')) $('rel_fornecedor').onchange = () => renderRelatorios();
    if($('rel_mes')) $('rel_mes').onchange = () => renderRelatorios();
    if($('rel_ano')) $('rel_ano').onchange = () => renderRelatorios();

    if($('btnPDFRelatorio')) $('btnPDFRelatorio').onclick = () => {
        const el = document.getElementById('relatorio-area');
        if(!el) return;
        const opt = { margin: 8, filename: 'relatorio.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
        html2pdf().set(opt).from(el).save();
    };
});

    document.querySelectorAll('.sidebar li').forEach(li => li.onclick = () => navegar(li.dataset.route));
    $('barra-pesquisa').onkeyup = () => renderProdutos(state.produtos);
    $('barra-pesquisa-financeiro').onkeyup = () => renderFinanceiro(state.financeiro);
});

function initApp() { $('tela-login').style.display = 'none'; $('display-nome-usuario').innerText = state.user.nome || state.user.usuario || ''; navegar('dashboard'); }