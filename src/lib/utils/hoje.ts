// Que dia e hoje, no fuso de quem usa o sistema.
//
// O servidor roda em UTC. Sao Paulo e UTC-3, entao das 21h a meia-noite o
// servidor ja esta no dia seguinte — e tudo que depende de "hoje" erra junto:
// o tema de Story da tela Hoje pula para o dia seguinte, o planejador escreve
// "HOJE E DIA 31" no dia 30, e o aviso de fim de mes aparece um dia cedo.
//
// A janela errada e justamente a de trabalho dela: os posts saem 19h, 20h,
// 22h. Em desenvolvimento nada disso aparece, porque a maquina ja esta no fuso
// certo — e por isso o bug sobreviveu ate agora.

// Fixo, e nao lido do ambiente: o sistema e de uma pessoa so, no Brasil, e um
// fuso vindo de variavel seria mais uma coisa capaz de quebrar em silencio na
// producao sem quebrar aqui. Vira configuracao do workspace no dia em que
// houver alguem fora do pais.
export const FUSO = "America/Sao_Paulo";

// Devolve uma Date cujo ano, mes, dia e dia-da-semana sao os de Sao Paulo.
//
// O horario dela fica zerado de proposito: o valor serve para responder "que
// dia e hoje", e carregar uma hora que nao corresponde a nada convidaria a
// usar o objeto para comparar horarios, que e outra pergunta.
export function hojeNoFuso(agora: Date = new Date()): Date {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(agora);

  const num = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value ?? "0");
  return new Date(num("year"), num("month") - 1, num("day"));
}

// Em que DIA do calendario brasileiro caiu um instante qualquer, como
// "2026-09-30". Serve para agrupar: um Momento registrado as 22h e de hoje para
// ela, ainda que ja seja amanha em UTC.
export function diaNoFuso(quando: string | Date): string {
  const d = typeof quando === "string" ? new Date(quando) : quando;
  if (Number.isNaN(d.getTime())) return "";
  // en-CA formata como AAAA-MM-DD, que ja e a ordem que ordena certo.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// A hora do dia no fuso, para a saudacao. Separada porque e a unica coisa que
// precisa de hora, e mante-la fora de `hojeNoFuso` deixa aquela funcao com uma
// resposta so.
export function horaNoFuso(agora: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: FUSO, hour: "2-digit", hour12: false }).format(
      agora,
    ),
  );
}
