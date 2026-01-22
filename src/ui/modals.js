import { $ } from '../utils/dom.js';
import { money, toast } from '../utils/format.js';
import { state } from '../state.js';
import { Backend } from '../services/backend.js';
import { navegar, updateGrupoSelects } from './navigation.js';

function closeModal(id) { $(id).style.display = 'none'; }

export function initModals() {
  window.onclick = (e) => { if (e.target.classList && e.target.classList.contains('modal')) e.target.style.display = 'none'; };
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
}

export { closeModal };
