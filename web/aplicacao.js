// ---------------------------------------------------------------------------
// Interface da Torre de Hanoi.
//
// Este arquivo NAO implementa busca nenhuma. Ele so pede os resultados ao
// servidor Python (que chama a funcao unica de busca em hanoi.py), preenche a
// tabela de metricas e anima o caminho de estados devolvido.
// ---------------------------------------------------------------------------

const NOMES_DOS_PINOS = ["A", "B", "C"];

// Estado da tela.
const aplicacao = {
  discos: 3,
  resposta: null,        // resposta completa do servidor
  solucao: null,         // resultado do algoritmo escolhido para animar
  indiceDoPasso: 0,      // qual estado do caminho esta na tela
  tocando: false,
  temporizador: null
};

// Atalhos para os elementos da pagina.
const campoDiscos = document.getElementById("campo-discos");
const campoLimite = document.getElementById("campo-limite");
const campoVelocidade = document.getElementById("campo-velocidade");
const campoPasso = document.getElementById("campo-passo");
const botaoExecutar = document.getElementById("botao-executar");
const botaoInicio = document.getElementById("botao-inicio");
const botaoAnterior = document.getElementById("botao-anterior");
const botaoTocar = document.getElementById("botao-tocar");
const botaoProximo = document.getElementById("botao-proximo");
const corpoDaTabela = document.getElementById("corpo-da-tabela");
const avisoOtimo = document.getElementById("aviso-otimo");
const avisoStatus = document.getElementById("aviso-status");
const legendaJogada = document.getElementById("legenda-jogada");
const tabuleiro = document.getElementById("tabuleiro");

// ---------------------------------------------------------------------------
// Comunicacao com o servidor
// ---------------------------------------------------------------------------

async function executarBuscas() {
  const discos = Number(campoDiscos.value);
  const limite = Number(campoLimite.value);

  pararAnimacao();
  botaoExecutar.disabled = true;
  avisoStatus.className = "aviso trabalhando";
  avisoStatus.textContent =
    "Executando UCS, Gulosa e A* com " + discos + " discos. " +
    "Com muitos discos a UCS pode demorar; aguarde ate o limite de " + limite + " s.";

  try {
    const endereco = "/api/buscar?discos=" + discos + "&limite=" + limite;
    const resposta = await fetch(endereco);
    const dados = await resposta.json();

    if (dados.erro) {
      avisoStatus.className = "aviso erro";
      avisoStatus.textContent = "Erro: " + dados.erro;
      return;
    }

    aplicacao.discos = dados.discos;
    aplicacao.resposta = dados;

    avisoOtimo.innerHTML =
      "Solucao otima conhecida por formula: 2<sup>" + dados.discos + "</sup> &minus; 1 = " +
      dados.otimo + " movimentos.";

    preencherTabela(dados);

    // Escolhe automaticamente a primeira solucao concluida para animar.
    const primeiraConcluida = dados.resultados.find(function (linha) {
      return linha.concluiu;
    });

    if (primeiraConcluida) {
      selecionarSolucao(primeiraConcluida.algoritmo);
      avisoStatus.className = "aviso";
      avisoStatus.textContent = "Buscas concluidas.";
    } else {
      avisoStatus.className = "aviso erro";
      avisoStatus.textContent = "Nenhuma busca concluiu dentro do limite de tempo.";
      desenharTabuleiroVazio(dados.discos);
    }
  } catch (erro) {
    avisoStatus.className = "aviso erro";
    avisoStatus.textContent = "Falha ao falar com o servidor: " + erro.message;
  } finally {
    botaoExecutar.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Tabela de resultados
// ---------------------------------------------------------------------------

function preencherTabela(dados) {
  corpoDaTabela.innerHTML = "";

  // Menor numero de nos expandidos entre as buscas que concluiram.
  const concluidas = dados.resultados.filter(function (linha) { return linha.concluiu; });
  const menorExpandidos = concluidas.length
    ? Math.min.apply(null, concluidas.map(function (linha) { return linha.expandidos; }))
    : null;

  dados.resultados.forEach(function (linha) {
    const tr = document.createElement("tr");
    tr.dataset.algoritmo = linha.algoritmo;

    const custo = linha.concluiu ? String(linha.custo) : "-";
    const passos = linha.concluiu ? String(linha.passos) : "-";
    const tempo = linha.concluiu
      ? linha.tempo.toFixed(4)
      : "<span class='nao-concluiu'>nao concluiu em " + dados.limite + "s</span>";

    // Marca se a solucao bateu com o otimo conhecido (2^n - 1) ou ficou pior.
    let marcaDoCusto = "";
    if (linha.concluiu && linha.custo === dados.otimo) {
      marcaDoCusto = "<span class='marca-otimo'>otimo</span>";
    } else if (linha.concluiu) {
      const excesso = linha.custo - dados.otimo;
      marcaDoCusto = "<span class='marca-pior'>+" + excesso + "</span>";
    }

    const marcaExpandidos =
      linha.concluiu && linha.expandidos === menorExpandidos
        ? "<span class='marca-otimo'>menor</span>"
        : "";

    const botao = linha.concluiu
      ? "<button class='botao' data-animar='" + linha.algoritmo + "'>Animar</button>"
      : "-";

    tr.innerHTML =
      "<td>" + linha.algoritmo + "</td>" +
      "<td>" + linha.heuristica + "</td>" +
      "<td>" + custo + marcaDoCusto + "</td>" +
      "<td>" + passos + "</td>" +
      "<td>" + linha.expandidos + marcaExpandidos + "</td>" +
      "<td>" + tempo + "</td>" +
      "<td>" + botao + "</td>";

    corpoDaTabela.appendChild(tr);
  });
}

function selecionarSolucao(nomeDoAlgoritmo) {
  const linha = aplicacao.resposta.resultados.find(function (item) {
    return item.algoritmo === nomeDoAlgoritmo && item.concluiu;
  });

  if (!linha) {
    return;
  }

  pararAnimacao();

  aplicacao.solucao = linha;
  aplicacao.indiceDoPasso = 0;

  campoPasso.max = String(linha.caminho.length - 1);
  campoPasso.value = "0";

  // Destaca a linha escolhida na tabela.
  Array.prototype.forEach.call(corpoDaTabela.children, function (tr) {
    tr.classList.toggle("selecionada", tr.dataset.algoritmo === nomeDoAlgoritmo);
  });

  desenharPasso();
}

// ---------------------------------------------------------------------------
// Desenho do tabuleiro
// ---------------------------------------------------------------------------

function larguraDoDisco(disco, totalDeDiscos) {
  // O menor disco (indice 0) fica estreito e cresce conforme o indice.
  const minima = 34;
  const maxima = 96;
  const fatia = totalDeDiscos > 1 ? (maxima - minima) / (totalDeDiscos - 1) : 0;
  return minima + fatia * disco;
}

function corDoDisco(disco, totalDeDiscos) {
  const matiz = Math.round((360 / Math.max(totalDeDiscos, 1)) * disco);
  return "hsl(" + matiz + ", 72%, 62%)";
}

function desenharTabuleiroVazio(totalDeDiscos) {
  desenharEstado(new Array(totalDeDiscos).fill(0), null);
}

function desenharEstado(estado, discoMovido) {
  const totalDeDiscos = estado.length;
  tabuleiro.innerHTML = "";

  for (let pino = 0; pino < 3; pino++) {
    const divPino = document.createElement("div");
    divPino.className = "pino";

    const pilha = document.createElement("div");
    pilha.className = "pilha";

    // Discos daquele pino, ordenados do menor para o maior.
    // A .pilha e um flex column, entao o primeiro elemento inserido aparece
    // no ALTO. Por isso o menor disco vai primeiro e o maior fica na base.
    const discosDoPino = [];
    for (let disco = 0; disco < totalDeDiscos; disco++) {
      if (estado[disco] === pino) {
        discosDoPino.push(disco);
      }
    }
    discosDoPino.sort(function (a, b) { return a - b; });

    discosDoPino.forEach(function (disco) {
      const divDisco = document.createElement("div");
      divDisco.className = "disco" + (disco === discoMovido ? " movido" : "");
      divDisco.style.width = larguraDoDisco(disco, totalDeDiscos) + "%";
      divDisco.style.background = corDoDisco(disco, totalDeDiscos);
      divDisco.textContent = String(disco + 1);
      pilha.appendChild(divDisco);
    });

    const rotulo = document.createElement("span");
    rotulo.className = "rotulo-do-pino";
    rotulo.textContent = NOMES_DOS_PINOS[pino];

    divPino.appendChild(pilha);
    divPino.appendChild(rotulo);
    tabuleiro.appendChild(divPino);
  }
}

function desenharPasso() {
  if (!aplicacao.solucao) {
    return;
  }

  const indice = aplicacao.indiceDoPasso;
  const estado = aplicacao.solucao.caminho[indice];

  // A acao de indice i leva do estado i para o estado i+1.
  const discoMovido = indice > 0 ? aplicacao.solucao.acoes[indice - 1][0] : null;

  desenharEstado(estado, discoMovido);
  campoPasso.value = String(indice);

  const total = aplicacao.solucao.caminho.length - 1;

  if (indice === 0) {
    legendaJogada.textContent =
      aplicacao.solucao.algoritmo + " - estado inicial (0 de " + total + " jogadas).";
  } else {
    legendaJogada.textContent =
      aplicacao.solucao.algoritmo + " - jogada " + indice + " de " + total + ": " +
      aplicacao.solucao.descricoes[indice - 1] + ".";
  }
}

// ---------------------------------------------------------------------------
// Controles da animacao
// ---------------------------------------------------------------------------

function irParaPasso(indice) {
  if (!aplicacao.solucao) {
    return;
  }

  const ultimo = aplicacao.solucao.caminho.length - 1;
  aplicacao.indiceDoPasso = Math.max(0, Math.min(indice, ultimo));
  desenharPasso();
}

function tocarOuPausar() {
  if (!aplicacao.solucao) {
    return;
  }

  if (aplicacao.tocando) {
    pararAnimacao();
    return;
  }

  // Se estiver no fim, recomeca do inicio.
  if (aplicacao.indiceDoPasso >= aplicacao.solucao.caminho.length - 1) {
    aplicacao.indiceDoPasso = 0;
    desenharPasso();
  }

  aplicacao.tocando = true;
  botaoTocar.innerHTML = "&#10073;&#10073; Pausar";

  const intervalo = Math.max(60, Number(campoVelocidade.value) || 450);

  aplicacao.temporizador = setInterval(function () {
    if (aplicacao.indiceDoPasso >= aplicacao.solucao.caminho.length - 1) {
      pararAnimacao();
      return;
    }

    aplicacao.indiceDoPasso += 1;
    desenharPasso();
  }, intervalo);
}

function pararAnimacao() {
  if (aplicacao.temporizador !== null) {
    clearInterval(aplicacao.temporizador);
    aplicacao.temporizador = null;
  }

  aplicacao.tocando = false;
  botaoTocar.innerHTML = "&#9654; Tocar";
}

// ---------------------------------------------------------------------------
// Ligacao dos eventos
// ---------------------------------------------------------------------------

botaoExecutar.addEventListener("click", executarBuscas);
botaoInicio.addEventListener("click", function () { pararAnimacao(); irParaPasso(0); });
botaoAnterior.addEventListener("click", function () { pararAnimacao(); irParaPasso(aplicacao.indiceDoPasso - 1); });
botaoProximo.addEventListener("click", function () { pararAnimacao(); irParaPasso(aplicacao.indiceDoPasso + 1); });
botaoTocar.addEventListener("click", tocarOuPausar);

campoPasso.addEventListener("input", function () {
  pararAnimacao();
  irParaPasso(Number(campoPasso.value));
});

// Clique no botao "Animar" de qualquer linha da tabela.
corpoDaTabela.addEventListener("click", function (evento) {
  const alvo = evento.target;
  if (alvo && alvo.dataset && alvo.dataset.animar) {
    selecionarSolucao(alvo.dataset.animar);
  }
});

// Desenha a torre inicial assim que a pagina abre.
desenharTabuleiroVazio(Number(campoDiscos.value));

campoDiscos.addEventListener("change", function () {
  pararAnimacao();
  aplicacao.solucao = null;
  legendaJogada.textContent = "Execute uma busca e escolha um algoritmo na tabela.";
  desenharTabuleiroVazio(Number(campoDiscos.value));
});
