import { $ } from '../utils/dom.js';
import { money } from '../utils/format.js';
import { state } from '../state.js';
import { Backend } from '../services/backend.js';

// Helpers locais (evita dependência circular)
function _toDate(value) {
    if (!value) return null;
    if (typeof value === 'string' && value.length === 10) return new Date(value + 'T00:00:00');
    return new Date(value);
}
function safeDate(dateStr) {
    if (!dateStr) return "-";
    if (typeof dateStr === 'string' && dateStr.length === 10) return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');
    return new Date(dateStr).toLocaleDateString('pt-BR');
}
function _isFuncionarioAtivo(f) {
    if (!f || typeof f !== 'object') return false;

    if (typeof f.ativo === 'boolean') return f.ativo;
    if (typeof f.active === 'boolean') return f.active;
    if (typeof f.habilitado === 'boolean') return f.habilitado;

    const status = (f.status ?? f.situacao ?? f.estado ?? '').toString().trim().toUpperCase();
    if (status) {
        if (['ATIVO', 'ATIVA', 'SIM', 'TRUE', '1'].includes(status)) return true;
        if (['INATIVO', 'INATIVA', 'NAO', 'NÃO', 'FALSE', '0'].includes(status)) return false;
    }
    return true; // se não existir coluna, assume ativo
}
function _normId(v) {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (!s) return null;
    return (/^\d+$/.test(s)) ? Number(s) : s;
}


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


function exportarExcel() {
  try {
    if (!window.XLSX) {
      alert("Exportação para Excel não disponível (biblioteca XLSX não carregou). Verifique sua internet e recarregue a página.");
      return;
    }

    const tipo = $('#rel_tipo')?.value || 'todos';

    const sections = [
      { key: 'resumo', id: 'rel-sec-resumo', sheet: 'Resumo' },
      { key: 'financeiro', id: 'rel-sec-financeiro', sheet: 'Financeiro' },
      { key: 'notas', id: 'rel-sec-notas', sheet: 'NotasEntrada' },
      { key: 'estoque', id: 'rel-sec-estoque', sheet: 'BaixoEstoque' },
      { key: 'apontamento', id: 'rel-sec-apontamento', sheet: 'Apontamento' },
    ];

    const wb = window.XLSX.utils.book_new();

    function addSectionToWorkbook(sec) {
      const el = document.getElementById(sec.id);
      if (!el) return;
      const table = el.querySelector('table');
      if (!table) return;

      // Se a tabela estiver vazia (sem tbody ou sem linhas), ainda exporta cabeçalhos
      const ws = window.XLSX.utils.table_to_sheet(table, { raw: true });
      window.XLSX.utils.book_append_sheet(wb, ws, sec.sheet);
    }

    if (tipo === 'todos') {
      sections.forEach(addSectionToWorkbook);
      if (wb.SheetNames.length === 0) {
        alert("Não encontrei nenhuma tabela para exportar nesta tela.");
        return;
      }
      window.XLSX.writeFile(wb, `relatorios_${new Date().toISOString().slice(0,10)}.xlsx`);
      return;
    }

    const sec = sections.find(s => s.key === tipo);
    if (!sec) {
      alert("Tipo de relatório inválido para exportação.");
      return;
    }

    addSectionToWorkbook(sec);
    if (wb.SheetNames.length === 0) {
      alert("Não encontrei uma tabela para exportar neste relatório.");
      return;
    }

    window.XLSX.writeFile(wb, `relatorio_${sec.sheet.toLowerCase()}_${new Date().toISOString().slice(0,10)}.xlsx`);
  } catch (err) {
    console.error(err);
    alert("Erro ao exportar Excel: " + (err?.message || err));
  }
}

if (typeof window !== "undefined") {
  window.Relatorios = window.Relatorios || {};
  window.Relatorios.exportarExcel = exportarExcel;
}

export { prepararRelatorios, renderRelatorios, aplicarFiltroRelatorioTipo, prepararRelatorioApontamentoUI, carregarRelatorioApontamento, exportarExcel };
