# RELATÓRIO DE TESTES — SALDOFamília v7

Data: 29/08/2026

## Resultado geral

**Aprovado para publicação em ambiente de teste/beta**, com uma ressalva:
o teste final de cadastro/login real precisa ser executado no endereço HTTPS publicado,
porque confirmação e recuperação de e-mail dependem da URL pública configurada no Supabase.

## Testes executados

### Pacote e arquivos
- ZIP extraído corretamente.
- `index.html`, `styles.css`, `app.js`, `sw.js`, manifest, ícone, privacidade e termos presentes.
- Nenhum `id` HTML duplicado detectado.
- Nenhum asset local referenciado pelo HTML ficou ausente.
- Todos os assets locais do Service Worker existem.
- `manifest.webmanifest` é JSON válido.
- Manifest configurado como `display: standalone`.
- Ícone PWA encontrado.

### JavaScript
- `node --check app.js`: aprovado.
- `node --check sw.js`: aprovado.
- Nenhum erro de sintaxe detectado.

### Servidor local
- `index.html` respondeu HTTP 200 em servidor local.
- Conteúdo estático pode ser servido sem etapa de build.

### Contrato frontend ↔ Supabase
O frontend referencia as tabelas:
`accounts`, `bills`, `budgets`, `categories`, `credit_cards`, `families`,
`family_activity`, `family_members`, `goals`, `notifications`, `profiles`,
`recurring_rules`, `transactions`, `user_settings`.

O frontend referencia as RPCs:
`create_family_invite`, `create_my_family`, `delete_my_account`,
`ensure_user_settings`, `generate_recurring_due`, `get_family_members`,
`join_family_by_code`, `leave_current_family`, `log_family_activity`,
`post_bill_as_transaction`, `remove_family_member`, `seed_due_notifications`,
`transfer_family_ownership`, `update_family_member_role`.

As funções da v7 foram confirmadas no projeto Supabase.

### Banco e segurança
- RLS confirmado como ativo nas principais tabelas financeiras e familiares.
- Foram encontradas políticas de acesso configuradas no schema público.
- O endpoint de saúde do Auth respondeu 200 nos logs do Supabase.
- O backend está operacional.

## Fluxos que precisam de validação final após publicação HTTPS

1. Criar conta.
2. Confirmar e-mail, se a confirmação estiver habilitada.
3. Entrar e sair.
4. Recuperar senha.
5. Criar receita e despesa.
6. Criar conta e cartão.
7. Criar parcela.
8. Criar e liquidar compromisso.
9. Criar recorrência e processá-la.
10. Criar orçamento.
11. Criar meta.
12. Gerar convite familiar.
13. Entrar com segunda conta.
14. Trocar membro para somente leitura.
15. Transferir administração.
16. Exportar JSON e CSV.
17. Testar instalação como PWA no Android.
18. Testar offline depois do primeiro carregamento.

## Publicação gratuita

O pacote inclui `.nojekyll` e não exige build. Pode ser colocado diretamente no GitHub Pages.

Após obter a URL pública, configure no Supabase:
- Authentication → URL Configuration → Site URL
- Authentication → URL Configuration → Redirect URLs

Use a URL HTTPS publicada.
