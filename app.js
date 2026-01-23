/* ==========================================================================
   CONFIGURAÇÃO SUPABASE
   ========================================================================== */
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
    funcionarios: [],
    fornecedores: [],
    grupos: [],
    route: 'dashboard',
    tipoFinanceiro: 'Despesa',

    // Auxiliares
    itensNotaManual: [],
    produtoContagemSelecionado: null,
    itensContagem: []
};

/* ==========================================================================
   HELPERS (FALLBACK DE COLUNAS / SCHEMA CACHE)
   ========================================================================== */
function _cleanUndefined(obj) {
    const o = { ...obj };
    Object.keys(o).forEach(k => {
        if (o[k] === undefined) delete o[k];
    });
    return o;
}

function _parseMissingColumnFromErrorMessage(msg) {
    // Ex.: "Could not find the 'cpf' column of 'funcionarios' in the schema cache"
    const m = String(msg || '').match(/Could not find the '([^']+)' column of '([^']+)'/i);
    if (!m) return null;
    return { col: m[1], table: m[2] };
}

async function _runQueryOrThrow(query) {
    const { error } = await query;
    if (error) throw error;
    return true;
}

/**
 * Faz INSERT/UPDATE com fallback automático quando o Supabase reclamar de coluna inexistente.
 * - Se vier erro de coluna faltando, aplica mappingRules ou remove a coluna e tenta novamente.
 */
async function _upsertWithSchemaFallback(table, payload, id, mappingRules = {}) {
    let p = _cleanUndefined(payload);

    // até 5 tentativas para encadear fallbacks (ex.: documento -> cnpj_cpf -> cpf -> cnpj)
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            if (id) {
                await _runQueryOrThrow(_db.from(table).update(p).eq('id', id));
            } else {
                await _runQueryOrThrow(_db.from(table).insert([p]));
            }
            return true;
        } catch (err) {
            const msg = err?.message || err?.error_description || String(err);
            const missing = _parseMissingColumnFromErrorMessage(msg);

            // Se não for erro de coluna inexistente, estoura normal
            if (!missing) throw err;

            const missingCol = missing.col;

            // Se tiver regra de mapeamento para essa coluna, aplica
            if (typeof mappingRules[missingCol] === 'function') {
                p = _cleanUndefined(mappingRules[missingCol](p));
                continue;
            }

            // Caso não tenha regra: remove a coluna que não existe e tenta de novo
            const p2 = { ...p };
            delete p2[missingCol];
            p = _cleanUndefined(p2);

            // Se ficou vazio (ou quase), para não ficar em loop inútil:
            if (Object.keys(p).length === 0) {
                throw new Error(`Erro ao salvar em "${table}": o banco não aceita os campos enviados (colunas não existem).`);
            }
        }
    }

    throw new Error(`Erro ao salvar em "${table}": não foi possível ajustar os campos para o schema atual.`);
}

/* ==========================================================================
   BACKEND
   ========================================================================== */
const Backend = {
    async login(u, s) {
        const userInput = (u ?? '').toString().trim();
        const passInput = (s ?? '').toString();

        if (!userInput || !passInput) return null;

        // 1) tenta por "usuario" (case-insensitive)
        let { data, error } = await _db
            .from('usuarios')
            .select('*')
            .ilike('usuario', userInput)
            .eq('senha', passInput)
            .maybeSingle();

        // 2) fallback: tenta por "nome" (case-insensitive) caso o usuário digite o nome
        if (!data && !error) {
            ({ data, error } = await _db
                .from('usuarios')
                .select('*')
                .ilike('nome', userInput)
                .eq('senha', passInput)
                .maybeSingle());
        }

        if (error) throw error;
        if (!data) return null;

        // Se existir controle de ativo, bloqueia login de usuários desativados
        if (data.ativo === false) {
            const err = new Error('Usuário desativado.');
            err.code = 'USER_DISABLED';
            throw err;
        }

        return data;
    },

    // --- PRODUTOS ---
    async getProdutos() {
        const { data } = await _db.from('produtos').select('*').order('nome');
        state.produtos = data || [];
        return state.produtos;
    },
    async salvarProduto(p) {
        const query = p.id ? _db.from('produtos').update(p).eq('id', p.id) : _db.from('produtos').insert([p]);
        const { error } = await query;
        if (error) throw error;
        return true;
    },
    async excluirProduto(id) {
        const { error } = await _db.from('produtos').delete().eq('id', id);
        if (error) throw error;
        return true;
    },
    async atualizarEstoqueBatch(itens) {
        for (const item of itens) {
            const { error } = await _db.from('produtos').update({ qtd: item.novaQtd }).eq('id', item.id);
            if (error) throw error;
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

    // --- FINANCEIRO ---
    async getFinanceiro() {
        const { data } = await _db.from('financeiro').select('*').order('data_vencimento', { ascending: false });
        state.financeiro = data || [];
        return state.financeiro;
    },
    async salvarFinanceiro(dados) {
        const query = dados.id ? _db.from('financeiro').update(dados).eq('id', dados.id) : _db.from('financeiro').insert(dados);
        const { error } = await query;
        if (error) throw error;
        return true;
    },
    async salvarFinanceiroLote(listaDados) {
        const { error } = await _db.from('financeiro').insert(listaDados);
        if (error) throw error;
        return true;
    },
    async excluirFinanceiro(id) {
        const { error } = await _db.from('financeiro').delete().eq('id', id);
        if (error) throw error;
        return true;
    },
    async baixarLote(ids) {
        const { error } = await _db.from('financeiro').update({ status: 'Pago' }).in('id', ids);
        if (error) throw error;
        return true;
    },

    // --- NOTAS ---
    async getNotas() {
        const { data, error } = await _db.from('notas_entrada').select('*').order('data', { ascending: false });
        state.notas = data || [];
        return state.notas;
    },
    async salvarNota(nota) {
        const query = nota.id ? _db.from('notas_entrada').update(nota).eq('id', nota.id) : _db.from('notas_entrada').insert([nota]);
        const { error } = await query;
        if (error) throw error;
        return true;
    },
    async excluirNota(id) {
        const { error } = await _db.from('notas_entrada').delete().eq('id', id);
        if (error) throw error;
        return true;
    },

    // --- USUARIOS ---
    async getUsuarios() {
        const { data } = await _db.from('usuarios').select('*');
        state.usuarios = data || [];
        return state.usuarios;
    },
    async salvarUsuario(u) {
        const payload = { ...u };
        if (!payload.id) delete payload.id;

        const query = payload.id ? _db.from('usuarios').update(payload).eq('id', payload.id) : _db.from('usuarios').insert([payload]);
        const { error } = await query;
        if (error) throw error;
        return true;
    },
    async excluirUsuario(id) {
        const { error } = await _db.from('usuarios').delete().eq('id', id);
        if (error) throw error;
        return true;
    },

    // --- FUNCIONARIOS (COM FALLBACK AUTOMÁTICO DE COLUNAS) ---
    async getFuncionarios() {
        const { data, error } = await _db.from('funcionarios').select('*').order('nome');
        if (error) {
            console.error("Erro leitura funcionarios:", error);
            alert("Erro ao ler funcionários: " + error.message + " (Verifique se a tabela existe)");
            return [];
        }
        state.funcionarios = data || [];
        return state.funcionarios;
    },
    async salvarFuncionario(f) {
        const id = f.id || null;
        const payload = { ...f };
        delete payload.id;

        const rules = {
            // Se o banco NÃO tem 'cpf', tenta salvar como 'documento'
            cpf: (p) => {
                const np = { ...p };
                if (np.cpf && !np.documento) np.documento = np.cpf;
                delete np.cpf;
                return np;
            },
            // Se o banco NÃO tem 'documento', tenta salvar como 'cpf'
            documento: (p) => {
                const np = { ...p };
                if (np.documento && !np.cpf) np.cpf = np.documento;
                delete np.documento;
                return np;
            },
            // Se o banco NÃO tem 'data_admissao', tenta 'admissao'
            data_admissao: (p) => {
                const np = { ...p };
                if (np.data_admissao && !np.admissao) np.admissao = np.data_admissao;
                delete np.data_admissao;
                return np;
            },
            // Se o banco NÃO tem 'admissao', tenta 'data_admissao'
            admissao: (p) => {
                const np = { ...p };
                if (np.admissao && !np.data_admissao) np.data_admissao = np.admissao;
                delete np.admissao;
                return np;
            }
        };

        await _upsertWithSchemaFallback('funcionarios', payload, id, rules);
        return true;
    },
    async excluirFuncionario(id) {
        const { error } = await _db.from('funcionarios').delete().eq('id', id);
        if (error) throw error;
        return true;
    },

    // --- FORNECEDORES (COM FALLBACK AUTOMÁTICO DE COLUNAS) ---
    async getFornecedores() {
        const { data, error } = await _db.from('fornecedores').select('*').order('nome');
        if (error) {
            console.error("Erro leitura fornecedores:", error);
            alert("Erro ao ler fornecedores: " + error.message);
            return [];
        }
        state.fornecedores = data || [];
        return state.fornecedores;
    },
    async salvarFornecedor(f) {
        const id = f.id || null;
        const payload = { ...f };
        delete payload.id;

        const rules = {
            // Se o banco NÃO tem 'documento', tenta cadeias comuns:
            documento: (p) => {
                const np = { ...p };
                if (np.documento && !np.cnpj_cpf) np.cnpj_cpf = np.documento;
                delete np.documento;
                return np;
            },
            // Se não tem 'cnpj_cpf', tenta 'cpf'
            cnpj_cpf: (p) => {
                const np = { ...p };
                if (np.cnpj_cpf && !np.cpf) np.cpf = np.cnpj_cpf;
                delete np.cnpj_cpf;
                return np;
            },
            // Se não tem 'cpf', tenta 'cnpj'
            cpf: (p) => {
                const np = { ...p };
                if (np.cpf && !np.cnpj) np.cnpj = np.cpf;
                delete np.cpf;
                return np;
            }
        };

        await _upsertWithSchemaFallback('fornecedores', payload, id, rules);
        return true;
    },
    async excluirFornecedor(id) {
        const { error } = await _db.from('fornecedores').delete().eq('id', id);
        if (error) throw error;
        return true;
    },

    // --- GRUPOS ---
    async getGrupos() {
        const { data } = await _db.from('ajustes').select('config_json').limit(1).maybeSingle();
        state.grupos = data?.config_json?.grupos || [];
        return state.grupos;
    },
    async saveGrupos(grupos) {
        const { data } = await _db.from('ajustes').select('id').limit(1).maybeSingle();
        if (data) await _db.from('ajustes').update({ config_json: { grupos } }).eq('id', data.id);
        else await _db.from('ajustes').insert([{ config_json: { grupos } }]);
    },

    // --- APONTAMENTO (ENTRADA / INTERVALO / SAÍDA) ---
    async getApontamentoDia(funcionario_id, dataISO) {
        // dataISO: 'YYYY-MM-DD'
        const { data, error } = await _db
            .from('apontamentos')
            .select('*')
            .eq('funcionario_id', funcionario_id)
            .eq('data', dataISO)
            .order('created_at', { ascending: true });

        if (error) throw error;

        if (Array.isArray(data) && data.length > 1) {
            console.warn('⚠️ Encontrados múltiplos apontamentos no dia para o mesmo funcionário. Mantendo o primeiro e sugerindo criar UNIQUE (funcionario_id, data).', data);
        }
        return (Array.isArray(data) && data.length > 0) ? data[0] : null;
    },
    
    async getApontamentosPeriodo({ de, ate, funcionario_id = null }) {
        // de/ate: 'YYYY-MM-DD'
        let q = _db
            .from('apontamentos')
            .select('id, funcionario_id, data, entrada, intervalo_inicio, intervalo_fim, saida, observacao, usuario_id, created_at, funcionarios(nome)')
            .gte('data', de)
            .lte('data', ate)
            .order('data', { ascending: true });

        if (funcionario_id) q = q.eq('funcionario_id', funcionario_id);

        const { data, error } = await q;
        if (error) throw error;
        return data || [];
    },
async criarApontamento(payload) {
        const { data, error } = await _db
            .from('apontamentos')
            .insert([payload])
            .select('*')
            .single();
        if (error) throw error;
        return data;
    },
    async atualizarApontamento(id, patch) {
        const { data, error } = await _db
            .from('apontamentos')
            .update(patch)
            .eq('id', id)
            .select('*')
            .single();
        if (error) throw error;
        return data;
    }

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

    // Esconde todas as views
    ['view-padrao', 'view-usuarios', 'view-produtos', 'view-configuracoes', 'view-notas-entrada',
        'view-financeiro', 'view-relatorios', 'view-funcionarios', 'view-fornecedores', 'view-apontamento'].forEach(v => {
        const el = $(v); if (el) el.style.display = 'none';
    });

    if (modulo === 'produtos') {
        $('view-produtos').style.display = 'block';
        renderProdutos(await Backend.getProdutos());
        updateGrupoSelects();
    } else if (modulo === 'financeiro') {
        $('view-financeiro').style.display = 'block';
        injetarControlesFinanceiros();
        renderFinanceiro(await Backend.getFinanceiro());
    } else if (modulo === 'apontamento') {
        $('view-apontamento').style.display = 'block';
        await prepararApontamento();
    } else if (modulo === 'usuarios') {
        $('view-usuarios').style.display = 'block';
        renderUsuarios(await Backend.getUsuarios());
    } else if (modulo === 'notas_entrada') {
        $('view-notas-entrada').style.display = 'block';
        if (state.produtos.length === 0) await Backend.getProdutos();
        renderNotas(await Backend.getNotas());
    } else if (modulo === 'configuracoes') {
        $('view-configuracoes').style.display = 'block';
        renderGrupos(await Backend.getGrupos());
    } else if (modulo === 'relatorios') {
        $('view-relatorios').style.display = 'block';
        await prepararRelatorios(); renderRelatorios(); aplicarFiltroRelatorioTipo();
    } else if (modulo === 'funcionarios') {
        $('view-funcionarios').style.display = 'block';
        renderFuncionarios(await Backend.getFuncionarios());
    } else if (modulo === 'fornecedores') {
        $('view-fornecedores').style.display = 'block';
        renderFornecedores(await Backend.getFornecedores());
    } else {
        $('view-padrao').style.display = 'block';
    }
}

// ==========================================================================
// RENDERIZAÇÃO
// ==========================================================================
function safeDate(dateStr) {
    if (!dateStr) return "-";
    if (dateStr.length === 10) return new Date(dateStr + 'T00:00:00').toLocaleDateString();
    return new Date(dateStr).toLocaleDateString();
}

function renderNotas(lista) {
    const tbody = $('tabela-notas-corpo'); if (!tbody) return;
    tbody.innerHTML = lista.map(n => `<tr>
        <td>${safeDate(n.data)}</td><td>${n.numero || '-'}</td><td>${n.fornecedor || '-'}</td>
        <td>${n.qtd_itens || 0}</td><td style="color:#27ae60"><b>${money(n.valor)}</b></td>
        <td><small>${n.tipo || 'Manual'}</small></td>
        <td><span class="material-icons" style="cursor:pointer; margin-right:8px;" onclick="editarNota('${n.id}')">edit</span><span class="material-icons" style="color:red; cursor:pointer" onclick="delNota('${n.id}')">delete</span></td>
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
            <td><span class="material-icons" onclick="editarProd('${p.id}')" style="cursor:pointer; margin-right:5px;">edit</span><span class="material-icons" style="color:red; cursor:pointer" onclick="delProd('${p.id}')">delete</span></td>
        </tr>`;
    }).join('');
    $('resumo-qtd').innerText = totalQtd; $('resumo-valor').innerText = money(totalValor);
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
    if (theadRow && !theadRow.querySelector('.th-check')) {
        const th = document.createElement('th'); th.className = 'th-check'; th.width = '30px';
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
            <td><span style="padding:4px 8px; border-radius:4px; background:${isPago ? '#dff9fb' : '#ffeaa7'}; color:${isPago ? '#2c3e50' : '#d35400'}; font-size:12px;">${i.status}</span></td>
            <td><span class="material-icons" style="cursor:pointer; margin-right:5px; color:#666;" onclick="editarFin('${i.id}')">edit</span><span class="material-icons" style="color:red; cursor:pointer" onclick="delFin('${i.id}')">delete</span></td>
        </tr>`;
    }).join('');
    $('fin-total-receitas').innerText = money(rec); $('fin-total-despesas').innerText = money(desp); $('fin-saldo').innerText = money(rec - desp);
    checkFinChanged();
}
function injetarControlesFinanceiros() {
    if (document.getElementById('filtro-status-fin')) return;
    const toolbar = document.querySelector('#view-financeiro .filters');
    if (toolbar) {
        const select = document.createElement('select'); select.id = 'filtro-status-fin';
        select.innerHTML = '<option value="">Todos Status</option><option value="Pendente">Pendente</option><option value="Pago">Pago</option>';
        select.style.padding = '10px'; select.style.borderRadius = '5px'; select.style.border = '1px solid #ddd'; select.style.marginLeft = '10px';
        select.onchange = async () => renderFinanceiro(state.financeiro);
        toolbar.appendChild(select);
    }
    const toolbarBtn = document.querySelector('#view-financeiro .toolbar > div:last-child');
    if (toolbarBtn) {
        const btnBatch = document.createElement('button'); btnBatch.id = 'btn-baixa-lote'; btnBatch.className = 'btn-action';
        btnBatch.innerHTML = '<span class="material-icons">done_all</span> Baixar Selecionados';
        btnBatch.style.backgroundColor = '#27ae60'; btnBatch.style.display = 'none'; btnBatch.onclick = realizarBaixaEmLote;
        toolbarBtn.insertBefore(btnBatch, toolbarBtn.firstChild);
    }
}
window.toggleAllFin = (source) => { document.querySelectorAll('.check-fin').forEach(c => c.checked = source.checked); checkFinChanged(); };
window.checkFinChanged = () => { const selecionados = document.querySelectorAll('.check-fin:checked').length; const btn = $('btn-baixa-lote'); if (btn) btn.style.display = selecionados > 0 ? 'flex' : 'none'; };
async function realizarBaixaEmLote() {
    const ids = Array.from(document.querySelectorAll('.check-fin:checked')).map(c => c.value); if (ids.length === 0) return;
    if (!confirm(`Deseja marcar ${ids.length} itens como PAGO?`)) return;
    try { await Backend.baixarLote(ids); alert('Baixa realizada com sucesso!'); renderFinanceiro(await Backend.getFinanceiro()); } catch (e) { alert('Erro: ' + e.message); }
}

// RENDER USUARIOS, GRUPOS E NOVOS MÓDULOS
function renderUsuarios(lista) { $('tabela-usuarios-corpo').innerHTML = lista.map(u => `<tr><td>${u.nome}</td><td>${u.usuario}</td><td>${u.perfil}</td><td><span class="material-icons" onclick="editUser('${u.id}')" style="cursor:pointer">edit</span><span class="material-icons" style="color:red; cursor:pointer" onclick="delUser('${u.id}')">delete</span></td></tr>`).join(''); }
function renderGrupos(lista) { $('tabela-config-grupos').innerHTML = lista.map(g => `<tr><td>${g}</td><td><span class="material-icons" style="color:red; cursor:pointer" onclick="delGrupo('${g}')">delete</span></td></tr>`).join(''); }

function renderFuncionarios(lista) {
    if (!lista || lista.length === 0) {
        $('tabela-funcionarios-corpo').innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;">Nenhum funcionário encontrado.</td></tr>';
        return;
    }

    $('tabela-funcionarios-corpo').innerHTML = lista.map(f => {
        const doc = f.cpf ?? f.documento ?? f.cnpj_cpf ?? f.doc ?? '-';
        return `<tr>
            <td>${f.nome ?? ''}</td>
            <td>${f.cargo ?? ''}</td>
            <td>${f.telefone ?? ''}</td>
            <td>${doc}</td>
            <td>
              <span class="material-icons" onclick="editarFunc('${f.id}')" style="cursor:pointer">edit</span>
              <span class="material-icons" style="color:red; cursor:pointer" onclick="delFunc('${f.id}')">delete</span>
            </td>
        </tr>`;
    }).join('');
}

function renderFornecedores(lista) {
    if (!lista || lista.length === 0) {
        $('tabela-fornecedores-corpo').innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;">Nenhum fornecedor encontrado.</td></tr>';
        return;
    }

    $('tabela-fornecedores-corpo').innerHTML = lista.map(f => {
        const doc = f.documento ?? f.cnpj_cpf ?? f.cpf ?? f.cnpj ?? '-';
        return `<tr>
            <td>${f.nome ?? ''}</td>
            <td>${doc}</td>
            <td>${f.telefone ?? ''}</td>
            <td>${f.cidade ?? ''}</td>
            <td>
              <span class="material-icons" onclick="editarForn('${f.id}')" style="cursor:pointer">edit</span>
              <span class="material-icons" style="color:red; cursor:pointer" onclick="delForn('${f.id}')">delete</span>
            </td>
        </tr>`;
    }).join('');
}

// RELATORIOS
function _toDate(value) { if (!value) return null; if (typeof value === 'string' && value.length === 10) return new Date(value + 'T00:00:00'); return new Date(value); }
async function prepararRelatorios() {
    if (state.produtos.length === 0) await Backend.getProdutos();
    if (state.financeiro.length === 0) await Backend.getFinanceiro();
    if (state.notas.length === 0) await Backend.getNotas();

    const selMes = $('rel_mes');
    const selAno = $('rel_ano');
    if (!selMes || !selAno) return;

    if (selMes.options.length === 0) {
        const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        selMes.innerHTML = meses.map((m, idx) => `<option value="${idx + 1}">${m}</option>`).join('');
        const anoAtual = new Date().getFullYear();
        const anos = [];
        for (let a = anoAtual - 4; a <= anoAtual + 1; a++) anos.push(a);
        selAno.innerHTML = anos.map(a => `<option value="${a}">${a}</option>`).join('');
        selMes.value = String(new Date().getMonth() + 1);
        selAno.value = String(anoAtual);
    }

    // liga eventos (uma vez)
    const selTipo = $('rel_tipo');
    if (selTipo && !selTipo.dataset.bound) {
        selTipo.dataset.bound = '1';
        selTipo.onchange = () => {
            aplicarFiltroRelatorioTipo();
            if ((selTipo.value || '').toLowerCase() === 'apontamento') prepararRelatorioApontamentoUI();
        };
    }
    if (selMes && !selMes.dataset.bound) {
        selMes.dataset.bound = '1';
        selMes.onchange = () => { renderRelatorios(); };
    }
    if (selAno && !selAno.dataset.bound) {
        selAno.dataset.bound = '1';
        selAno.onchange = () => { renderRelatorios(); };
    }

    // prepara UI do relatório de apontamento (select + datas + botão)
    await prepararRelatorioApontamentoUI();
}
function renderRelatorios() {
    const selMes = $('rel_mes'); const selAno = $('rel_ano');
    const mes = parseInt(selMes?.value || (new Date().getMonth() + 1), 10); const ano = parseInt(selAno?.value || new Date().getFullYear(), 10);
    const inicio = new Date(ano, mes - 1, 1); const fim = new Date(ano, mes, 1);
    const finPeriodo = (state.financeiro || []).filter(f => { const d = _toDate(f.data_vencimento); return d && d >= inicio && d < fim; });
    const notasPeriodo = (state.notas || []).filter(n => { const d = _toDate(n.data); return d && d >= inicio && d < fim; });
    let receitas = 0, despesas = 0; finPeriodo.forEach(i => { const v = parseFloat(i.valor || 0); if (i.tipo === 'Receita') receitas += v; else despesas += v; });

    let qtdEstoque = 0, valorEstoque = 0; (state.produtos || []).forEach(p => { const q = parseFloat(p.qtd || 0); const pr = parseFloat(p.preco || 0); qtdEstoque += q; valorEstoque += (q * pr); });
    if ($('rel-receitas')) $('rel-receitas').innerText = money(receitas); if ($('rel-despesas')) $('rel-despesas').innerText = money(despesas); if ($('rel-saldo')) $('rel-saldo').innerText = money(receitas - despesas); if ($('rel-estoque-qtd')) $('rel-estoque-qtd').innerText = String(qtdEstoque); if ($('rel-estoque-valor')) $('rel-estoque-valor').innerText = money(valorEstoque); if ($('rel-notas')) $('rel-notas').innerText = String(notasPeriodo.length);
    const corpoFin = $('rel-financeiro-corpo');
    if (corpoFin) {
        corpoFin.innerHTML = finPeriodo.sort((a, b) => (_toDate(b.data_vencimento) - _toDate(a.data_vencimento))).slice(0, 200).map(i => { const cor = i.tipo === 'Receita' ? '#27ae60' : '#e74c3c'; return `<tr><td>${safeDate(i.data_vencimento)}</td><td>${i.descricao || ''}<br><small>${i.fornecedor || ''}</small></td><td><span style="color:${cor}">${i.tipo}</span></td><td style="color:${cor}"><b>${money(i.valor)}</b></td><td>${i.status || ''}</td></tr>`; }).join('') || `<tr><td colspan="5" style="text-align:center; color:#999;">Nenhum lançamento</td></tr>`;
    }
    const corpoNotas = $('rel-notas-corpo');
    if (corpoNotas) { corpoNotas.innerHTML = notasPeriodo.sort((a, b) => (_toDate(b.data) - _toDate(a.data))).slice(0, 200).map(n => `<tr><td>${safeDate(n.data)}</td><td>${n.numero || '-'}</td><td>${n.fornecedor || '-'}</td><td>${n.qtd_itens || 0}</td><td style="color:#27ae60"><b>${money(n.valor)}</b></td><td><small>${n.tipo || 'Manual'}</small></td></tr>`).join('') || `<tr><td colspan="6" style="text-align:center; color:#999;">Nenhuma nota</td></tr>`; }
    const corpoBaixo = $('rel-baixo-estoque-corpo');
    if (corpoBaixo) { const low = (state.produtos || []).slice().sort((a, b) => parseFloat(a.qtd || 0) - parseFloat(b.qtd || 0)).slice(0, 15); corpoBaixo.innerHTML = low.map(p => `<tr><td><b>${p.codigo}</b></td><td>${p.nome}</td><td>${p.grupo || '-'}</td><td><b>${p.qtd}</b></td></tr>`).join('') || `<tr><td colspan="4" style="text-align:center; color:#999;">Sem produtos</td></tr>`; }
}

// --- RELATÓRIO APONTAMENTO ---
let _relApInit = false;

function _hmFromMinutes(min) {
    const m = Math.max(0, Math.round(min || 0));
    const h = Math.floor(m / 60);
    const mm = String(m % 60).padStart(2, '0');
    return `${h}:${mm}`;
}

function _minDiff(a, b) {
    if (!a || !b) return 0;
    const ta = new Date(a).getTime();
    const tb = new Date(b).getTime();
    return (tb - ta) / 60000;
}

function _calcMinTrabalhado(ap) {
    const total = _minDiff(ap.entrada, ap.saida);
    const intervalo = _minDiff(ap.intervalo_inicio, ap.intervalo_fim);
    return Math.max(0, total - intervalo);
}

function _fmtHoraCurta(ts) { return ts ? new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'; }

function _setRelApMsg(txt) { const el = $('rel-apont-msg'); if (el) el.innerText = txt || ''; }

async function prepararRelatorioApontamentoUI() {
    const sel = $('rel-apont-funcionario');
    const de = $('rel-apont-de');
    const ate = $('rel-apont-ate');
    const btn = $('btn-rel-apont-buscar');

    if (!sel || !de || !ate || !btn) return;

    // Garante funcionários carregados
    if (!state.funcionarios || state.funcionarios.length === 0) {
        await Backend.getFuncionarios();
    }

    // Preenche select com ativos
    sel.innerHTML = '';
    const optAll = document.createElement('option');
    optAll.value = '';
    optAll.innerText = 'Todos os funcionários';
    sel.appendChild(optAll);

    (state.funcionarios || []).filter(_isFuncionarioAtivo).forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.innerText = f.nome;
        sel.appendChild(opt);
    });

    // Defaults: mês atual
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);

    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    if (!de.value) de.value = iso(first);
    if (!ate.value) ate.value = iso(last);

    // Se for usuário (funcionário) vinculado, trava para ele mesmo
    const isUser = (String(state.user?.perfil || '').toLowerCase() === 'usuario');
    const myFunc = state.user?.funcionario_id;
    if (isUser && myFunc) {
        sel.value = myFunc;
        sel.disabled = true;
    }

    if (!_relApInit) {
        _relApInit = true;
        btn.onclick = async (e) => { e.preventDefault(); await carregarRelatorioApontamento(); };
    }
}

async function carregarRelatorioApontamento() {
    const sel = $('rel-apont-funcionario');
    const de = $('rel-apont-de');
    const ate = $('rel-apont-ate');
    const corpo = $('rel-apont-corpo');
    const totalEl = $('rel-apont-total');

    if (!sel || !de || !ate || !corpo || !totalEl) return;

    const deISO = de.value;
    const ateISO = ate.value;

    if (!deISO || !ateISO) { _setRelApMsg('Selecione o período.'); return; }

    let funcionarioId = sel.value ? _normId(sel.value) : null;

    // Se for usuário comum e estiver vinculado, força o próprio
    const isUser = (String(state.user?.perfil || '').toLowerCase() === 'usuario');
    const myFunc = state.user?.funcionario_id;
    if (isUser && myFunc) funcionarioId = _normId(myFunc);

    try {
        _setRelApMsg('Carregando...');
        corpo.innerHTML = '';

        const lista = await Backend.getApontamentosPeriodo({ de: deISO, ate: ateISO, funcionario_id: funcionarioId });

        let totalMin = 0;
        const rows = (lista || []).map(ap => {
            const mins = _calcMinTrabalhado(ap);
            if (ap.saida) totalMin += mins;

            const nomeFunc = ap.funcionarios?.nome || ap.funcionario_nome || '-';

            return `<tr>
                <td>${ap.data || '-'}</td>
                <td>${nomeFunc}</td>
                <td>${_fmtHoraCurta(ap.entrada)}</td>
                <td>${_fmtHoraCurta(ap.intervalo_inicio)}</td>
                <td>${_fmtHoraCurta(ap.intervalo_fim)}</td>
                <td>${_fmtHoraCurta(ap.saida)}</td>
                <td>${ap.saida ? _hmFromMinutes(mins) : '-'}</td>
                <td>${(ap.observacao || '').replace(/</g,'&lt;')}</td>
            </tr>`;
        }).join('');

        corpo.innerHTML = rows || `<tr><td colspan="8" style="text-align:center; color:#999;">Sem dados no período</td></tr>`;
        totalEl.innerText = _hmFromMinutes(totalMin);

        _setRelApMsg('');
    } catch (e) {
        console.error(e);
        _setRelApMsg('Erro ao carregar: ' + (e.message || e));
    }
}


function aplicarFiltroRelatorioTipo() {
    const tipo = ($('rel_tipo')?.value || 'todos').toLowerCase();
    const secResumo = $('rel-sec-resumo');
    const cardsFin = $('rel-cards-fin');
    const cardsEst = $('rel-cards-estoque');
    const secFin = $('rel-sec-financeiro');
    const secNotas = $('rel-sec-notas');
    const secBaixo = $('rel-sec-baixo-estoque');
    const secApont = $('rel-sec-apontamento');

    const show = (el, yes) => { if (el) el.style.display = yes ? 'block' : 'none'; };

    // padrão: mostra tudo
    show(secResumo, true); show(cardsFin, true); show(cardsEst, true); show(secFin, true); show(secNotas, true); show(secBaixo, true);
    show(secApont, false);

    if (tipo === 'todos') return;
    if (tipo === 'resumo') { show(secFin, false); show(secNotas, false); show(secBaixo, false); return; }
    if (tipo === 'financeiro') { show(cardsEst, false); show(secNotas, false); show(secBaixo, false); show(secFin, true); return; }
    if (tipo === 'notas') { show(cardsFin, false); show(secFin, false); show(secBaixo, false); show(secNotas, true); return; }
    if (tipo === 'estoque') { show(cardsFin, false); show(secFin, false); show(secNotas, false); show(secBaixo, true); return; }
    if (tipo === 'apontamento') {
        show(secResumo, false); show(cardsFin, false); show(cardsEst, false); show(secFin, false); show(secNotas, false); show(secBaixo, false);
        show(secApont, true);
        return;
    }
}


/* ==========================================================================
   MODAIS E ACTIONS
   ========================================================================== */
function closeModal(id) { $(id).style.display = 'none'; }
window.onclick = (e) => { if (e.target.classList.contains('modal')) e.target.style.display = 'none'; };

// --- PRODUTOS ---
$('btnAbrirNovoProduto').onclick = () => { $('form-produto').reset(); $('is_edit').value = 'false'; $('prod_id_edit').value = ''; $('modal-produto').style.display = 'block'; setTimeout(() => $('prod_codigo').focus(), 100); };
$('prod_codigo').addEventListener('keydown', (e) => { if (e.key === "Enter") { e.preventDefault(); $('prod_nome').focus(); } });
window.editarProd = (id) => { const p = state.produtos.find(x => x.id == id); if (!p) return; $('is_edit').value = 'true'; $('prod_id_edit').value = p.id; $('prod_codigo').value = p.codigo; $('prod_nome').value = p.nome; $('prod_grupo').value = p.grupo; $('prod_qtd').value = p.qtd; $('prod_preco').value = p.preco; $('modal-produto').style.display = 'block'; };
$('btn-salvar-prod').onclick = async (e) => { e.preventDefault(); try { const p = { id: $('prod_id_edit').value || undefined, codigo: $('prod_codigo').value, nome: $('prod_nome').value, grupo: $('prod_grupo').value, qtd: parseFloat($('prod_qtd').value), preco: parseFloat($('prod_preco').value) }; await Backend.salvarProduto(p); closeModal('modal-produto'); navegar('produtos'); } catch (err) { alert("Erro ao salvar produto: " + err.message); } };
window.delProd = async (id) => { if (confirm('Excluir?')) { try { await Backend.excluirProduto(id); navegar('produtos'); } catch (err) { alert("Erro: " + err.message); } } };

// --- FUNCIONARIOS ---
$('btnNovoFuncionario').onclick = () => { $('form-funcionario').reset(); $('func_id_edit').value = ''; $('modal-funcionario').style.display = 'block'; };
$('btn-salvar-func').onclick = async (e) => {
    e.preventDefault();
    try {
        const id = $('func_id_edit').value;

        const f = {
            nome: $('func_nome').value,
            cargo: $('func_cargo').value,
            cpf: $('func_cpf').value,               // pode virar "documento" automaticamente se no banco não existir cpf
            telefone: $('func_telefone').value,
            salario: parseFloat($('func_salario').value) || 0,
            data_admissao: $('func_admissao').value // pode virar "admissao" automaticamente se no banco for diferente
        };
        if (id) f.id = id;

        await Backend.salvarFuncionario(f);
        closeModal('modal-funcionario');
        alert('Funcionário salvo com sucesso!');
        navegar('funcionarios');
    } catch (err) {
        console.error(err);
        alert("Erro ao salvar funcionário: " + (err.message || err.code));
    }
};
window.editarFunc = (id) => {
    const f = state.funcionarios.find(x => x.id == id); if (!f) return;

    const doc = f.cpf ?? f.documento ?? f.cnpj_cpf ?? f.doc ?? '';
    const adm = f.data_admissao ?? f.admissao ?? '';

    $('func_id_edit').value = f.id;
    $('func_nome').value = f.nome ?? '';
    $('func_cargo').value = f.cargo ?? '';
    $('func_cpf').value = doc;
    $('func_telefone').value = f.telefone ?? '';
    $('func_salario').value = f.salario ?? '';
    $('func_admissao').value = adm;

    $('modal-funcionario').style.display = 'block';
};
window.delFunc = async (id) => { if (confirm('Excluir?')) { await Backend.excluirFuncionario(id); navegar('funcionarios'); } };

// --- FORNECEDORES ---
$('btnNovoFornecedor').onclick = () => { $('form-fornecedor').reset(); $('forn_id_edit').value = ''; $('modal-fornecedor').style.display = 'block'; };
$('btn-salvar-forn').onclick = async (e) => {
    e.preventDefault();
    try {
        const id = $('forn_id_edit').value;

        const f = {
            nome: $('forn_nome').value,
            documento: $('forn_documento').value, // pode virar cnpj_cpf/cpf/cnpj automaticamente
            telefone: $('forn_telefone').value,
            email: $('forn_email').value,
            cidade: $('forn_cidade').value
        };
        if (id) f.id = id;

        await Backend.salvarFornecedor(f);
        closeModal('modal-fornecedor');
        alert('Fornecedor salvo com sucesso!');
        navegar('fornecedores');
    } catch (err) {
        console.error(err);
        alert("Erro ao salvar fornecedor: " + (err.message || err.code));
    }
};
window.editarForn = (id) => {
    const f = state.fornecedores.find(x => x.id == id); if (!f) return;

    const doc = f.documento ?? f.cnpj_cpf ?? f.cpf ?? f.cnpj ?? '';

    $('forn_id_edit').value = f.id;
    $('forn_nome').value = f.nome ?? '';
    $('forn_documento').value = doc;
    $('forn_telefone').value = f.telefone ?? '';
    $('forn_email').value = f.email ?? '';
    $('forn_cidade').value = f.cidade ?? '';

    $('modal-fornecedor').style.display = 'block';
};
window.delForn = async (id) => { if (confirm('Excluir?')) { await Backend.excluirFornecedor(id); navegar('fornecedores'); } };

// --- NOTAS DE ENTRADA ---
function injetarBotaoFinanceiroNaNota() {
    const actionsDiv = document.querySelector('#form-nota-manual .actions'); if (!actionsDiv) return;
    if (document.getElementById('btn-lancar-fin-manual-nota')) return;
    const btn = document.createElement('button'); btn.type = 'button'; btn.id = 'btn-lancar-fin-manual-nota'; btn.className = 'btn-action'; btn.style.backgroundColor = '#e67e22'; btn.style.marginLeft = '10px';
    btn.innerHTML = '<span class="material-icons" style="font-size:16px; vertical-align:middle;">attach_money</span> Lançar no Contas a Pagar';
    btn.onclick = () => {
        const idNota = $('nota_id_edicao').value; const fornecedor = $('nota_fornecedor').value; const numero = $('nota_numero').value;
        let valTotal = 0; state.itensNotaManual.forEach(i => valTotal += (i.qtd * i.preco));
        if (valTotal === 0) return alert("A nota não tem valor.");
        const notaObj = { id: idNota, numero: numero, fornecedor: fornecedor, valor: valTotal, parcelas_xml: null };
        if (idNota) { const notaOriginal = state.notas.find(n => n.id == idNota); if (notaOriginal && notaOriginal.parcelas_xml) { notaObj.parcelas_xml = notaOriginal.parcelas_xml; } }
        closeModal('modal-nota-manual'); preencherFinanceiroComNota(notaObj);
    };
    const btnSalvar = $('btn-salvar-nota'); actionsDiv.insertBefore(btn, btnSalvar);
}
$('btnLancarNotaManual').onclick = () => { $('form-nota-manual').reset(); state.itensNotaManual = []; $('nota_is_edit').value = 'false'; $('nota_id_edicao').value = ''; $('titulo-modal-nota').innerText = "Lançamento Manual de Nota"; renderItensNotaManual(); $('modal-nota-manual').style.display = 'block'; injetarBotaoFinanceiroNaNota(); };
function renderItensNotaManual() { const tbody = $('tabela-itens-nota-manual'); let totalQtd = 0, totalValor = 0; if (state.itensNotaManual.length === 0) { tbody.innerHTML = ''; $('msg-sem-itens').style.display = 'block'; } else { $('msg-sem-itens').style.display = 'none'; tbody.innerHTML = state.itensNotaManual.map((item, idx) => { totalQtd++; const totItem = Number(item.qtd) * Number(item.preco); totalValor += totItem; return `<tr><td>${item.codigo || '-'}</td><td>${item.nome}</td><td>${item.qtd}</td><td>${money(item.preco)}</td><td>${money(totItem)}</td><td><span class="material-icons" style="color:red; cursor:pointer" onclick="removerItemNota(${idx})">delete</span></td></tr>`; }).join(''); } $('display-total-qtd').innerText = totalQtd; $('display-total-valor').innerText = money(totalValor); }
$('btnAddItemNota').onclick = () => { const nome = $('input-item-busca').value; const codigo = $('input-item-codigo').value; const qtd = parseFloat($('input-item-qtd').value); const preco = parseFloat($('input-item-preco').value); if (!nome || !qtd || !preco) return alert('Preencha os dados do item.'); state.itensNotaManual.push({ nome, codigo, qtd, preco }); renderItensNotaManual(); $('input-item-busca').value = ''; $('input-item-codigo').value = ''; $('input-item-qtd').value = ''; $('input-item-preco').value = ''; $('input-item-busca').focus(); };
window.removerItemNota = (idx) => { state.itensNotaManual.splice(idx, 1); renderItensNotaManual(); };
$('input-item-busca').onkeyup = () => { const termo = $('input-item-busca').value.toLowerCase(); const lista = $('lista-sugestoes-manual'); if (termo.length < 2) { lista.style.display = 'none'; return; } const encontrados = state.produtos.filter(p => p.nome.toLowerCase().includes(termo)); if (encontrados.length > 0) { lista.style.display = 'block'; lista.innerHTML = encontrados.map(p => `<li onclick="selecionarItemNota('${p.id}')"><strong>${p.nome}</strong> (R$ ${p.preco})</li>`).join(''); } else lista.style.display = 'none'; };
window.selecionarItemNota = (id) => { const p = state.produtos.find(x => x.id == id); if (p) { $('input-item-busca').value = p.nome; $('input-item-codigo').value = p.codigo; $('input-item-preco').value = p.preco; $('lista-sugestoes-manual').style.display = 'none'; $('input-item-qtd').focus(); } };
$('btn-salvar-nota').onclick = async (e) => { e.preventDefault(); const btn = $('btn-salvar-nota'); btn.disabled = true; btn.innerText = "Salvando..."; let valTotal = 0; state.itensNotaManual.forEach(i => valTotal += (i.qtd * i.preco)); const novaNota = { id: $('nota_id_edicao').value || undefined, numero: $('nota_numero').value, data: $('nota_data').value, fornecedor: $('nota_fornecedor').value, qtd_itens: state.itensNotaManual.length, valor: valTotal, tipo: 'Manual', itens_json: state.itensNotaManual }; try { await Backend.salvarNota(novaNota); if (!novaNota.id && state.itensNotaManual.length > 0) { try { await Backend.processarEntradaEstoque(state.itensNotaManual); } catch (e) { console.error("Erro estoque", e); } } closeModal('modal-nota-manual'); alert('Nota salva com sucesso!'); navegar('notas_entrada'); } catch (err) { alert('Erro ao salvar nota: ' + err.message); } btn.disabled = false; btn.innerText = "Salvar Nota Completa"; };
window.editarNota = (id) => { const n = state.notas.find(x => x.id == id); if (!n) return; $('nota_is_edit').value = 'true'; $('nota_id_edicao').value = n.id; $('titulo-modal-nota').innerText = `Editar Nota ${n.numero}`; $('nota_numero').value = n.numero; $('nota_data').value = n.data; $('nota_fornecedor').value = n.fornecedor; state.itensNotaManual = n.itens_json || []; renderItensNotaManual(); $('modal-nota-manual').style.display = 'block'; injetarBotaoFinanceiroNaNota(); };
window.delNota = async (id) => { if (confirm('Excluir?')) { await Backend.excluirNota(id); navegar('notas_entrada'); } };

// --- FINANCEIRO ---
function injetarCamposParcelamento() {
    const form = $('form-financeiro-manual'); if (!form) return;
    if (document.getElementById('check_parcelado')) return;
    const div = document.createElement('div');
    div.innerHTML = `<div style="margin:10px 0; padding:10px; background:#f8f9fa; border:1px solid #ddd; border-radius:5px;"><label style="display:flex; align-items:center; cursor:pointer; font-weight:bold;"><input type="checkbox" id="check_parcelado" style="margin-right:8px;"> Habilitar Parcelamento?</label><div id="area-parcelas" style="display:none; margin-top:10px; border-top:1px dashed #ccc; padding-top:10px;"><label>Qtd Parcelas:</label><input type="number" id="fin_man_qtd_parc" value="1" min="1" style="width:60px; padding:5px; margin-left:5px;"><div id="container-parcelas-geradas" style="margin-top:10px; max-height:200px; overflow-y:auto; display:flex; flex-direction:column; gap:5px;"></div></div></div>`;
    const btnSalvar = $('btn-salvar-fin-manual'); if (btnSalvar) form.insertBefore(div, btnSalvar.parentElement); else form.appendChild(div);
    $('check_parcelado').onchange = () => { const checked = $('check_parcelado').checked; $('area-parcelas').style.display = checked ? 'block' : 'none'; if (checked) gerarParcelasVisuais(); };
    $('fin_man_qtd_parc').onchange = gerarParcelasVisuais;
}
$('btnNovaDespesa').onclick = () => { injetarCamposParcelamento(); $('form-financeiro-manual').reset(); $('fin_man_id').value = ''; $('container-parcelas-geradas').innerHTML = ''; $('area-parcelas').style.display = 'none'; $('modal-nova-despesa').style.display = 'block'; };
$('opt-despesa').onclick = () => { state.tipoFinanceiro = 'Despesa'; $('opt-despesa').classList.add('selected'); $('opt-receita').classList.remove('selected'); };
$('opt-receita').onclick = () => { state.tipoFinanceiro = 'Receita'; $('opt-receita').classList.add('selected'); $('opt-despesa').classList.remove('selected'); };
window.gerarParcelasVisuais = () => { const container = $('container-parcelas-geradas'); if (!container) return; container.innerHTML = ""; const qtd = parseInt($('fin_man_qtd_parc').value) || 1; const valorTotal = parseFloat($('fin_man_valor').value) || 0; const dataInicial = $('fin_man_vencimento').value ? new Date($('fin_man_vencimento').value) : new Date(); dataInicial.setMinutes(dataInicial.getMinutes() + dataInicial.getTimezoneOffset()); const valorParcela = (valorTotal / qtd).toFixed(2); for (let i = 0; i < qtd; i++) { let novaData = new Date(dataInicial); novaData.setMonth(novaData.getMonth() + i); const dataStr = novaData.toISOString().split('T')[0]; container.innerHTML += `<div style="display:flex; gap:5px; align-items:center;"><span style="font-size:12px; width:25px;">${i + 1}x</span><input type="date" class="parc-data" value="${dataStr}" style="flex:1; padding:5px;"><input type="number" class="parc-valor" value="${valorParcela}" style="width:80px; padding:5px;"></div>`; } };
$('fin_man_vencimento').onchange = gerarParcelasVisuais; $('fin_man_valor').onkeyup = gerarParcelasVisuais;
window.editarFin = (id) => { injetarCamposParcelamento(); const item = state.financeiro.find(x => x.id == id); if (!item) return; if (!document.getElementById('fin_man_id')) { const inputId = document.createElement('input'); inputId.type = 'hidden'; inputId.id = 'fin_man_id'; $('form-financeiro-manual').appendChild(inputId); } $('fin_man_id').value = item.id; $('fin_man_valor').value = item.valor; $('fin_man_descricao').value = item.descricao; $('fin_man_fornecedor').value = item.fornecedor; $('fin_man_emissao').value = item.data_emissao; $('fin_man_vencimento').value = item.data_vencimento; $('fin_man_status').value = item.status; if (item.tipo === 'Receita') $('opt-receita').click(); else $('opt-despesa').click(); $('check_parcelado').checked = false; $('area-parcelas').style.display = 'none'; $('modal-nova-despesa').style.display = 'block'; };
$('btn-salvar-fin-manual').onclick = async (e) => {
    e.preventDefault(); injetarCamposParcelamento();
    const isEdit = $('fin_man_id') && $('fin_man_id').value !== ""; const checkboxParcelado = document.getElementById('check_parcelado'); const isParcelado = checkboxParcelado && checkboxParcelado.checked && !isEdit;
    const dadosBase = { tipo: state.tipoFinanceiro, descricao: $('fin_man_descricao').value, fornecedor: $('fin_man_fornecedor').value, data_emissao: $('fin_man_emissao').value, status: $('fin_man_status').value };
    if (isEdit) { dadosBase.id = $('fin_man_id').value; dadosBase.valor = parseFloat($('fin_man_valor').value); dadosBase.data_vencimento = $('fin_man_vencimento').value; await Backend.salvarFinanceiro(dadosBase); }
    else {
        if (isParcelado) {
            const container = $('container-parcelas-geradas'); if (!container || container.innerHTML.trim() === "") { gerarParcelasVisuais(); }
            const inputsData = document.querySelectorAll('.parc-data'); const inputsValor = document.querySelectorAll('.parc-valor'); const lista = [];
            inputsData.forEach((inp, idx) => { lista.push({ ...dadosBase, descricao: `${dadosBase.descricao} (${idx + 1}/${inputsData.length})`, data_vencimento: inp.value, valor: parseFloat(inputsValor[idx].value) }); });
            if (lista.length > 0) { await Backend.salvarFinanceiroLote(lista); } else { alert("Erro ao gerar parcelas. Tente novamente."); return; }
        } else { dadosBase.valor = parseFloat($('fin_man_valor').value); dadosBase.data_vencimento = $('fin_man_vencimento').value; await Backend.salvarFinanceiro(dadosBase); }
    }
    closeModal('modal-nova-despesa'); navegar('financeiro');
};
window.delFin = async (id) => { if (confirm('Excluir?')) { await Backend.excluirFinanceiro(id); navegar('financeiro'); } };
function preencherFinanceiroComNota(nota) { injetarCamposParcelamento(); $('form-financeiro-manual').reset(); $('fin_man_id').value = ''; const container = $('container-parcelas-geradas'); if (container) container.innerHTML = ''; $('opt-despesa').click(); $('fin_man_fornecedor').value = nota.fornecedor; $('fin_man_descricao').value = `Ref. Nota ${nota.numero}`; $('fin_man_emissao').value = new Date().toISOString().split('T')[0]; $('fin_man_status').value = 'Pendente'; if (nota.parcelas_xml && nota.parcelas_xml.length > 0) { $('fin_man_valor').value = nota.valor; $('check_parcelado').checked = true; $('area-parcelas').style.display = 'block'; $('fin_man_qtd_parc').value = nota.parcelas_xml.length; gerarParcelasVisuais(); setTimeout(() => { const inputsData = document.querySelectorAll('.parc-data'); const inputsValor = document.querySelectorAll('.parc-valor'); nota.parcelas_xml.forEach((p, idx) => { if (inputsData[idx]) inputsData[idx].value = p.vencimento; if (inputsValor[idx]) inputsValor[idx].value = p.valor; }); }, 100); } else { $('fin_man_valor').value = nota.valor; const hoje = new Date(); hoje.setDate(hoje.getDate() + 30); $('fin_man_vencimento').valueAsDate = hoje; $('check_parcelado').checked = false; $('area-parcelas').style.display = 'none'; } $('modal-nova-despesa').style.display = 'block'; }

// --- CONTAGEM ---
$('btnAbrirContagem').onclick = () => { state.itensContagem = []; state.produtoContagemSelecionado = null; $('lista-contagem-corpo').innerHTML = ''; $('msg-vazio-contagem').style.display = 'block'; $('input-busca-contagem').value = ''; $('input-qtd-contagem').value = ''; $('input-qtd-contagem').disabled = true; $('btn-add-contagem').disabled = true; $('obs-contagem').value = ''; $('modal-contagem').style.display = 'block'; };
$('input-busca-contagem').onkeyup = () => { const termo = $('input-busca-contagem').value.toLowerCase(); const lista = $('lista-sugestoes-contagem'); lista.innerHTML = ''; if (termo.length < 1) { lista.style.display = 'none'; return; } const enc = state.produtos.filter(p => p.nome.toLowerCase().includes(termo) || String(p.codigo).includes(termo)); if (enc.length > 0) { lista.style.display = 'block'; lista.innerHTML = enc.map(p => `<li onclick="selecionarProdutoContagem('${p.id}')"><strong>${p.nome}</strong> <small>(${p.codigo}) | ${p.qtd}</small></li>`).join(''); } else lista.style.display = 'none'; };
window.selecionarProdutoContagem = (id) => { const p = state.produtos.find(x => x.id == id); if (p) { state.produtoContagemSelecionado = p; $('input-busca-contagem').value = p.nome; $('lista-sugestoes-contagem').style.display = 'none'; $('input-qtd-contagem').disabled = false; $('btn-add-contagem').disabled = false; $('input-qtd-contagem').focus(); } };
$('btn-add-contagem').onclick = () => { if (!state.produtoContagemSelecionado) return; const qtd = parseFloat($('input-qtd-contagem').value); if (isNaN(qtd)) return alert("Informe a quantidade."); const p = state.produtoContagemSelecionado; const diff = qtd - p.qtd; const cor = diff > 0 ? 'green' : (diff < 0 ? 'red' : 'gray'); const sinal = diff > 0 ? '+' : ''; $('msg-vazio-contagem').style.display = 'none'; const tr = document.createElement('tr'); tr.innerHTML = `<td>${p.nome}</td><td>${p.qtd}</td><td style="font-weight:bold;background:#fff3cd;">${qtd}</td><td style="color:${cor};font-weight:bold;">${sinal}${diff}</td><td><span class="material-icons" style="color:red;cursor:pointer;" onclick="removerItemContagem(this, '${p.id}')">delete</span></td>`; $('lista-contagem-corpo').appendChild(tr); state.itensContagem.push({ id: p.id, novaQtd: qtd }); $('input-busca-contagem').value = ''; $('input-qtd-contagem').value = ''; $('input-qtd-contagem').disabled = true; $('btn-add-contagem').disabled = true; state.produtoContagemSelecionado = null; $('input-busca-contagem').focus(); };
window.removerItemContagem = (btn, id) => { btn.closest('tr').remove(); state.itensContagem = state.itensContagem.filter(i => i.id != id); if (state.itensContagem.length === 0) $('msg-vazio-contagem').style.display = 'block'; };
$('btnSalvarContagem').onclick = async () => { if (state.itensContagem.length === 0) return alert("Vazio."); const btn = $('btnSalvarContagem'); btn.disabled = true; btn.innerText = "Processando..."; try { await Backend.atualizarEstoqueBatch(state.itensContagem); alert("Sucesso!"); closeModal('modal-contagem'); navegar('produtos'); } catch (e) { alert(e.message); } btn.disabled = false; btn.innerText = "Concluir"; };

// --- XML IMPORT ---
$('btnImportarXML').onclick = () => { $('file-xml').value = ''; $('modal-importar-xml').style.display = 'block'; };
$('btn-processar-xml').onclick = () => { const file = $('file-xml').files[0]; if (!file) return alert('Selecione um arquivo'); const reader = new FileReader(); reader.onload = async (e) => { const parser = new DOMParser(); const xml = parser.parseFromString(e.target.result, "text/xml"); const nNF = xml.getElementsByTagName("nNF")[0]?.textContent; const xNome = xml.getElementsByTagName("xNome")[0]?.textContent; const vNF = xml.getElementsByTagName("vNF")[0]?.textContent; const itensXML = []; const dets = xml.getElementsByTagName("det"); for (let i = 0; i < dets.length; i++) { const prod = dets[i].getElementsByTagName("prod")[0]; if (prod) { const cEAN = prod.getElementsByTagName("cEAN")[0]?.textContent; const cProd = prod.getElementsByTagName("cProd")[0]?.textContent; const codigoFinal = (cEAN && cEAN !== "SEM GTIN" && cEAN.trim() !== "") ? cEAN : cProd; itensXML.push({ codigo: codigoFinal, nome: prod.getElementsByTagName("xProd")[0]?.textContent, qtd: parseFloat(prod.getElementsByTagName("qCom")[0]?.textContent), preco: parseFloat(prod.getElementsByTagName("vUnCom")[0]?.textContent) }); } } const parcelasXML = []; const dups = xml.getElementsByTagName("dup"); for (let i = 0; i < dups.length; i++) { parcelasXML.push({ vencimento: dups[i].getElementsByTagName("dVenc")[0]?.textContent, valor: dups[i].getElementsByTagName("vDup")[0]?.textContent }); } if (nNF) { const notaXML = { numero: nNF, fornecedor: xNome, valor: parseFloat(vNF), tipo: 'XML Importado', data: new Date(), qtd_itens: itensXML.length, itens_json: itensXML, parcelas_xml: parcelasXML }; await Backend.salvarNota(notaXML); try { await Backend.processarEntradaEstoque(itensXML); } catch (e) { console.error(e); } alert(`Nota ${nNF} importada!`); closeModal('modal-importar-xml'); navegar('notas_entrada'); } else alert('XML inválido'); }; reader.readAsText(file); };

// --- PDF & USUARIOS ---
$('btnPDFProdutos').onclick = () => html2pdf().set({ margin: 10, filename: 'estoque.pdf' }).from($('tabela-produtos-corpo').parentElement).save();
$('btnPDFFinanceiro').onclick = () => html2pdf().set({ margin: 10, filename: 'financeiro.pdf' }).from($('tabela-financeiro-corpo').parentElement).save();

async function preencherSelectFuncionarioUsuario(selectedId = null) {
    const chk = $('user_eh_funcionario');
    const grp = $('grp-user-funcionario');
    const sel = $('user_funcionario_id');
    if (!chk || !grp || !sel) return;

    // bind toggle 1x
    if (!chk.dataset.bound) {
        chk.dataset.bound = '1';
        chk.onchange = async () => {
            grp.style.display = chk.checked ? 'block' : 'none';
            if (chk.checked) await preencherSelectFuncionarioUsuario(sel.value || null);
        };
    }

    // se não estiver marcado, só esconde e limpa
    if (!chk.checked) {
        grp.style.display = 'none';
        sel.innerHTML = '';
        return;
    }

    // carrega funcionarios se necessário
    if (!state.funcionarios || state.funcionarios.length === 0) {
        await Backend.getFuncionarios();
    }

    const ativos = (state.funcionarios || []).filter(_isFuncionarioAtivo);

    sel.innerHTML = '';
    if (!ativos || ativos.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.innerText = 'Nenhum funcionário ativo cadastrado';
        sel.appendChild(opt);
        sel.disabled = true;
        return;
    }

    sel.disabled = false;

    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.innerText = 'Selecione...';
    sel.appendChild(opt0);

    ativos.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.innerText = f.nome;
        sel.appendChild(opt);
    });

    if (selectedId) sel.value = selectedId;
}

$('btnNovoUsuario').onclick = async () => {
    $('form-usuario').reset();
    $('usuario_id_edit').value = '';
    // padrão: não é funcionário
    if ($('user_eh_funcionario')) $('user_eh_funcionario').checked = false;
    if ($('grp-user-funcionario')) $('grp-user-funcionario').style.display = 'none';
    await preencherSelectFuncionarioUsuario();
    $('modal-usuario').style.display = 'block';
};
$('btn-salvar-usuario').onclick = async (e) => {
    e.preventDefault();
    try {
        const id = $('usuario_id_edit').value;
        const u = {
            nome: $('user_nome').value,
            usuario: $('user_login').value,
            senha: $('user_senha').value,
            perfil: $('user_perfil').value
        };
        // vínculo com funcionário (opcional)
        const ehFunc = $('user_eh_funcionario')?.checked;
        if (ehFunc) {
            u.funcionario_id = $('user_funcionario_id')?.value || null;
        } else {
            u.funcionario_id = null;
        }

        if (id) u.id = id;

        await Backend.salvarUsuario(u);
        closeModal('modal-usuario');
        alert('Usuário salvo com sucesso!');
        navegar('usuarios');
    } catch (err) {
        alert('Erro ao salvar usuário: ' + err.message);
    }
};

window.delUser = async (id) => { if (confirm('Excluir?')) { await Backend.excluirUsuario(id); navegar('usuarios'); } };
window.editUser = async (id) => {
    const u = state.usuarios.find(x => x.id == id);
    if (!u) return;

    $('usuario_id_edit').value = u.id;
    $('user_nome').value = u.nome;
    $('user_login').value = u.usuario;
    $('user_senha').value = u.senha;
    $('user_perfil').value = u.perfil;

    const temVinculo = !!u.funcionario_id;
    if ($('user_eh_funcionario')) $('user_eh_funcionario').checked = temVinculo;
    if ($('grp-user-funcionario')) $('grp-user-funcionario').style.display = temVinculo ? 'block' : 'none';

    await preencherSelectFuncionarioUsuario(temVinculo ? u.funcionario_id : null);

    $('modal-usuario').style.display = 'block';
};

// --- CONFIG ---
$('btnAddGrupo').onclick = async () => { const g = $('novo-grupo-nome').value; if (g && !state.grupos.includes(g)) { state.grupos.push(g); await Backend.saveGrupos(state.grupos); navegar('configuracoes'); } };
window.delGrupo = async (g) => { state.grupos = state.grupos.filter(x => x !== g); await Backend.saveGrupos(state.grupos); navegar('configuracoes'); };
async function updateGrupoSelects() { const grps = await Backend.getGrupos(); const opts = grps.map(g => `<option value="${g}">${g}</option>`).join(''); $('prod_grupo').innerHTML = '<option value="">Selecione...</option>' + opts; $('filtro-grupo').innerHTML = '<option value="">Todos</option>' + opts; }

// --- INIT ---

/* ==========================================================================
   MÓDULO: APONTAMENTO (Entrada / Intervalo / Saída)
   Requisitos Supabase:
   - tabela: apontamentos
   - colunas: id (uuid), funcionario_id (uuid), data (date), entrada (timestamptz),
              intervalo_inicio (timestamptz), intervalo_fim (timestamptz), saida (timestamptz),
              observacao (text), usuario_id (uuid), created_at (timestamptz default now())
   ========================================================================== */

let _apontamentoInit = false;
let _apontamentoAtual = null;

function _localDateISO() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}
function _fmtHora(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function _setApStatus(msg) {
    const el = $('apontamento-status');
    if (el) el.innerText = msg || '';
}

function _isFuncionarioAtivo(f) {
    // Aceita vários padrões de coluna para "ativo"
    if (!f || typeof f !== 'object') return false;

    if (typeof f.ativo === 'boolean') return f.ativo;
    if (typeof f.active === 'boolean') return f.active;
    if (typeof f.habilitado === 'boolean') return f.habilitado;

    // Padrões texto
    const status = (f.status ?? f.situacao ?? f.estado ?? '').toString().trim().toUpperCase();
    if (status) {
        if (['ATIVO', 'ATIVA', 'SIM', 'TRUE', '1'].includes(status)) return true;
        if (['INATIVO', 'INATIVA', 'NAO', 'NÃO', 'FALSE', '0'].includes(status)) return false;
    }

    // Se não existir coluna, assume ativo para não sumir da lista
    return true;
}

async function prepararApontamento() {
    // Garante funcionários carregados
    if (!state.funcionarios || state.funcionarios.length === 0) {
        await Backend.getFuncionarios();
    }

    // Se ainda estiver vazio, mostra aviso (tabela pode não existir)
    const sel = $('apontamento-funcionario');
    if (!sel) return;

    sel.innerHTML = '';

    // Apenas funcionários ATIVOS na lista de seleção (puxa da tabela funcionarios)
    const funcionariosAtivos = (state.funcionarios || []).filter(_isFuncionarioAtivo);

    if (!funcionariosAtivos || funcionariosAtivos.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.innerText = 'Nenhum funcionário ativo cadastrado';
        sel.appendChild(opt);
        sel.disabled = true;
        _setApStatus('Cadastre funcionários na tela Funcionários.');
        return;
    }

    sel.disabled = false;
    funcionariosAtivos.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.innerText = f.nome;
        sel.appendChild(opt);
    });

    $('apontamento-data').innerText = _localDateISO();

    if (!_apontamentoInit) {
        _apontamentoInit = true;

        sel.onchange = () => carregarApontamentoDia();

        $('btnApEntrada').onclick = () => acaoApontamento('entrada');
        $('btnApIntIni').onclick = () => acaoApontamento('intervalo_inicio');
        $('btnApIntFim').onclick = () => acaoApontamento('intervalo_fim');
        $('btnApSaida').onclick = () => acaoApontamento('saida');
    }

    await carregarApontamentoDia();
}

async function carregarApontamentoDia() {
    const sel = $('apontamento-funcionario');
    const funcionarioId = _normId(sel?.value);
    if (!funcionarioId) return;

    const dataISO = _localDateISO();
    $('apontamento-data').innerText = dataISO;

    try {
        _setApStatus('Carregando...');
        const ap = await Backend.getApontamentoDia(funcionarioId, dataISO);
        _apontamentoAtual = ap;

        $('apontamento-hora-entrada').innerText = _fmtHora(ap?.entrada);
        $('apontamento-hora-int-ini').innerText = _fmtHora(ap?.intervalo_inicio);
        $('apontamento-hora-int-fim').innerText = _fmtHora(ap?.intervalo_fim);
        $('apontamento-hora-saida').innerText = _fmtHora(ap?.saida);

        if (!ap) {
            _setApStatus('Nenhum registro hoje. Clique em “Entrada” para iniciar.');
        } else if (ap.saida) {
            _setApStatus('Turno finalizado hoje ✅');
        } else if (ap.intervalo_inicio && !ap.intervalo_fim) {
            _setApStatus('Em intervalo. Registre “Intervalo (fim)” para continuar.');
        } else if (ap.entrada && !ap.intervalo_inicio) {
            _setApStatus('Em trabalho. Se for pausar, registre “Intervalo (início)”, ou registre “Saída”.');
        } else if (ap.entrada && ap.intervalo_fim && !ap.saida) {
            _setApStatus('Intervalo finalizado. Registre “Saída” ao terminar.');
        } else {
            _setApStatus('');
        }
    } catch (e) {
        console.error(e);
        _setApStatus('Erro ao carregar apontamento: ' + (e?.message || ''));
    }
}

function _validarSequencia(ap, acao) {
    if (acao === 'entrada') return null;

    if (!ap) return 'Faça a Entrada primeiro.';

    if (acao === 'intervalo_inicio') {
        if (!ap.entrada) return 'Faça a Entrada primeiro.';
        if (ap.intervalo_inicio) return 'Intervalo (início) já registrado.';
        if (ap.saida) return 'Turno já finalizado.';
        return null;
    }
    if (acao === 'intervalo_fim') {
        if (!ap.intervalo_inicio) return 'Registre Intervalo (início) antes.';
        if (ap.intervalo_fim) return 'Intervalo (fim) já registrado.';
        if (ap.saida) return 'Turno já finalizado.';
        return null;
    }
    if (acao === 'saida') {
        if (!ap.entrada) return 'Faça a Entrada primeiro.';
        if (ap.saida) return 'Saída já registrada.';
        if (ap.intervalo_inicio && !ap.intervalo_fim) return 'Finalize o Intervalo (fim) antes da Saída.';
        return null;
    }
    return null;
}


function _normId(v){
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (!s) return null;
    return (/^\d+$/.test(s)) ? Number(s) : s;
}

async function acaoApontamento(acao) {
    const funcionarioId = _normId($('apontamento-funcionario')?.value);
    const obs = ($('apontamento-obs')?.value || '').trim();
    const dataISO = _localDateISO();
    if (!funcionarioId) return;

    try {
        _setApStatus('Salvando...');
        const agora = new Date().toISOString();

        // Recarrega o estado do dia (evita conflito)
        const ap = await Backend.getApontamentoDia(funcionarioId, dataISO);

        if (acao === 'entrada') {
            if (ap && ap.entrada && !ap.saida) {
                _setApStatus('Já existe um turno aberto hoje. Registre Intervalo/Saída nele.');
                _apontamentoAtual = ap;
                await carregarApontamentoDia();
                return;
            }
            if (ap && ap.saida) {
                _setApStatus('Turno já foi finalizado hoje. (Se precisar, ajuste no banco/relatório.)');
                _apontamentoAtual = ap;
                await carregarApontamentoDia();
                return;
            }

            const payload = {
                funcionario_id: funcionarioId,
                data: dataISO,
                entrada: agora,
                observacao: obs || null,
                usuario_id: _normId(state.user?.id)
            };

            const criado = await Backend.criarApontamento(payload);
            _apontamentoAtual = criado;
            _setApStatus('✅ Entrada registrada às ' + _fmtHora(criado.entrada));
            await carregarApontamentoDia();
            return;
        }

        const err = _validarSequencia(ap, acao);
        if (err) {
            _setApStatus('⚠️ ' + err);
            _apontamentoAtual = ap;
            await carregarApontamentoDia();
            return;
        }

        const patch = {};
        if (acao === 'intervalo_inicio') patch.intervalo_inicio = agora;
        if (acao === 'intervalo_fim') patch.intervalo_fim = agora;
        if (acao === 'saida') patch.saida = agora;
        if (obs) patch.observacao = obs;

        const atualizado = await Backend.atualizarApontamento(ap.id, patch);
        async function prepararApontamento() {
    // Garante funcionários carregados
    if (!state.funcionarios || state.funcionarios.length === 0) {
        await Backend.getFuncionarios();
    }

    const sel = $('apontamento-funcionario');
    if (!sel) return;

    const setBtnsDisabled = (yes) => {
        ['btnApEntrada', 'btnApIntIni', 'btnApIntFim', 'btnApSaida'].forEach(id => {
            const b = $(id); if (b) b.disabled = !!yes;
        });
    };

    sel.innerHTML = '';

    // Apenas ATIVOS
    const funcionariosAtivos = (state.funcionarios || []).filter(_isFuncionarioAtivo);

    const isUser = (String(state.user?.perfil || '').toLowerCase() === 'usuario');
    const myFunc = state.user?.funcionario_id;

    if (!funcionariosAtivos || funcionariosAtivos.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.innerText = 'Nenhum funcionário ativo cadastrado';
        sel.appendChild(opt);
        sel.disabled = true;
        setBtnsDisabled(true);
        _setApStatus('Cadastre funcionários na tela Funcionários.');
        return;
    }

    if (isUser) {
        // Funcionário: só pode lançar para si mesmo
        if (!myFunc) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.innerText = 'Usuário sem funcionário vinculado';
            sel.appendChild(opt);
            sel.disabled = true;
            setBtnsDisabled(true);
            _setApStatus('Seu usuário não está vinculado a um funcionário. Peça ao Admin para vincular em Usuários.');
            return;
        }

        const f = funcionariosAtivos.find(x => String(x.id) === String(myFunc));
        if (!f) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.innerText = 'Funcionário vinculado inativo/inexistente';
            sel.appendChild(opt);
            sel.disabled = true;
            setBtnsDisabled(true);
            _setApStatus('O funcionário vinculado está inativo (ou não existe). Peça ao Admin para ajustar.');
            return;
        }

        const opt = document.createElement('option');
        opt.value = f.id;
        opt.innerText = f.nome;
        sel.appendChild(opt);
        sel.value = f.id;
        sel.disabled = true;
        setBtnsDisabled(false);
    } else {
        // Admin: lista todos ativos
        sel.disabled = false;
        funcionariosAtivos.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.id;
            opt.innerText = f.nome;
            sel.appendChild(opt);
        });
        setBtnsDisabled(false);
    }

    $('apontamento-data').innerText = _localDateISO();

    if (!_apontamentoInit) {
        _apontamentoInit = true;

        sel.onchange = () => carregarApontamentoDia();

        $('btnApEntrada').onclick = () => acaoApontamento('entrada');
        $('btnApIntIni').onclick = () => acaoApontamento('intervalo_inicio');
        $('btnApIntFim').onclick = () => acaoApontamento('intervalo_fim');
        $('btnApSaida').onclick = () => acaoApontamento('saida');
    }

    await carregarApontamentoDia();
}

async function carregarApontamentoDiaontamentoAtual = atualizado;

        const label = {
            intervalo_inicio: 'Intervalo (início)',
            intervalo_fim: 'Intervalo (fim)',
            saida: 'Saída'
        }[acao] || acao;

        _setApStatus('✅ ' + label + ' registrado às ' + _fmtHora(agora));
        await carregarApontamentoDia();
    } catch (e) {
        console.error(e);
        _setApStatus('❌ Erro ao salvar: ' + (e?.message || ''));
    }
}


document.addEventListener('DOMContentLoaded', () => {
    const sess = localStorage.getItem('sess_gestao'); if (sess) { state.user = JSON.parse(sess); initApp(); }
    $('btnLogin').onclick = async () => {
        const msg = $('msg-erro');
        msg.innerText = '';
        try {
            const u = await Backend.login($('usuario').value, $('senha').value);
            if (u) {
                state.user = u;
                localStorage.setItem('sess_gestao', JSON.stringify(u));
                initApp();
            } else {
                msg.innerText = 'Usuário ou senha inválidos.';
            }
        } catch (e) {
            msg.innerText = (e && e.message) ? e.message : 'Erro ao entrar.';
        }
    };
    $('btnSair').onclick = () => { localStorage.removeItem('sess_gestao'); location.reload(); };
    document.querySelectorAll('.close').forEach(b => b.onclick = function () { this.closest('.modal').style.display = 'none'; });
    document.querySelectorAll('.sidebar li').forEach(li => li.onclick = () => navegar(li.dataset.route));
    $('barra-pesquisa').onkeyup = () => renderProdutos(state.produtos);
    $('barra-pesquisa-financeiro').onkeyup = () => renderFinanceiro(state.financeiro);
});


function aplicarPermissoesUI() {
    const perfil = String(state.user?.perfil || '').toLowerCase();

    // Usuário (funcionário): só pode lançar apontamento
    if (perfil === 'usuario') {
        document.querySelectorAll('.sidebar li').forEach(li => {
            const r = (li.dataset.route || '').toLowerCase();
            // mantém apenas apontamento
            li.style.display = (r === 'apontamento') ? 'flex' : 'none';
        });
    } else {
        // Admin: mostra tudo
        document.querySelectorAll('.sidebar li').forEach(li => li.style.display = 'flex');
    }
}

function initApp() {
    $('tela-login').style.display = 'none';
    $('tela-dashboard').style.display = 'flex';
    $('display-nome-usuario').innerText = state.user.nome;

    aplicarPermissoesUI();

    const isUser = (String(state.user?.perfil || '').toLowerCase() === 'usuario');
    if (isUser) {
        navegar('apontamento');
    } else {
        navegar('dashboard');
    }
}
