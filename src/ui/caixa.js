import { Backend } from '../services/backend.js';
// state.js exporta  (minúsculo). Aqui usamos um alias para manter o restante do código.
import { state as State } from '../state.js';
import { money, localDateISO } from '../utils/format.js';

let _iniciado = false;

const TAG_CAIXA = '[CAIXA]';

function _el(id) {
  return document.getElementById(id);
}

function _getLojasSalvas() {
  try {
    const raw = localStorage.getItem('triboom_caixa_lojas');
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function _saveLoja(nome) {
  const loja = (nome || '').trim();
  if (!loja) return;
  const atual = _getLojasSalvas();
  const novo = [loja, ...atual.filter((x) => (x || '').trim().toLowerCase() !== loja.toLowerCase())].slice(0, 20);
  localStorage.setItem('triboom_caixa_lojas', JSON.stringify(novo));
}

function _renderLojaDatalist() {
  const dl = _el('caixa-lojas');
  if (!dl) return;
  const lojas = _getLojasSalvas();
  dl.innerHTML = lojas.map((l) => `<option value="${String(l).replaceAll('"', '&quot;')}"></option>`).join('');
}

function _parseValorBR(str) {
  // Aceita: 1234,56 | 1.234,56 | 1234.56
  const s = String(str || '').trim();
  if (!s) return NaN;
  const normal = s
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const n = Number(normal);
  return Number.isFinite(n) ? n : NaN;
}

function _isoToBR(iso) {
  // yyyy-mm-dd -> dd/mm/yyyy
  const v = String(iso || '');
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return v;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function _moneyCell(v) {
  return `<span class="money">${money(v)}</span>`;
}

function _atualizarModoLoteUI() {
  const chk = _el('caixa-modo-lote');
  const isLote = !!chk?.checked;
  const boxLote = _el('caixa-lote-box');
  const singles = document.querySelectorAll('.caixa-single');

  if (boxLote) boxLote.style.display = isLote ? 'grid' : 'none';
  singles.forEach((el) => {
    el.style.display = isLote ? 'none' : '';
  });
}

async function _carregarLista() {
  const data = _el('caixa-data')?.value || localDateISO();
  const loja = (_el('caixa-loja')?.value || '').trim();

  const tbody = _el('tabela-caixa-corpo');
  const lblEntradas = _el('caixa-total-entradas');
  const lblSaidas = _el('caixa-total-saidas');
  const lblSaldo = _el('caixa-total-saldo');

  if (tbody) tbody.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';

  try {
    const todos = await Backend.listarFinanceiro();
    const lista = (todos || [])
      .filter((r) => {
        const d = (r.data_vencimento || r.data || '').slice(0, 10);
        if (d !== data) return false;
        const desc = String(r.descricao || '');
        if (!desc.includes(TAG_CAIXA)) return false;
        if (!loja) return true;
        return String(r.fornecedor || '').trim().toLowerCase() === loja.toLowerCase();
      })
      .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));

    let totalEntradas = 0;
    let totalSaidas = 0;

    const rows = lista.map((r) => {
      const tipo = String(r.tipo || '').toUpperCase();
      const valor = Number(r.valor || 0);
      if (tipo === 'RECEITA') totalEntradas += valor;
      else totalSaidas += valor;

      const status = r.status ? String(r.status) : '';
      const desc = String(r.descricao || '').replace(TAG_CAIXA, '').trim();

      return `
        <tr>
          <td>${_isoToBR((r.data_vencimento || '').slice(0, 10))}</td>
          <td>${r.fornecedor || ''}</td>
          <td>${tipo === 'RECEITA' ? 'Entrada' : 'Saída'}</td>
          <td>${desc}</td>
          <td>${_moneyCell(valor)}</td>
          <td>
            <button class="btn btn-sm btn-danger" data-id="${r.id}" title="Excluir">Excluir</button>
          </td>
        </tr>
      `;
    }).join('');

    if (tbody) {
      tbody.innerHTML = rows || '<tr><td colspan="6">Nenhum lançamento.</td></tr>';
      tbody.querySelectorAll('button[data-id]')?.forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          if (!id) return;
          if (!confirm('Excluir este lançamento de caixa?')) return;
          await Backend.excluirFinanceiro(id);
          await _carregarLista();
        });
      });
    }

    if (lblEntradas) lblEntradas.textContent = money(totalEntradas);
    if (lblSaidas) lblSaidas.textContent = money(totalSaidas);
    if (lblSaldo) lblSaldo.textContent = money(totalEntradas - totalSaidas);
  } catch (err) {
    console.error(err);
    if (tbody) tbody.innerHTML = '<tr><td colspan="6">Erro ao carregar lançamentos.</td></tr>';
  }
}

async function _salvarLancamento() {
  const data = _el('caixa-data')?.value || localDateISO();
  const loja = (_el('caixa-loja')?.value || '').trim();

  const isLote = !!_el('caixa-modo-lote')?.checked;

  if (!loja) return alert('Informe a sorveteria do caixa.');

  const user = State.getCurrentUser();
  const usuario = user?.login || user?.nome || '';

  const btn = _el('btn-caixa-salvar');
  if (btn) btn.disabled = true;
  try {
    _saveLoja(loja);
    _renderLojaDatalist();

    if (isLote) {
      const obs = (_el('caixa-lote-obs')?.value || '').trim();
      const valores = [
        { forma: 'Cartão Crédito', v: _parseValorBR(_el('caixa-lote-credito')?.value) },
        { forma: 'Cartão Débito', v: _parseValorBR(_el('caixa-lote-debito')?.value) },
        { forma: 'Pix', v: _parseValorBR(_el('caixa-lote-pix')?.value) },
        { forma: 'Dinheiro', v: _parseValorBR(_el('caixa-lote-dinheiro')?.value) },
      ].filter((x) => Number.isFinite(x.v) && x.v > 0);

      if (valores.length === 0) {
        return alert('Preencha pelo menos um valor (crédito, débito, pix ou dinheiro).');
      }

      for (const item of valores) {
        const registro = {
          data_emissao: data,
          data_vencimento: data,
          fornecedor: loja,
          descricao: `${TAG_CAIXA} (${item.forma}) ${obs || 'Vendas do dia'}`,
          tipo: 'Receita',
          valor: item.v,
          status: 'Pago',
          usuario,
        };
        await Backend.salvarFinanceiro(registro);
      }

      // limpa campos do lote
      ['caixa-lote-credito', 'caixa-lote-debito', 'caixa-lote-pix', 'caixa-lote-dinheiro', 'caixa-lote-obs'].forEach((id) => {
        const el = _el(id);
        if (el) el.value = '';
      });
    } else {
      const tipo = (_el('caixa-tipo')?.value || 'ENTRADA').toUpperCase();
      const forma = (_el('caixa-forma')?.value || 'Dinheiro').trim();
      const descUser = (_el('caixa-descricao')?.value || '').trim();
      const valorStr = _el('caixa-valor')?.value;
      const valor = _parseValorBR(valorStr);

      if (!descUser) return alert('Informe uma descrição.');
      if (!Number.isFinite(valor) || valor <= 0) return alert('Informe um valor válido.');

      const registro = {
        data_emissao: data,
        data_vencimento: data,
        fornecedor: loja,
        descricao: `${TAG_CAIXA} (${forma}) ${descUser}`,
        tipo: tipo === 'ENTRADA' ? 'Receita' : 'Despesa',
        valor,
        status: 'Pago',
        usuario,
      };

      await Backend.salvarFinanceiro(registro);
      _el('caixa-descricao').value = '';
      _el('caixa-valor').value = '';
    }

    await _carregarLista();
    alert('Caixa salvo!');
  } catch (err) {
    console.error(err);
    alert(`Erro ao salvar lançamento: ${err?.message || err}`);
  } finally {
    if (btn) btn.disabled = false;
  }
}

export function prepararCaixa() {
  if (_iniciado) return;
  _iniciado = true;

  // Defaults
  const inpData = _el('caixa-data');
  if (inpData && !inpData.value) inpData.value = localDateISO();

  _renderLojaDatalist();

  _el('caixa-modo-lote')?.addEventListener('change', _atualizarModoLoteUI);
  _atualizarModoLoteUI();

  _el('btn-caixa-salvar')?.addEventListener('click', _salvarLancamento);
  _el('btn-caixa-atualizar')?.addEventListener('click', _carregarLista);
  _el('caixa-loja')?.addEventListener('change', _carregarLista);
  _el('caixa-data')?.addEventListener('change', _carregarLista);
}

export async function renderCaixa() {
  const inpData = _el('caixa-data');
  if (inpData && !inpData.value) inpData.value = localDateISO();
  _renderLojaDatalist();
  await _carregarLista();
}

// Para debug / uso via console
window.Caixa = { prepararCaixa, renderCaixa };
