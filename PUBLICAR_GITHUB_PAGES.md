# PUBLICAR NO GITHUB PAGES — R$ 0

1. Crie um repositório chamado `saldofamilia`.
2. Envie **o conteúdo desta pasta** para a raiz do repositório.
3. No GitHub, abra **Settings → Pages**.
4. Em **Build and deployment**, selecione **Deploy from a branch**.
5. Escolha a branch `main` e a pasta `/ (root)`.
6. Salve e aguarde o endereço HTTPS ser gerado.

Depois, copie esse endereço e abra o Supabase:
**Authentication → URL Configuration**.

Defina o endereço como:
- **Site URL**
- **Redirect URL**

Isso habilita corretamente confirmação de e-mail e recuperação de senha.

O arquivo `diagnostico.html` pode ser aberto no endereço publicado para verificar
manifest, Service Worker e recursos básicos do navegador.
