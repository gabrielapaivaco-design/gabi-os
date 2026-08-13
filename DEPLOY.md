# Publicar o Gabi OS na Vercel

## Antes de comecar

O deploy muda o modelo de risco do sistema. Duas coisas passam a valer:

1. **A URL e publica.** Quem tiver o link chega na tela de login. Os dados
   continuam protegidos pelo RLS (uma conta nunca ve o workspace de outra),
   mas a porta existe.
2. **A chave da Anthropic e uma so.** Ela pertence a quem publicou. Toda
   geracao de IA, de qualquer conta, sai desse credito. Por isso o cadastro
   nasce fechado em producao — ver `SIGNUP_ALLOWED_EMAILS` abaixo.

## Variaveis de ambiente na Vercel

Todas em **Project Settings > Environment Variables**, marcadas para
Production, Preview e Development.

| Variavel | Onde encontrar | Exposta ao navegador? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Settings > API | Sim (por design) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase > Settings > API | Sim (por design) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Settings > API | **Nao — nunca** |
| `ANTHROPIC_API_KEY` | console.anthropic.com | **Nao — nunca** |
| `SIGNUP_ALLOWED_EMAILS` | voce define | Nao |

As duas primeiras sao publicas de proposito: o navegador precisa delas para
falar com o Supabase, e quem protege os dados e o RLS, nao o segredo da chave.

As duas seguintes **nao podem** ganhar o prefixo `NEXT_PUBLIC_`. A service role
ignora RLS; a chave da Anthropic gasta dinheiro. Com o prefixo, ambas iriam
para dentro do JavaScript que qualquer visitante baixa.

`SIGNUP_ALLOWED_EMAILS` recebe os e-mails que podem criar conta, separados por
virgula. Sem ela, em producao ninguem se cadastra.

## Depois do primeiro deploy

No Supabase, em **Authentication > URL Configuration**:

- **Site URL**: a URL de producao da Vercel
- **Redirect URLs**: a mesma URL

Sem isso, a sessao pode nao persistir corretamente no dominio publicado.

## Verificar que subiu inteiro

1. Abrir a URL — deve cair em `/login`
2. Entrar com a conta existente
3. O seletor no topo da sidebar deve listar as marcas
4. Trocar de marca e conferir que os Momentos mudam junto
5. Em `/config`, o status da IA deve dizer `conectado`

## O que NAO muda com o deploy

O banco continua sendo o mesmo Supabase do localhost. Nao ha copia nem
migracao: o que voce criar publicado aparece no local e vice-versa.
