# Sistema Web Triboom (Modularizado)

Este pacote mantém o mesmo HTML/CSS e separa o JavaScript por módulos (frontend/ui e backend/services).

## Estrutura
- `src/services/` = camada de dados (Supabase) — "backend" do app no navegador
- `src/ui/` = telas/ações (apontamento, relatórios, navegação, modais)
- `src/utils/` = helpers
- `src/state.js` = estado global
- `src/main.js` = bootstrap (login, menu, permissões)

## Rodar local
Como é um app estático, use um servidor simples (para módulos funcionarem):
```bash
python -m http.server 8000
```
Abra: http://localhost:8000/Web-App-Triboom-modulos (ou ajuste conforme seu caminho)

## GitHub Pages
Publique a pasta do projeto. Módulos funcionam normal.

Obs.: as chaves Supabase estão em `src/config.js`.
