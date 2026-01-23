import { getDb, upsertWithSchemaFallback } from './db.js';
import { state } from '../state.js';

const Backend = {
    async login(u, s) {
        const db = getDb();
        const userInput = (u ?? '').toString().trim();
        const passInput = (s ?? '').toString();

        if (!userInput || !passInput) return null;

        // 1) tenta por "usuario" (match exato)
        let resp = await db
            .from('usuarios')
            .select('*')
            .eq('usuario', userInput)
            .eq('senha', passInput)
            .limit(1)
            .maybeSingle();

        // 2) tenta por "usuario" (case-insensitive / parcial)
        if (!resp.data && !resp.error) {
            resp = await db
                .from('usuarios')
                .select('*')
                .ilike('usuario', `%${userInput}%`)
                .eq('senha', passInput)
                .limit(1)
                .maybeSingle();
        }

        // 3) fallback: tenta por "nome" (case-insensitive / parcial) caso o usuário digite o nome
        if (!resp.data && !resp.error) {
            resp = await db
                .from('usuarios')
                .select('*')
                .ilike('nome', `%${userInput}%`)
                .eq('senha', passInput)
                .limit(1)
                .maybeSingle();
        }

        const { data, error } = resp;

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
        const db = getDb();
        const { data } = await db.from('produtos').select('*').order('nome');
        state.produtos = data || [];
        return state.produtos;
    },
    async salvarProduto(p) {
        const db = getDb();
        const query = p.id ? db.from('produtos').update(p).eq('id', p.id) : db.from('produtos').insert([p]);
        const { error } = await query;
        if (error) throw error;
        return true;
    },
    async excluirProduto(id) {
        const db = getDb();
        const { error } = await db.from('produtos').delete().eq('id', id);
        if (error) throw error;
        return true;
    },
    async atualizarEstoqueBatch(itens) {
        const db = getDb();
        for (const item of itens) {
            const { error } = await db.from('produtos').update({ qtd: item.novaQtd }).eq('id', item.id);
            if (error) throw error;
        }
        return true;
    },
    async processarEntradaEstoque(itens) {
        const db = getDb();
        for (const item of itens) {
            const { data: existente } = await db.from('produtos').select('*').eq('codigo', item.codigo).maybeSingle();
            if (existente) {
                const novaQtd = Number(existente.qtd) + Number(item.qtd);
                await db.from('produtos').update({ qtd: novaQtd, preco: item.preco }).eq('id', existente.id);
            } else {
                await db.from('produtos').insert([{
                    codigo: item.codigo, nome: item.nome, grupo: 'Geral',
                    qtd: Number(item.qtd), preco: Number(item.preco)
                }]);
            }
        }
    },

    // --- FINANCEIRO ---
    async getFinanceiro() {
        const db = getDb();
        const { data } = await db.from('financeiro').select('*').order('data_vencimento', { ascending: false });
        state.financeiro = data || [];
        return state.financeiro;
    },
    async salvarFinanceiro(dados) {
        const db = getDb();
        const query = dados.id ? db.from('financeiro').update(dados).eq('id', dados.id) : db.from('financeiro').insert(dados);
        const { error } = await query;
        if (error) throw error;
        return true;
    },
    async salvarFinanceiroLote(listaDados) {
        const db = getDb();
        const { error } = await db.from('financeiro').insert(listaDados);
        if (error) throw error;
        return true;
    },
    async excluirFinanceiro(id) {
        const db = getDb();
        const { error } = await db.from('financeiro').delete().eq('id', id);
        if (error) throw error;
        return true;
    },
    async baixarLote(ids) {
        const db = getDb();
        const { error } = await db.from('financeiro').update({ status: 'Pago' }).in('id', ids);
        if (error) throw error;
        return true;
    },

    // --- NOTAS ---
    async getNotas() {
        const db = getDb();
        const { data, error } = await db.from('notas_entrada').select('*').order('data', { ascending: false });
        state.notas = data || [];
        return state.notas;
    },
    async salvarNota(nota) {
        const db = getDb();
        const query = nota.id ? db.from('notas_entrada').update(nota).eq('id', nota.id) : db.from('notas_entrada').insert([nota]);
        const { error } = await query;
        if (error) throw error;
        return true;
    },
    async excluirNota(id) {
        const db = getDb();
        const { error } = await db.from('notas_entrada').delete().eq('id', id);
        if (error) throw error;
        return true;
    },

    // --- USUARIOS ---
    async getUsuarios() {
        const db = getDb();
        const { data } = await db.from('usuarios').select('*');
        state.usuarios = data || [];
        return state.usuarios;
    },
    async salvarUsuario(u) {
        const db = getDb();
        const payload = { ...u };
        if (!payload.id) delete payload.id;

        const query = payload.id ? db.from('usuarios').update(payload).eq('id', payload.id) : db.from('usuarios').insert([payload]);
        const { error } = await query;
        if (error) throw error;
        return true;
    },
    async excluirUsuario(id) {
        const db = getDb();
        const { error } = await db.from('usuarios').delete().eq('id', id);
        if (error) throw error;
        return true;
    },

    // --- FUNCIONARIOS (COM FALLBACK AUTOMÁTICO DE COLUNAS) ---
    async getFuncionarios() {
        const db = getDb();
        const { data, error } = await db.from('funcionarios').select('*').order('nome');
        if (error) {
            console.error("Erro leitura funcionarios:", error);
            alert("Erro ao ler funcionários: " + error.message + " (Verifique se a tabela existe)");
            return [];
        }
        state.funcionarios = data || [];
        return state.funcionarios;
    },
    async salvarFuncionario(f) {
        const db = getDb();
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

        const { error } = await upsertWithSchemaFallback('funcionarios', payload, id, rules);
        if (error) throw error;
        return true;
    },
    async excluirFuncionario(id) {
        const db = getDb();
        const { error } = await db.from('funcionarios').delete().eq('id', id);
        if (error) throw error;
        return true;
    },

    // --- FORNECEDORES (COM FALLBACK AUTOMÁTICO DE COLUNAS) ---
    async getFornecedores() {
        const db = getDb();
        const { data, error } = await db.from('fornecedores').select('*').order('nome');
        if (error) {
            console.error("Erro leitura fornecedores:", error);
            alert("Erro ao ler fornecedores: " + error.message);
            return [];
        }
        state.fornecedores = data || [];
        return state.fornecedores;
    },
    async salvarFornecedor(f) {
        const db = getDb();
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

        const { error } = await upsertWithSchemaFallback('fornecedores', payload, id, rules);
        if (error) throw error;
        return true;
    },
    async excluirFornecedor(id) {
        const db = getDb();
        const { error } = await db.from('fornecedores').delete().eq('id', id);
        if (error) throw error;
        return true;
    },

    // --- GRUPOS ---
    async getGrupos() {
        const db = getDb();
        const { data } = await db.from('ajustes').select('config_json').limit(1).maybeSingle();
        state.grupos = data?.config_json?.grupos || [];
        return state.grupos;
    },
    async saveGrupos(grupos) {
        const db = getDb();
        const { data } = await db.from('ajustes').select('id').limit(1).maybeSingle();
        if (data) await db.from('ajustes').update({ config_json: { grupos } }).eq('id', data.id);
        else await db.from('ajustes').insert([{ config_json: { grupos } }]);
    },

    // --- APONTAMENTO (ENTRADA / INTERVALO / SAÍDA) ---
    async getApontamentoDia(funcionario_id, dataISO) {
        const db = getDb();
        // dataISO: 'YYYY-MM-DD'
        const { data, error } = await db
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
        const db = getDb();
        // de/ate: 'YYYY-MM-DD'
        let q = db
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
        const db = getDb();
        const { data, error } = await db
            .from('apontamentos')
            .insert([payload])
            .select('*')
            .single();
        if (error) throw error;
        return data;
    },
    async atualizarApontamento(id, patch) {
        const db = getDb();
        const { data, error } = await db
            .from('apontamentos')
            .update(patch)
            .eq('id', id)
            .select('*')
            .single();
        if (error) throw error;
        return data;
    }

};

export { Backend };

export async function trocarSenhaUsuario(usuarioId, senhaAtual, senhaNova) {
  const db = getDb();
  // Atualiza somente se a senha atual estiver correta (evita troca sem validação)
  const { data, error } = await db
    .from('usuarios')
    .update({ senha: senhaNova })
    .eq('id', usuarioId)
    .eq('senha', senhaAtual)
    .select();

  if (error) throw error;
  // Se não retornou linhas, a senha atual não conferiu
  return Array.isArray(data) && data.length > 0;
}
