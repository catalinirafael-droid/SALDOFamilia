# Publicar por R$ 0

## Opção 1 — Cloudflare Pages
1. Crie uma conta gratuita no Cloudflare.
2. Abra Workers & Pages > Create > Pages.
3. Escolha upload direto ou conecte um repositório GitHub.
4. Se usar upload direto, envie o conteúdo desta pasta.
5. Não há comando de build: o SALDOFamília v5 é estático.
6. O site receberá um endereço `*.pages.dev` e HTTPS gratuito.

## Opção 2 — GitHub Pages
1. Crie um repositório público no GitHub.
2. Envie os arquivos desta pasta para a raiz do repositório.
3. Settings > Pages > Deploy from a branch.
4. Escolha a branch principal e a pasta `/root`.

## Supabase Auth
Depois de publicar, no painel do Supabase configure em Authentication > URL Configuration:
- Site URL: endereço público do app
- Redirect URLs: inclua o endereço público do app

Isso é necessário principalmente para confirmação de e-mail e recuperação de senha.

## Custo
O projeto foi desenhado para funcionar dentro das camadas gratuitas dos serviços enquanto não ultrapassar seus limites.


## v6
A v6 continua sem build obrigatório. Envie os arquivos estáticos diretamente para Cloudflare Pages ou GitHub Pages.
