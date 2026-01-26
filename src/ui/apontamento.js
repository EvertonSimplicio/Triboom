import { $ } from '../utils/dom.js';
import { state } from '../state.js';
import { Backend } from '../services/backend.js';

let _apontamentoInit = false;
let _apontamentoAtual = null;
let _adminEditMode = false;

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

function _isoToHHMM(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function _getSelectedDateISO() {
  const inp = $('ap-man-data');
  const v = (inp?.value || '').trim();
  return v || _localDateISO();
}

function _isFutureDate(dateISO) {
  const today = _localDateISO();
  return String(dateISO) > String(today);
}

function _isFolgaObs(obs) {
  const s = (obs || '').toString().trim().toUpperCase();
  return s === 'FOLGA' || s.startsWith('FOLGA ') || s.startsWith('FOLGA-') || s.startsWith('[FOLGA]');
}

function _apIsEmpty(ap) {
  if (!ap) return true;
  const hasHora = !!(ap.entrada || ap.intervalo_inicio || ap.intervalo_fim || ap.saida);
  const hasObs = !!(ap.observacao && String(ap.observacao).trim());
  return !hasHora && !hasObs;
}

function _combineDateTimeISO(dateISO, hhmm) {
  if (!hhmm) return null;
  // Interpreta como horário LOCAL do navegador e converte para ISO (UTC) para salvar no timestamptz
  const d = new Date(`${dateISO}T${hhmm}:00`);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function _showManualUI(show) {
  const box = $('apontamento-manual');
  if (box) box.style.display = show ? 'flex' : 'none';

  // Botões antigos
  ['btnApEntrada', 'btnApIntIni', 'btnApIntFim', 'btnApSaida'].forEach(id => {
    const b = $(id);
    if (b) b.style.display = show ? 'none' : '';
  });
}

function _setApStatus(msg) {
  const el = $('apontamento-status');
  if (el) el.innerText = msg || '';
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

function _setBtnsDisabled(yes) {
  ['btnApEntrada', 'btnApIntIni', 'btnApIntFim', 'btnApSaida'].forEach(id => {
    const b = $(id);
    if (b) b.disabled = !!yes;
  });
}

export async function prepararApontamento() {
  // garante funcionários carregados
  if (!state.funcionarios || state.funcionarios.length === 0) {
    await Backend.getFuncionarios();
  }

  const sel = $('apontamento-funcionario');
  if (!sel) return;

  sel.innerHTML = '';
  // Funcionário: trava o select e mostra apenas o funcionário vinculado ao login
  if (isFuncionario) {
    sel.disabled = true;
  } else {
    sel.disabled = false;
  }

  const funcionariosAtivos = (state.funcionarios || []).filter(_isFuncionarioAtivo);

  if (!funcionariosAtivos.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.innerText = 'Nenhum funcionário ativo cadastrado';
    sel.appendChild(opt);
    sel.disabled = true;
    _setBtnsDisabled(true);
    _setApStatus('Cadastre funcionários na tela Funcionários.');
    return;
  }

  const perfil = String(state.user?.perfil || '').toLowerCase();
  const isAdmin = (perfil === 'admin' || perfil === 'administrador');
  const isFuncionario = (perfil === 'funcionario');
  const isUsuario = (perfil === 'usuario');

  // Controle de acesso:
  // - Admin: gerencia e pode corrigir horários
  // - Funcionário: só pode lançar/editar o próprio apontamento
  // - Usuário: somente visualização de relatórios (sem acesso ao apontamento)
  if (isUsuario) {
    const area = document.getElementById('conteudo');
    if (area) {
      area.innerHTML = `
        <div class="card">
          <div class="card-body">
            <h4>Acesso restrito</h4>
            <p>Seu perfil é <b>Usuário</b>. Você pode apenas visualizar relatórios.</p>
          </div>
        </div>`;
    }
    return;
  }

  const myFunc = state.user?.funcionario_id;

  if (isFuncionario) {
    // Funcionário: só pode lançar para si mesmo
    if (!myFunc) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.innerText = 'Usuário sem funcionário vinculado';
      sel.appendChild(opt);
      sel.disabled = true;
      _setBtnsDisabled(true);
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
      _setBtnsDisabled(true);
      _setApStatus('O funcionário vinculado está inativo (ou não existe). Peça ao Admin para ajustar.');
      return;
    }

    const opt = document.createElement('option');
    opt.value = f.id;
    opt.innerText = f.nome;
    sel.appendChild(opt);
    sel.value = f.id;
    sel.disabled = true;
    _setBtnsDisabled(false);
    _showManualUI(true);
  } else {
    // Admin: lista todos ativos
    funcionariosAtivos.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.innerText = f.nome;
      sel.appendChild(opt);
    });
    sel.disabled = false;
    _setBtnsDisabled(false);
    _showManualUI(_adminEditMode);
  }


  // Botão "Corrigir" (somente Admin) - ativa modo correção e libera edição manual
  const btnEditar = $('btnApEditar');
  if (btnEditar) {
    btnEditar.style.display = isAdmin ? '' : 'none';
    btnEditar.innerHTML = _adminEditMode
      ? '<span class="material-icons">close</span> Cancelar correção'
      : '<span class="material-icons">edit</span> Corrigir';
    btnEditar.onclick = async () => {
      _adminEditMode = !_adminEditMode;
      // Admin em modo correção usa a UI manual (data + horários)
      if (isAdmin) _showManualUI(_adminEditMode);
      btnEditar.innerHTML = _adminEditMode
        ? '<span class="material-icons">close</span> Cancelar correção'
        : '<span class="material-icons">edit</span> Corrigir';
      await carregarApontamentoDia();
    };
  }

  const dInp = $('ap-man-data');
  if (dInp) dInp.value = _localDateISO();
  $('apontamento-data').innerText = _getSelectedDateISO();

  if (!_apontamentoInit) {
    _apontamentoInit = true;

    sel.onchange = () => carregarApontamentoDia();
    $('btnApEntrada').onclick = () => acaoApontamento('entrada');
    $('btnApIntIni').onclick = () => acaoApontamento('intervalo_inicio');
    $('btnApIntFim').onclick = () => acaoApontamento('intervalo_fim');
    $('btnApSaida').onclick = () => acaoApontamento('saida');

    // Modo manual (funcionário preenche horários e salva ao informar Saída)
    const inpEntrada = $('ap-man-entrada');
    const inpIntIni = $('ap-man-int-ini');
    const inpIntFim = $('ap-man-int-fim');
    const inpSaida = $('ap-man-saida');
    const btnSalvar = $('btnApSalvarManual');

    const salvar = () => {
      const perfil = String(state.user?.perfil || '').toLowerCase();
      const isFuncionario = (perfil === 'funcionario');
      if (!isFuncionario && _adminEditMode) return salvarApontamentoAdminCorrecao();
      return salvarApontamentoManual();
    };
    if (btnSalvar) btnSalvar.onclick = salvar;
    if (inpSaida) inpSaida.onchange = () => {
      const perfil = String(state.user?.perfil || '').toLowerCase();
      const isFuncionario = (perfil === 'funcionario');
      if (isFuncionario) salvar();
    };

    const inpData = $('ap-man-data');
    const chkFolga = $('ap-man-folga');
    const toggleFolga = () => {
      const isFolga = !!chkFolga?.checked;
      ['ap-man-entrada','ap-man-int-ini','ap-man-int-fim','ap-man-saida'].forEach(id => {
        const el = $(id);
        if (el) el.disabled = isFolga;
      });
      if (isFolga) _setApStatus('Marquei como folga. Selecione a Data e clique em Salvar.');
    };
    if (inpData) inpData.onchange = () => carregarApontamentoDia();
    if (chkFolga) chkFolga.onchange = () => {
      // Não recarrega do backend ao marcar Folga, senão desfaz o check
      const isFolga = !!chkFolga.checked;
      if (isFolga) {
        ['ap-man-entrada','ap-man-int-ini','ap-man-int-fim','ap-man-saida'].forEach(id => {
          const el = $(id);
          if (el) el.value = '';
        });
      }
      toggleFolga();
    };
    toggleFolga();

  }

  await carregarApontamentoDia();
}

export async function carregarApontamentoDia() {
  const sel = $('apontamento-funcionario');
  const funcionarioId = _normId(sel?.value);
  if (!funcionarioId) return;

  const dataISO = _getSelectedDateISO();
  $('apontamento-data').innerText = dataISO;

  try {
    _setApStatus('Carregando...');
    const ap = await Backend.getApontamentoDia(funcionarioId, dataISO);
    _apontamentoAtual = ap;

    // Preenche inputs do modo manual (se existir)
    const inpData = $('ap-man-data');
    if (inpData) inpData.value = dataISO;
    const chkFolga = $('ap-man-folga');
    const isFolgaTmp = _isFolgaObs(ap?.observacao);
    if (chkFolga) chkFolga.checked = isFolgaTmp;
    // aplica estado de habilitar/desabilitar campos conforme Folga
    const _perfilTmp = String(state.user?.perfil || '').toLowerCase();
    const _isUserTmp = (_perfilTmp === 'usuario');
    const _isAdminTmp = !_isUserTmp;
    if (!(_isAdminTmp && _adminEditMode)) {
      const _isFolgaChecked = !!chkFolga?.checked;
      ['ap-man-entrada','ap-man-int-ini','ap-man-int-fim','ap-man-saida'].forEach(id => {
        const el = $(id);
        if (el) el.disabled = _isFolgaChecked;
      });
    }

    const inE = $('ap-man-entrada'); if (inE) inE.value = _isoToHHMM(ap?.entrada);
    const inII = $('ap-man-int-ini'); if (inII) inII.value = _isoToHHMM(ap?.intervalo_inicio);
    const inIF = $('ap-man-int-fim'); if (inIF) inIF.value = _isoToHHMM(ap?.intervalo_fim);
    const inS = $('ap-man-saida'); if (inS) inS.value = _isoToHHMM(ap?.saida);

    $('apontamento-hora-entrada').innerText = _fmtHora(ap?.entrada);
    $('apontamento-hora-int-ini').innerText = _fmtHora(ap?.intervalo_inicio);
    $('apontamento-hora-int-fim').innerText = _fmtHora(ap?.intervalo_fim);
    $('apontamento-hora-saida').innerText = _fmtHora(ap?.saida);

    
    const perfil = String(state.user?.perfil || '').toLowerCase();
    const isFuncionario = (perfil === 'funcionario');
    const btnSalvar = $('btnApSalvarManual');

    const isAdmin = !isFuncionario;
    // Admin em modo correção: libera edição e permite sobrescrever
    if (isAdmin && _adminEditMode) {
      if (btnSalvar) btnSalvar.disabled = false;
      ['ap-man-entrada','ap-man-int-ini','ap-man-int-fim','ap-man-saida'].forEach(id => {
        const el = $(id);
        if (el) el.disabled = false;
      });
    }


    const isFolga = _isFolgaObs(ap?.observacao);
    const empty = _apIsEmpty(ap);

    if (!(isAdmin && _adminEditMode)) {
    // data futura não permite lançar
    if (_isFutureDate(dataISO)) {
      _setApStatus('⚠️ Não é permitido lançar apontamento em data futura.');
      if (btnSalvar) btnSalvar.disabled = true;
    } else if (!ap || empty) {
      const msg = (dataISO === _localDateISO())
        ? 'Nenhum registro hoje. Preencha os horários e clique em Salvar (ou marque Folga).'
        : 'Nenhum registro nesta data. Preencha os horários e clique em Salvar (ou marque Folga).';
      _setApStatus(msg);
      if (btnSalvar) btnSalvar.disabled = false;
    } else if (isFolga) {
      _setApStatus('Folga registrada ✅');
      if (btnSalvar) btnSalvar.disabled = true;
    } else if (ap.saida) {
      _setApStatus('Turno finalizado ✅');
      if (btnSalvar) btnSalvar.disabled = true;
    } else {
      _setApStatus('Já existe lançamento nesta data. Para evitar duplicar, não vou sobrescrever.');
      if (btnSalvar) btnSalvar.disabled = true;
    }

    }

    if (isAdmin && _adminEditMode) {
      _setApStatus(ap ? '✏️ Modo correção: edite os horários e clique em Salvar.' : '✏️ Modo correção: preencha os horários e clique em Salvar.');
    }

    // Se for funcionário e a data já tem registro, trava edição
    if (isFuncionario && btnSalvar?.disabled) {
      ['ap-man-entrada','ap-man-int-ini','ap-man-int-fim','ap-man-saida'].forEach(id => {
        const el = $(id);
        if (el) el.disabled = true;
      });
    } else {
      // Se não estiver em folga, mantém inputs liberados
      const chkFolga = $('ap-man-folga');
      if (!chkFolga?.checked) {
        ['ap-man-entrada','ap-man-int-ini','ap-man-int-fim','ap-man-saida'].forEach(id => {
          const el = $(id);
          if (el) el.disabled = false;
        });
      }
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

async function acaoApontamento(acao) {
  const funcionarioId = _normId($('apontamento-funcionario')?.value);
  const obs = ($('apontamento-obs')?.value || '').trim();
  const dataISO = _getSelectedDateISO();
  if (!funcionarioId) return;

  try {
    _setApStatus('Salvando...');
    const agora = new Date().toISOString();

    // recarrega o dia para evitar conflito
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
        usuario_id: _normId(state.user?.id),
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

    // não duplica
    if (ap && ap[acao]) {
      _setApStatus('⚠️ Este lançamento já foi feito hoje.');
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
    _apontamentoAtual = atualizado;

    const label = {
      intervalo_inicio: 'Intervalo (início)',
      intervalo_fim: 'Intervalo (fim)',
      saida: 'Saída',
    }[acao] || acao;

    _setApStatus('✅ ' + label + ' registrado às ' + _fmtHora(agora));
    await carregarApontamentoDia();
  } catch (e) {
    console.error(e);
    _setApStatus('❌ Erro ao salvar: ' + (e?.message || ''));
  }
}



async function salvarApontamentoManual() {
  const funcionarioId = _normId($('apontamento-funcionario')?.value);
  const obs = ($('apontamento-obs')?.value || '').trim();
  const dataISO = _getSelectedDateISO();
  if (!funcionarioId) return;

  if (_isFutureDate(dataISO)) {
    _setApStatus('⚠️ Não é permitido lançar em data futura.');
    return;
  }

  const isFolga = !!$('ap-man-folga')?.checked;

  const eIn = $('ap-man-entrada')?.value || '';
  const iIni = $('ap-man-int-ini')?.value || '';
  const iFim = $('ap-man-int-fim')?.value || '';
  const sOut = $('ap-man-saida')?.value || '';

  try {
    // busca existente para evitar duplicidade
    const ap = await Backend.getApontamentoDia(funcionarioId, dataISO);

    // Folga: salva sem horários, apenas em data vazia
    if (isFolga) {
      if (ap && !_apIsEmpty(ap)) {
        _setApStatus('⚠️ Já existe lançamento nessa data. Para evitar duplicar, não vou sobrescrever.');
        await carregarApontamentoDia();
        return;
      }

      _setApStatus('Salvando folga...');
      const obsFolga = obs ? `FOLGA - ${obs}` : 'FOLGA';

      const payload = {
        funcionario_id: funcionarioId,
        data: dataISO,
        entrada: null,
        intervalo_inicio: null,
        intervalo_fim: null,
        saida: null,
        observacao: obsFolga,
        usuario_id: _normId(state.user?.id),
      };

      let salvo;
      if (!ap) salvo = await Backend.criarApontamento(payload);
      else salvo = await Backend.atualizarApontamento(ap.id, payload);

      _apontamentoAtual = salvo;
      _setApStatus('✅ Folga registrada.');
      await carregarApontamentoDia();
      return;
    }

    // só salva quando tiver saída (pedido do usuário)
    if (!sOut) {
      _setApStatus('Preencha a Saída para salvar o apontamento (ou marque Folga).');
      return;
    }

    const entradaISO = _combineDateTimeISO(dataISO, eIn);
    const intIniISO = _combineDateTimeISO(dataISO, iIni);
    const intFimISO = _combineDateTimeISO(dataISO, iFim);
    const saidaISO = _combineDateTimeISO(dataISO, sOut);

    if (!entradaISO) {
      _setApStatus('⚠️ Informe a Entrada (horário) antes de salvar.');
      return;
    }
    if (!saidaISO) {
      _setApStatus('⚠️ Horário de Saída inválido.');
      return;
    }

    // valida sequências básicas
    if (intIniISO && !intFimISO) {
      _setApStatus('⚠️ Se iniciou intervalo, informe também o fim do intervalo.');
      return;
    }
    if (intFimISO && !intIniISO) {
      _setApStatus('⚠️ Informe o início do intervalo antes do fim.');
      return;
    }

    // não sobrescrever lançamentos já feitos
    if (ap?.saida) {
      _setApStatus('⚠️ Já existe uma Saída registrada nessa data. Para ajustes, use o Admin/relatório.');
      await carregarApontamentoDia();
      return;
    }

    const camposJa = [];
    if (ap?.entrada) camposJa.push('Entrada');
    if (ap?.intervalo_inicio) camposJa.push('Intervalo (início)');
    if (ap?.intervalo_fim) camposJa.push('Intervalo (fim)');

    if (camposJa.length) {
      _setApStatus('⚠️ Já existe lançamento nessa data (' + camposJa.join(', ') + '). Para evitar duplicar, não vou sobrescrever.');
      await carregarApontamentoDia();
      return;
    }

    _setApStatus('Salvando...');

    const patchAll = {
      entrada: entradaISO,
      intervalo_inicio: intIniISO || null,
      intervalo_fim: intFimISO || null,
      saida: saidaISO,
      observacao: obs || null,
      usuario_id: _normId(state.user?.id),
    };

    let salvo;
    if (!ap) {
      const payload = { funcionario_id: funcionarioId, data: dataISO, ...patchAll };
      salvo = await Backend.criarApontamento(payload);
    } else {
      salvo = await Backend.atualizarApontamento(ap.id, patchAll);
    }

    _apontamentoAtual = salvo;
    _setApStatus('✅ Apontamento salvo. Total do dia será calculado no Relatório.');
    await carregarApontamentoDia();
  } catch (e) {
    console.error(e);
    _setApStatus('❌ Erro ao salvar: ' + (e?.message || ''));
  }
}


async function salvarApontamentoAdminCorrecao() {
  const funcionarioId = _normId($('apontamento-funcionario')?.value);
  const obsRaw = ($('apontamento-obs')?.value || '').trim();
  const dataISO = _getSelectedDateISO();
  if (!funcionarioId) return;

  if (_isFutureDate(dataISO)) {
    _setApStatus('⚠️ Não é permitido lançar/corrigir em data futura.');
    return;
  }

  const isFolga = !!$('ap-man-folga')?.checked;

  const eIn = $('ap-man-entrada')?.value || '';
  const iIni = $('ap-man-int-ini')?.value || '';
  const iFim = $('ap-man-int-fim')?.value || '';
  const sOut = $('ap-man-saida')?.value || '';

  try {
    _setApStatus('Salvando correção...');
    const ap = await Backend.getApontamentoDia(funcionarioId, dataISO);

    // Monta patch
    let patch = {
      usuario_id: _normId(state.user?.id),
    };

    if (isFolga) {
      const obsFolga = obsRaw ? `FOLGA - ${obsRaw}` : 'FOLGA';
      patch = {
        ...patch,
        entrada: null,
        intervalo_inicio: null,
        intervalo_fim: null,
        saida: null,
        observacao: obsFolga,
      };
    } else {
      // Converte horas
      const entradaISO = _combineDateTimeISO(dataISO, eIn);
      const intIniISO = _combineDateTimeISO(dataISO, iIni);
      const intFimISO = _combineDateTimeISO(dataISO, iFim);
      const saidaISO = _combineDateTimeISO(dataISO, sOut);

      // validações leves
      if (!entradaISO && !intIniISO && !intFimISO && !saidaISO && !obsRaw) {
        _setApStatus('⚠️ Informe pelo menos um horário (ou Obs.) para salvar a correção.');
        return;
      }
      if (intIniISO && !intFimISO) {
        _setApStatus('⚠️ Se iniciou intervalo, informe também o fim do intervalo.');
        return;
      }
      if (intFimISO && !intIniISO) {
        _setApStatus('⚠️ Informe o início do intervalo antes do fim.');
        return;
      }
      // se informou saída, exige entrada
      if (saidaISO && !entradaISO) {
        _setApStatus('⚠️ Para registrar Saída, informe também a Entrada.');
        return;
      }

      patch = {
        ...patch,
        entrada: entradaISO || null,
        intervalo_inicio: intIniISO || null,
        intervalo_fim: intFimISO || null,
        saida: saidaISO || null,
        observacao: obsRaw || null,
      };
    }

    let salvo;
    if (!ap) {
      const payload = { funcionario_id: funcionarioId, data: dataISO, ...patch };
      salvo = await Backend.criarApontamento(payload);
    } else {
      salvo = await Backend.atualizarApontamento(ap.id, patch);
    }

    _apontamentoAtual = salvo;
    _setApStatus('✅ Correção salva.');
    await carregarApontamentoDia();
  } catch (e) {
    console.error(e);
    _setApStatus('❌ Erro ao salvar correção: ' + (e?.message || ''));
  }
}
