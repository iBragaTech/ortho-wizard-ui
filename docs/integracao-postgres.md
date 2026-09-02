# Integração com o Postgres do hospital

## Situação

O app publicado roda em um ambiente serverless na internet. Um Postgres
interno do hospital (rede privada, sem exposição pública) **não é alcançável
diretamente** por esse ambiente — e expor o banco na internet não é
recomendável em um sistema com dados de paciente.

## Arquitetura recomendada

```text
Navegador  ->  Portal (este app)  ->  API interna do hospital  ->  PostgreSQL
                                       (rede do hospital)
```

A API interna é um serviço HTTPS hospedado pelo hospital (Node/.NET/Java —
o que a TI já usa) que fala com o Postgres usando o schema em `db/schema.sql`.
O portal consome essa API por HTTPS com um token de serviço.

Alternativas válidas:
- **VPN / túnel** entre o provedor de hospedagem e a rede do hospital.
- **Hospedar o portal on-premise**, dentro da rede do hospital (build estático
  + servidor Node interno). Nesse caso o app pode falar direto com o Postgres.

## O que já está pronto no projeto

1. `db/schema.sql` — schema completo (pacientes, orçamentos, médicos,
   usuários, timeline, configurações). Basta rodar no banco do hospital.
2. `src/lib/data/repository.ts` — camada única de acesso a dados. Hoje ela
   devolve os dados fictícios; ao configurar a API interna, é o único arquivo
   que muda.

## Endpoints esperados da API interna

| Método | Rota                        | Descrição                        |
| ------ | --------------------------- | -------------------------------- |
| GET    | `/requests`                 | lista de orçamentos              |
| GET    | `/requests/:id`             | detalhe de um orçamento          |
| POST   | `/requests`                 | cria orçamento                   |
| PATCH  | `/requests/:id/medico`      | preenchimento do médico          |
| PATCH  | `/requests/:id/comercial`   | valor hospitalar                 |
| GET    | `/doctors` / `POST /doctors`| médicos                          |
| GET    | `/users` / `POST /users`    | usuários do portal               |
| GET/PUT| `/settings`                 | dados da instituição             |

## Configuração (quando a API existir)

Guardar como segredos do servidor (nunca no código):

- `HOSPITAL_API_URL` — ex.: `https://api.interna.hospital.local`
- `HOSPITAL_API_TOKEN` — token de serviço

Depois disso, trocar as implementações em `src/lib/data/repository.ts` pelas
chamadas HTTP correspondentes (as assinaturas já estão definidas).
