# SEGURANÇA — SALDOFamília v8

O SALDOFamília v8 foi projetado com segurança em várias camadas:

- Autenticação via Supabase Auth.
- Row Level Security (RLS) nas tabelas financeiras e familiares.
- Isolamento de dados por `family_id`.
- Funções de banco com checagem de usuário autenticado e permissões.
- Papéis de Administrador, Membro e Somente leitura.
- Chave administrativa não é incluída no frontend.
- Confirmações para ações destrutivas.
- Política CSP limitando origens de scripts/conexões.
- Cabeçalhos anti-frame, MIME sniffing e permissões de navegador restritas em hosts compatíveis.
- Senha mínima de 8 caracteres com letras e números no frontend.
- Centro de segurança dentro do aplicativo.

## Comunicação responsável
O produto pode ser apresentado como **“segurança reforçada”**, **“proteção avançada”** ou **“múltiplas camadas de segurança”**. Evite afirmar “100% seguro” ou “inviolável”, pois nenhum serviço conectado à internet pode garantir isso.
